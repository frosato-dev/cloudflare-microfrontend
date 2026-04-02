import { execSync } from 'child_process';
import { resolve } from 'path';
import { collectAssets } from './collect-assets.js';

const ROOT = resolve(import.meta.dirname, '..');

collectAssets();

const workers = [
  'packages/fragments/fragment-header/wrangler.jsonc',
  'packages/fragments/fragment-product/wrangler.jsonc',
  'packages/apps/front-office/wrangler.jsonc',
];

for (const config of workers) {
  console.log(`\n  Deploying ${config}...`);
  execSync(`npx wrangler deploy -c ${config}`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

console.log('\n  All workers deployed.');
