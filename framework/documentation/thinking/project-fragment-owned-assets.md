# Project: Fragment-Owned Assets

**Status:** design agreed, not started
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
| CSS/JS placement | `<link>`/`<script>` emitted in `<body>` next to each fragment (correctness), plus best-effort preloads in `<head>` (speed) |
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

- Right after each fragment's HTML, emit its `<link rel=stylesheet>` (and the Firefox workaround if needed). Its `<script type=module>` goes in the collected list after `#app`.
- Head preloads: the shell keeps, in isolate memory, the latest `X-Fragment-Assets` seen for each fragment, and uses it for `<link rel=preload|modulepreload>` and the `Link` header (Early Hints). No extra infrastructure is needed, because it learns from real responses.
- `<link rel=preconnect href="https://static.<domain>" crossorigin>` in the first flush of `<head>`.
- Vue check: if `X-Fragment-Vue` doesn't satisfy the shell's Vue range, keep the server-rendered HTML, skip that fragment's script and log an alert.

### Client

- The fragment registry is keyed by `id` and stores `version`.
- During SPA navigation, if a fragment in the new page has a different `X-Fragment-Version` (exposed as `data-fragment-version`) than the loaded one, do a full page load (`location.assign`).
- Scripts are loaded from the asset URL in the response, not found with the `fragment-<id>` filename regex.
- A `vite:preloadError` listener reloads the page when a lazy chunk fails to load (safety net).

### Deploy

Order per fragment:
1. Build the client, then the server, with the client manifest inlined.
2. Upload the client files to R2 under `<id>/`, skipping keys that already exist.
3. `wrangler deploy` the fragment Worker.

Assets are uploaded before the Worker, so new HTML never references missing files. The shell deploy no longer touches fragment assets.

## Local dev

`framework-cli preview` runs every Worker in one `wrangler dev` process (`-c app -c fragment…`). Service bindings already work locally.

- **Asset base is configurable**: an `ASSET_BASE` variable (or a build-time define).
  - Production: `https://static.<domain>`
  - Local: `/_f` (same origin)
- **Local serving:** the shell handles `/_f/<id>/*` by forwarding to the fragment's service binding. In local mode only, the fragment Worker serves its `dist/client` through a Workers `assets` binding.
  - This avoids uploading files to local R2 on every build.
  - Only the storage layer differs from production, not the contract.
- **Alternative:** have preview write the built files into local R2 (wrangler/Miniflare simulates R2 in `.wrangler/state`), with the shell serving `/_f/*` from an R2 binding. This is closer to production but slower when rebuilding.
- **Open:** HMR or watch mode for a single fragment, and working on a fragment against a deployed shell.

## Code impact

| File | Change |
|---|---|
| [vite/fragment.ts](../../src/vite/fragment.ts) | `base` = `${ASSET_BASE}/<id>/`, inline the client manifest and version into the server entry |
| [worker/fragment.ts](../../src/worker/fragment.ts) | Set the `X-Fragment-*` headers, serve `dist/client` in local mode |
| [worker/shell.ts](../../src/worker/shell.ts) | Read the fragment headers, remember the latest assets per fragment, forward `/_f/*` locally |
| [request-handler.ts](../../src/request-handler.ts) | Emit `<link>`/`<script>` per fragment from its response, head preloads, `preconnect`, Vue check, drop the use of the merged manifest for fragments |
| [hydration/shell.ts](../../src/hydration/shell.ts) | Version check, full page load on change, load scripts by URL |
| [collect-assets.ts](../../src/collect-assets.ts) | Shell assets only |
| [cli/deploy.ts](../../src/cli/deploy.ts) | Upload to R2 before `wrangler deploy` |
| `wrangler.jsonc` (apps) | Custom domain routes |

## Open questions

- Should the R2 upload use the S3 API (portable) or `wrangler r2 object put` (simpler)?
- Garbage collection: a lifecycle rule deleting objects older than N days, or keep them forever? Note that age is measured from upload, so a file still in use but uploaded long ago would be deleted too.
- Should preload hints cover every fragment, or only those above the fold?
