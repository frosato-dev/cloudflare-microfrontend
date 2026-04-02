import type { Middleware } from './types.js';

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
