import type { FragmentResponse } from '../types.js';

type RenderFn = (request: Request) => Promise<FragmentResponse>;

export function createFragmentWorker(render: RenderFn, cacheControl: string) {
  return {
    async fetch(request: Request): Promise<Response> {
      const result = await render(request);
      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': cacheControl,
        },
      });
    },
  };
}
