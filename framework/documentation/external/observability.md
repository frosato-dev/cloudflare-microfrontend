# Observability & Fragment Isolation

Each fragment belongs to one team. The framework makes sure a fragment can't break pages owned by other teams, and that each team can see its own fragment's cost.

## Fragment isolation

The shell gives every fragment fetch a time limit and catches its errors.

| Situation | Result |
|---|---|
| Fragment responds in time | Normal server-rendered HTML |
| Fragment throws, returns non-2xx, or has no binding | Empty slot |
| Fragment exceeds `fragmentTimeout` (default **1000 ms**) | Empty slot, and the page keeps streaming |

An empty slot looks like this:

- The container gets `data-fragment-error="<reason>"`.
- If the shell has already seen this fragment's assets (from earlier requests in the same isolate), it emits the fragment's CSS and JS. The fragment then **renders client-side** instead of hydrating. This can cause a layout shift.
- The page is **not stored in the page cache**, so one slow response doesn't serve a degraded page to everyone.
- The shell logs `[fragment-<id>] <reason>`, and the outcome appears in the structured logs below.

If the shell's own render throws, the response is still closed: it's cut short, but it doesn't hang.

Set the timeout per app:

```ts
// application.config.ts
export default defineApplicationConfig({
  document: { title: 'My App' },
  fragmentTimeout: 800, // ms
});
```

### Fault injection (debug only)

To see how a page degrades, set the debug cookie plus `__debug_fault=<fragment>:<timeout|error>`:

```js
document.cookie = '__debug=1; path=/';
document.cookie = '__debug_fault=header:timeout; path=/';
location.reload();
```

The debug bar shows failed fragments in red with the reason. Fault injection does nothing without `__debug=1`.

## Server metrics: structured logs

Every page request logs one JSON line per fragment and one per page. Workers Logs is enabled on every Worker (`"observability": { "enabled": true }` in `wrangler.jsonc`).

```json
{"type":"fragment","fragment":"header","route":"/product/:id","ms":14,"cached":false,"outcome":"ok","version":"header@f0a2633b"}
{"type":"page","route":"/product/:id","totalMs":18,"fragments":3}
```

- `route` is the route pattern, not the raw URL, so it stays low-cardinality.
- `outcome` is `ok`, `timeout` or `error` (with `error` set to the reason).
- `ms` measures fetch time. In Workers, the clock only advances on I/O, so it doesn't capture CPU-only time such as the shell's server render. Use the Workers CPU time metrics for that.

In the Cloudflare dashboard (Workers → front-office → Logs), filter on `type = fragment` and `fragment = header` to get one team's view: p95 `ms`, cache hit rate, and timeouts by `version` after a deploy.

## Real-user metrics (RUM)

The shell loads `web-vitals` (about 4 KB gzipped) **after `load`**, in a separate chunk off the critical path. It collects TTFB, FCP, LCP, INP and CLS, and sends them with `navigator.sendBeacon` to `POST /__rum` when the page is hidden.

LCP, INP and CLS are **attributed to a fragment**: the closest `[data-fragment]` ancestor of the LCP element, the interaction target, or the largest layout shift source. The shell logs one line per metric:

```json
{"type":"rum","route":"/product/:id","metric":"LCP","value":812,"rating":"good","fragment":"footer","version":"footer@deb40005"}
```

This answers questions like "which team's fragment is the LCP element on this route" and "did INP regress after `product@…` was deployed".

Notes:
- 100% of page views are sampled for now. The endpoint caps payloads at 16 KB and ignores unknown metric names.
- Web Vitals cover the initial page load only. SPA navigations aren't measured.
- INP only appears after an interaction slow enough to be reported.
