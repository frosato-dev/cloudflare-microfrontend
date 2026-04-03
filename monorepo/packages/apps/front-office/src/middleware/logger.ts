import type { Middleware } from 'framework';

const logger: Middleware = (request) => {
  console.log(`[middleware] ${request.method} ${new URL(request.url).pathname}`);
};

export default logger;
