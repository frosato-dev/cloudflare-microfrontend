import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve, basename } from 'path';
import { existsSync } from 'fs';

const VIRTUAL_ENTRY_CLIENT = 'virtual:fragment-entry-client';
const RESOLVED_VIRTUAL_CLIENT = '\0' + VIRTUAL_ENTRY_CLIENT;
const VIRTUAL_ENTRY_SERVER = 'virtual:fragment-entry-server';
const RESOLVED_VIRTUAL_SERVER = '\0' + VIRTUAL_ENTRY_SERVER;

/**
 * Vite plugin that provides a virtual entry-client.ts for fragments.
 * If the fragment has a real src/entry-client.ts, it's used instead.
 */
function fragmentEntryClientPlugin(fragmentId: string, srcDir: string): Plugin {
  return {
    name: 'meta-framework:fragment-entry-client',
    resolveId(id) {
      if (id === VIRTUAL_ENTRY_CLIENT) return RESOLVED_VIRTUAL_CLIENT;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_CLIENT) return;
      const appPath = resolve(srcDir, 'App.vue').replace(/\\/g, '/');
      return [
        `import { hydrateFragment } from 'framework/hydration';`,
        `import App from '${appPath}';`,
        `hydrateFragment('${fragmentId}', App);`,
      ].join('\n');
    },
  };
}

function fragmentEntryServerPlugin(cwd: string): Plugin {
  const configPath = resolve(cwd, 'fragment.config.ts').replace(/\\/g, '/');
  const appPath = resolve(cwd, 'src/App.vue').replace(/\\/g, '/');

  return {
    name: 'meta-framework:fragment-entry-server',
    resolveId(id) {
      if (id === VIRTUAL_ENTRY_SERVER) return RESOLVED_VIRTUAL_SERVER;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_SERVER) return;
      return [
        `import { createSSRApp } from 'vue';`,
        `import { renderToString } from 'vue/server-renderer';`,
        `import { createFragmentWorker } from 'framework/worker';`,
        `import App from '${appPath}';`,
        `import config from '${configPath}';`,
        ``,
        `async function render(request) {`,
        `  const props = config.props ? config.props(request) : {};`,
        `  const app = createSSRApp(App, props);`,
        `  const html = await renderToString(app);`,
        `  return { html };`,
        `}`,
        ``,
        `export default createFragmentWorker(render, config.cache ?? 'private, no-cache');`,
      ].join('\n');
    },
  };
}

/**
 * Define a fragment's Vite config.
 * Name is inferred from dirname (e.g. "fragment-header") — no arg needed.
 */
export function defineFragmentConfig(name?: string) {
  const cwd = process.cwd();
  const dirName = basename(cwd);
  const resolvedName = name ?? dirName;
  const fragmentId = resolvedName.replace(/^fragment-/, '');

  // Use real entry-client.ts if it exists, otherwise virtual module
  const realEntryClient = resolve(cwd, 'src/entry-client.ts');
  const hasRealEntryClient = existsSync(realEntryClient);
  const clientInput = hasRealEntryClient ? realEntryClient : VIRTUAL_ENTRY_CLIENT;

  const hasConfig = existsSync(resolve(cwd, 'fragment.config.ts'));

  return defineConfig(({ mode }) => {
    if (mode === 'client') {
      return {
        plugins: [vue(), fragmentEntryClientPlugin(fragmentId, resolve(cwd, 'src'))],
        build: {
          outDir: 'dist/client',
          manifest: true,
          rollupOptions: {
            input: clientInput,
            external: ['vue'],
            output: {
              entryFileNames: `${resolvedName}.[hash].js`,
              assetFileNames: `${resolvedName}.[hash].[ext]`,
              format: 'es' as const,
            },
          },
        },
      };
    }

    if (hasConfig) {
      return {
        plugins: [vue(), fragmentEntryServerPlugin(cwd)],
        build: {
          ssr: true,
          outDir: 'dist/server',
          rollupOptions: {
            input: VIRTUAL_ENTRY_SERVER,
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
