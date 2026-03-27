import { createSSRApp } from 'vue';
import App from './App.vue';

const container = document.querySelector('[data-fragment="header"]');
if (container) {
  const app = createSSRApp(App);
  app.mount(container);
  console.log('[fragment-header] hydrated');
}
