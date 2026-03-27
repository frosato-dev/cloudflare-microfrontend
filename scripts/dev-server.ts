import { createServer, type ViteDevServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

async function startDevServer() {
  const vite = await createServer({
    root: ROOT,
    plugins: [vue()],
    server: { port: 3000 },
    resolve: {
      alias: {
        '@meta-framework/shared': resolve(ROOT, 'packages/shared/src/index.ts'),
      },
    },
    appType: 'custom',
  });

  // SSR middleware: intercept all HTML requests, render via shell
  vite.middlewares.use(async (req, res, next) => {
    const url = req.url || '/';

    // Skip Vite internal requests
    if (
      url.startsWith('/@') ||
      url.startsWith('/node_modules') ||
      url.startsWith('/__vite') ||
      url.includes('.')
    ) {
      return next();
    }

    try {
      // Import shell's entry-server via Vite's SSR module loader
      const { handleRequest } = await vite.ssrLoadModule(
        resolve(ROOT, 'packages/shell/src/entry-server.ts'),
      );

      // Fragment fetcher: uses Vite's ssrLoadModule to render fragments in-process
      const fragmentFetcher = async (fragmentId: string, request: Request, routeProps: Record<string, string> = {}) => {
        const entryPath = resolve(
          ROOT,
          `packages/fragment-${fragmentId}/src/entry-server.ts`,
        );
        try {
          // Build a request with route props as query params
          const fragUrl = new URL(request.url);
          for (const [k, v] of Object.entries(routeProps)) {
            fragUrl.searchParams.set(k, v);
          }
          const fragRequest = new Request(fragUrl.toString(), { headers: request.headers });
          const mod = await vite.ssrLoadModule(entryPath);
          return await mod.render(fragRequest);
        } catch (e) {
          console.error(`[dev] Failed to render fragment "${fragmentId}":`, e);
          return { html: `<!-- fragment "${fragmentId}" error -->` };
        }
      };

      // Build a Request object from Node's IncomingMessage
      const origin = `http://localhost:3000`;
      const request = new Request(`${origin}${url}`, {
        method: req.method,
        headers: Object.entries(req.headers).reduce(
          (h, [k, v]) => {
            if (v) h[k] = Array.isArray(v) ? v.join(', ') : v;
            return h;
          },
          {} as Record<string, string>,
        ),
      });

      const response = await handleRequest(request, fragmentFetcher);
      let html = await response.text();

      // Transform client script paths for Vite dev
      html = html.replace(
        /src="\/@shell\/(.*?)"/g,
        (_, path) => `src="/packages/shell/src/${path}"`,
      );
      html = html.replace(
        /src="\/@fragment\/(.*?)\/(.*?)"/g,
        (_, id, path) => `src="/packages/fragment-${id}/src/${path}"`,
      );

      // Inject Vite's HMR client
      html = html.replace(
        '</head>',
        `<script type="module" src="/@vite/client"></script></head>`,
      );

      res.writeHead(response.status, {
        'Content-Type': 'text/html',
      });
      res.end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      console.error(e);
      res.writeHead(500);
      res.end((e as Error).stack);
    }
  });

  await vite.listen();
  console.log(`\n  Meta Framework POC dev server`);
  console.log(`  -> http://localhost:3000\n`);
  console.log(`  Routes:`);
  console.log(`    /                    — Home (header fragment)`);
  console.log(`    /product/:id         — Product page (header + product fragments)`);
  console.log();
}

startDevServer().catch(console.error);
