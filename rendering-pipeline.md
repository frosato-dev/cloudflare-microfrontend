# Rendering Pipeline

## Dev mode (buffered)

```
Request
  → Route match (router.ts)
  → Middleware chain
  → Start all work in parallel:
      ├─ Page SSR (renderToString)
      └─ Fragment fetches (via Vite ssrLoadModule)
  → Await all
  → renderLayout() — assemble full HTML string
  → Response (single flush)
```

## Production (streaming)

```
Request
  → Route match (router.ts)
  → Middleware chain
  → Start all work in parallel (don't await):
      ├─ Page SSR (renderToString)
      └─ Fragment fetches (via CF service bindings)
  → Open ReadableStream, flush chunks as ready:
      1. <head> (CSS links known at route time — no waiting)
      2. <body><div id="app">
      3. await header fragment → flush header HTML
      4. await page SSR → flush <main><div data-page>...</div>
      5. await remaining fragments in route order → flush each
      6. </main></div> + client scripts + </body></html>
  → Response streams to client progressively
```

## Fragment lifecycle

```
Shell worker                          Fragment worker
    │                                      │
    ├─ env.FRAGMENT_HEADER.fetch(req) ───→ │
    │                                      ├─ createSSRApp(component, props)
    │                                      ├─ renderToString(app)
    │                                      └─ Response JSON { html, css? }
    │ ←────────────────────────────────────┘
    ├─ wrapFragment(id, html, props)
    └─ flush to stream
```

## Client hydration

```
Browser receives streamed HTML
  → Parses progressively (header paints before product arrives)
  → import map resolves vue → /assets/vue.js (single copy)
  → shell.js: hydrates [data-page] container
  → fragment-*.js: hydrates [data-fragment="*"] containers
      → reads data-props from DOM attribute
      → createSSRApp + mount
```
