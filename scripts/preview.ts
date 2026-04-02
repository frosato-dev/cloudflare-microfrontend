import { execSync } from 'child_process';
import { resolve } from 'path';
import { collectAssets } from './collect-assets.js';

const ROOT = resolve(import.meta.dirname, '..');

collectAssets();

execSync(
  [
    'npx wrangler dev',
    '-c packages/apps/front-office/wrangler.jsonc',
    '-c packages/fragments/fragment-header/wrangler.jsonc',
    '-c packages/fragments/fragment-product/wrangler.jsonc',
  ].join(' '),
  { cwd: ROOT, stdio: 'inherit' },
);
