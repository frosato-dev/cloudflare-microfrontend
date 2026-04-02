import { resolve } from 'path';
import { cpSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'fs';

const ROOT = resolve(import.meta.dirname, '..');
const STATIC_DIR = resolve(ROOT, 'dist/static');
const PACKAGES = ['shell', 'fragment-header', 'fragment-product'];

export function collectAssets() {
  rmSync(STATIC_DIR, { recursive: true, force: true });
  const targetDir = resolve(STATIC_DIR, 'assets');
  mkdirSync(targetDir, { recursive: true });

  const mergedManifest: Record<string, string> = {};

  for (const pkg of PACKAGES) {
    const clientDir = resolve(ROOT, `packages/${pkg}/dist/client`);
    if (!existsSync(clientDir)) continue;

    // Read Vite manifest if present
    const manifestPath = resolve(clientDir, '.vite/manifest.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      for (const [, entry] of Object.entries(manifest) as [string, any][]) {
        if (entry.file) {
          const logicalName = entry.file.replace(/\.[a-zA-Z0-9_-]{8}\./, '.');
          mergedManifest[logicalName] = entry.file;
        }
        if (entry.css) {
          for (const cssFile of entry.css) {
            const logicalCss = cssFile.replace(/\.[a-zA-Z0-9_-]{8}\./, '.');
            mergedManifest[logicalCss] = cssFile;
          }
        }
      }
    }

    // Copy all built assets (skip .vite dir)
    const entries = readdirSync(clientDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.vite') continue;
      const src = resolve(clientDir, entry.name);
      const dest = resolve(targetDir, entry.name);
      cpSync(src, dest, { recursive: true });
    }
  }

  // Write merged manifest
  writeFileSync(resolve(targetDir, 'manifest.json'), JSON.stringify(mergedManifest, null, 2));

  // Also write manifest into shell's dist/server so the worker can import it
  const shellServerDir = resolve(ROOT, 'packages/shell/dist/server');
  if (existsSync(shellServerDir)) {
    writeFileSync(resolve(shellServerDir, 'manifest.json'), JSON.stringify(mergedManifest, null, 2));
  }

  console.log('  Assets collected. Manifest:', mergedManifest);
}
