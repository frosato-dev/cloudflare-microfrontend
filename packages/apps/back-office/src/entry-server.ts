import { createShellWorker } from '@meta-framework/core/worker/shell';
import { toRouteEntries, buildMiddlewareRegistry } from '@meta-framework/core';
import { routes } from './router.js';
import { layouts } from './layouts.js';

const middlewareRegistry = buildMiddlewareRegistry(
  import.meta.glob('./middleware/*.ts', { eager: true }) as any,
);

export default createShellWorker({
  routes: toRouteEntries(routes),
  middlewareRegistry,
  layouts,
  document: { title: 'Back Office' },
});
