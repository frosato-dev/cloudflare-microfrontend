import { execSync } from 'child_process';
import { resolve } from 'path';
import { collectAssets } from './collect-assets.js';
import { discoverWorkers, generateAppWranglerConfigs } from 'framework/discover';

const ROOT = resolve(import.meta.dirname, '..');

generateAppWranglerConfigs(ROOT);
collectAssets();

const workers = discoverWorkers(ROOT);

for (const worker of workers) {
  console.log(`\n  Deploying ${worker.wranglerConfig}...`);
  execSync(`npx wrangler deploy -c ${worker.wranglerConfig}`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

console.log('\n  All workers deployed.');
