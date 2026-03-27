import { createSSRApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { clientRoutes } from './router.js';

const router = createRouter({
  history: createWebHistory(),
  routes: clientRoutes,
});

router.isReady().then(() => {
  const pageEl = document.querySelector('[data-page]');
  if (!pageEl) return;

  const matched = router.currentRoute.value.matched[0];
  if (!matched) return;

  const app = createSSRApp(matched.components!.default, router.currentRoute.value.params);
  app.mount(pageEl);
  console.log('[shell] hydrated');
});
