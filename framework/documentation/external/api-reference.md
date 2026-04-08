# API Reference

Public exports organized by entry point.

## `framework` (main)

Source: `framework/src/index.ts`

### Types

| Type | Description |
|------|-------------|
| `AppRoute` | Route definition: `path`, `component`, `layout?`, `middleware?`, `cache?` |
| `LazyComponent` | `() => Promise<{ default: Component }>` |
| `FragmentResponse` | `{ html: string; css?: string; _meta?: { cached: boolean } }` |
| `Middleware` | `(request: Request) => Response \| void \| Promise<Response \| void>` |
| `MatchedRoute` | Resolved route with `props`, `path`, `layout`, `middleware`, `cache` |
| `RouteEntry` | Compiled route with `pattern: RegExp`, `paramNames: string[]` |
| `FragmentFetcher` | `(fragmentId, request, routeProps) => Promise<FragmentResponse>` |
| `AssetManifest` | `Record<string, string>` — logical name → hashed filename |

### Functions

#### `matchRoute(routes: RouteEntry[], pathname: string): MatchedRoute | null`
Match a pathname against compiled routes. Returns first match with extracted params.

#### `toRouteEntries(routes: AppRoute[]): RouteEntry[]`
Compile `AppRoute[]` into `RouteEntry[]` with regex patterns.

#### `runMiddleware(registry, names, request): Promise<Response | void>`
Run middleware chain. Returns early if any middleware returns a `Response`.

#### `buildLayoutRegistry(modules): Record<string, Component>`
Build layout name → component map from module imports.

#### `handleRequest(request, fetchFragment, config): Promise<Response>`
Core SSR handler. Matches route, runs middleware, renders layout+page, extracts fragments, fetches in parallel, streams HTML response.

### Components

#### `<Fragment id="..." :fragmentProps="..." />`
Renders a `<div data-fragment="..." data-props="...">` placeholder. The shell fills this with SSR content from the fragment worker.

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Fragment identifier (e.g. `'header'`) |
| `fragmentProps` | `Record<string, string>` | Props passed to the fragment worker |

---

## `framework/vite`

Source: `framework/src/vite/index.ts`

#### `defineShellConfig(): UserConfig`
Returns a Vite config for shell apps. Handles dual build (server default, `--mode client`), virtual entry modules, Vue browser bundle emission, and import map generation.

#### `defineFragmentConfig(name?: string): UserConfig`
Returns a Vite config for fragments. Name auto-inferred from directory. Handles dual build, virtual entries, Vue externalization.

---

## `framework/worker`

Source: `framework/src/worker/index.ts`

#### `createShellWorker(config): { fetch(request, env, ctx) }`
Creates a Cloudflare Worker fetch handler for a shell app. Handles manifest loading, page caching, fragment fetching via service bindings, debug mode, and streaming.

**Config:**
```ts
interface ShellWorkerConfig {
  routes: AppRoute[];
  middleware: Record<string, { default: Middleware }>;
  layouts: Record<string, { default: Component }>;
  document: { title: string; baseStyles?: string };
}
```

#### `createFragmentWorker(render, cacheControl): { fetch(request) }`
Creates a Worker fetch handler for a fragment. Calls `render(request)` and returns JSON with the specified `Cache-Control`.

---

## `framework/hydration`

Source: `framework/src/hydration/index.ts`

#### `hydrateShell(config): void`
Client-side shell hydration. Creates `vue-router`, mounts `#app` via `createSSRApp`, sets up link interception, SPA navigation with fragment diffing, and View Transitions.

**Config:**
```ts
{ routes: AppRoute[]; layouts: Record<string, { default: Component }> }
```

#### `hydrateFragment(id: string, App: Component): void`
Client-side fragment hydration. Registers in `__fragmentRegistry`, mounts at `[data-fragment="${id}"]` via `createSSRApp`.

---

## `framework/config`

Source: `framework/src/config.ts`

#### `defineApplicationConfig(config: ApplicationConfig): ApplicationConfig`
Type-safe identity function for app config.

#### `defineFragmentConfig(config: FragmentConfigOptions): FragmentConfigOptions`
Type-safe identity function for fragment runtime config.

**`FragmentConfigOptions`:**
```ts
interface FragmentConfigOptions {
  cache?: string;
  props?: (request: Request) => Record<string, string>;
}
```

---

## `framework/discover`

Source: `framework/src/discover.ts`

#### `discoverWorkers(root: string): DiscoveredWorker[]`
Scan `packages/fragments/fragment-*` and `packages/apps/*` for wrangler configs. Returns fragments first, then apps.

#### `discoverFragments(root): DiscoveredWorker[]`
Filter: only fragments.

#### `discoverApps(root): DiscoveredWorker[]`
Filter: only apps.

#### `fragmentId(name: string): string`
`'fragment-header'` → `'header'`

#### `generateAppWranglerConfigs(root): void`
Auto-generate `services` array in each app's `wrangler.jsonc` from discovered fragments.

**`DiscoveredWorker`:**
```ts
interface DiscoveredWorker {
  name: string;      // e.g. "fragment-header"
  type: 'fragment' | 'app';
  dir: string;       // absolute path
  wranglerConfig: string; // relative path from root
}
```

---

## `framework/debug`

Source: `framework/src/debug/index.ts`

#### `isDebugRequest(request): boolean`
Checks for `__debug=1` cookie.

#### `isNoCacheRequest(request): boolean`
Checks for `__debug_nocache=1` cookie.

#### `wrapFetcherWithDebug(fetcher, requestStart): { fetcher, getMeta }`
Wraps a `FragmentFetcher` to collect timing metadata per fragment.

#### `getDebugBarScript(fragmentIds): string`
Returns an inline `<script>` that renders the debug bar UI with waterfall, cache indicators, and toggle controls.
