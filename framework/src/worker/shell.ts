declare const caches: { default: { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> } };

import { handleRequest } from '../request-handler.js';
import { toRouteEntries } from '../router.js';
import { buildMiddlewareRegistry } from '../middleware.js';
import { buildLayoutRegistry } from '../layouts.js';
import { isDebugRequest, isNoCacheRequest, wrapFetcherWithDebug } from '../debug/index.js';
import type { Component } from 'vue';
import type {
  AppRoute,
  AssetManifest,
  FragmentFetcher,
  Middleware,
} from '../types.js';

export interface ShellWorkerConfig {
  routes: AppRoute[];
  middleware: Record<string, { default: Middleware }>;
  layouts: Record<string, { default: Component }>;
  document: { title: string; baseStyles?: string };
}

export function createShellWorker(config: ShellWorkerConfig) {
  const routeEntries = toRouteEntries(config.routes);
  const middlewareRegistry = buildMiddlewareRegistry(config.middleware);
  const layoutRegistry = buildLayoutRegistry(config.layouts);
  let manifest: AssetManifest | undefined;

  return {
    async fetch(request: Request, env: Record<string, { fetch: typeof fetch }>, ctx: { waitUntil: (p: Promise<any>) => void }): Promise<Response> {
      if (!manifest && (env as any).ASSETS) {
        try {
          const res = await (env as any).ASSETS.fetch(new Request('https://dummy/assets/manifest.json'));
          if (res.ok) manifest = await res.json();
        } catch {}
      }

      const isDebug = isDebugRequest(request);

      const workerFetcher: FragmentFetcher = async (fragmentId, req, routeProps) => {
        const bindingKey = `FRAGMENT_${fragmentId.toUpperCase()}`;
        const binding = env[bindingKey];
        if (!binding) return { html: '' };

        const url = new URL(req.url);
        for (const [k, v] of Object.entries(routeProps)) {
          url.searchParams.set(k, v);
        }

        const cacheUrl = new URL(url.toString());
        cacheUrl.searchParams.set('__fragment', fragmentId);
        const cacheKey = new Request(cacheUrl.toString());
        const cache = caches.default;

        if (!isNoCacheRequest(request)) {
          const cached = await cache.match(cacheKey);
          if (cached) {
            const result = await cached.json() as any;
            result._meta = { cached: true };
            return result;
          }
        }

        const res = await binding.fetch(new Request(url.toString(), { headers: req.headers }));
        const response = new Response(res.body, res);

        if (!response.headers.get('Cache-Control')?.includes('no-cache')) {
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
        }

        const result = await response.json() as any;
        result._meta = { cached: false };
        return result;
      };

      let fetcher = workerFetcher;
      let debug: { getMeta: () => Map<string, any> } | undefined;

      if (isDebug) {
        const wrapped = wrapFetcherWithDebug(workerFetcher, Date.now());
        fetcher = wrapped.fetcher;
        debug = { getMeta: wrapped.getMeta };
      }

      return handleRequest(request, fetcher, {
        routes: routeEntries,
        middlewareRegistry,
        layouts: layoutRegistry,
        document: config.document,
        manifest,
        debug,
      });
    },
  };
}
