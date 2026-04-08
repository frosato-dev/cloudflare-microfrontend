# Discovery & Codegen

Source: `framework/src/discover.ts`, `framework/src/cli/deploy.ts`, `framework/src/cli/git-changed.ts`

## `discoverWorkers(root)`

Scans the monorepo for workers:

1. Scan `packages/fragments/` for directories matching `fragment-*` with a `wrangler.jsonc`
2. Scan `packages/apps/` for directories with a `wrangler.jsonc`
3. Return sorted: fragments first, then apps

### `DiscoveredWorker` Shape

```ts
interface DiscoveredWorker {
  name: string;           // "fragment-header" or "front-office"
  type: 'fragment' | 'app';
  dir: string;            // Absolute path
  wranglerConfig: string; // Relative path from root: "packages/fragments/fragment-header/wrangler.jsonc"
}
```

Helper functions:
- `discoverFragments(root)` — filter for `type === 'fragment'`
- `discoverApps(root)` — filter for `type === 'app'`
- `fragmentId(name)` — `'fragment-header'` → `'header'`

## `generateAppWranglerConfigs(root)`

Auto-generates service bindings in each app's `wrangler.jsonc`:

1. Discover all fragments
2. For each fragment, read its `wrangler.jsonc` to get the worker name
3. Build service binding: `{ binding: "FRAGMENT_HEADER", service: "fragment-header" }`
4. Write `services` array into each app's `wrangler.jsonc`

Convention: `fragment-header` → binding `FRAGMENT_${id.toUpperCase()}` = `FRAGMENT_HEADER`

The output is plain JSON (comments stripped). Runs automatically during `preview` and `deploy`.

## `getChangedPackages(root, ref)`

Determines which packages changed since a git ref:

```ts
function getChangedPackages(root: string, ref: string): Set<string>
```

1. Get git root via `git rev-parse --show-toplevel`
2. Run `git diff --name-only ${ref}`
3. For each changed file:
   - Match `${prefix}/packages/(apps|fragments)/<name>/` → add package name to set
   - Match `framework/src/` (excluding `cli/`) → add `'__framework__'` sentinel
4. Return set of changed package names

The `__framework__` sentinel triggers a full deploy — if framework runtime code changed, all workers need redeploying.

## Deploy Flow

```
framework-cli deploy [--since <ref>] [--all]
```

1. `generateAppWranglerConfigs(root)` — update service bindings
2. `collectAssets(root)` — always runs (needs all manifests)
3. Determine deploy scope:
   - `--all` → all workers
   - `--since <ref>` → only `getChangedPackages()` results
   - `__framework__` in changed set → all workers
4. Sequential `wrangler deploy -c <config>` for each worker

Workers deploy sequentially (not parallel) to avoid race conditions with Cloudflare's API.

## Preview Flow

```
framework-cli preview [--app <name>] [--port <port>]
```

1. `generateAppWranglerConfigs(root)`
2. `collectAssets(root)`
3. Build wrangler CLI args: `-c <app-config> -c <frag1-config> -c <frag2-config> ...`
4. Run `wrangler dev ${configArgs} --port ${port}`

All workers (app + fragments) run in a single wrangler dev process with multi-worker mode.
