import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { virtualModule } from './virtual-module.ts';

const VIRTUAL_SERVER = 'virtual:shell-entry-server';
const VIRTUAL_CLIENT = 'virtual:shell-entry-client';

/** List files matching a glob-like pattern in a directory */
function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => resolve(dir, f).replace(/\\/g, '/'));
}

/**
 * Emits Vue's pre-built browser bundle as a hashed asset.
 * Eliminates the re-export shim + runtime-dom waterfall.
 */
function vueBrowserBundlePlugin(): Plugin {
  let vuePath: string;
  return {
    name: 'meta-framework:vue-browser-bundle',
    async buildStart() {
      const resolved = import.meta.resolve?.('vue/dist/vue.runtime.esm-browser.prod.js');
      vuePath = resolved ? new URL(resolved).pathname : resolve('node_modules/vue/dist/vue.runtime.esm-browser.prod.js');
    },
    generateBundle() {
      const source = readFileSync(vuePath);
      const hash = createHash('sha256').update(source).digest('hex').slice(0, 8);
      this.emitFile({
        type: 'asset',
        fileName: `vue.${hash}.js`,
        source,
      });
    },
  };
}

function shellEntryServerPlugin(cwd: string): Plugin {
  const configPath = resolve(cwd, 'application.config.ts').replace(/\\/g, '/');
  const routerPath = resolve(cwd, 'src/router.ts').replace(/\\/g, '/');
  const srcDir = resolve(cwd, 'src').replace(/\\/g, '/');

  return virtualModule('meta-framework:shell-entry-server', VIRTUAL_SERVER, () => {
    const middlewareFiles = listFiles(resolve(cwd, 'src/middleware'), '.ts');
    const layoutFiles = listFiles(resolve(cwd, 'src/layouts'), '.vue');
    return [
      `import { createShellWorker } from 'framework/worker';`,
      `import { routes } from '${routerPath}';`,
      `import config from '${configPath}';`,
      ...middlewareFiles.map((f, i) => `import * as mw${i} from '${f}';`),
      ...layoutFiles.map((f, i) => `import * as layout${i} from '${f}';`),
      ``,
      `const middleware = {`,
      ...middlewareFiles.map((f, i) => `  '${'./' + f.slice(srcDir.length + 1)}': mw${i},`),
      `};`,
      `const layouts = {`,
      ...layoutFiles.map((f, i) => `  '${'./' + f.slice(srcDir.length + 1)}': layout${i},`),
      `};`,
      ``,
      `export default createShellWorker({`,
      `  routes,`,
      `  middleware,`,
      `  layouts,`,
      `  document: config.document,`,
      `});`,
    ].join('\n');
  });
}

function shellEntryClientPlugin(cwd: string): Plugin {
  const routerPath = resolve(cwd, 'src/router.ts').replace(/\\/g, '/');
  const srcDir = resolve(cwd, 'src').replace(/\\/g, '/');

  return virtualModule('meta-framework:shell-entry-client', VIRTUAL_CLIENT, () => {
    const layoutFiles = listFiles(resolve(cwd, 'src/layouts'), '.vue');
    return [
      `import { hydrateShell } from 'framework/hydration';`,
      `import { routes } from '${routerPath}';`,
      ...layoutFiles.map((f, i) => `import * as layout${i} from '${f}';`),
      ``,
      `const layouts = {`,
      ...layoutFiles.map((f, i) => `  '${'./' + f.slice(srcDir.length + 1)}': layout${i},`),
      `};`,
      ``,
      `hydrateShell({`,
      `  routes,`,
      `  layouts,`,
      `});`,
    ].join('\n');
  });
}

export function defineShellConfig() {
  const cwd = process.cwd();

  return defineConfig(({ mode }) => {
    if (mode === 'client') {
      return {
        plugins: [vue(), vueBrowserBundlePlugin(), shellEntryClientPlugin(cwd)],
        build: {
          outDir: 'dist/client',
          manifest: true,
          rollupOptions: {
            input: VIRTUAL_CLIENT,
            external: ['vue'],
            output: {
              entryFileNames: `shell.[hash].js`,
              assetFileNames: `shell.[hash].[ext]`,
              format: 'es' as const,
              chunkFileNames: '[name].[hash].js',
            },
          },
        },
      };
    }

    return {
      plugins: [vue(), shellEntryServerPlugin(cwd)],
      build: {
        ssr: true,
        outDir: 'dist/server',
        rollupOptions: {
          input: VIRTUAL_SERVER,
          output: { entryFileNames: 'entry-server.js', format: 'es' as const },
        },
      },
      ssr: { noExternal: true, target: 'webworker' as const },
    };
  });
}
