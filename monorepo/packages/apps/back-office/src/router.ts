import type { AppRoute } from '@meta-framework/core';
import IndexPage from './pages/index.vue';

export const routes: AppRoute[] = [
  { path: '/', component: IndexPage, layout: 'default', middleware: ['logger'] },
];
