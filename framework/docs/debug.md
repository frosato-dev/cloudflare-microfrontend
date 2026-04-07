# Debugging

## Fragments

If you need to debug a fragment, note that deployed fragments have `workers_dev: false` — they are not publicly accessible on `*.workers.dev`. They are internal workers only reachable via Cloudflare service bindings from shell apps.

To reach a fragment directly during debugging:

1. **Preview** (`pnpm run preview`) — fragments run as local Wrangler workers, service bindings work locally regardless of `workers_dev`.
2. **Deployed** — temporarily set `workers_dev: true` in the fragment's `wrangler.jsonc`, deploy, and hit `https://fragment-{name}.<account>.workers.dev` directly. Revert after debugging.
