import type { Middleware } from '@meta-framework/shared';

const middlewareRegistry: Record<string, Middleware> = {
  logger: (request: Request) => {
    console.log(`[middleware] ${request.method} ${new URL(request.url).pathname}`);
  },
};

export async function runMiddleware(
  names: string[],
  request: Request,
): Promise<Response | void> {
  for (const name of names) {
    const mw = middlewareRegistry[name];
    if (mw) {
      const result = await mw(request);
      if (result instanceof Response) return result;
    }
  }
}
