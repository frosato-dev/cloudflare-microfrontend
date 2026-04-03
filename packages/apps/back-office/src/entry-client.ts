import { hydrateShell } from '@meta-framework/core/hydration/shell';
import { toClientRoutes } from '@meta-framework/core';
import { routes } from './router.js';
import { layouts } from './layouts.js';

hydrateShell(toClientRoutes(routes), layouts);
