import { handleRequest } from '../request-handler.js';
import { toRouteEntries } from '../router.js';
import { buildMiddlewareRegistry } from '../middleware.js';
import { buildLayoutRegistry } from '../layouts.js';
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
    async fetch(request: Request, env: Record<string, { fetch: typeof fetch }>): Promise<Response> {
      if (!manifest && (env as any).ASSETS) {
        try {
          const res = await (env as any).ASSETS.fetch(new Request('https://dummy/assets/manifest.json'));
          if (res.ok) manifest = await res.json();
        } catch {}
      }

      const workerFetcher: FragmentFetcher = async (fragmentId, req, routeProps) => {
        const bindingKey = `FRAGMENT_${fragmentId.toUpperCase()}`;
        const binding = env[bindingKey];
        if (!binding) return { html: '' };

        const url = new URL(req.url);
        for (const [k, v] of Object.entries(routeProps)) {
          url.searchParams.set(k, v);
        }
        const res = await binding.fetch(new Request(url.toString(), { headers: req.headers }));
        return res.json();
      };

      return handleRequest(request, workerFetcher, {
        routes: routeEntries,
        middlewareRegistry,
        layouts: layoutRegistry,
        document: config.document,
        manifest,
      });
    },
  };
}
