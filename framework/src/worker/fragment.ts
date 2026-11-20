import { fragmentHeaders } from '../fragment-protocol.js';
import type { FragmentBuildInfo } from '../types.js';

type RenderFn = (request: Request) => Promise<{ html: string }>;

export function createFragmentWorker(render: RenderFn, cacheControl: string, buildInfo: FragmentBuildInfo) {
  return {
    async fetch(request: Request): Promise<Response> {
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
