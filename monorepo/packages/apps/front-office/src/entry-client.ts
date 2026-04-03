import { hydrateShell } from '@meta-framework/core/hydration/shell';
import { routes } from './router.js';

hydrateShell({
  routes,
  layouts: import.meta.glob('./layouts/*.vue', { eager: true }) as any,
});
