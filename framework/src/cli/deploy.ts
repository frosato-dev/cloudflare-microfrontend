import { execSync } from 'child_process';
import { collectAssets } from '../collect-assets.ts';
import { discoverWorkers, generateAppWranglerConfigs } from '../discover.ts';

export function deploy(root: string, _args: string[]) {
  generateAppWranglerConfigs(root);
  collectAssets(root);

  const workers = discoverWorkers(root);

  for (const worker of workers) {
    console.log(`\n  Deploying ${worker.wranglerConfig}...`);
    execSync(`npx wrangler deploy -c ${worker.wranglerConfig}`, {
      cwd: root,
      stdio: 'inherit',
    });
  }

  console.log('\n  All workers deployed.');
}
