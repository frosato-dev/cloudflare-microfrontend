# Meta Framework POC

## Project

Back Market meta-framework POC — Vue micro-frontends on Cloudflare Workers

## Architecture

- Fragment stitching: each fragment = independent Worker SSR'ing Vue HTML
- Shell Worker owns Vue runtime, assembles + hydrates all fragments
- No shared SSR state; client-side pub-sub for cross-fragment comms
- Monorepo: `packages/shell/`, `packages/fragment-*/`
- Nuxt-like DX: file-based routing, layouts, middleware
- Vite builds, `ssr.target: 'webworker'`
- Hardest problem: shell hydrating HTML produced by separate fragment Workers

## Commands

- `pnpm install` - install deps
- `pnpm run dev` - vite SSR dev server (port 3000)
- `pnpm run build` - production build all packages
- `pnpm run preview` - build + wrangler dev with all workers (port 8787)
- `pnpm run deploy` - build + deploy all workers to Cloudflare
- `pnpm test` - run vitest

## Guidelines

- Keep code concise, prefer simplicity
- No unnecessary abstractions
- All decisions should trace back to: deploy independence, edge perf, org scaling, incremental migration

## Volta workaround

Volta shims often fail in Claude Code sandbox. When `pnpm`/`npm` fails with "Node is not available", use direct binary:

```
~/.volta/tools/image/node/<version>/bin/npx pnpm <command>
```

Check `package.json` volta field for pinned version.
