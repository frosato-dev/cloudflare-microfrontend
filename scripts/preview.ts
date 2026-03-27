import { Miniflare } from 'miniflare';
import { resolve } from 'path';
import { cpSync, mkdirSync, existsSync, rmSync } from 'fs';

const ROOT = resolve(import.meta.dirname, '..');
const STATIC_DIR = resolve(ROOT, 'dist/static');

// Collect all client assets into dist/static/assets/ so /assets/* URLs resolve
function collectAssets() {
  rmSync(STATIC_DIR, { recursive: true, force: true });
  const targetDir = resolve(STATIC_DIR, 'assets');
  mkdirSync(targetDir, { recursive: true });

  const packages = ['shell', 'fragment-header', 'fragment-product'];
  for (const pkg of packages) {
    const clientDir = resolve(ROOT, `packages/${pkg}/dist/client`);
    if (existsSync(clientDir)) {
      cpSync(clientDir, targetDir, { recursive: true });
    }
  }
  console.log('  Collected client assets into dist/static/assets/');
}

async function startPreview() {
  collectAssets();

  const mf = new Miniflare({
    port: 8787,
    compatibilityDate: '2024-12-01',
    compatibilityFlags: ['nodejs_compat'],
    workers: [
      {
        name: 'shell',
        scriptPath: resolve(ROOT, 'packages/shell/dist/server/entry-server.js'),
        modules: true,
        serviceBindings: {
          FRAGMENT_HEADER: 'fragment-header',
          FRAGMENT_PRODUCT: 'fragment-product',
        },
        assets: {
          directory: STATIC_DIR,
          binding: 'ASSETS',
          routerConfig: { has_user_worker: true },
        },
      },
      {
        name: 'fragment-header',
        scriptPath: resolve(ROOT, 'packages/fragment-header/dist/server/entry-server.js'),
        modules: true,
      },
      {
        name: 'fragment-product',
        scriptPath: resolve(ROOT, 'packages/fragment-product/dist/server/entry-server.js'),
        modules: true,
      },
    ],
  });

  const url = await mf.ready;
  console.log(`\n  Meta Framework preview (miniflare)`);
  console.log(`  -> ${url}\n`);
  console.log(`  Routes:`);
  console.log(`    /                    — Home (header fragment)`);
  console.log(`    /product/:id         — Product page (header + product fragments)`);
  console.log();
}

startPreview().catch((err) => {
  console.error(err);
  process.exit(1);
});
