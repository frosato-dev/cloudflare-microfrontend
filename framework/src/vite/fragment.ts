import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve, basename } from 'path';
import { existsSync } from 'fs';

const VIRTUAL_ENTRY_CLIENT = 'virtual:fragment-entry-client';
const RESOLVED_VIRTUAL = '\0' + VIRTUAL_ENTRY_CLIENT;

/**
 * Vite plugin that provides a virtual entry-client.ts for fragments.
 * If the fragment has a real src/entry-client.ts, it's used instead.
 */
function fragmentEntryClientPlugin(fragmentId: string, srcDir: string): Plugin {
  return {
    name: 'meta-framework:fragment-entry-client',
    resolveId(id) {
      if (id === VIRTUAL_ENTRY_CLIENT) return RESOLVED_VIRTUAL;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL) return;
      const appPath = resolve(srcDir, 'App.vue').replace(/\\/g, '/');
      return [
        `import { hydrateFragment } from '@meta-framework/core/hydration/fragment';`,
        `import App from '${appPath}';`,
        `hydrateFragment('${fragmentId}', App);`,
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
