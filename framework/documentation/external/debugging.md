# Debugging

## Debug Bar

The debug bar is a floating UI injected into the page when the `__debug=1` cookie is set.

### Enable

```js
document.cookie = '__debug=1; path=/';
location.reload();
```

### Features

- **Total request time** — shown in the toggle button and panel header
- **Summary line** — fragment count, cached count, miss count
- **Shell SSR bar** — gray bar showing time spent on route matching, middleware, and Vue SSR render before fragment fetches begin
- **Fragment waterfall** — shows fetch timing for each fragment relative to request start
- **Cache indicators** — HIT (green, near-zero ms) / MISS (blue, shows actual duration)
- **Tooltip** — hover a bar to see timing + cache status
- **Disable cache toggle** — checkbox sets `__debug_nocache=1` cookie, reloads
- **Disable debug button** — clears both cookies, reloads

### How It Works

1. When `__debug=1` cookie is detected, the shell wraps the fragment fetcher with `wrapFetcherWithDebug()` to collect timing metadata
2. Shell SSR end time is recorded before fragment fetches start
3. Total request time is recorded at stream end
4. Each fragment `<div>` gets `data-dbg-cached`, `data-dbg-start`, `data-dbg-end` attributes
5. The app container gets `data-dbg-total` and `data-dbg-shell-end` attributes
6. An inline script reads this data and renders the waterfall with shell bar, fragment bars, and summary
7. Page cache is skipped in debug mode (cached pages don't have the debug bar)

### Demonstrating Cache Speedup

The debug bar makes the cache benefit visible:

- **Cached fragments** show as short green bars (~0ms) with a HIT badge
- **Uncached fragments** show as longer blue bars (actual fetch duration) with a MISS badge
- Toggle the "Disable cache" checkbox to compare cached vs uncached side-by-side

## Cookies Reference

| Cookie | Value | Effect |
|--------|-------|--------|
| `__debug` | `1` | Enable debug bar, skip page cache |
| `__debug_nocache` | `1` | Also skip fragment cache |

Both cookies use `path=/`. Remove by setting `max-age=0`.

## Debug Attributes

When debug mode is active, fragment containers and the app container have extra attributes:

### Fragment containers

| Attribute | Description |
|-----------|-------------|
| `data-dbg-cached` | `"true"` if served from cache |
| `data-dbg-start` | Fetch start time (ms from request start) |
| `data-dbg-end` | Fetch end time (ms from request start) |

### App container

| Attribute | Description |
|-----------|-------------|
| `data-dbg-total` | Total request time (ms) |
| `data-dbg-shell-start` | Shell SSR start (always 0) |
| `data-dbg-shell-end` | Shell SSR end time (ms from request start) |
