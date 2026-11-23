declare const caches: { default: { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> } };

import { handleRequest } from '../request-handler.js';
import { toRouteEntries } from '../router.js';
import { buildMiddlewareRegistry } from '../middleware.js';
import { buildLayoutRegistry } from '../layouts.js';
import { isDebugRequest, isNoCacheRequest, wrapFetcherWithDebug } from '../debug/index.js';
import { withFaults } from '../debug/faults.js';
import { isolateFetcher } from '../isolation.js';
import { handleRumRequest } from '../metrics.js';
import { handlePreviewRequest } from '../preview.js';
import { FRAGMENT_ASSET_PREFIX, FRAGMENT_PROTOCOL, readFragmentResponse } from '../fragment-protocol.js';
import type { Component } from 'vue';
import type {
  AppRoute,
  AssetManifest,
  FragmentAssets,
  FragmentFetcher,
  Middleware,
} from '../types.js';

export interface ShellWorkerConfig {
  routes: AppRoute[];
  middleware: Record<string, { default: Middleware }>;
  layouts: Record<string, { default: Component }>;
  document: { title: string; baseStyles?: string };
  /** ms per fragment before it's rendered empty (default 1000) */
  fragmentTimeout?: number;
}

/** Strip s-maxage from Cache-Control (prevents Cloudflare edge from buffering the stream) */
function stripSMaxAge(cc: string): string {
  return cc.replace(/,?\s*s-maxage=\d+/g, '').replace(/^\s*,\s*/, '');
}

export function createShellWorker(config: ShellWorkerConfig) {
  const routeEntries = toRouteEntries(config.routes);
  const middlewareRegistry = buildMiddlewareRegistry(config.middleware);
  const layoutRegistry = buildLayoutRegistry(config.layouts);
  const knownAssets = new Map<string, FragmentAssets>();
  let manifest: AssetManifest | undefined;

  return {
    async fetch(request: Request, env: Record<string, { fetch: typeof fetch }>, ctx: { waitUntil: (p: Promise<any>) => void }): Promise<Response> {
      const url = new URL(request.url);

      // Fragment client assets: /_fragments/<id>/* → owning fragment worker
      if (url.pathname.startsWith(FRAGMENT_ASSET_PREFIX + '/')) {
        const id = url.pathname.slice(FRAGMENT_ASSET_PREFIX.length + 1).split('/')[0];
        const binding = env[`FRAGMENT_${id.toUpperCase()}`];
        return binding ? binding.fetch(request) : new Response('Not Found', { status: 404 });
      }

      if (url.pathname === '/__rum') return handleRumRequest(request, routeEntries);

      if (!manifest && (env as any).ASSETS) {
        try {
          const res = await (env as any).ASSETS.fetch(new Request('https://dummy/assets/manifest.json'));
          if (res.ok) manifest = await res.json();
        } catch {}
      }

      const isDebug = isDebugRequest(request);
      const noCache = isNoCacheRequest(request);
      const pageCache = caches.default;
      const pageCacheUrl = new URL(request.url);
      pageCacheUrl.searchParams.set('__fp', FRAGMENT_PROTOCOL);
      // Shell build in the key: a deploy removes the previous shell bundle → never serve pages that reference it
      pageCacheUrl.searchParams.set('__sv', manifest?.['shell.js'] ?? '');
      const pageCacheKey = new Request(pageCacheUrl.toString());

      // Skip when debug is on — cached page won't have the debug bar
      if (!noCache && !isDebug) {
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
        if (!binding) return { html: '', error: `no ${bindingKey} binding` };

        const url = new URL(req.url);
        for (const [k, v] of Object.entries(routeProps)) {
          url.searchParams.set(k, v);
        }

        const cacheUrl = new URL(url.toString());
        cacheUrl.searchParams.set('__fragment', fragmentId);
        cacheUrl.searchParams.set('__fp', FRAGMENT_PROTOCOL);
        // Shell build in the key: a full redeploy drops cached fragment HTML pointing at deleted assets
        cacheUrl.searchParams.set('__sv', manifest?.['shell.js'] ?? '');
        const cacheKey = new Request(cacheUrl.toString());
        const cache = caches.default;

        if (!noCache) {
          const cached = await cache.match(cacheKey);
          if (cached) {
            const result = await readFragmentResponse(cached);
            result._meta = { cached: true };
            return result;
          }
        }

        const res = await binding.fetch(new Request(url.toString(), { headers: req.headers }));
        const response = new Response(res.body, res);

        if (response.ok && !response.headers.get('Cache-Control')?.includes('no-cache')) {
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
        }

        const result = await readFragmentResponse(response);
        result._meta = { cached: false };
        return result;
      };

      // Every fragment is time-boxed + error-isolated (fault injection only in debug mode)
      let fetcher = isolateFetcher(isDebug ? withFaults(workerFetcher, request) : workerFetcher, config.fragmentTimeout);
      // Always time fragments: structured logs (metrics.ts) + debug bar when cookie-enabled
      const timed = wrapFetcherWithDebug(fetcher, Date.now());
      fetcher = timed.fetcher;
      const timing = { getMeta: timed.getMeta, setShellEnd: timed.setShellEnd, setTotalEnd: timed.setTotalEnd };

      if (url.pathname === '/__preview' || url.pathname.startsWith('/__preview/')) {
        const fragmentIds = Object.keys(env)
          .filter((k) => k.startsWith('FRAGMENT_'))
          .map((k) => k.slice('FRAGMENT_'.length).toLowerCase());
        return handlePreviewRequest(request, fetcher, fragmentIds, manifest, config.document);
      }

      let degraded = false; // a fragment failed → never put this page in the page cache
      const response = await handleRequest(request, fetcher, {
        routes: routeEntries,
        middlewareRegistry,
        layouts: layoutRegistry,
        document: config.document,
        manifest,
        knownAssets,
        onFragmentError: () => { degraded = true; },
        timing,
        debugBar: isDebug,
      });

      // Collect streamed chunks for worker-level cache while streaming to client
      const cc = response.headers.get('Cache-Control') || '';
      if (!noCache && !isDebug && cc.includes('s-maxage')) {
        const chunks: Uint8Array[] = [];
        const passthrough = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            chunks.push(chunk);
            controller.enqueue(chunk);
          },
          flush() {
            // Stream done — cache the collected body
            const body = new Blob(chunks);
            if (!degraded) ctx.waitUntil(pageCache.put(pageCacheKey, new Response(body, response)));
          },
        });
        const clientHeaders = new Headers(response.headers);
        clientHeaders.set('Cache-Control', stripSMaxAge(cc));
        return new Response(
          response.body!.pipeThrough(passthrough),
          { status: response.status, headers: clientHeaders },
        );
      }

      // Strip s-maxage so CDN won't cache debug-decorated response
      if (isDebug && cc.includes('s-maxage')) {
        const clientHeaders = new Headers(response.headers);
        clientHeaders.set('Cache-Control', stripSMaxAge(cc));
        return new Response(response.body, { status: response.status, headers: clientHeaders });
      }

      return response;
    },
  };
}
