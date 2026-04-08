# Alternative Architectures for Streaming Micro-Frontends

What if we started from scratch? This doc explores alternative approaches to achieve true HTML streaming with micro-frontend isolation, SSR for SEO, and good Web Vitals — and honestly evaluates each one.

## The Fundamental Tension

Our current architecture has a sequential dependency chain:

```
shell SSR (renderToString)
  → regex extract fragment IDs from HTML string
    → fire fragment Worker fetches (parallel)
      → await each fragment in doc order
        → stitch into stream
```

Fragment discovery is coupled to shell SSR completion. The shell must render the full page layout to know which fragments exist, what props they need, and where they go. This blocks the first body byte.

The question: **can we decouple fragment discovery from shell SSR while keeping independent deployment?**

---

## Approach A: Declarative Fragment Manifest + Parallel Streaming

### Idea

Move fragment declarations out of Vue templates and into route-level config. The shell knows fragments before SSR, so it can fetch them in parallel with (or before) its own render.

### How it would work

```typescript
// router.ts
export const routes = [
  {
    path: '/product/:id',
    component: ProductPage,
    layout: 'default',
    // Fragments declared statically — no SSR needed to discover them
    fragments: [
      { id: 'header', slot: 'before-main' },
      { id: 'product', slot: 'main', props: (route) => ({ id: route.params.id }) },
      { id: 'footer', slot: 'after-main' },
    ],
  },
];
```

The shell:

1. Matches route → knows all fragments + their props immediately
2. Fires all fragment fetches + shell SSR in parallel
3. Streams `<head>` with ALL asset links (shell + fragments) immediately
4. Streams body structure: as each fragment resolves, writes it at its slot position

### Trade-offs

| Pro | Con |
| --- | --- |
| Fragment fetches start at T=0, parallel with SSR | Fragments hardcoded per route — can't conditionally render `<Fragment v-if="...">` |
| All assets (CSS/JS) in first `<head>` chunk | Duplicates layout structure between Vue template and route config |
| Simple mental model | Fragment props must be derivable from route params only (no SSR-computed props) |

### Verdict

Good for apps with predictable layouts (most e-commerce pages). Breaks down when fragments are truly dynamic (A/B testing, feature flags). Could be combined with current approach as a fast-path: use static manifest when available, fall back to SSR extraction when not.

---

## Approach B: Edge-Side Includes (ESI) / HTML Streaming Includes

### Idea

Forget Vue SSR for the shell. The shell Worker emits a static HTML template with ESI-like include tags. Each fragment is a URL. A streaming HTML assembler replaces includes with fragment Worker responses as they arrive.

### How it would work

Shell layout is a plain HTML template (not Vue):

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/assets/shell.css">
  <!-- fragment assets injected by assembler based on include tags -->
</head>
<body>
  <div id="app">
    <include src="/_fragment/header" />
    <main>
      <include src="/_fragment/product?id=iphone-15" />
    </main>
    <include src="/_fragment/footer" />
  </div>
</body>
</html>
```

The assembler (shell Worker):

1. Parses the template (static, instant — no SSR)
2. For each `<include>`, fires a fetch to the fragment Worker
3. Streams the HTML: static parts flush immediately, includes are replaced with fragment responses as they resolve
4. Fragment responses could themselves be streams (chunked HTML, not JSON)

### Fragment streaming protocol

Change fragment Workers from JSON to streaming HTML:

```typescript
// Fragment worker returns an HTML stream, not JSON
async fetch(request) {
  const stream = renderToWebStream(createSSRApp(App, props));
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html',
      'X-Fragment-CSS': '/assets/fragment-header.css',
    },
  });
}
```

The assembler reads `X-Fragment-CSS` header to inject `<link>` tags in `<head>`, then pipes the fragment body stream directly into the main response stream.

### Trade-offs

| Pro | Con |
| --- | --- |
| True streaming end-to-end: shell template is instant, fragments stream as they render | No Vue SSR for the shell layout — can't use Vue components for page structure |
| Fragment responses can be streams (not buffered JSON) | Layout is static HTML, not a Vue template — loses composability |
| Each fragment starts streaming independently | Asset discovery requires fragment response headers, adding a round-trip or requires a manifest |
| Similar to Cloudflare's HTMLRewriter / ESI pattern | Client hydration for the shell layout needs rethinking (no SSR'd Vue app to hydrate) |
| Simple caching: each include URL is independently cacheable | Route-specific layout logic (conditional fragments) needs a different mechanism |

### Verdict

This is essentially the "edge-side includes" pattern. Excellent for streaming performance, but sacrifices Vue's component model for the shell. Works best when the shell is truly just a layout frame and all logic lives in fragments. Could work if the shell becomes a thin HTML assembler rather than a Vue app.

---

## Approach C: Islands Architecture (Astro/Fresh-style)

### Idea

The shell renders a full static HTML page (or uses a lightweight template engine). Interactive "islands" (fragments) are marked in the HTML and hydrated independently on the client. On the server, islands are rendered in parallel and stitched into the stream.

### How it would work

```html
<!-- Shell template (static or lightweight SSR) -->
<html>
<body>
  <island name="header" worker="fragment-header">
    <!-- Server: fragment Worker HTML injected here -->
    <!-- Client: hydrated independently -->
  </island>

  <main>
    <h1>Product Page</h1>
    <island name="product" worker="fragment-product" props='{"id":"iphone-15"}'>
      <!-- Server-rendered fragment content -->
    </island>
  </main>

  <island name="footer" worker="fragment-footer">
    <!-- ... -->
  </island>
</body>
</html>
```

Key difference from current approach: **no Vue SSR for the shell page**. The shell is static HTML or a simple template. Only islands (fragments) use Vue SSR.

### Stream order

1. Shell template is known statically → `<head>` + all asset links flush immediately
2. Islands discovered from template (no SSR needed) → fragment fetches fire at T=0
3. Body streams: static HTML around islands flushes immediately, island content injected as fragment Workers respond
4. Each island hydrates independently when its script loads

### Trade-offs

| Pro | Con |
| --- | --- |
| Zero shell SSR — instant template | Shell loses Vue reactivity (no shared state, no Vue router SSR) |
| All fragment fetches start at T=0 | Page transitions become full navigations (no SPA) unless you add a client router |
| Perfect streaming — static HTML streams instantly, islands fill in | More boilerplate for layouts (HTML templates instead of Vue components) |
| Each island = independent Worker, independently cacheable | Harder to share data between shell and islands (no SSR context) |
| Aligns with Astro/Fresh/Qwik patterns | Requires rethinking the file-based routing and layout system |

### Verdict

The best approach for raw streaming performance and Web Vitals. The cost is losing Vue as the shell framework — the shell becomes a thin template layer. This is essentially what Astro does, but with Cloudflare Workers as the island renderers. Worth considering if the shell's only job is layout + routing, which is largely true today.

---

## Approach D: Nested Workers with Streaming Pipes

### Idea

Keep Vue SSR for the shell, but change the fragment protocol from JSON to streaming HTML. The shell SSR uses a custom Vue component that creates a "pipe" — a placeholder in the stream that connects to a fragment Worker's response stream.

### How it would work

```typescript
// Custom Fragment component for SSR
const Fragment = defineComponent({
  async setup(props) {
    // During SSR, this component:
    // 1. Registers itself with the streaming context
    // 2. Returns a marker that the stream assembler recognizes
    // 3. The assembler pipes the fragment Worker's stream into this position
    const ctx = useSSRContext();
    ctx.fragments.push({ id: props.id, props: props.fragmentProps });
    return () => h('div', { 'data-fragment': props.id });
  },
});
```

The shell uses `renderToWebStream` with a custom `SSRContext` that collects fragment declarations as Vue renders. A `TransformStream` wraps the Vue output stream:

1. Vue starts streaming shell HTML
2. When the transform encounters a `data-fragment` marker, it:
   - Pauses piping the Vue stream at that point
   - Pipes the corresponding fragment Worker's HTML stream
   - Resumes the Vue stream after the fragment stream ends
3. Fragment fetches are fired as soon as discovered (during SSR, not after)

### The critical insight

Vue's `renderToWebStream` + `SSRContext` gives us a registration mechanism during render. We don't need regex extraction — fragments register themselves during SSR via the context object. The transform stream acts as a multiplexer.

### Trade-offs

| Pro | Con |
| --- | --- |
| Keeps Vue for shell — full component model preserved | Complex stream multiplexing logic |
| Fragments can stream their HTML (not buffered JSON) | Fragment discovery still sequential (Vue renders top-down) |
| No regex extraction — fragments self-register via SSRContext | `renderToWebStream` still buffers synchronous components (see investigation) |
| Fragment fetches fire during SSR, not after | Pausing/resuming streams adds latency for each fragment boundary |
| Natural Vue DX — `<Fragment>` works like any component | Error handling for failed fragment streams is complex |

### Verdict

The most architecturally elegant approach that preserves Vue DX. The main challenge is that Vue's `renderToWebStream` doesn't truly stream synchronous components incrementally — it buffers them. So the "fire fetches during SSR" benefit only materializes if the shell has async components before the first fragment. In practice, shell layouts are synchronous, so fragments would still all be discovered at once (just via SSRContext instead of regex). Marginal improvement over current approach for significant complexity.

---

## Approach E: Hybrid — Static Manifest + SSR Fallback

### Idea

Combine the best of current architecture with Approach A. Use a build-time static analysis to extract fragment IDs from Vue layout templates (they're statically analyzable — `<Fragment id="header" />` is a string literal). At runtime, use the static manifest for the fast path, fall back to SSR extraction for dynamic cases.

### How it would work

**Build time** (Vite plugin):

```typescript
// Parse layout .vue files, extract Fragment component usage
// <Fragment id="header" /> → fragments: ['header']
// <Fragment :id="dynamicId" /> → fragments: null (dynamic, can't extract)
function extractFragmentsFromLayout(sfc: string): string[] | null {
  const matches = sfc.matchAll(/<Fragment\s+id="([^"]+)"/g);
  // If any Fragment has a dynamic :id, return null (can't statically analyze)
  if (sfc.includes(':id=')) return null;
  return [...matches].map(m => m[1]);
}
```

**Runtime:**

```typescript
// If static fragments known → fast path (no SSR needed for discovery)
if (layoutConfig.fragments) {
  // Fire fetches + stream <head> immediately
  // SSR runs in parallel, body streams after
} else {
  // Fall back to current: SSR → extract → fetch → stream
}
```

### Trade-offs

| Pro | Con |
| --- | --- |
| Zero config for common case (static analysis) | Build-time extraction is fragile (misses conditional rendering) |
| Backward compatible — dynamic fragments still work | Two code paths to maintain and test |
| No developer overhead (auto-detected) | Static analysis limited to string literal `id` props |
| Incremental adoption | |

### Verdict

Pragmatic middle ground. Most layouts use static fragment IDs (we verified: `default.vue` uses `<Fragment id="header" />` and `<Fragment id="footer" />`). The build-time extraction handles the 90% case; SSR fallback handles the rest. Lower risk than a full architecture rewrite.

---

## Comparison Matrix

| Approach | Streaming quality | Vue DX preserved | Deploy independence | Complexity | Web Vitals impact |
| --- | --- | --- | --- | --- | --- |
| **Current** (two-phase head) | Good (shell assets early) | Full | Full | Low | Good |
| **A** Declarative manifest | Great (all assets T=0) | Reduced (duplicate config) | Full | Low | Great |
| **B** ESI / HTML includes | Excellent (true streaming) | None for shell | Full | Medium | Excellent |
| **C** Islands (Astro-style) | Excellent | None for shell | Full | Medium | Excellent |
| **D** Nested streaming pipes | Great | Full | Full | High | Great |
| **E** Hybrid static + fallback | Great (all assets T=0) | Full | Full | Medium | Great |

## Recommendation

For this project's constraints (Vue micro-frontends, Cloudflare Workers, SSR for SEO, independent deployment):

1. **Short term**: Current two-phase head flush is the right call. Low complexity, good results.
2. **Medium term**: **Approach E** (hybrid static + fallback) gives most of the streaming benefit with minimal developer overhead and full backward compatibility.
3. **Long term / greenfield**: **Approach C** (islands) is the industry direction (Astro, Fresh, Qwik all converge here). If the shell's Vue SSR doesn't carry its weight, moving to a thin template shell with Worker-backed islands would give the best streaming and Web Vitals.
