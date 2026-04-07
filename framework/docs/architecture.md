# Architecture

Vue micro-frontends on Cloudflare Workers. Each fragment is an independent Worker that SSR's a Vue component. A shell worker assembles them into a full page and hydrates everything client-side with a single shared Vue runtime.

---

## Key concepts

### Shell worker
The "app" — owns routing, layouts, middleware, and the HTML document. Renders the page component inside a layout, discovers `<Fragment>` placeholders, fetches each fragment worker, and stitches the HTML together.

### Fragment worker
A self-contained micro-frontend. Receives a request, SSR's a Vue component, returns `{ html, css? }` JSON. Has its own build, deploy, and cache policy. Teams own their fragments independently.

### Fragment component
A Vue component (`<Fragment id="header" :fragment-props="{ slug }">`) that renders as a `<div data-fragment="id" data-props="...">` placeholder during SSR. The shell replaces these with real HTML after fetching.

### Import map / shared Vue
Vue is built once by the shell (as a pre-built browser bundle `vue.<hash>.js`) and shared via `<script type="importmap">`. Fragments externalize Vue in their client builds, so there's exactly one Vue runtime in the browser.

## Diagram

```
                    ┌─────────────────────────┐
                    │      Shell Worker        │
                    │  (front-office, etc.)    │
                    │                          │
  Request ────────→ │  route → middleware      │
                    │  → SSR Layout+Page       │
                    │  → extract fragments     │
                    │  → fetch in parallel ────┼──→ Fragment Worker (header)  → { html }
                    │                     ────┼──→ Fragment Worker (footer)  → { html }
                    │                     ────┼──→ Fragment Worker (product) → { html }
                    │  → stream progressively  │
                    └─────────────────────────┘
                                │
                                ▼
                           Browser
                    ┌─────────────────────────┐
                    │  import map → vue.js     │
                    │  shell.js hydrates page  │
                    │  fragment-*.js each      │
                    │  hydrate their container │
                    └─────────────────────────┘
```

## File-based conventions

Everything is auto-discovered by Vite plugins — no manual registration needed.

| Convention | Location | Effect |
|---|---|---|
| Routes | `src/router.ts` | exports `routes: AppRoute[]` |
| Layouts | `src/layouts/*.vue` | filename = layout name (e.g. `default.vue`) |
| Middleware | `src/middleware/*.ts` | filename = middleware name, default export |
| App config | `application.config.ts` | `defineApplicationConfig({ document: { title } })` |
| Fragment config | `fragment.config.ts` | `defineFragmentConfig({ cache, props(req) })` |
| Fragment component | `src/App.vue` | the Vue component rendered by the fragment worker |

## Service bindings

Fragment discovery is automatic. `discover.ts` scans `packages/fragments/fragment-*`, and generates service bindings in each app's `wrangler.jsonc`:

```
fragment-header  →  binding: FRAGMENT_HEADER, service: fragment-header
fragment-footer  →  binding: FRAGMENT_FOOTER, service: fragment-footer
```

The shell worker uses these bindings to call `env.FRAGMENT_HEADER.fetch(request)` at render time — worker-to-worker calls within Cloudflare, no network hop.
