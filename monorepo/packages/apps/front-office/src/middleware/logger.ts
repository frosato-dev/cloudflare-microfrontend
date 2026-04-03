import type { Middleware } from '@meta-framework/core';

const logger: Middleware = (request) => {
  console.log(`[middleware] ${request.method} ${new URL(request.url).pathname}`);
};

export default logger;
