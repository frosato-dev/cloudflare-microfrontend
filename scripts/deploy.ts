import { execSync } from 'child_process';
import { resolve } from 'path';
import { collectAssets } from './collect-assets.js';

const ROOT = resolve(import.meta.dirname, '..');

collectAssets();

for (const worker of ['fragment-header', 'fragment-product', 'shell']) {
  console.log(`\n  Deploying ${worker}...`);
  execSync(`npx wrangler deploy -c packages/${worker}/wrangler.jsonc`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

console.log('\n  All workers deployed.');
