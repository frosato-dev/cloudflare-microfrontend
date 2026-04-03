import { hydrateShell } from 'framework/hydration';
import { routes } from './router.js';

hydrateShell({
  routes,
  layouts: import.meta.glob('./layouts/*.vue', { eager: true }) as any,
});
