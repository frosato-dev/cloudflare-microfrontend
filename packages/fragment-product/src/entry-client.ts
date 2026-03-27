import { createSSRApp } from 'vue';
import App from './App.vue';

const container = document.querySelector('[data-fragment="product"]');
if (container) {
  const props = JSON.parse(container.dataset.props || '{}');
  const app = createSSRApp(App, props);
  app.mount(container);
  console.log('[fragment-product] hydrated');
}
