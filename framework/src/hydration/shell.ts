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

    // Build old/new fragment maps
    const oldFragments = new Map<string, Element>();
    document.querySelectorAll('[data-fragment]').forEach((el) => {
      const id = el.getAttribute('data-fragment')!;
      oldFragments.set(id, el);
    });
    const newFragments = new Map<string, Element>();
    doc.querySelectorAll('[data-fragment]').forEach((el) => {
      const id = el.getAttribute('data-fragment')!;
      newFragments.set(id, el);
    });

    const registry = (globalThis as any).__fragmentRegistry || {};

    // Unmount removed fragments
    for (const [id, el] of oldFragments) {
      if (!newFragments.has(id)) {
        const entry = registry[id];
        if (entry?.app) { entry.app.unmount(); entry.app = null; }
        el.remove();
      }
    }

    // Determine which fragments need update
    const toHydrate: Element[] = [];
    for (const [id, source] of newFragments) {
      const existing = oldFragments.get(id);
      if (existing) {
        const oldProps = (existing as HTMLElement).dataset.props || '{}';
        const newProps = (source as HTMLElement).dataset.props || '{}';
        const hasLiveApp = registry[id]?.app && existing.innerHTML.trim() !== '';
        if (oldProps === newProps && hasLiveApp) {
          console.log(`[fragment-${id}] skipped (unchanged)`);
          continue; // same props + live app with content → keep Vue instance
        }
        // Props changed — unmount old, replace HTML
        const entry = registry[id];
        if (entry?.app) { entry.app.unmount(); entry.app = null; }
        existing.innerHTML = source.innerHTML;
        (existing as HTMLElement).dataset.props = newProps;
        toHydrate.push(existing);
      } else {
        // New fragment — inject into DOM
        toHydrate.push(source);
      }
    }

    // Inject CSS links from new page that aren't already loaded
    doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (href && !document.querySelector(`link[href="${href}"]`)) {
        document.head.appendChild(document.createElement('link')).setAttribute('rel', 'stylesheet');
        document.head.lastElementChild!.setAttribute('href', href);
      }
    });

    // Load scripts for new fragments not yet registered
    const newScripts = doc.querySelectorAll('script[type="module"][src]');
    for (const script of newScripts) {
      const src = script.getAttribute('src')!;
      const match = src.match(/fragment-([^/.]+)/);
      if (match && !registry[match[1]]) {
        await import(/* @vite-ignore */ src);
      }
    }

    // Re-hydrate only changed/new fragments
    const updatedRegistry = (globalThis as any).__fragmentRegistry || {};
    for (const el of toHydrate) {
      const id = el.getAttribute('data-fragment')!;
      const entry = updatedRegistry[id];
      if (entry) entry.mount(el);
    }
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
