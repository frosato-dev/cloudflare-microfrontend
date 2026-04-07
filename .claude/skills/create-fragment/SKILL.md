---
name: create-fragment
description: Scaffold a new fragment (micro-frontend) in the meta-framework. Creates all boilerplate files under monorepo/packages/fragments/fragment-{name}/.
user-invocable: true
---

# Create Fragment

Scaffold a new Vue micro-frontend fragment. The user provides the fragment name as the argument (e.g. `/create-fragment cart`).

## Steps

1. **Parse the name** from the argument. Strip any `fragment-` prefix if the user included it. The name should be lowercase kebab-case (e.g. `cart`, `search-bar`, `footer`). If no name is provided, ask the user for one.

2. **Create the following files** under `monorepo/packages/fragments/fragment-{name}/`:

### `package.json`
```json
{
  "name": "@meta-framework/fragment-{name}",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build && vite build --mode client"
  },
  "dependencies": {
    "framework": "link:../../../../framework"
  }
}
```

### `wrangler.jsonc`
```jsonc
{
  "name": "fragment-{name}",
  "main": "dist/server/entry-server.js",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": false,
}
```

### `vite.config.ts`
```ts
import { defineFragmentConfig } from 'framework/vite';

export default defineFragmentConfig();
```

### `fragment.config.ts`
```ts
import { defineFragmentConfig } from 'framework/config'

export default defineFragmentConfig({
  cache: 'public, max-age=3600',
})
```

### `src/App.vue`
```vue
<template>
  <div class="{name}">
    <p>{Name} fragment</p>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.{name} {
  padding: 1rem;
}
</style>
```

Replace `{name}` with the actual fragment name and `{Name}` with the capitalized version.

3. **Run `pnpm install`** from the `monorepo/` directory to register the new workspace package. Use the volta workaround if pnpm fails: `~/.volta/tools/image/node/22.22.2/bin/npx pnpm install`.

Note: `entry-server.ts` is generated automatically by the framework via a virtual module based on `fragment.config.ts`. Do NOT create it manually.

4. **Remind the user** the fragment is ready to use — add `<Fragment id="{name}" />` in any app layout to render it. If it needs props from the request, add a `props(request)` function in `fragment.config.ts` (see `fragment-product` for an example).

No other files need editing — scripts and wrangler bindings are auto-discovered.
