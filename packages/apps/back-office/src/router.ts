import type { RouteRecordRaw } from 'vue-router';
import type { RouteEntry } from '@meta-framework/core';
import IndexPage from './pages/index.vue';

export const routes: RouteEntry[] = [
  {
    pattern: /^\/$/,
    paramNames: [],
    component: IndexPage,
    layout: 'default',
    fragments: ['header'],
    middleware: ['logger'],
  },
];

export const clientRoutes: RouteRecordRaw[] = [
  { path: '/', component: IndexPage },
];
