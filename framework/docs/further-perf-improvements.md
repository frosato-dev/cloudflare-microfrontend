# Further Web Performance Improvements

## 1. Cloudflare 103 Early Hints

Cloudflare caches `Link` headers from 200 responses and replays them as `103 Early Hints` on subsequent requests — browser starts fetching assets before the Worker even executes. Already partially enabled (we send `Link` headers), just needs the Cloudflare dashboard toggle. On repeat visits, assets start loading at T=0 instead of after TTFB.

## 2. `renderToWebStream` instead of `renderToString`

**Status: INVESTIGATED — NOT BENEFICIAL**

Vue 3's `renderToWebStream()` uses a **buffer-first-then-unroll** model (verified in `@vue/server-renderer` v3.5.31):

1. Renders the entire component tree into a nested `SSRBuffer` array
2. Then unrolls the buffer, pushing opaque HTML byte chunks to the stream
3. Streaming granularity is at the async-component/Promise level, not per-component

**Why it doesn't help our architecture:**

- **Can't detect fragments mid-stream** — `data-fragment` divs are plain text bytes in the stream, indistinguishable from any other HTML. No hook to intercept specific components as they render.
- **Can't fire fragment fetches earlier** — we'd still need the complete output to extract fragment IDs via regex (`extractFragments`).
- **Suspense doesn't create streaming boundaries** — Vue SSR awaits Suspense content before rendering; it doesn't enable partial flushing.
- **Our layouts are synchronous** — `Fragment.vue` renders a placeholder `<div>`, no async work. So Vue's streaming adds zero progressive benefit.
- **Memory savings negligible** — the shell layout HTML is a few KB at most.

**What would make it viable:** Replacing the regex-based fragment extraction with Vue async components resolved via Suspense. This would be a complete rewrite of the fragment stitching model and would lose the current benefit of independent Worker-level fragment isolation (each fragment = its own Worker, fetched via service binding).

**Verdict:** `renderToString` is optimal for this architecture. The SSR render is fast (just placeholder divs); real latency is in fragment Worker fetches, which happen post-SSR regardless.

## 3. Out-of-order fragment streaming

**Status: INVESTIGATED — HIGH COMPLEXITY, LOW ROI**

The idea: don't block the stream when a slow fragment is awaited. Emit placeholders, stream faster fragments first, inject slow content later.

**Compatibility — it's technically safe:**

- Hydration uses `querySelector('[data-fragment="${id}"]')` — attribute-based, not position-based
- Fragment CSS is Vue SFC scoped — order-independent
- SPA navigation re-hydration also uses attribute lookup

**Implementation sketch (React Suspense / Marko pattern):**

```html
<!-- Slow "header" gets empty placeholder -->
<div data-fragment="header" data-props="{}"></div>

<!-- Fast "product" streams immediately -->
<div data-fragment="product" ...>product content</div>

<!-- At end of body: late-arriving content injected via template + swap script -->
<template data-fragment-content="header">
  <style>.header{color:red}</style>
  <header>...</header>
</template>
<script>
  const tpl = document.querySelector('template[data-fragment-content="header"]');
  const target = document.querySelector('[data-fragment="header"]');
  target.innerHTML = tpl.content.firstElementChild?.innerHTML || tpl.innerHTML;
  tpl.remove();
</script>
```

**Challenges:**

| Issue | Severity | Detail |
|-------|----------|--------|
| **Layout shift (CLS)** | HIGH | Empty placeholder swapped with content causes visible reflow. Header is above-the-fold — swapping late is *worse* UX than waiting |
| **FOUC** | MEDIUM | Fragment CSS injected late via `<template>` → unstyled flash before swap |
| **Hydration race** | MEDIUM | Fragment JS may load and hydrate the empty placeholder before swap script runs → double render |
| **SEO** | LOW | Content in `<template>` tags invisible to crawlers |
| **Diminishing returns** | HIGH | Fragments are cached via Cloudflare Cache API. After first request, they resolve in <10ms. Slow-fragment scenario is rare in production |

**A simpler alternative: per-fragment timeout.** If a fragment doesn't resolve within N ms, emit the empty placeholder and continue streaming. Content is missing (graceful degradation), client-side hydration renders it. No swap machinery needed — just a `Promise.race` with a timeout. This limits worst-case TTFB without the complexity.

**Verdict:** Not worth implementing for the current setup. The header (above-the-fold) would cause CLS, and caching makes most fragments fast. The per-fragment timeout is a simpler partial win if worst-case latency becomes a real problem.

## 4. Critical CSS inlining

Fragment CSS is loaded via external `<link>` tags (render-blocking). For small fragments, inline the CSS directly in the stream:
- Fragment workers already return `css` in their JSON response
- Inline critical CSS in `<head>`, defer external stylesheet loading
- Eliminates CSS round-trip for small fragments

## 5. Font preloading

Add `<link rel="preload" as="font" crossorigin>` to the early `<head>` flush for any custom fonts. Fonts are often the last resource discovered and cause layout shift (CLS).

## 6. Service Worker asset precaching

Register a service worker that precaches shell assets (vue.js, shell.js, shell.css) on first visit. Subsequent navigations get instant asset loading from SW cache. The `Cache-Control: immutable` headers already on `/assets/*` make this safe.

## 7. Fragment cache warming

On deploy, warm the Cloudflare Cache API for common fragments (header, footer) by making synthetic requests. First real user hits warm cache instead of cold fragment worker execution.

## 8. HTTP/2 Server Push

Cloudflare can push assets over the same connection using `Link` headers with `nopush` removed. More aggressive than preload hints — assets arrive before the browser even parses `<head>`. However, H2 push is being deprecated across the industry in favor of 103 Early Hints (point 1). Likely not worth investing in.

## 9. Compress SSR output

Ensure `Content-Encoding: gzip` or `br` on the streaming HTML response. Cloudflare does this automatically for responses >1KB, but verify it's active on the deployed Workers. Smaller HTML = faster time to first meaningful paint.

## 10. Prefetch on hover/viewport

Add `<link rel="prefetch">` for likely next-page assets. E.g. on homepage, prefetch product page fragment JS/CSS. Combine with `IntersectionObserver` to prefetch fragments as they scroll into view.
