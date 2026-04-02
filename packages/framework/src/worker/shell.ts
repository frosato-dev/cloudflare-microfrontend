import { handleRequest } from '../request-handler.js';
import type {
  AssetManifest,
  FragmentFetcher,
  LayoutContext,
  Middleware,
  RouteEntry,
} from '../types.js';

export interface ShellWorkerConfig {
  routes: RouteEntry[];
  layouts: Record<string, (ctx: LayoutContext) => string>;
  middlewareRegistry: Record<string, Middleware>;
  streamLayoutFn: (ctx: {
    headerHtml: string;
    otherFragments: string;
    pageHtml: string;
    headLinks: string;
    clientScripts: string;
    inlineStyles: string;
  }) => { before: string; after: string };
}

export function createShellWorker(config: ShellWorkerConfig) {
  let manifest: AssetManifest | undefined;

  return {
    async fetch(request: Request, env: Record<string, { fetch: typeof fetch }>): Promise<Response> {
      // Load manifest from assets binding on first request
      if (!manifest && (env as any).ASSETS) {
        try {
          const res = await (env as any).ASSETS.fetch(new Request('https://dummy/assets/manifest.json'));
          if (res.ok) manifest = await res.json();
        } catch { /* manifest optional — falls back to unhashed names */ }
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

      return handleRequest(request, workerFetcher, { ...config, manifest });
    },
  };
}
