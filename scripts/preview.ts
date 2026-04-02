import { execSync } from 'child_process';
import { resolve } from 'path';
import { collectAssets } from './collect-assets.js';
import { discoverWorkers, generateAppWranglerConfigs } from '../packages/framework/src/discover.js';

const ROOT = resolve(import.meta.dirname, '..');

generateAppWranglerConfigs(ROOT);
collectAssets();

const workers = discoverWorkers(ROOT);
// Apps must come first — first -c is the entrypoint worker for wrangler dev
const sorted = [...workers.filter((w) => w.type === 'app'), ...workers.filter((w) => w.type !== 'app')];
const configArgs = sorted.map((w) => `-c ${w.wranglerConfig}`).join(' ');

execSync(`npx wrangler dev ${configArgs}`, { cwd: ROOT, stdio: 'inherit' });
