import type { Middleware } from './types.js';
import { buildModuleRegistry } from './layouts.js';

export function buildMiddlewareRegistry(
  modules: Record<string, { default: Middleware }>,
): Record<string, Middleware> {
  return buildModuleRegistry(modules, /\/([^/]+)\.ts$/);
}

export async function runMiddleware(
  registry: Record<string, Middleware>,
  names: string[],
  request: Request,
): Promise<Response | void> {
  for (const name of names) {
    const mw = registry[name];
    if (mw) {
      const result = await mw(request);
      if (result instanceof Response) return result;
    }
  }
}
