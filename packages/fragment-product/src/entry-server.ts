import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createFragmentWorker } from '@meta-framework/core/worker/fragment';
import App from './App.vue';

export async function render(request?: Request) {
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

export default createFragmentWorker(render, 'private, no-cache');
