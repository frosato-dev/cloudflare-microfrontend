# Caching

Two independent cache layers using the Cloudflare Workers Cache API.

## Page Cache (Shell)

Set via `cache` field on a route:

```ts
{
  path: '/',
  component: IndexPage,
  cache: 'public, s-maxage=300, stale-while-revalidate=60',
}
```

- `s-maxage` controls edge cache duration
- The shell worker caches the full streamed HTML response when `s-maxage` is present
- `s-maxage` is stripped from the response sent to the browser (prevents Cloudflare edge from buffering the stream)
- Cached pages are served directly — no SSR or fragment fetches

## Fragment Cache

Set via `cache` field in `fragment.config.ts`:

```ts
export default defineFragmentConfig({
  cache: 'public, max-age=3600',
});
```

- Controls the `Cache-Control` header on the fragment JSON response
- The shell caches fragment responses independently using a `__fragment` query param as cache key namespace
- Fragment cache writes use `ctx.waitUntil()` — non-blocking

Default: `'private, no-cache'` (no caching).

## Cache Bypass

### Debug Mode

Set cookie `__debug=1` to:
- Skip page cache reads
- Show the debug bar with cache hit/miss indicators

Set cookie `__debug_nocache=1` to additionally:
- Skip fragment cache reads

### How to Enable

```js
// In browser console
document.cookie = '__debug=1; path=/';
// Reload — debug bar appears at bottom-right
```

Or use the debug bar's "Disable cache" checkbox to toggle `__debug_nocache=1`.

## Cache-Control Patterns

| Use Case | Value |
|----------|-------|
| Static page, edge-cached 5min | `'public, s-maxage=300, stale-while-revalidate=60'` |
| Dynamic page, no cache | — (omit `cache` field) |
| Fragment cached 1h | `'public, max-age=3600'` |
| Fragment never cached | `'private, no-cache'` |
