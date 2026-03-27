import { execSync } from 'child_process';
import { resolve } from 'path';
import { cpSync, mkdirSync, existsSync, rmSync } from 'fs';

const ROOT = resolve(import.meta.dirname, '..');
const STATIC_DIR = resolve(ROOT, 'dist/static');

// Collect client assets
rmSync(STATIC_DIR, { recursive: true, force: true });
const targetDir = resolve(STATIC_DIR, 'assets');
mkdirSync(targetDir, { recursive: true });

for (const pkg of ['shell', 'fragment-header', 'fragment-product']) {
  const clientDir = resolve(ROOT, `packages/${pkg}/dist/client`);
  if (existsSync(clientDir)) cpSync(clientDir, targetDir, { recursive: true });
}

// Deploy fragments first (shell depends on them via service bindings)
for (const worker of ['fragment-header', 'fragment-product', 'shell']) {
  console.log(`\n  Deploying ${worker}...`);
  execSync(`npx wrangler deploy -c packages/${worker}/wrangler.jsonc`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

console.log('\n  All workers deployed.');
