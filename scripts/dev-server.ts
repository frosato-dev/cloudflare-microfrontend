import { createServer, type ViteDevServer, type ModuleNode } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

function collectStyles(vite: ViteDevServer, entryFiles: string[]): string {
  const styles: string[] = [];
  const seen = new Set<string>();

  function walk(mod: ModuleNode | undefined) {
    if (!mod || seen.has(mod.url)) return;
    seen.add(mod.url);
    if (mod.url.includes('vue&type=style')) {
      const css = mod.ssrModule?.default;
      if (css) styles.push(css);
    }
    mod.importedModules.forEach(walk);
  }

  for (const file of entryFiles) {
    const mods = vite.moduleGraph.getModulesByFile(file);
    mods?.forEach(walk);
  }
  return styles.map(s => `<style>${s}</style>`).join('\n');
}

async function startDevServer() {
  const vite = await createServer({
    root: ROOT,
    plugins: [vue()],
    server: { port: 3000 },
    resolve: {
      alias: {
        '@meta-framework/core/hydration/shell': resolve(ROOT, 'packages/framework/src/hydration/shell.ts'),
        '@meta-framework/core/hydration/fragment': resolve(ROOT, 'packages/framework/src/hydration/fragment.ts'),
        '@meta-framework/core/worker/shell': resolve(ROOT, 'packages/framework/src/worker/shell.ts'),
        '@meta-framework/core/worker/fragment': resolve(ROOT, 'packages/framework/src/worker/fragment.ts'),
        '@meta-framework/core/vite/shell': resolve(ROOT, 'packages/framework/src/vite/shell.ts'),
        '@meta-framework/core/vite/fragment': resolve(ROOT, 'packages/framework/src/vite/fragment.ts'),
        '@meta-framework/core': resolve(ROOT, 'packages/framework/src/index.ts'),
      },
    },
    appType: 'custom',
  });

  vite.middlewares.use(async (req, res, next) => {
    const url = req.url || '/';

    if (
      url.startsWith('/@') ||
      url.startsWith('/node_modules') ||
      url.startsWith('/__vite') ||
      url.includes('.')
    ) {
      return next();
    }

    try {
      // Load framework + shell modules via Vite SSR
      const framework = await vite.ssrLoadModule(
        resolve(ROOT, 'packages/framework/src/request-handler.ts'),
      );
      const routerMod = await vite.ssrLoadModule(
        resolve(ROOT, 'packages/shell/src/router.ts'),
      );
      const layoutsMod = await vite.ssrLoadModule(
        resolve(ROOT, 'packages/shell/src/layouts/index.ts'),
      );
      const middlewareMod = await vite.ssrLoadModule(
        resolve(ROOT, 'packages/shell/src/middleware.ts'),
      );

      const ssrEntryFiles: string[] = [
        resolve(ROOT, 'packages/shell/src/router.ts'),
      ];

      const fragmentFetcher = async (fragmentId: string, request: Request, routeProps: Record<string, string> = {}) => {
        const entryPath = resolve(ROOT, `packages/fragment-${fragmentId}/src/entry-server.ts`);
        ssrEntryFiles.push(entryPath);
        try {
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

      const response = await framework.handleRequest(
        request,
        fragmentFetcher,
        {
          routes: routerMod.routes,
          layouts: layoutsMod.layouts,
          middlewareRegistry: middlewareMod.middlewareRegistry,
          streamLayoutFn: () => ({ before: '', after: '' }), // unused in dev
        },
        { isDev: true },
      );
      let html = await response.text();

      html = html.replace(
        /src="\/@shell\/(.*?)"/g,
        (_, path) => `src="/packages/shell/src/${path}"`,
      );
      html = html.replace(
        /src="\/@fragment\/(.*?)\/(.*?)"/g,
        (_, id, path) => `src="/packages/fragment-${id}/src/${path}"`,
      );

      const ssrStyles = collectStyles(vite, ssrEntryFiles);
      if (ssrStyles) {
        html = html.replace('</head>', `${ssrStyles}\n</head>`);
      }

      html = html.replace(
        '</head>',
        `<script type="module" src="/@vite/client"></script></head>`,
      );

      res.writeHead(response.status, { 'Content-Type': 'text/html' });
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
