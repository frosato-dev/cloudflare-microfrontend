import type { Component } from 'vue';
import type { RouteRecordRaw } from 'vue-router';
import IndexPage from './pages/index.vue';
import ProductPage from './pages/product/[id].vue';

export interface MatchedRoute {
  path: string;
  component: Component;
  props: Record<string, string>;
  layout: string;
  fragments: string[];
  middleware: string[];
}

interface RouteEntry {
  pattern: RegExp;
  paramNames: string[];
  component: Component;
  layout: string;
  fragments: string[];
  middleware: string[];
}

// File-based route definitions — in a real framework this would be auto-generated
// from scanning packages/shell/src/pages/ at build time
const routes: RouteEntry[] = [
  {
    pattern: /^\/$/,
    paramNames: [],
    component: IndexPage,
    layout: 'default',
    fragments: ['header'],
    middleware: ['logger'],
  },
  {
    pattern: /^\/product\/([^/]+)$/,
    paramNames: ['id'],
    component: ProductPage,
    layout: 'default',
    fragments: ['header', 'product'],
    middleware: ['logger'],
  },
];

export function matchRoute(pathname: string): MatchedRoute | null {
  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (match) {
      const props: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        props[name] = match[i + 1];
      });
      return {
        path: pathname,
        component: route.component,
        props,
        layout: route.layout,
        fragments: route.fragments,
        middleware: route.middleware,
      };
    }
  }
  return null;
}

// Client-side routes for vue-router
export const clientRoutes: RouteRecordRaw[] = [
  { path: '/', component: IndexPage },
  { path: '/product/:id', component: ProductPage, props: true },
];
