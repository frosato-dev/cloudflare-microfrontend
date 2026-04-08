# Debugging

## Fragments

If you need to debug a fragment, note that deployed fragments have `workers_dev: false` — they are not publicly accessible on `*.workers.dev`. They are internal workers only reachable via Cloudflare service bindings from shell apps.

To reach a fragment directly during debugging:

1. **Preview** (`pnpm run preview`) — fragments run as local Wrangler workers, service bindings work locally regardless of `workers_dev`.
2. **Deployed** — temporarily set `workers_dev: true` in the fragment's `wrangler.jsonc`, deploy, and hit `https://fragment-{name}.<account>.workers.dev` directly. Revert after debugging.

## Debug Bar

Stream waterfall visualization with cache info.

### Enable

```js
document.cookie = "__debug=1; path=/"
```

Reload. A **Debug** toggle appears bottom-right.

### Features

- **Stream Waterfall** — horizontal bars per fragment showing server fetch timing. Green = cache HIT, blue = network.
- **Cache Tooltip** — hover fragment name to see cache status (HIT/MISS) and timing.
- **Disable Cache** — checkbox sets `__debug_nocache=1` cookie and reloads. Cache works normally in debug mode by default.

### Cookies

| Cookie | Value | Purpose |
|--------|-------|---------|
| `__debug` | `1` | Enables debug bar |
| `__debug_nocache` | `1` | Bypasses fragment cache |

### Disable

Click **Disable Debug** in the panel, or:

```js
document.cookie = "__debug=; max-age=0; path=/"
document.cookie = "__debug_nocache=; max-age=0; path=/"
```

### Overhead

Zero when `__debug` cookie absent — single `indexOf` check on cookie header.
