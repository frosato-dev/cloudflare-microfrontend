import type { AppRoute } from 'framework';

export const routes: AppRoute[] = [
  { path: '/', component: () => import('./pages/index.vue'), layout: 'default', middleware: ['logger'] },
];
