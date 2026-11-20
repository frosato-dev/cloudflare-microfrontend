import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve, basename } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import { virtualModule } from './virtual-module.ts';
import type { FragmentBuildInfo } from '../types.ts';

const VIRTUAL_ENTRY_CLIENT = 'virtual:fragment-entry-client';
const VIRTUAL_ENTRY_SERVER = 'virtual:fragment-entry-server';
const VIRTUAL_BUILD_INFO = 'virtual:fragment-build-info';
const ASSET_BASE = '/assets/';

/**
 * Inlines the fragment's build info (version, vue version, client assets) into the server bundle.
 * Reads the client manifest → client build must run before the server build.
 * Custom entry-server.ts can `import buildInfo from 'virtual:fragment-build-info'`.
 */
function fragmentBuildInfoPlugin(cwd: string, fragmentId: string): Plugin {
  return virtualModule('meta-framework:fragment-build-info', VIRTUAL_BUILD_INFO, () => {
    const manifestPath = resolve(cwd, 'dist/client/.vite/manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`[fragment-${fragmentId}] missing ${manifestPath} — run the client build first (vite build --mode client && vite build)`);
    }
    const raw = readFileSync(manifestPath, 'utf-8');
    const entry = Object.values(JSON.parse(raw) as Record<string, any>).find((e) => e.isEntry);
    const url = (file: string) => ASSET_BASE + file;
    const info: FragmentBuildInfo = {
      version: `${fragmentId}@${createHash('sha256').update(raw).digest('hex').slice(0, 8)}`,
      vue: createRequire(resolve(cwd, 'package.json'))('vue/package.json').version,
      assets: { js: entry ? url(entry.file) : undefined, css: (entry?.css ?? []).map(url) },
    };
    return `export default ${JSON.stringify(info)};`;
  });
}

function fragmentEntryClientPlugin(fragmentId: string, srcDir: string): Plugin {
  const appPath = resolve(srcDir, 'App.vue').replace(/\\/g, '/');
  return virtualModule('meta-framework:fragment-entry-client', VIRTUAL_ENTRY_CLIENT, () => [
    `import { hydrateFragment } from 'framework/hydration';`,
    `import App from '${appPath}';`,
    `hydrateFragment('${fragmentId}', App);`,
  ].join('\n'));
}

function fragmentEntryServerPlugin(cwd: string): Plugin {
  const configPath = resolve(cwd, 'fragment.config.ts').replace(/\\/g, '/');
  const appPath = resolve(cwd, 'src/App.vue').replace(/\\/g, '/');
  return virtualModule('meta-framework:fragment-entry-server', VIRTUAL_ENTRY_SERVER, () => [
    `import { createSSRApp } from 'vue';`,
    `import { renderToString } from 'vue/server-renderer';`,
    `import { createFragmentWorker } from 'framework/worker';`,
    `import App from '${appPath}';`,
    `import config from '${configPath}';`,
    `import buildInfo from '${VIRTUAL_BUILD_INFO}';`,
    ``,
    `async function render(request) {`,
    `  const props = config.props ? config.props(request) : {};`,
    `  const app = createSSRApp(App, props);`,
    `  const html = await renderToString(app);`,
    `  return { html };`,
    `}`,
    ``,
    `export default createFragmentWorker(render, config.cache ?? 'private, no-cache', buildInfo);`,
  ].join('\n'));
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
        plugins: [vue(), fragmentEntryServerPlugin(cwd), fragmentBuildInfoPlugin(cwd, fragmentId)],
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
      plugins: [vue(), fragmentBuildInfoPlugin(cwd, fragmentId)],
      build: {
        ssr: 'src/entry-server.ts',
        outDir: 'dist/server',
        rollupOptions: { output: { format: 'es' as const } },
      },
      ssr: { noExternal: true, target: 'webworker' as const },
    };
  });
}
