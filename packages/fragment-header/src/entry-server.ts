import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createFragmentWorker } from '@meta-framework/core/worker/fragment';
import App from './App.vue';

export async function render(_request?: Request) {
  const app = createSSRApp(App);
  const html = await renderToString(app);
  return { html };
}

export default createFragmentWorker(render, 'public, max-age=3600');
