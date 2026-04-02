import type { RouteRecordRaw } from 'vue-router';
import type { RouteEntry } from '@meta-framework/core';
import IndexPage from './pages/index.vue';
import ProductPage from './pages/product/[id].vue';

export const routes: RouteEntry[] = [
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

export const clientRoutes: RouteRecordRaw[] = [
  { path: '/', component: IndexPage },
  { path: '/product/:id', component: ProductPage, props: true },
];
