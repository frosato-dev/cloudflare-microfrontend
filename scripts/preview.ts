import { execSync } from 'child_process';
import { resolve } from 'path';
import { collectAssets } from './collect-assets.js';

const ROOT = resolve(import.meta.dirname, '..');

collectAssets();

execSync(
  [
    'npx wrangler dev',
    '-c packages/shell/wrangler.jsonc',
    '-c packages/fragment-header/wrangler.jsonc',
    '-c packages/fragment-product/wrangler.jsonc',
  ].join(' '),
  { cwd: ROOT, stdio: 'inherit' },
);
