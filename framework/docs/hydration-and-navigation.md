# Hydration & Client-Side Navigation

## Overview

Two distinct phases: **hydration** (make SSR HTML interactive) and **client-side navigation** (SPA transitions without full reload).

---

## 1. Hydration (initial page load)

After the server streams the full HTML, the browser loads `shell.js` and each `fragment-{id}.js`.

```
  Browser receives streamed HTML
           │
           ▼
┌─────────────────────────────────────────────┐
│  shell.js loads                              │
│                                              │
│  hydrateShell()                              │
│  ├─ create Vue router (history mode)         │
│  ├─ create SSR app (Layout > Page)           │
│  ├─ register click interceptor on <a> tags   │
│  ├─ register router.afterEach (SPA nav)      │
│  ├─ register router.beforeEach (transitions) │
│  └─ router.isReady() → app.mount('#app')     │
│         │                                    │
│         ▼                                    │
│  Shell is interactive                        │
└─────────────────────────────────────────────┘
           │
           │  (in parallel, per fragment)
           ▼
┌─────────────────────────────────────────────┐
│  fragment-{id}.js loads                      │
│                                              │
│  hydrateFragment(id, App)                    │
│  ├─ register in globalThis.__fragmentRegistry│
│  │   (for re-hydration on SPA nav)           │
│  ├─ find <div data-fragment="{id}">          │
│  ├─ parse data-props from the DOM element    │
│  └─ createSSRApp(App, props).mount(el)       │
│         │                                    │
│         ▼                                    │
│  Fragment is interactive                     │
└─────────────────────────────────────────────┘
```

Key points:
- Shell and fragments hydrate **independently** — no shared SSR state
- `createSSRApp` reuses existing DOM (no re-render flicker)
- Fragment scripts self-register in `__fragmentRegistry` for later re-use

---

## 2. Client-Side Navigation (SPA)

When the user clicks an internal link, the shell intercepts it and performs a soft navigation.

```
  User clicks <a href="/products/42">
           │
           ▼
  Click interceptor
  ├─ ignore external links (http...) and anchors (#)
  └─ e.preventDefault() → router.push(href)
           │
           ▼
  router.beforeEach
  └─ if View Transitions API supported:
       document.startViewTransition(() => next())
     else:
       next()
           │
           ▼
  Vue router updates current route
           │
           ▼
  router.afterEach
  ├─ skip on initial nav (isInitialNav flag)
  └─ fetch new page HTML from server
           │
           ▼
┌─────────────────────────────────────────────┐
│  fetch(to.fullPath, { X-Navigate: 1 })       │
│                                              │
│  Server renders full HTML but:               │
│  - X-Navigate header → no Link preload       │
│    headers (avoids re-downloading shell.css)  │
│  - Response is still full HTML               │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│  DOMParser parses response as virtual doc    │
│  (no asset downloads — just a DOM tree)      │
│                                              │
│  For each [data-fragment] in current page:   │
│  ├─ find matching element in fetched doc     │
│  └─ swap innerHTML                           │
│                                              │
│  For each [data-fragment] in current page:   │
│  ├─ look up __fragmentRegistry[id]           │
│  └─ call entry(el) → mountFragment()         │
│     └─ createApp(App, props).mount(el)       │
│        (fresh mount, not SSR hydration)      │
└─────────────────────────────────────────────┘
           │
           ▼
  Page updated, fragments re-mounted
```

### Why fetch full HTML?

Each fragment is an independent Worker — the shell has no way to get fragment HTML directly from the client. The server acts as orchestrator: it SSR-renders the layout, fans out to fragment Workers, and stitches the response. The client reuses this by fetching the full page and extracting only the fragment `innerHTML` it needs.

### X-Navigate header

On SPA fetches the client sends `X-Navigate: 1`. The server uses this to skip `Link` preload headers (shell assets are already loaded). Without this, the browser would re-download `shell.css` due to the `rel=preload` hint on the fetch response.

---

## 3. Fragment Re-Hydration on SPA Nav

```
                    Initial load                 SPA navigation
                    ───────────                  ──────────────
Mount mode:         createSSRApp (reuse DOM)     createApp (fresh mount)
Props source:       data-props attribute         data-props from fetched HTML
Registry:           self-register on load        looked up from __fragmentRegistry
```

`hydrateFragment()` does two things:
1. **Hydrates now** — `createSSRApp` attaches to existing server HTML
2. **Registers for later** — stores a factory `(container) => mountFragment(...)` in `__fragmentRegistry`

On SPA nav, the shell calls the registered factory with the updated DOM element. This time it uses `createApp` (not `createSSRApp`) because the innerHTML was swapped — there's no server-rendered DOM to reconcile with.

---

## 4. Lifecycle Summary

```
           ┌──────────────────────────────────────────────┐
           │            INITIAL PAGE LOAD                  │
           │                                              │
           │  Server streams HTML (shell + fragments)      │
           │           │                                  │
           │           ▼                                  │
           │  Browser: load shell.js + fragment-*.js       │
           │           │                                  │
           │           ▼                                  │
           │  hydrateShell() ──── hydrateFragment() x N   │
           │  (SSR app mount)     (SSR mount + register)  │
           └──────────────────────────────────────────────┘
                       │
                       │  user clicks link
                       ▼
           ┌──────────────────────────────────────────────┐
           │          CLIENT-SIDE NAVIGATION               │
           │                                              │
           │  router.push(href)                            │
           │           │                                  │
           │           ▼                                  │
           │  View Transition (optional cross-fade)        │
           │           │                                  │
           │           ▼                                  │
           │  fetch full HTML (X-Navigate: 1)              │
           │           │                                  │
           │           ▼                                  │
           │  DOMParser → extract fragment innerHTML       │
           │           │                                  │
           │           ▼                                  │
           │  Swap DOM + re-mount via __fragmentRegistry   │
           └──────────────────────────────────────────────┘
```
