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

  const app = createSSRApp({
    render() {
      const matched = router.currentRoute.value.matched[0];
      if (!matched) return null;
      const layoutName = (matched.meta?.layout as string) || 'default';
      const Layout = layouts[layoutName];
      if (!Layout) return null;
      const Page = matched.components!.default as Component;
      return h(Layout, null, { default: () => h(Page, router.currentRoute.value.params) });
    },
  });

  app.use(router); // must happen before isReady — triggers initial navigation

  let isInitialNav = true;

  // Intercept <a> clicks for SPA navigation
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#')) return;
    e.preventDefault();
    router.push(href);
  });

  // Fetch + inject fragment HTML on client-side nav
  router.afterEach(async (to) => {
    if (isInitialNav) { isInitialNav = false; return; }

    const res = await fetch(to.fullPath, { headers: { 'X-Navigate': '1' } });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    document.querySelectorAll('[data-fragment]').forEach((el) => {
      const id = el.getAttribute('data-fragment');
      const source = doc.querySelector(`[data-fragment="${id}"]`);
      if (source) el.innerHTML = source.innerHTML;
    });

    // Load scripts for new fragments not yet registered
    const registry = (globalThis as any).__fragmentRegistry || {};
    const newScripts = doc.querySelectorAll('script[type="module"][src]');
    for (const script of newScripts) {
      const src = script.getAttribute('src')!;
      const match = src.match(/fragment-([^/.]+)/);
      if (match && !registry[match[1]]) {
        await import(/* @vite-ignore */ src);
      }
    }

    // Re-hydrate fragments (registry may have new entries from imports above)
    const updatedRegistry = (globalThis as any).__fragmentRegistry || {};
    document.querySelectorAll('[data-fragment]').forEach((el) => {
      const id = el.getAttribute('data-fragment')!;
      const entry = updatedRegistry[id];
      if (entry) entry(el);
    });
  });

  // View Transitions API for smooth cross-fade
  router.beforeEach((to, from, next) => {
    if (!isInitialNav && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => next());
    } else {
      next();
    }
  });

  router.isReady().then(() => {
    app.mount('#app');
    console.log('[shell] hydrated');
  });
}
