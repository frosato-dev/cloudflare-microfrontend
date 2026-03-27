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
  const html = renderLayout(route.layout, {
    pageHtml,
    fragments,
    route,
    clientScripts: buildClientScripts(route),
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function buildClientScripts(route: MatchedRoute): string {
  const scripts = [
    '<script type="importmap">',
    JSON.stringify({
      imports: {
        vue: '/node_modules/vue/dist/vue.esm-browser.js',
      },
    }),
    '</script>',
    `<script type="module" src="/@shell/entry-client.ts"></script>`,
  ];

  for (const frag of route.fragments) {
    scripts.push(
      `<script type="module" src="/@fragment/${frag}/entry-client.ts"></script>`,
    );
  }

  return scripts.join('\n');
}

// Worker export for Cloudflare
export default {
  async fetch(request: Request): Promise<Response> {
    const workerFetcher: FragmentFetcher = async (fragmentId, req, routeProps) => {
      // In prod, fetch from fragment Worker URLs
      const config = (await import('../../../framework.config.js')).default;
      const fragment = config.fragments[fragmentId];
      if (!fragment) return { html: '' };

      const fragmentUrl = new URL(fragment.workerUrl);
      for (const [k, v] of Object.entries(routeProps)) {
        fragmentUrl.searchParams.set(k, v);
      }
      const res = await fetch(fragmentUrl.toString(), {
        headers: req.headers,
      });
      return res.json() as Promise<FragmentResponse>;
    };

    return handleRequest(request, workerFetcher);
  },
};
