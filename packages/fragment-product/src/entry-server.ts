import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import App from './App.vue';
import type { FragmentResponse } from '@meta-framework/shared';

export async function render(request?: Request): Promise<FragmentResponse> {
  const props: Record<string, string> = {};
  if (request) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id) props.id = id;
  }

  const app = createSSRApp(App, props);
  const html = await renderToString(app);
  return { html };
}

// Cloudflare Worker export
export default {
  async fetch(request: Request): Promise<Response> {
    const result = await render(request);
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache', // personalized fragment
      },
    });
  },
};
