import { execSync } from 'child_process';
import { relative } from 'path';

/** Return set of package dir names that have changes vs a git ref */
export function getChangedPackages(root: string, ref: string): Set<string> {
  // git diff outputs paths relative to repo root, not cwd
  const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: root, encoding: 'utf-8' }).trim();
  const prefix = relative(gitRoot, root); // e.g. "monorepo"
  const output = execSync(`git diff --name-only ${ref}`, { cwd: root, encoding: 'utf-8' });
  const dirs = new Set<string>();
  const pkgRe = new RegExp(`^${prefix}/packages/(?:apps|fragments)/([^/]+)/`);
  for (const line of output.trim().split('\n')) {
    const m = line.match(pkgRe);
    if (m) dirs.add(m[1]);
    // framework runtime changes (not cli tooling) → redeploy all
    if (/^framework\/src\/(?!cli\/)/.test(line)) dirs.add('__framework__');
  }
  return dirs;
}
