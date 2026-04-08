import { execSync } from 'child_process';
import { collectAssets } from '../collect-assets.ts';
import { discoverWorkers, generateAppWranglerConfigs } from '../discover.ts';
import { getChangedPackages } from './git-changed.ts';
import { parseArg } from './args.ts';

export function deploy(root: string, args: string[]) {
  generateAppWranglerConfigs(root);
  collectAssets(root); // always runs — needs all manifests

  const workers = discoverWorkers(root);
  const since = parseArg(args, '--since');
  const forceAll = args.includes('--all');

  let toDeploy = workers;
  if (since && !forceAll) {
    const changed = getChangedPackages(root, since);
    if (changed.has('__framework__')) {
      console.log('  Framework changed — deploying all workers');
    } else {
      toDeploy = workers.filter((w) => changed.has(w.name));
      const skipped = workers.length - toDeploy.length;
      if (skipped) console.log(`  Skipping ${skipped} unchanged worker(s)`);
    }
  }

  for (const worker of toDeploy) {
    console.log(`\n  Deploying ${worker.wranglerConfig}...`);
    execSync(`npx wrangler deploy -c ${worker.wranglerConfig}`, {
      cwd: root,
      stdio: 'inherit',
    });
  }

  console.log('\n  Done.');
}
