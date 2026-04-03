import type { Middleware } from './types.js';

export function buildMiddlewareRegistry(
  modules: Record<string, { default: Middleware }>,
): Record<string, Middleware> {
  const registry: Record<string, Middleware> = {};
  for (const [path, mod] of Object.entries(modules)) {
    const name = path.match(/\/([^/]+)\.ts$/)?.[1];
    if (name) registry[name] = mod.default;
  }
  return registry;
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
