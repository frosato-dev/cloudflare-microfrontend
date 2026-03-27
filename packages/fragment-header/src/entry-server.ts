import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import App from './App.vue';
import type { FragmentResponse } from '@meta-framework/shared';

export async function render(_request?: Request): Promise<FragmentResponse> {
  const app = createSSRApp(App);
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
        'Cache-Control': 'public, max-age=3600', // static fragment
      },
    });
  },
};
