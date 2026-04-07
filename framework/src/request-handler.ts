import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { Component } from 'vue';
import { matchRoute } from './router.js';
import { runMiddleware } from './middleware.js';
import type {
  AssetManifest,
  FragmentFetcher,
  FragmentResponse,
  Middleware,
  RouteEntry,
} from './types.js';

export interface HandleRequestConfig {
  routes: RouteEntry[];
  middlewareRegistry: Record<string, Middleware>;
  layouts: Record<string, Component>;
  document: { title: string; baseStyles?: string; viewTransitions?: boolean };
  manifest?: AssetManifest;
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

  // 1. Render Vue app → HTML with fragment placeholders
  const app = createSSRApp({
    render: () => h(Layout, null, { default: () => h(route.component, route.props) }),
  });
  const appHtml = await renderToString(app);

  // 2. Extract fragments, fire all fetches in parallel immediately
  const fragments = extractFragments(appHtml);
  const fragmentIds = fragments.map((f) => f.id);
  const fragmentPromises: Record<string, Promise<FragmentResponse>> = Object.fromEntries(
    fragments.map((f) => [
      f.id,
      fetchFragment(f.id, request, { ...route.props, ...f.props }),
    ]),
  );

  // 3. Build client tags (fragment IDs known upfront)
  const { headLinks, scripts } = buildClientTags(fragmentIds, config.manifest);

  // 4. Split appHtml at fragment boundaries for streaming
  const segments = splitAtFragments(appHtml);

  // 5. Stream response: head → body segments (awaiting each fragment in doc order) → scripts → close
  const baseStyles = config.document.baseStyles || defaultBaseStyles;
  const viewTransitionStyle = config.document.viewTransitions
    ? `\n  <style>@view-transition { navigation: auto; }
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
  animation-timing-function: ease-in-out;
}</style>`
    : '';

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    // Stream <head> immediately — browser starts fetching CSS/JS
    await writer.write(encoder.encode(
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n` +
      `  <meta charset="UTF-8" />\n` +
      `  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n` +
      `  <title>${config.document.title}</title>\n` +
      `  <style>${baseStyles}</style>${viewTransitionStyle}\n` +
      `  ${headLinks}\n` +
      `</head>\n<body>\n  <div id="app">`,
    ));

    // Stream body: static parts flush immediately, fragments await in doc order
    for (const seg of segments) {
      if (seg.type === 'static') {
        await writer.write(encoder.encode(seg.html));
      } else {
        const result = await fragmentPromises[seg.id];
        const css = result.css ? `<style>${result.css}</style>` : '';
        await writer.write(encoder.encode(`${css}${seg.openTag}${result.html}</div>`));
      }
    }

    // Stream scripts + close
    await writer.write(encoder.encode(
      `</div>\n  ${scripts}\n</body>\n</html>`,
    ));
    await writer.close();
  })();

  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
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

export function buildClientTags(
  fragmentIds: string[],
  manifest?: AssetManifest,
): { headLinks: string; scripts: string } {
  const resolve = (key: string, fallback: string) => manifest?.[key] || fallback;

  const links = [
    `<link rel="stylesheet" href="/assets/${resolve('shell.css', 'shell.css')}">`,
    ...fragmentIds.map(
      (frag) =>
        `<link rel="stylesheet" href="/assets/${resolve(`fragment-${frag}.css`, `fragment-${frag}.css`)}">`,
    ),
  ];
  const importMap = `<script type="importmap">${JSON.stringify({ imports: { vue: `/assets/${resolve('vue.js', 'vue.js')}` } })}</script>`;
  const scripts = [
    importMap,
    `<script type="module" src="/assets/${resolve('shell.js', 'shell.js')}"></script>`,
    ...fragmentIds.map(
      (frag) =>
        `<script type="module" src="/assets/${resolve(`fragment-${frag}.js`, `fragment-${frag}.js`)}"></script>`,
    ),
  ];
  return { headLinks: links.join('\n'), scripts: scripts.join('\n') };
}
