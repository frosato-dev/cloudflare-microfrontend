import { spawn, type ChildProcess } from 'child_process';
import { resolve } from 'path';
import { collectAssets } from './collect-assets.js';
import { discoverWorkers, generateAppWranglerConfigs } from '../packages/framework/src/discover.js';

const ROOT = resolve(import.meta.dirname, '..');
const BASE_PORT = 8787;
const BASE_INSPECTOR_PORT = 9229;

generateAppWranglerConfigs(ROOT);
collectAssets();

const workers = discoverWorkers(ROOT);
const apps = workers.filter((w) => w.type === 'app');
const fragments = workers.filter((w) => w.type === 'fragment');
const fragmentArgs = fragments.map((w) => `-c ${w.wranglerConfig}`).join(' ');

const children: ChildProcess[] = [];

function cleanup() {
  children.forEach((p) => p.kill());
  process.exit();
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

/** Wait for "Ready on" in wrangler output (may appear on stdout or stderr) */
function startApp(app: typeof apps[0], index: number): Promise<ChildProcess> {
  return new Promise((resolve_p) => {
    const port = BASE_PORT + index;
    const inspectorPort = BASE_INSPECTOR_PORT + index;
    const configArgs = `-c ${app.wranglerConfig} ${fragmentArgs}`;
    const cmd = `npx wrangler dev ${configArgs} --port ${port} --inspector-port ${inspectorPort}`;

    console.log(`\n  Starting ${app.name} on :${port}`);

    const child = spawn(cmd, { cwd: ROOT, shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
    let resolved = false;

    const onData = (data: Buffer) => {
      const str = data.toString();
      process.stdout.write(data);
      if (!resolved && str.includes('Ready on')) {
        resolved = true;
        resolve_p(child);
      }
    };

    child.stdout!.on('data', onData);
    child.stderr!.on('data', onData);
    child.on('error', (err) => console.error(`${app.name} error:`, err));
    children.push(child);
  });
}

// Start apps sequentially — each waits for the previous to be ready
(async () => {
  for (let i = 0; i < apps.length; i++) {
    await startApp(apps[i], i);
  }
  console.log(`\n  All apps running.`);
})();
