import type { AppRoute } from 'framework';
import IndexPage from './pages/index.vue';
import ProductPage from './pages/product/[id].vue';

export const routes: AppRoute[] = [
  { path: '/', component: IndexPage, layout: 'default', middleware: ['logger'], cache: 'public, s-maxage=300, stale-while-revalidate=60' },
  { path: '/product/:id', component: ProductPage, layout: 'default', middleware: ['logger'], cache: 'public, s-maxage=60, stale-while-revalidate=30' },
];
