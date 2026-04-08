# Debugging

## Debug Bar

The debug bar is a floating UI injected into the page when the `__debug=1` cookie is set.

### Enable

```js
document.cookie = '__debug=1; path=/';
location.reload();
```

### Features

- **Waterfall visualization** — shows fetch timing for each fragment
- **Cache indicators** — HIT (green) / MISS (blue) per fragment
- **Tooltip** — hover a fragment name to see timing + cache status
- **Disable cache toggle** — checkbox sets `__debug_nocache=1` cookie, reloads
- **Disable debug button** — clears both cookies, reloads

### How It Works

1. When `__debug=1` cookie is detected, the shell wraps the fragment fetcher with `wrapFetcherWithDebug()` to collect timing metadata
2. Each fragment `<div>` gets `data-dbg-cached`, `data-dbg-start`, `data-dbg-end` attributes
3. After `</div id="app">`, an inline script reads these attributes and renders the bar
4. Page cache is skipped in debug mode (cached pages don't have the debug bar)

## Cookies Reference

| Cookie | Value | Effect |
|--------|-------|--------|
| `__debug` | `1` | Enable debug bar, skip page cache |
| `__debug_nocache` | `1` | Also skip fragment cache |

Both cookies use `path=/`. Remove by setting `max-age=0`.

## Fragment Debug Attributes

When debug mode is active, fragment containers have extra attributes:

| Attribute | Description |
|-----------|-------------|
| `data-dbg-cached` | `"true"` if served from cache |
| `data-dbg-start` | Fetch start time (ms from request start) |
| `data-dbg-end` | Fetch end time (ms from request start) |
