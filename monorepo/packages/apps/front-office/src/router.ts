import type { AppRoute } from 'framework';

export const routes: AppRoute[] = [
  {
    path: '/',
    component: () => import('./pages/index.vue'),
    layout: 'default',
    middleware: ['logger'],
    cache: 'public, s-maxage=300, stale-while-revalidate=60'
  },
  { path: '/product/:id',
    component: () => import('./pages/product/[id].vue'),
    layout: 'default',
    middleware: ['logger'],
    cache: 'public, s-maxage=60, stale-while-revalidate=30'
  },
];
