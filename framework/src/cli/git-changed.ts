import { execSync } from 'child_process';

/** Return set of package dir names that have changes vs a git ref */
export function getChangedPackages(root: string, ref: string): Set<string> {
  const output = execSync(`git diff --name-only ${ref}`, { cwd: root, encoding: 'utf-8' });
  const dirs = new Set<string>();
  for (const line of output.trim().split('\n')) {
    const m = line.match(/^packages\/(?:apps|fragments)\/([^/]+)\//);
    if (m) dirs.add(m[1]);
  }
  if (output.includes('framework/')) dirs.add('__framework__');
  return dirs;
}
