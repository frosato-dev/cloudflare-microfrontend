import type { Middleware } from '@meta-framework/core';

export const middlewareRegistry: Record<string, Middleware> = {
  logger: (request: Request) => {
    console.log(`[middleware] ${request.method} ${new URL(request.url).pathname}`);
  },
};
