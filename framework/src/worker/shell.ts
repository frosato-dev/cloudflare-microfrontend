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

/** Strip s-maxage from Cache-Control (prevents Cloudflare edge from buffering the stream) */
function stripSMaxAge(cc: string): string {
  return cc.replace(/,?\s*s-maxage=\d+/g, '').replace(/^\s*,\s*/, '');
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
      const noCache = isNoCacheRequest(request);
      const pageCache = caches.default;
      const pageCacheKey = new Request(request.url);

      // Serve from worker-level page cache (already fully rendered, fast)
      if (!noCache) {
        const cached = await pageCache.match(pageCacheKey);
        if (cached) {
          const headers = new Headers(cached.headers);
          const cc = headers.get('Cache-Control');
          if (cc) headers.set('Cache-Control', stripSMaxAge(cc));
          return new Response(cached.body, { status: cached.status, headers });
        }
      }

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

        if (!noCache) {
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

      const response = await handleRequest(request, fetcher, {
        routes: routeEntries,
        middlewareRegistry,
        layouts: layoutRegistry,
        document: config.document,
        manifest,
        debug,
      });

      // Collect streamed chunks for worker-level cache while streaming to client
      const cc = response.headers.get('Cache-Control') || '';
      if (!noCache && cc.includes('s-maxage')) {
        const chunks: Uint8Array[] = [];
        const passthrough = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            chunks.push(chunk);
            controller.enqueue(chunk);
          },
          flush() {
            // Stream done — cache the collected body
            const body = new Blob(chunks);
            ctx.waitUntil(pageCache.put(pageCacheKey, new Response(body, response)));
          },
        });
        const clientHeaders = new Headers(response.headers);
        clientHeaders.set('Cache-Control', stripSMaxAge(cc));
        return new Response(
          response.body!.pipeThrough(passthrough),
          { status: response.status, headers: clientHeaders },
        );
      }

      return response;
    },
  };
}
