import { resolve } from 'path';
import { cpSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { discoverWorkers } from './discover.ts';

export function collectAssets(root: string) {
  const STATIC_DIR = resolve(root, 'dist/static');
  const workers = discoverWorkers(root);

  rmSync(STATIC_DIR, { recursive: true, force: true });
  const targetDir = resolve(STATIC_DIR, 'assets');
  mkdirSync(targetDir, { recursive: true });

  const mergedManifest: Record<string, string> = {};

  for (const worker of workers) {
    const clientDir = resolve(worker.dir, 'dist/client');
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

  // Detect emitted vue browser bundle (not in Vite manifest since it's a raw asset)
  const allFiles = readdirSync(targetDir);
  const vueFile = allFiles.find(f => /^vue\.[a-zA-Z0-9_-]{8}\.js$/.test(f));
  if (vueFile) mergedManifest['vue.js'] = vueFile;

  // Write merged manifest
  writeFileSync(resolve(targetDir, 'manifest.json'), JSON.stringify(mergedManifest, null, 2));

  // Write _headers file for Cloudflare static asset cache
  writeFileSync(resolve(STATIC_DIR, '_headers'), `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);

  console.log('  Assets collected. Manifest:', mergedManifest);
}
