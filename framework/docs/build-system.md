# Build System

Each package (shell app or fragment) produces two Vite builds: a **server** bundle (Cloudflare Worker) and a **client** bundle (browser JS + CSS). A post-build step collects all client assets into a shared static directory with a unified manifest.

---

## Vite plugins

The framework provides two config helpers that wire up everything via virtual modules — no manual entry files needed.

### `defineShellConfig()` (shell apps)

**Server build:**
- Virtual entry `virtual:shell-entry-server` auto-imports routes, middleware, layouts, config
- Calls `createShellWorker(...)` → exports a Worker with a `fetch` handler
- Target: `webworker`, all deps bundled (`noExternal: true`)
- Output: `dist/server/entry-server.js`

**Client build** (mode=client):
- Virtual entry `virtual:shell-entry-client` imports routes + layouts
- Calls `hydrateShell(...)` → mounts vue-router + layout at `#app`
- Vue is externalized (loaded via import map)
- Output: `dist/client/shell.<hash>.js` + CSS

**Vue browser bundle plugin:**
- Reads `vue.runtime.esm-browser.prod.js` from node_modules
- Emits it as `vue.<hash>.js` in the client build
- This is the single shared Vue runtime for the whole page

### `defineFragmentConfig()` (fragments)

**Server build:**
- Virtual entry `virtual:fragment-entry-server` imports `App.vue` + `fragment.config.ts`
- Generates a `render(request)` function that extracts props from config and SSR's the component
- Calls `createFragmentWorker(render, cacheControl)`
- Output: `dist/server/entry-server.js`

**Client build** (mode=client):
- Virtual entry `virtual:fragment-entry-client` (or real `src/entry-client.ts` if it exists)
- Calls `hydrateFragment(id, App)` → mounts at `[data-fragment="id"]`
- Vue externalized
- Output: `dist/client/fragment-<name>.<hash>.js` + CSS

## Asset collection (`collectAssets`)

After all packages build, `collectAssets(root)` runs:

1. Scans all workers' `dist/client/` directories
2. Reads each Vite manifest, strips hashes to get logical names
3. Copies all assets into `dist/static/assets/`
4. Detects the vue browser bundle (`vue.<hash>.js`)
5. Writes unified `manifest.json` mapping logical → hashed names
6. Copies manifest into each app's `dist/server/` so workers can resolve asset URLs at runtime

The shell worker lazy-loads this manifest via `env.ASSETS.fetch('manifest.json')` on first request, then uses it to build `<link>` and `<script>` tags with correct hashed filenames.

## Build order

```
pnpm run build
  → each fragment: vite build (server) + vite build --mode client
  → each app: vite build (server) + vite build --mode client
  → collectAssets() merges everything into dist/static/
  → generateAppWranglerConfigs() wires up service bindings
```
