import { createSSRApp, h } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import type { Component } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

export function hydrateShell(clientRoutes: RouteRecordRaw[], layouts: Record<string, Component>) {
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
