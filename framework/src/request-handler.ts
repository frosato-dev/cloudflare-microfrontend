import { createSSRApp, h, version as vueVersion } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { Component } from 'vue';
import { matchRoute } from './router.js';
import { runMiddleware } from './middleware.js';
import type {
  AssetManifest,
  FragmentAssets,
  FragmentFetcher,
  FragmentResponse,
  Middleware,
  RouteEntry,
} from './types.js';
import type { FragmentMeta } from './debug/index.js';
import { getDebugBarScript } from './debug/index.js';

export interface HandleRequestConfig {
  routes: RouteEntry[];
  middlewareRegistry: Record<string, Middleware>;
  layouts: Record<string, Component>;
  document: { title: string; baseStyles?: string; viewTransitions?: boolean };
  manifest?: AssetManifest;
  /** Latest assets seen per fragment (isolate memory) — best-effort <head> preloads; stale = one wasted preload */
  knownAssets?: Map<string, FragmentAssets>;
  /** Called when a fragment failed/timed out — caller must not cache this page */
  onFragmentError?: (fragmentId: string, error: string) => void;
  debug?: { getMeta: () => Map<string, FragmentMeta>; setShellEnd: (ms: number) => void; setTotalEnd: (ms: number) => void };
}

interface ExtractedFragment {
  id: string;
  props: Record<string, string>;
}

type HtmlSegment =
  | { type: 'static'; html: string }
  | { type: 'fragment'; id: string; openTag: string };

const defaultBaseStyles = `* { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a2e; }`;

export async function handleRequest(
  request: Request,
  fetchFragment: FragmentFetcher,
  config: HandleRequestConfig,
): Promise<Response> {
  const url = new URL(request.url);
  const route = matchRoute(config.routes, url.pathname);

  if (!route) {
    return new Response('Not Found', { status: 404 });
  }

  const middlewareResponse = await runMiddleware(config.middlewareRegistry, route.middleware, request);
  if (middlewareResponse) return middlewareResponse;

  const Layout = config.layouts[route.layout];
  if (!Layout) {
    return new Response(`Layout "${route.layout}" not found`, { status: 500 });
  }

  // 1. Build shell-only tags (always known, no SSR needed)
  const { headLinks: shellLinks, scripts: shellScripts, linkHeaders } = buildShellTags(config.manifest);

  const baseStyles = config.document.baseStyles || defaultBaseStyles;
  const viewTransitionStyle = config.document.viewTransitions
    ? `\n  <style>@view-transition { navigation: auto; }
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
  animation-timing-function: ease-in-out;
}</style>`
    : '';

  // 2. Start streaming — flush shell assets in <head> immediately
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    try {
      // Phase 1: flush shell assets — browser starts fetching vue.js, shell.js, shell.css NOW
      await writer.write(encoder.encode(
        `<!DOCTYPE html>\n<html lang="en">\n<head>\n` +
        `  <meta charset="UTF-8" />\n` +
        `  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n` +
        `  <title>${config.document.title}</title>\n` +
        `  <style>${baseStyles}</style>${viewTransitionStyle}\n` +
        `  ${shellLinks}\n` +
        `  ${shellScripts}\n` +
        buildPreconnectTags(url.origin, config.knownAssets),
      ));

      // 3. Resolve lazy component + SSR render (browser already fetching shell assets)
      const comp = typeof route.component === 'function' && !(route.component as any).__vccOpts
        ? (await (route.component as () => Promise<{ default: Component }>)()).default
        : route.component as Component;
      const app = createSSRApp({
        render: () => h(Layout, null, { default: () => h(comp, route.props) }),
      });
      const appHtml = await renderToString(app);

      // 4. Extract fragments, fire all fetches in parallel
      const fragments = extractFragments(appHtml);
      const fragmentIds = fragments.map((f) => f.id);

      if (config.debug) {
        config.debug.setShellEnd(Date.now());
      }

      const fragmentPromises: Record<string, Promise<FragmentResponse>> = Object.fromEntries(
        fragments.map((f) => [
          f.id,
          fetchFragment(f.id, request, { ...route.props, ...f.props }),
        ]),
      );

      // Phase 2: preload known fragment assets + close </head>
      // (authoritative CSS links ship inside each fragment's HTML via fragmentRoot)
      await writer.write(encoder.encode(
        buildFragmentPreloadTags(fragmentIds, config.knownAssets) +
        `</head>\n<body>\n  <div id="app">`,
      ));

      // 5. Stream body: static parts flush immediately, fragments await in doc order
      // Collect fragment scripts to emit OUTSIDE #app (avoids hydration mismatch)
      const fragScripts: string[] = [];
      const segments = splitAtFragments(appHtml);
      for (const seg of segments) {
        if (seg.type === 'static') {
          await writer.write(encoder.encode(seg.html));
        } else {
          const result = await fragmentPromises[seg.id];
          if (result.assets) config.knownAssets?.set(seg.id, result.assets);
          // Failed/timed-out fragment: empty slot + client-side render from last known assets (if any)
          const assets = result.assets ?? (result.error ? config.knownAssets?.get(seg.id) : undefined);
          const html = result.error
            ? (assets?.css ?? []).map((href) => `<link rel="stylesheet" href="${href}">`).join('')
            : result.html;
          if (result.error) {
            console.error(`[fragment-${seg.id}] ${result.error} — empty slot${assets ? ', client-side fallback' : ''}`);
            config.onFragmentError?.(seg.id, result.error);
          }
          if (isVueCompatible(result.vue)) {
            fragScripts.push(fragmentScriptTag(assets));
          } else {
            // SSR HTML stays, hydration skipped — a fragment built against another Vue minor must not run on the shell's Vue
            console.error(`[fragment-${seg.id}] built with vue ${result.vue}, shell serves ${vueVersion} — hydration skipped`);
          }
          let openTag = seg.openTag;
          if (result.version) openTag = openTag.replace(/>$/, ` data-fragment-version="${escapeAttr(result.version)}">`);
          if (result.error) openTag = openTag.replace(/>$/, ` data-fragment-error="${escapeAttr(result.error)}">`);
          if (config.debug) {
            const meta = config.debug.getMeta().get(seg.id);
            const cached = meta?.cached ?? false;
            const serverStart = meta?.fetchStart ?? 0;
            const serverEnd = meta?.fetchEnd ?? 0;
            const dbgAttrs = ` data-dbg-cached="${cached}" data-dbg-start="${serverStart}" data-dbg-end="${serverEnd}"`;
            const tagWithDbg = openTag.replace(/>$/, dbgAttrs + '>');
            await writer.write(encoder.encode(`${tagWithDbg}${html}</div>`));
          } else {
            await writer.write(encoder.encode(`${openTag}${html}</div>`));
          }
        }
      }

      // Stream close: fragment scripts go after #app to avoid hydration mismatch
      if (config.debug) {
        config.debug.setTotalEnd(Date.now());
      }
      const debugData = config.debug ? config.debug.getMeta() : undefined;
      const debugBar = config.debug ? getDebugBarScript(fragmentIds, debugData) : '';
      const totalAttr = debugData ? ` data-dbg-total="${debugData.get('__total')?.fetchEnd ?? 0}"` : '';
      const shellMeta = debugData?.get('__shell');
      const shellAttr = shellMeta ? ` data-dbg-shell-start="${shellMeta.fetchStart}" data-dbg-shell-end="${shellMeta.fetchEnd}"` : '';
      await writer.write(encoder.encode(
        `</div>${totalAttr}${shellAttr}\n${fragScripts.join('\n')}\n${debugBar}\n</body>\n</html>`,
      ));
    } catch (err) {
      // Never leave the response hanging (shell SSR/layout error)
      console.error('[shell] render failed', err);
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  const isClientNav = request.headers.get('X-Navigate') === '1';
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!isClientNav) headers['Link'] = linkHeaders.join(', ');
  if (route.cache) headers['Cache-Control'] = route.cache;
  return new Response(readable, { headers });
}

export function extractFragments(html: string): ExtractedFragment[] {
  const regex = /data-fragment="([^"]+)"[^>]*data-props="([^"]*)"/g;
  const results: ExtractedFragment[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    let props: Record<string, string> = {};
    try {
      props = JSON.parse(match[2]);
    } catch {}
    results.push({ id: match[1], props });
  }
  return results;
}

/** Split HTML into alternating static / fragment segments for streaming */
export function splitAtFragments(html: string): HtmlSegment[] {
  const pattern = /(<div data-fragment="([^"]+)"[^>]*>)<\/div>/g;
  const segments: HtmlSegment[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'static', html: html.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'fragment', id: match[2], openTag: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({ type: 'static', html: html.slice(lastIndex) });
  }

  return segments;
}

/** Shell assets — always known, no SSR needed */
export function buildShellTags(
  manifest?: AssetManifest,
): { headLinks: string; scripts: string; linkHeaders: string[] } {
  const resolve = (key: string, fallback: string) => manifest?.[key] || fallback;

  const vueAsset = resolve('vue.js', 'vue.js');
  const shellJs = resolve('shell.js', 'shell.js');
  const shellCss = resolve('shell.css', 'shell.css');

  const links = [
    `<link rel="stylesheet" href="/assets/${shellCss}">`,
    `<link rel="modulepreload" href="/assets/${vueAsset}">`,
  ];
  const importMap = `<script type="importmap">${JSON.stringify({ imports: { vue: `/assets/${vueAsset}` } })}</script>`;
  const scripts = [
    importMap,
    `<script type="module" src="/assets/${shellJs}"></script>`,
  ];

  const linkHeaders = [
    `</assets/${shellCss}>; rel=preload; as=style`,
    `</assets/${vueAsset}>; rel=modulepreload`,
    `</assets/${shellJs}>; rel=modulepreload`,
  ];

  return { headLinks: links.join('\n'), scripts: scripts.join('\n'), linkHeaders };
}

const majorMinor = (v: string) => v.split('.').slice(0, 2).join('.');

/** Same major.minor as the shell's Vue (SFC output may use runtime helpers added in a minor). Unknown → allowed */
export function isVueCompatible(fragmentVue?: string): boolean {
  return !fragmentVue || majorMinor(fragmentVue) === majorMinor(vueVersion);
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** preconnect to cross-origin fragment asset hosts (e.g. static.<domain>) */
export function buildPreconnectTags(pageOrigin: string, knownAssets?: Map<string, FragmentAssets>): string {
  const origins = new Set<string>();
  for (const assets of knownAssets?.values() ?? []) {
    for (const href of [assets.js, ...assets.css]) {
      if (!href || !/^https?:/.test(href)) continue;
      const origin = new URL(href).origin;
      if (origin !== pageOrigin) origins.add(origin);
    }
  }
  return [...origins].map((o) => `  <link rel="preconnect" href="${o}" crossorigin>\n`).join('');
}

/** Best-effort preloads for this page's fragments, from assets seen on previous requests */
export function buildFragmentPreloadTags(fragmentIds: string[], knownAssets?: Map<string, FragmentAssets>): string {
  return fragmentIds.map((id) => {
    const assets = knownAssets?.get(id);
    if (!assets) return '';
    return [
      ...assets.css.map((href) => `  <link rel="preload" as="style" href="${href}">\n`),
      assets.js ? `  <link rel="modulepreload" href="${assets.js}">\n` : '',
    ].join('');
  }).join('');
}

/** Fragment entry script, from the fragment's own response (same deploy as its HTML) */
export function fragmentScriptTag(assets?: FragmentAssets): string {
  return assets?.js ? `<script type="module" src="${assets.js}"></script>` : '';
}
