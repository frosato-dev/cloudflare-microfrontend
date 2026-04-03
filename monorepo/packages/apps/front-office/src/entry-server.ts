import { createShellWorker } from 'framework/worker';
import { routes } from './router.js';

export default createShellWorker({
  routes,
  middleware: import.meta.glob('./middleware/*.ts', { eager: true }) as any,
  layouts: import.meta.glob('./layouts/*.vue', { eager: true }) as any,
  document: { title: 'Meta Framework POC' },
});
