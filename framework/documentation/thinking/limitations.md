# Limitations

Known limitations of the current implementation, measured against the north star: **web performance** and **team ownership boundaries**.

## Assumptions

- About 20 teams own fragments
- Fragments are page sections, not whole pages, so a page has roughly 10–20 fragments
- Most fragments need client JS for tracking events (for example, block impressions)
- Content mixes edge-cacheable and personalised fragments
- Fragments must ship their own JS and assets, without redeploying the shell
- No coexistence with the legacy app (incremental migration is not a goal)
- A single Vue version across shell and fragments is acceptable
- Moving away from Cloudflare is a hedge, not a priority

## Ownership / deploy independence

1. **Fragment assets are served by the shell**: client builds are merged into the shell's `ASSETS` binding and manifest, so shipping new fragment JS/CSS means redeploying the shell.
2. **Version skew**: HTML from a new fragment Worker can be hydrated by old client JS (or the other way round). Nothing protects against this.
3. **Vue version lockstep**: every fragment must be compatible with the Vue runtime the shell serves, and nothing checks this at build time or runtime.
4. **No shell ↔ fragment contract**: props are untyped strings, fragment IDs share one global namespace, and service binding names follow a naming convention (`FRAGMENT_<ID>`).
5. **The shell owns routes, pages and layouts**, so the shell team is a bottleneck.
6. **Fragments can't contain other fragments.**
7. **No shared Vue plugins** (router, store, i18n) inside fragments, and the shell intercepts every `<a>` click.
8. **Untyped pub-sub**: cross-fragment events are untyped `window` CustomEvents, and an event sent before the listening fragment hydrates is lost.
9. **No observability per fragment or per team**: no tracing, error attribution or latency metrics outside the debug bar. *Partly addressed: structured logs per fragment and RUM with fragment attribution (see [Observability](../external/observability.md)). Still missing: distributed tracing, and dashboards or alerts per team.*

## Web performance: server

10. **Waterfall**: fragments are discovered only after the shell finishes its server render (`renderToString`, then regex extraction).
11. **Head-of-line blocking**: fragments are awaited in document order, so one slow fragment delays everything after it.
12. **No timeout or error boundary**: a failing fragment breaks the whole stream. *Addressed: every fragment has a time limit and its errors are caught. A failure gives an empty slot with a client-side fallback, and the page isn't cached (see [Observability](../external/observability.md)).*
13. **Fragment HTML is wrapped in JSON and fully buffered**, so it isn't streamed through.
14. **Each fragment is one subrequest**, plus a possible cold start. Cost and Workers subrequest limits grow with the number of fragments.
15. **Caching**:
    - The whole-page cache isn't invalidated when a fragment deploys.
    - The fragment cache key is the URL only, while request headers and cookies are forwarded, so personalised content could leak between users.
16. **SPA navigation reruns the full server render** and fetches the full page HTML.

## Web performance: client

17. **One Vue app per fragment, every fragment hydrated eagerly**: no lazy, on-visible or idle hydration, and static fragments can't skip JS.
18. **Fragment scripts load only at the end of `<body>`**, so nothing hydrates before the stream finishes.
19. **No server state is passed to the client**: data fetched during the server render is fetched again on the client, or causes a hydration mismatch.
20. **Shared dependencies other than Vue** (design system, utilities) are duplicated in every fragment's bundle.
21. **CSS isn't deduplicated or isolated** beyond SFC `scoped`, and global styles can leak between fragments.

## Platform coupling

22. **Cloudflare-specific APIs throughout**: service bindings, `caches.default`, the `ASSETS` binding, wrangler, and `env` in the fetcher. There's no adapter layer.

## Priorities

1. Fragments own their assets and their version (1, 2)
2. Cost per fragment on the server (10, 11, 13, 14)
3. Cost per fragment on the client: hydration strategy, framework-handled tracking, shared dependencies (17, 18, 20)
4. Isolating failures (12)
5. Cache correctness with personalisation (15)
6. Contracts and governance (4, 8, 9)
7. Cloudflare adapter (22)

## Directions explored

### Vue version policy (3)

- One source of truth: a pnpm `catalog:` entry for `vue` and `@vitejs/plugin-vue`, with fragments declaring `vue` as a peer dependency.
- Pin the minor version and allow patches: SFC templates compile to runtime helpers, and a minor release can add new ones, so a minor bump is a coordinated change.
- Build/deploy check: each fragment build records the Vue version it compiled against, and the fragment's deploy fails if that version doesn't satisfy the shell's range.
- Runtime check: the fragment response includes its Vue version. If it doesn't match, the shell keeps the server-rendered HTML but skips hydration and logs an alert.
- Upgrade escape hatch: fragments are separate Vue apps with no reactivity shared across fragments, so import map `scopes` let one fragment canary a new Vue version while the rest stay on the old one:

  ```json
  {"imports":{"vue":"/assets/vue.3.5.js"},
   "scopes":{"/fragments/product/":{"vue":"/assets/vue.3.6.js"}}}
  ```

### Fragment-owned assets (1, 2)

Each fragment Worker serves its own assets, and its response tells the shell its asset URLs and version. The shell builds the import map and `<link>`/`<script>` tags from that response, not from a merged manifest built at deploy time. HTML and JS then come from the same deployment, which also fixes version skew.

### Tracking without hydration (17)

The framework provides impression tracking itself (`data-track-*` attributes and one IntersectionObserver in the shell), so static fragments need no JS and tracking stays consistent across teams.
