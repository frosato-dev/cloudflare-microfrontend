import { createSSRApp, h } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { toClientRoutes } from '../router.js';
import { buildLayoutRegistry } from '../layouts.js';
import type { Component } from 'vue';
import type { AppRoute } from '../types.js';

export function hydrateShell(config: {
  routes: AppRoute[];
  layouts: Record<string, { default: Component }>;
}) {
  const clientRoutes = toClientRoutes(config.routes);
  const layouts = buildLayoutRegistry(config.layouts);

  const router = createRouter({
    history: createWebHistory(),
    routes: clientRoutes,
  });

  router.isReady().then(() => {
    const matched = router.currentRoute.value.matched[0];
    if (!matched) return;

    const layoutName = (matched.meta?.layout as string) || 'default';
    const Layout = layouts[layoutName];
    if (!Layout) return;

    const Page = matched.components!.default as Component;
    const props = router.currentRoute.value.params;

    const app = createSSRApp({
      render: () => h(Layout, null, { default: () => h(Page, props) }),
    });
    app.use(router);
    app.mount('#app');
    console.log('[shell] hydrated');
  });
}
