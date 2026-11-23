import { resolve } from 'path';
import { cpSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { discoverWorkers } from './discover.ts';

/**
 * Per app: copy its client build into <app>/dist/static/assets/ + write its own manifest.json.
 * Each app has its own static dir (wrangler `assets.directory: "dist/static"`) — apps never share
 * logical names (shell.js/shell.css). Fragments serve their own assets (/_fragments/<id>/*).
 */
export function collectAssets(root: string) {
  const apps = discoverWorkers(root).filter((w) => w.type === 'app');

  for (const app of apps) {
    const staticDir = resolve(app.dir, 'dist/static');
    const targetDir = resolve(staticDir, 'assets');
    rmSync(staticDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });

    const clientDir = resolve(app.dir, 'dist/client');
    if (!existsSync(clientDir)) continue;

    const manifest: Record<string, string> = {};

    // Vite manifest → logical name (hash stripped) → hashed file
    const viteManifestPath = resolve(clientDir, '.vite/manifest.json');
    if (existsSync(viteManifestPath)) {
      const viteManifest = JSON.parse(readFileSync(viteManifestPath, 'utf-8'));
      for (const entry of Object.values(viteManifest) as any[]) {
        for (const file of [entry.file, ...(entry.css ?? [])].filter(Boolean)) {
          manifest[file.replace(/\.[a-zA-Z0-9_-]{8}\./, '.')] = file;
        }
      }
    }

    // Copy all built assets (skip .vite dir)
    for (const entry of readdirSync(clientDir, { withFileTypes: true })) {
      if (entry.name === '.vite') continue;
      cpSync(resolve(clientDir, entry.name), resolve(targetDir, entry.name), { recursive: true });
    }

    // Vue browser bundle is a raw emitted asset → not in the Vite manifest
    const vueFile = readdirSync(targetDir).find((f) => /^vue\.[a-zA-Z0-9_-]{8}\.js$/.test(f));
    if (vueFile) manifest['vue.js'] = vueFile;

    writeFileSync(resolve(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    writeFileSync(resolve(staticDir, '_headers'), `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`);

    console.log(`  Assets collected for ${app.name}:`, manifest);
  }
}
