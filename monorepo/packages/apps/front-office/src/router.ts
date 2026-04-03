import type { AppRoute } from 'framework';
import IndexPage from './pages/index.vue';
import ProductPage from './pages/product/[id].vue';

export const routes: AppRoute[] = [
  { path: '/', component: IndexPage, layout: 'default', middleware: ['logger'] },
  { path: '/product/:id', component: ProductPage, layout: 'default', middleware: ['logger'] },
];
