# Project: Fragment-Owned Assets

**Status:** local dev and the `*.workers.dev` mode are implemented (branch `feat/fragment-owned-assets`). The R2/CDN production setup is pending, as it needs a custom domain.
**Addresses:** [limitations](limitations.md) #1 (assets served by the shell) and #2 (version skew)

## Problem

Every fragment's client build is merged into the shell's `dist/static` and listed in one shared manifest, which the shell loads once per isolate. As a result:

- Shipping new fragment JS/CSS means redeploying the shell, so fragment teams aren't independent.
- A fragment's server HTML (from the fragment's deploy) and its client JS (from the shell's deploy) can come from different versions, which causes hydration mismatches.

## Goals

1. A fragment deploy ships its server and client code together, with no shell deploy.
2. The JS that hydrates a fragment always comes from the same version as the HTML it rendered.
3. The shell can still start loading fragment assets early: `<head>` preloads and Early Hints.
4. Old asset versions stay reachable while cached HTML or open tabs reference them.
5. Storage stays portable (the Cloudflare hedge).

## Decisions

| Topic | Decision |
|---|---|
| Domain | Move from `*.workers.dev` to a custom domain (needed for routes, custom asset hostnames and, it seems, the Workers Cache API) |
| Storage | **R2 only**: one bucket, files are only ever added, never deleted |
| Serving | `static.<domain>` (R2 custom domain), long-lived immutable CDN caching. Add a same-origin Worker on `/_f/*` later only if measurements justify it |
| Contract | Fragment response headers carry its version, Vue version and asset list |
| CSS/JS placement | CSS `<link>` rendered **by the fragment itself**, inside its container (`fragmentRoot`). `<script>` comes from the fragment response and goes after `#app`. Best-effort preloads in `<head>` (speed) |
| Local asset path | `/_fragments/<id>/*` (reserved prefix, can't collide with app routes or the shell's `/assets/*`) |
| Retention | At least the longest HTML cache TTL plus a buffer (around 7 days). Storage cost is negligible |
| Skew during SPA navigation | Do a full page load when a fragment's version changed, instead of remounting |

### Why R2 only

- Compared with Workers static assets per fragment: those drop old files on every deploy, so keeping old versions would need extra work. R2 is simpler and S3-compatible.
- Downsides:
  - A cache miss at a given edge location (POP) goes back to the bucket's region. Hashed, immutable files keep the hit rate high.
  - It adds a separate origin, which needs CORS for module scripts and costs one extra connection (mitigated by `preconnect` and Early Hints).
- Cost: storage around $0.015/GB/month and reads around $0.36 per million beyond the free tier, mostly absorbed by the CDN. No egress fees. Prices are approximate.

### Why CSS goes in `<body>` (plus preloads in `<head>`)

- If all CSS is in `<head>`, the shell needs fragment assets before fragments respond. That means either a manifest lookup that can be stale (skew) or waiting for every fragment (no more streaming).
- In `<body>`, the CSS comes from the same response as the HTML, works with streaming, paints progressively, and keeps each fragment self-contained.
- Known catch: Firefox may not hold back rendering for a stylesheet in `<body>`, which can cause a flash of unstyled content (FOUC). The workaround is an empty `<script> </script>` after the `<link>`. To verify.
- Preloads in `<head>` come from asset lists the shell has already seen. If one is stale, the only cost is a wasted preload, because filenames are hashed.

## Design

### Asset layout in R2

```
static.<domain>/
  header/header.a1b2c3d4.js
  header/header.e5f6a7b8.css
  header/chunk-x.9c0d1e2f.js
  product/...
```

- The key prefix is the fragment ID. Files are hashed and immutable (`Cache-Control: public, max-age=31536000, immutable`).
- The bucket's CORS setting allows the app origins, so `<script type="module">` can load cross-origin.

### Fragment response contract

```
X-Fragment-Version: header@a1b2c3d
X-Fragment-Vue: 3.5.13
X-Fragment-Assets: {"js":"https://static.<domain>/header/header.a1b2c3d4.js","css":["https://static.<domain>/header/header.e5f6a7b8.css"]}

<body: html>
```

- Metadata goes in headers, so the body can later be streamed as raw HTML instead of JSON (limitation #13).
- The fragment Worker learns its own asset list at build time: the client build runs first, and its Vite manifest is inlined into the server build.
- The fragment cache stores the full response, headers included, so cached HTML and its assets stay consistent.

### Shell rendering

- The fragment renders its own `<link rel=stylesheet>` tags as part of its Vue app (`fragmentRoot(App, props, css)`), on both server and client. The tags sit inside the fragment container and survive hydration.
  - Why not emit them from the shell next to the container: the shell's Vue hydration would see an extra node and discard the server-rendered fragment.
  - Why not move them to `<head>` before hydrating: a possible one-frame flash of unstyled content.
- The `<script type=module>` comes from `X-Fragment-Assets` and goes in the collected list after `#app`.
- Head preloads: the shell keeps, in isolate memory, the latest `X-Fragment-Assets` seen for each fragment, and uses it for `<link rel=preload|modulepreload>` and the `Link` header (Early Hints). No extra infrastructure is needed, because it learns from real responses.
- `<link rel=preconnect href="https://static.<domain>" crossorigin>` in the first flush of `<head>`.
- Vue check: if `X-Fragment-Vue` doesn't satisfy the shell's Vue range, keep the server-rendered HTML, skip that fragment's script and log an alert.

### Client

- The fragment registry is keyed by `id` and stores `version`.
- During SPA navigation, if a fragment in the new page has a different `X-Fragment-Version` (exposed as `data-fragment-version`) than the loaded one, do a full page load (`location.assign`). The same applies when the shell's `<head>` module scripts changed (shell redeployed).
- A failed `import()` of a fragment script during SPA navigation also triggers a full page load.
- Scripts are loaded from the asset URL in the response, not found with the `fragment-<id>` filename regex.
- A `vite:preloadError` listener reloads the page when a lazy chunk fails to load (safety net).

### Deploy

Order per fragment:
1. Build the client, then the server, with the client manifest inlined.
2. Upload the client files to R2 under `<id>/`, skipping keys that already exist.
3. `wrangler deploy` the fragment Worker.

Assets are uploaded before the Worker, so new HTML never references missing files. The shell deploy no longer touches fragment assets.

## Local dev (implemented)

`framework-cli preview` runs every Worker in one `wrangler dev` process (`-c app -c fragment…`). Service bindings work locally.

- **Asset base is configurable**: the `FRAGMENT_ASSET_BASE` env var, read at build time.
  - Default: `/_fragments` (same origin)
  - Production with a CDN: `https://static.<domain>`
- **Serving:**
  - The shell forwards `/_fragments/<id>/*` to the `FRAGMENT_<ID>` binding.
  - The fragment Worker has `assets: { directory: "dist/client", run_worker_first: true }`. It strips the prefix and serves the file from `env.ASSETS`.
- **wrangler ≥ 4.165**: in multi-config `wrangler dev`, version 4.78 returned 500 for static assets of secondary Workers.
- **Preview clears the local Workers cache** on start. Otherwise, cached pages and fragments from a previous build reference assets that no longer exist (the retention problem, reproduced locally).
- **Open:** HMR or watch mode for a single fragment, and working on a fragment against a deployed shell.

## Without a custom domain (`*.workers.dev`)

The default `/_fragments` mode works deployed as is: each fragment's `wrangler deploy` uploads its own `dist/client`, and the shell forwards asset requests to it. Fragments are deployed independently already. Limitations compared with R2 + `static.<domain>`:

- Each asset request runs two Worker invocations (shell, then fragment), which is billed. On a cache miss, the CDN doesn't help.
- **Old versions aren't kept**: Workers static assets are replaced on each deploy. Cached HTML or open tabs that reference the previous hashes get 404, which the client recovers from by doing a full page load or reload.
- The Workers Cache API **is** active on `workers.dev` (checked: `cf-cache-status: HIT`). The first deploy showed why cache keys must change with the protocol: the new shell read JSON fragment responses cached by the old one and injected them as HTML. Shell cache keys now include `__fp=<FRAGMENT_PROTOCOL>`, which must be bumped on any incompatible protocol change.

## Code impact

| File | Change | Status |
|---|---|---|
| [fragment-protocol.ts](../../src/fragment-protocol.ts) | `X-Fragment-*` headers, `readFragmentResponse`, `FRAGMENT_ASSET_PREFIX` | ✅ |
| [fragment-root.ts](../../src/fragment-root.ts) | Fragment root component: own `<link>` tags + App | ✅ |
| [vite/fragment.ts](../../src/vite/fragment.ts) | `base`, `<id>/` output, `_headers`/`.assetsignore`, `virtual:fragment-build-info` | ✅ |
| [worker/fragment.ts](../../src/worker/fragment.ts) | HTML body + headers, serve `/_fragments/*` | ✅ |
| [worker/shell.ts](../../src/worker/shell.ts) | Parse headers, `knownAssets`, forward `/_fragments/*` | ✅ |
| [request-handler.ts](../../src/request-handler.ts) | Script from response, head preloads, `preconnect`, Vue check, `data-fragment-version` | ✅ |
| [hydration/](../../src/hydration/) | Registry version, skew → full page load, scripts by URL, `vite:preloadError` | ✅ |
| [collect-assets.ts](../../src/collect-assets.ts) | Shell assets only | ✅ |
| [cli/preview.ts](../../src/cli/preview.ts) | Clear the local cache | ✅ |
| [cli/deploy.ts](../../src/cli/deploy.ts) | Upload to R2 before `wrangler deploy` | ⏳ needs domain |
| `wrangler.jsonc` (apps) | Custom domain routes | ⏳ needs domain |

## Open questions

- Should the R2 upload use the S3 API (portable) or `wrangler r2 object put` (simpler)?
- Garbage collection: a lifecycle rule deleting objects older than N days, or keep them forever? Note that age is measured from upload, so a file still in use but uploaded long ago would be deleted too.
- Should preload hints cover every fragment, or only those above the fold?
