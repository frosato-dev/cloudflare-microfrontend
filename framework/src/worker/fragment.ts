import { FRAGMENT_ASSET_PREFIX, fragmentHeaders } from '../fragment-protocol.js';
import type { FragmentBuildInfo } from '../types.js';

type RenderFn = (request: Request) => Promise<{ html: string }>;
type Env = { ASSETS?: { fetch: typeof fetch } };

export function createFragmentWorker(render: RenderFn, cacheControl: string, buildInfo: FragmentBuildInfo) {
  return {
    async fetch(request: Request, env: Env = {}): Promise<Response> {
      // Own client assets: /_fragments/<id>/<file> → static asset /<id>/<file>
      const url = new URL(request.url);
      if (url.pathname.startsWith(FRAGMENT_ASSET_PREFIX + '/')) {
        if (!env.ASSETS) return new Response('Not Found', { status: 404 });
        url.pathname = url.pathname.slice(FRAGMENT_ASSET_PREFIX.length);
        return env.ASSETS.fetch(new Request(url, request));
      }

      const { html } = await render(request);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': cacheControl,
          ...fragmentHeaders(buildInfo),
        },
      });
    },
  };
}
