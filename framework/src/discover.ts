import { resolve } from 'path';
import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

export interface DiscoveredWorker {
  name: string; // e.g. "fragment-header" or "front-office"
  type: 'fragment' | 'app';
  dir: string; // absolute path to package dir
  wranglerConfig: string; // relative path from root for wrangler CLI
}

/**
 * Scan packages/fragments/fragment-* and packages/apps/* for wrangler configs.
 * Returns discovered workers sorted: fragments first, then apps.
 */
export function discoverWorkers(root: string): DiscoveredWorker[] {
  const workers: DiscoveredWorker[] = [];

  // Scan fragments
  const fragmentsDir = resolve(root, 'packages/fragments');
  if (existsSync(fragmentsDir)) {
    for (const entry of readdirSync(fragmentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('fragment-')) continue;
      const dir = resolve(fragmentsDir, entry.name);
      const wrangler = resolve(dir, 'wrangler.jsonc');
      if (!existsSync(wrangler)) continue;
      workers.push({
        name: entry.name,
        type: 'fragment',
        dir,
        wranglerConfig: `packages/fragments/${entry.name}/wrangler.jsonc`,
      });
    }
  }

  // Scan apps
  const appsDir = resolve(root, 'packages/apps');
  if (existsSync(appsDir)) {
    for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = resolve(appsDir, entry.name);
      const wrangler = resolve(dir, 'wrangler.jsonc');
      if (!existsSync(wrangler)) continue;
      workers.push({
        name: entry.name,
        type: 'app',
        dir,
        wranglerConfig: `packages/apps/${entry.name}/wrangler.jsonc`,
      });
    }
  }

  return workers;
}

/** Discover only fragments */
export function discoverFragments(root: string) {
  return discoverWorkers(root).filter((w) => w.type === 'fragment');
}

/** Discover only apps */
export function discoverApps(root: string) {
  return discoverWorkers(root).filter((w) => w.type === 'app');
}

/**
 * Extract fragment ID from dirname: "fragment-header" → "header"
 */
export function fragmentId(name: string) {
  return name.replace(/^fragment-/, '');
}

/**
 * Parse a jsonc file (strip // comments, then JSON.parse).
 */
function parseJsonc(path: string) {
  const raw = readFileSync(path, 'utf-8');
  const stripped = raw
    .replace(/\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(stripped);
}

/**
 * Auto-generate service bindings in each app's wrangler.jsonc
 * from discovered fragments. Convention:
 *   fragment-header → binding FRAGMENT_HEADER, service fragment-header
 */
export function generateAppWranglerConfigs(root: string) {
  const fragments = discoverFragments(root);
  const apps = discoverApps(root);

  const services = fragments.map((f) => {
    const id = fragmentId(f.name);
    // Read the fragment's wrangler to get its worker name
    const fConfig = parseJsonc(resolve(f.dir, 'wrangler.jsonc'));
    return {
      binding: `FRAGMENT_${id.toUpperCase()}`,
      service: fConfig.name,
    };
  });

  for (const app of apps) {
    const configPath = resolve(app.dir, 'wrangler.jsonc');
    const config = parseJsonc(configPath);
    config.services = services;
    // Write back as plain JSON (no comments needed in generated output)
    const content = JSON.stringify(config, null, 2) + '\n';
    writeFileSync(configPath, content);
  }
}
