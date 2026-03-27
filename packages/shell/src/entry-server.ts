import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { matchRoute, type MatchedRoute } from './router.js';
import { runMiddleware } from './middleware.js';
import { renderLayout } from './layouts/index.js';
import type { FragmentResponse } from '@meta-framework/shared';

export interface FragmentFetcher {
  (fragmentId: string, request: Request, routeProps: Record<string, string>): Promise<FragmentResponse>;
}

export async function handleRequest(
  request: Request,
  fetchFragment: FragmentFetcher,
  options: { isDev?: boolean } = {},
): Promise<Response> {
  const url = new URL(request.url);
  const route = matchRoute(url.pathname);

  if (!route) {
    return new Response('Not Found', { status: 404 });
  }

  // Run middleware chain
  const middlewareResponse = await runMiddleware(route.middleware, request);
  if (middlewareResponse) return middlewareResponse;

  // SSR the page component
  const pageApp = createSSRApp(route.component, route.props);
  const pageHtml = await renderToString(pageApp);

  // Fetch all fragments in parallel
  const fragmentEntries = await Promise.all(
    route.fragments.map(async (id) => {
      const res = await fetchFragment(id, request, route.props);
      return [id, res] as const;
    }),
  );
  const fragments = Object.fromEntries(fragmentEntries);

  // Assemble full HTML
  const { headLinks, scripts } = buildClientTags(route, options.isDev);
  const html = renderLayout(route.layout, {
    pageHtml,
    fragments,
    route,
    headLinks,
    clientScripts: scripts,
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function buildClientTags(route: MatchedRoute, isDev = false): { headLinks: string; scripts: string } {
  if (isDev) {
    return {
      headLinks: '',
      scripts: [
        '<script type="importmap">',
        JSON.stringify({
          imports: {
            vue: '/node_modules/vue/dist/vue.esm-browser.js',
          },
        }),
        '</script>',
        `<script type="module" src="/@shell/entry-client.ts"></script>`,
        ...route.fragments.map(
          (frag) => `<script type="module" src="/@fragment/${frag}/entry-client.ts"></script>`,
        ),
      ].join('\n'),
    };
  }

  // Production: CSS in <head>, JS in <body>
  const links = [
    `<link rel="stylesheet" href="/assets/shell.css">`,
    ...route.fragments.map(
      (frag) => `<link rel="stylesheet" href="/assets/fragment-${frag}.css">`,
    ),
  ];
  const scripts = [
    `<script type="module" src="/assets/shell.js"></script>`,
    ...route.fragments.map(
      (frag) => `<script type="module" src="/assets/fragment-${frag}.js"></script>`,
    ),
  ];
  return { headLinks: links.join('\n'), scripts: scripts.join('\n') };
}

// Worker export for Cloudflare — uses service bindings to reach fragments
export default {
  async fetch(request: Request, env: Record<string, { fetch: typeof fetch }>): Promise<Response> {
    const workerFetcher: FragmentFetcher = async (fragmentId, req, routeProps) => {
      const bindingKey = `FRAGMENT_${fragmentId.toUpperCase()}`;
      const binding = env[bindingKey];
      if (!binding) return { html: '' };

      const url = new URL(req.url);
      for (const [k, v] of Object.entries(routeProps)) {
        url.searchParams.set(k, v);
      }
      const res = await binding.fetch(new Request(url.toString(), { headers: req.headers }));
      return res.json() as Promise<FragmentResponse>;
    };

    return handleRequest(request, workerFetcher);
  },
};
