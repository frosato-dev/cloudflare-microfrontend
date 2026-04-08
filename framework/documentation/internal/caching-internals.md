# Caching Internals

Source: `framework/src/worker/shell.ts`

## Two-Layer Cache

Both layers use the Cloudflare Workers Cache API (`caches.default`).

### Layer 1: Fragment Cache

Cache key uses a `__fragment` query param to namespace:

```ts
const cacheUrl = new URL(url.toString());
cacheUrl.searchParams.set('__fragment', fragmentId);
const cacheKey = new Request(cacheUrl.toString());
```

Example: `https://example.com/product/42?__fragment=header`

**Read**: before fetching the fragment worker
```ts
const cached = await cache.match(cacheKey);
if (cached) {
  const result = await cached.json();
  result._meta = { cached: true };
  return result;
}
```

**Write**: after fetching, if `Cache-Control` doesn't include `no-cache`
```ts
if (!response.headers.get('Cache-Control')?.includes('no-cache')) {
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
}
```

`ctx.waitUntil()` makes the cache write non-blocking — the response streams to the client immediately.

### Layer 2: Page Cache

Cache key is the original request URL:

```ts
const pageCacheKey = new Request(request.url);
```

**Read**: at the top of the fetch handler, before any SSR work
```ts
if (!noCache && !isDebug) {
  const cached = await pageCache.match(pageCacheKey);
  if (cached) {
    // Strip s-maxage, return cached response
  }
}
```

**Write**: only when `Cache-Control` includes `s-maxage`
```ts
if (cc.includes('s-maxage')) {
  const passthrough = new TransformStream({
    transform(chunk, controller) {
      chunks.push(chunk);
      controller.enqueue(chunk);
    },
    flush() {
      const body = new Blob(chunks);
      ctx.waitUntil(pageCache.put(pageCacheKey, new Response(body, response)));
    },
  });
  return new Response(response.body!.pipeThrough(passthrough), ...);
}
```

The `TransformStream` passthrough collects chunks while streaming to the client. On stream completion, `flush()` writes the full body to cache inside `ctx.waitUntil()`.

## `s-maxage` Stripping

```ts
function stripSMaxAge(cc: string): string {
  return cc.replace(/,?\s*s-maxage=\d+/g, '').replace(/^\s*,\s*/, '');
}
```

Applied in three places:

1. **Cached page response** — strip before sending to browser
2. **Page cache passthrough** — strip from client-facing headers
3. **Debug mode** — strip from debug-decorated response

**Why**: Cloudflare's edge CDN interprets `s-maxage` as a signal to buffer the entire response before forwarding. Since we want streaming, we use `s-maxage` only for the Workers Cache API (which respects it for TTL) and strip it from what the browser/CDN sees.

## Debug Bypass

Two cookies control cache behavior:

| Cookie | Fragment Cache | Page Cache |
|--------|---------------|------------|
| (none) | Read + Write | Read + Write |
| `__debug=1` | Read + Write | **Skip read** (cached page lacks debug bar) |
| `__debug_nocache=1` | **Skip read** | **Skip read** |

Detection in `framework/src/debug/utils.ts`:

```ts
function isDebugRequest(request: Request): boolean {
  return cookie?.indexOf('__debug=1') !== -1;
}

function isNoCacheRequest(request: Request): boolean {
  return cookie?.indexOf('__debug_nocache=1') !== -1;
}
```

Note: cache *writes* still happen even in debug mode — only reads are skipped. This means toggling debug off immediately serves cached content.

## Cache Lifecycle

```
Request arrives
  ├─ Debug? → skip page cache read
  ├─ Page cache hit? → return (strip s-maxage)
  └─ Page cache miss →
       ├─ For each fragment:
       │    ├─ No-cache? → skip fragment cache read
       │    ├─ Fragment cache hit? → use cached JSON
       │    └─ Fragment cache miss → fetch worker → cache write (waitUntil)
       ├─ handleRequest() → stream HTML
       └─ s-maxage? → passthrough collect → page cache write (waitUntil)
```
