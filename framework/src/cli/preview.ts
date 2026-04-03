import { execSync } from 'child_process';
import { collectAssets } from '../collect-assets.ts';
import { discoverWorkers, generateAppWranglerConfigs } from '../discover.ts';
import { parseArg } from './args.ts';

export function preview(root: string, args: string[]) {
  generateAppWranglerConfigs(root);
  collectAssets(root);

  const workers = discoverWorkers(root);
  const appFilter = parseArg(args, '--app');

  const allApps = workers.filter((w) => w.type === 'app');
  const app = appFilter ? allApps.find((w) => w.name === appFilter) : allApps[0];

  if (!app) {
    console.error(`App "${appFilter}" not found. Available: ${allApps.map((w) => w.name).join(', ')}`);
    process.exit(1);
  }

  const fragments = workers.filter((w) => w.type === 'fragment');
  const fragmentArgs = fragments.map((w) => `-c ${w.wranglerConfig}`).join(' ');
  const configArgs = `-c ${app.wranglerConfig} ${fragmentArgs}`;
  const port = parseArg(args, '--port') ?? '8787';
  const cmd = `npx wrangler dev ${configArgs} --port ${port}`;

  console.log(`\n  Starting ${app.name} on :${port}`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}
