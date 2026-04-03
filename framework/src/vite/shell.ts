import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { existsSync, readdirSync } from 'fs';

const VIRTUAL_SERVER = 'virtual:shell-entry-server';
const RESOLVED_SERVER = '\0' + VIRTUAL_SERVER;
const VIRTUAL_CLIENT = 'virtual:shell-entry-client';
const RESOLVED_CLIENT = '\0' + VIRTUAL_CLIENT;

/** List files matching a glob-like pattern in a directory */
function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => resolve(dir, f).replace(/\\/g, '/'));
}

/** Generate an object literal from files: { './relative/path': await import('abs') } */
function buildEagerImports(files: string[], baseDir: string): string {
  if (!files.length) return '{}';
  const entries = files.map((f) => {
    const rel = './' + f.slice(baseDir.length + 1);
    return `  '${rel}': await import('${f}')`;
  });
  return `{\n${entries.join(',\n')}\n}`;
}

function shellEntryServerPlugin(cwd: string): Plugin {
  const configPath = resolve(cwd, 'application.config.ts').replace(/\\/g, '/');
  const routerPath = resolve(cwd, 'src/router.ts').replace(/\\/g, '/');
  const srcDir = resolve(cwd, 'src').replace(/\\/g, '/');

  return {
    name: 'meta-framework:shell-entry-server',
    resolveId(id) {
      if (id === VIRTUAL_SERVER) return RESOLVED_SERVER;
    },
    load(id) {
      if (id !== RESOLVED_SERVER) return;
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
    },
  };
}

function shellEntryClientPlugin(cwd: string): Plugin {
  const routerPath = resolve(cwd, 'src/router.ts').replace(/\\/g, '/');
  const srcDir = resolve(cwd, 'src').replace(/\\/g, '/');

  return {
    name: 'meta-framework:shell-entry-client',
    resolveId(id) {
      if (id === VIRTUAL_CLIENT) return RESOLVED_CLIENT;
    },
    load(id) {
      if (id !== RESOLVED_CLIENT) return;
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
    },
  };
}

export function defineShellConfig() {
  const cwd = process.cwd();
  const hasConfig = existsSync(resolve(cwd, 'application.config.ts'));

  return defineConfig(({ mode }) => {
    if (mode === 'client') {
      const clientInput = hasConfig
        ? VIRTUAL_CLIENT
        : resolve(cwd, 'src/entry-client.ts');

      return {
        plugins: [vue(), ...(hasConfig ? [shellEntryClientPlugin(cwd)] : [])],
        build: {
          outDir: 'dist/client',
          manifest: true,
          rollupOptions: {
            input: clientInput,
            output: {
              entryFileNames: `shell.[hash].js`,
              assetFileNames: `shell.[hash].[ext]`,
              format: 'es' as const,
              chunkFileNames: '[name].[hash].js',
              manualChunks: { vue: ['vue'] },
            },
          },
        },
      };
    }

    if (hasConfig) {
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
    }

    return {
      plugins: [vue()],
      build: {
        ssr: 'src/entry-server.ts',
        outDir: 'dist/server',
        rollupOptions: { output: { format: 'es' as const } },
      },
      ssr: { noExternal: true, target: 'webworker' as const },
    };
  });
}
