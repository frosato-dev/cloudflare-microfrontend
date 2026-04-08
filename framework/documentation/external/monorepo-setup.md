# Monorepo Setup

## Directory Structure

```
monorepo/
  package.json                 # Root scripts, volta config, framework dep
  pnpm-workspace.yaml          # Workspace definition
  dist/
    static/                    # collectAssets() output — served by Cloudflare
      assets/
        manifest.json
        shell.[hash].js
        shell.[hash].css
        vue.[hash].js
        fragment-header.[hash].js
        ...
  packages/
    apps/
      front-office/            # Shell worker
      back-office/
    fragments/
      fragment-header/
      fragment-footer/
      fragment-product/
```

## pnpm Workspace

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/apps/*"
  - "packages/fragments/*"
```

## Framework Dependency

The framework is linked as a workspace dependency:

```json
// monorepo/package.json
{
  "devDependencies": {
    "framework": "link:../framework"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "vue-router": "^4.4.0"
  }
}
```

Vue and vue-router are root dependencies shared by all packages.

## Build Order

Build must follow this order:

1. **Fragments** — each produces `dist/server/entry-server.js` + `dist/client/` assets
2. **Apps** — each produces `dist/server/entry-server.js` + `dist/client/` (with Vue bundle)
3. **`collectAssets()`** — merges all `dist/client/` into `dist/static/`, writes `manifest.json`, copies manifest into each app's `dist/server/`

`pnpm run build` (= `pnpm -r run build`) handles this because pnpm respects workspace dependency order.

Each package's `build` script typically runs:
```bash
vite build && vite build --mode client
```

## Service Binding Auto-Generation

`generateAppWranglerConfigs()` scans all fragments, reads each fragment's `wrangler.jsonc` for the worker name, and writes `services` entries into each app's `wrangler.jsonc`:

```
fragment-header → { binding: "FRAGMENT_HEADER", service: "fragment-header" }
```

This runs automatically during `preview` and `deploy`.

## Add a New App

1. Create `monorepo/packages/apps/<name>/`
2. Add files: `vite.config.ts`, `application.config.ts`, `wrangler.jsonc`, `src/router.ts`, `src/layouts/default.vue`, `src/pages/index.vue`
3. Add `package.json` with `name`, build scripts, and a `"build": "vite build && vite build --mode client"` script
4. Run `pnpm install` from monorepo root

See [App Guide](app-guide.md) for file details.

## Add a New Fragment

1. Create `monorepo/packages/fragments/fragment-<name>/`
2. Add files: `vite.config.ts`, `fragment.config.ts`, `wrangler.jsonc`, `src/App.vue`
3. Add `package.json` with `name: "fragment-<name>"` and build script
4. Run `pnpm install`
5. Reference the fragment in a layout: `<Fragment id="<name>" />`

Service bindings are auto-generated — no manual wrangler config editing needed.

See [Fragment Guide](fragment-guide.md) for file details.
