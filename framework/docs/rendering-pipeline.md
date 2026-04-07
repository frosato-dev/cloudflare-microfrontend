# Rendering Pipeline

Every request goes through: **route match → middleware → SSR page+layout → extract fragment placeholders → fetch all fragments in parallel → inject fragment HTML → stream response**.

The shell worker owns the full page. Fragments are independent workers that return `{ html, css? }` JSON. The shell stitches everything together before sending HTML to the browser.

---

## Step by step

```
Request hits shell worker
  │
  ├─ 1. Route match (router.ts)
  │     path-to-regex matching, extracts :params
  │
  ├─ 2. Middleware chain
  │     runs named middleware in order, any can short-circuit with a Response
  │
  ├─ 3. SSR render (request-handler.ts)
  │     createSSRApp({ Layout > Page }) → renderToString
  │     produces HTML with <div data-fragment="id" data-props="{}"></div> placeholders
  │
  ├─ 4. Extract fragments
  │     regex scans HTML for data-fragment/data-props pairs
  │
  ├─ 5. Fetch fragments in parallel
  │     each fragment ID → env.FRAGMENT_<ID>.fetch() (CF service binding)
  │     fragment worker: createSSRApp(Component, props) → renderToString → JSON response
  │
  ├─ 6. Inject fragment HTML into placeholders
  │     replaces empty <div data-fragment="id"></div> with rendered content
  │
  └─ 7. Stream response (layouts.ts)
        async generator yields:
          <head> (CSS + import map)  ← flushed immediately
          <body><div id="app">...</div> + scripts
          </body></html>
```

## Dev vs Production

| | Dev | Production |
|---|---|---|
| Fragment fetch | Vite `ssrLoadModule` (in-process) | CF service bindings (`env.FRAGMENT_X.fetch()`) |
| Asset URLs | Vite dev server handles | Hashed filenames via manifest.json |
| Vue runtime | Vite serves from node_modules | Pre-built browser bundle emitted as `vue.<hash>.js` |

The rendering pipeline itself is identical in both modes — only the `FragmentFetcher` implementation differs.

## Fragment lifecycle

```
Shell worker                          Fragment worker
    │                                      │
    ├─ env.FRAGMENT_HEADER.fetch(req) ───→ │
    │    (route props passed as query)     ├─ config.props(request) → extract props
    │                                      ├─ createSSRApp(App, props)
    │                                      ├─ renderToString(app)
    │                                      └─ Response JSON { html, css? }
    │ ←────────────────────────────────────┘     + Cache-Control header
    ├─ inject html into placeholder
    └─ include in streamed response
```

## Client hydration

```
Browser receives streamed HTML
  → parses progressively
  → import map resolves `vue` → /assets/vue.<hash>.js (single shared copy)
  → shell.js:
      creates vue-router, matches current route
      recreates Layout > Page tree
      mounts at #app
  → fragment-*.js (one per fragment):
      finds [data-fragment="id"] container
      reads props from data-props attribute
      createSSRApp(App, props) → mount
```

Shell and fragments hydrate independently — no coordination needed. Vue is loaded once via import map and shared by all.
