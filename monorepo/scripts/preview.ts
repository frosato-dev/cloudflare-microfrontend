import { execSync } from 'child_process';
import { resolve } from 'path';
import { collectAssets } from './collect-assets.js';
import { discoverWorkers, generateAppWranglerConfigs } from 'framework/discover';

const ROOT = resolve(import.meta.dirname, '..');

generateAppWranglerConfigs(ROOT);
collectAssets();

const workers = discoverWorkers(ROOT);
const appFilter = process.argv.indexOf('--app') !== -1
  ? process.argv[process.argv.indexOf('--app') + 1]
  : undefined;

const allApps = workers.filter((w) => w.type === 'app');
const app = appFilter ? allApps.find((w) => w.name === appFilter) : allApps[0];

if (!app) {
  console.error(`App "${appFilter}" not found. Available: ${allApps.map((w) => w.name).join(', ')}`);
  process.exit(1);
}

const fragments = workers.filter((w) => w.type === 'fragment');
const fragmentArgs = fragments.map((w) => `-c ${w.wranglerConfig}`).join(' ');
const configArgs = `-c ${app.wranglerConfig} ${fragmentArgs}`;
const cmd = `npx wrangler dev ${configArgs} --port 8787`;

console.log(`\n  Starting ${app.name} on :8787`);
execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
