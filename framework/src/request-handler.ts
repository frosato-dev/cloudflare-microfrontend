import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { Component } from 'vue';
import { matchRoute } from './router.js';
import { runMiddleware } from './middleware.js';
import { streamResponse, wrapFragment } from './layouts.js';
import type {
  AssetManifest,
  FragmentFetcher,
  Middleware,
  RouteEntry,
} from './types.js';

export interface HandleRequestConfig {
  routes: RouteEntry[];
  middlewareRegistry: Record<string, Middleware>;
  layouts: Record<string, Component>;
  document: { title: string; baseStyles?: string };
  manifest?: AssetManifest;
}

interface ExtractedFragment {
  id: string;
  props: Record<string, string>;
}

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

  // 1. Render Vue app (layout wrapping page) to get HTML with fragment placeholders
  const app = createSSRApp({
    render: () => h(Layout, null, { default: () => h(route.component, route.props) }),
  });
  const appHtml = await renderToString(app);

  // 2. Extract fragment placeholders from rendered HTML
  const fragments = extractFragments(appHtml);
  const fragmentIds = fragments.map((f) => f.id);

  // 3. Build client tags using discovered fragments
  const { headLinks, scripts } = buildClientTags(fragmentIds, config.manifest);

  // 4. Fetch all fragments in parallel
  const fragmentPromises = Object.fromEntries(
    fragments.map((f) => [
      f.id,
      fetchFragment(f.id, request, { ...route.props, ...f.props }),
    ]),
  );

  // 5. Wait for fragments, inject into HTML
  const resolvedFragments: Record<string, { html: string; css?: string }> = {};
  await Promise.all(
    Object.entries(fragmentPromises).map(async ([id, promise]) => {
      resolvedFragments[id] = await promise;
    }),
  );

  const finalHtml = injectFragments(appHtml, resolvedFragments);
  const inlineStyles = Object.values(resolvedFragments)
    .map((f) => (f.css ? `<style>${f.css}</style>` : ''))
    .join('\n');

  // 6. Stream response
  const baseStyles = config.document.baseStyles || defaultBaseStyles;
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    for await (const chunk of streamResponse({
      title: config.document.title,
      baseStyles,
      headLinks,
      inlineStyles,
      appHtml: finalHtml,
      clientScripts: scripts,
    })) {
      await writer.write(encoder.encode(chunk));
    }
    await writer.close();
  })();

  return new Response(readable, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
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

export function injectFragments(
  html: string,
  fragments: Record<string, { html: string }>,
): string {
  return html.replace(
    /(<div data-fragment="([^"]+)"[^>]*>)<\/div>/g,
    (_, openTag, id) => {
      const content = fragments[id]?.html || '';
      return `${openTag}${content}</div>`;
    },
  );
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
