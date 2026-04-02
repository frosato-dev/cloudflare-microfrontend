import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { matchRoute } from './router.js';
import { runMiddleware } from './middleware.js';
import { renderLayout, streamLayout } from './layouts.js';
import type {
  AssetManifest,
  FragmentFetcher,
  LayoutContext,
  MatchedRoute,
  Middleware,
  RouteEntry,
  StreamLayoutContext,
} from './types.js';

export interface HandleRequestConfig {
  routes: RouteEntry[];
  layouts: Record<string, (ctx: LayoutContext) => string>;
  middlewareRegistry: Record<string, Middleware>;
  streamLayoutFn: (ctx: {
    headerHtml: string;
    otherFragments: string;
    pageHtml: string;
    headLinks: string;
    clientScripts: string;
    inlineStyles: string;
  }) => { before: string; after: string };
  manifest?: AssetManifest;
}

export async function handleRequest(
  request: Request,
  fetchFragment: FragmentFetcher,
  config: HandleRequestConfig,
  options: { isDev?: boolean } = {},
): Promise<Response> {
  const url = new URL(request.url);
  const route = matchRoute(config.routes, url.pathname);

  if (!route) {
    return new Response('Not Found', { status: 404 });
  }

  const middlewareResponse = await runMiddleware(config.middlewareRegistry, route.middleware, request);
  if (middlewareResponse) return middlewareResponse;

  const { headLinks, scripts } = buildClientTags(route, config.manifest, options.isDev);

  const pageHtmlPromise = renderToString(createSSRApp(route.component, route.props));
  const fragmentPromises = Object.fromEntries(
    route.fragments.map((id) => [id, fetchFragment(id, request, route.props)]),
  );

  // Dev mode: buffered response
  if (options.isDev) {
    const [pageHtml, ...entries] = await Promise.all([
      pageHtmlPromise,
      ...route.fragments.map(async (id) => [id, await fragmentPromises[id]] as const),
    ]);
    const fragments = Object.fromEntries(entries);
    const html = renderLayout(config.layouts, route.layout, { pageHtml, fragments, route, headLinks, clientScripts: scripts });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // Production: streaming response
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    for await (const chunk of streamLayout(config.streamLayoutFn, { fragmentPromises, pageHtmlPromise, route, headLinks, clientScripts: scripts })) {
      await writer.write(encoder.encode(chunk));
    }
    await writer.close();
  })();

  return new Response(readable, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export function buildClientTags(
  route: MatchedRoute,
  manifest?: AssetManifest,
  isDev = false,
): { headLinks: string; scripts: string } {
  if (isDev) {
    return {
      headLinks: '',
      scripts: [
        '<script type="importmap">',
        JSON.stringify({ imports: { vue: '/node_modules/vue/dist/vue.esm-browser.js' } }),
        '</script>',
        `<script type="module" src="/@shell/entry-client.ts"></script>`,
        ...route.fragments.map(
          (frag) => `<script type="module" src="/@fragment/${frag}/entry-client.ts"></script>`,
        ),
      ].join('\n'),
    };
  }

  const resolve = (key: string, fallback: string) => manifest?.[key] || fallback;

  const links = [
    `<link rel="stylesheet" href="/assets/${resolve('shell.css', 'shell.css')}">`,
    ...route.fragments.map(
      (frag) => `<link rel="stylesheet" href="/assets/${resolve(`fragment-${frag}.css`, `fragment-${frag}.css`)}">`,
    ),
  ];
  const importMap = `<script type="importmap">${JSON.stringify({ imports: { vue: `/assets/${resolve('vue.js', 'vue.js')}` } })}</script>`;
  const scripts = [
    importMap,
    `<script type="module" src="/assets/${resolve('shell.js', 'shell.js')}"></script>`,
    ...route.fragments.map(
      (frag) => `<script type="module" src="/assets/${resolve(`fragment-${frag}.js`, `fragment-${frag}.js`)}"></script>`,
    ),
  ];
  return { headLinks: links.join('\n'), scripts: scripts.join('\n') };
}
