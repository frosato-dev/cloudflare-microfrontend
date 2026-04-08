# CLI

The `framework-cli` binary is provided by the `framework` package.

## Commands

### `framework-cli preview`

Build assets and start a local multi-worker dev server via `wrangler dev`.

```bash
framework-cli preview [--app <name>] [--port <port>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--app <name>` | first app found | Which shell app to serve |
| `--port <port>` | `8787` | Local dev port |

**What it does:**
1. `generateAppWranglerConfigs()` — auto-generates service bindings
2. `collectAssets()` — merges all client builds into `dist/static/`
3. Starts `wrangler dev` with all fragment + app wrangler configs

### `framework-cli deploy`

Deploy workers to Cloudflare. Supports incremental deploys.

```bash
framework-cli deploy [--since <ref>] [--all]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--since <ref>` | — | Only deploy packages changed since git ref (e.g. `HEAD~1`) |
| `--all` | — | Force deploy all workers (overrides `--since`) |

**What it does:**
1. `generateAppWranglerConfigs()` — auto-generates service bindings
2. `collectAssets()` — merges all client builds
3. If `--since`: runs `getChangedPackages()` to diff git history
   - If `framework/src/` (non-CLI) changed → deploys all workers
   - Otherwise → only changed packages
4. Deploys each worker sequentially via `wrangler deploy`

## Monorepo Scripts

These scripts in `monorepo/package.json` wrap the CLI:

| Script | Command |
|--------|---------|
| `pnpm run preview` | `pnpm run build && framework-cli preview` |
| `pnpm run preview:front-office` | `pnpm run build && framework-cli preview --app front-office` |
| `pnpm run deploy:changed` | `pnpm -r --filter '...[HEAD~1]' run build && framework-cli deploy --since HEAD~1` |
| `pnpm run deploy:all` | `pnpm run clean && pnpm run build && framework-cli deploy --all` |
