# Fragment Guide

A fragment is an independent Cloudflare Worker that SSR-renders a Vue component. It deploys independently and is stitched into the shell app's HTML at request time.

## File Conventions

| File | Purpose |
|------|---------|
| `vite.config.ts` | `defineFragmentConfig()` from `framework/vite` — dual build |
| `fragment.config.ts` | `defineFragmentConfig()` from `framework/config` — cache, props |
| `src/App.vue` | Root component |
| `wrangler.jsonc` | Cloudflare Worker config |
| `package.json` | Standard — name must match dir name |

Fragment ID is derived from directory name: `fragment-header` → ID `header`.

## `defineFragmentConfig()` (runtime)

```ts
// fragment.config.ts
import { defineFragmentConfig } from 'framework/config';

export default defineFragmentConfig({
  cache: 'public, max-age=3600',
  props: (request) => {
    const url = new URL(request.url);
    return { id: url.searchParams.get('id') || '' };
  },
});
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cache` | `string` | `'private, no-cache'` | `Cache-Control` on the fragment JSON response |
| `props` | `(request: Request) => Record<string, string>` | — | Extract props from the incoming request (query params set by shell) |

## `src/App.vue`

Standard Vue SFC. Props come from `fragment.config.ts`'s `props` function:

```vue
<template>
  <header class="header">
    <a href="/" class="logo">Back Market</a>
    <nav>
      <a href="/">Home</a>
      <a href="/product/iphone-15">Products</a>
    </nav>
    <button @click="cartCount++">Cart ({{ cartCount }})</button>
  </header>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const cartCount = ref(0);

onMounted(() => {
  window.addEventListener('fragment:event', (event: CustomEvent) => {
    if (event.detail.type === 'cart:add') {
      cartCount.value++;
    }
  });
});
</script>
```

## Cross-Fragment Communication

Fragments communicate via custom DOM events (pub-sub). No shared SSR state.

**Emit** from any fragment:

```ts
window.dispatchEvent(new CustomEvent('fragment:event', {
  detail: { type: 'cart:add', payload: { productId: '123' } },
}));
```

**Listen** in another fragment:

```ts
onMounted(() => {
  window.addEventListener('fragment:event', (e: CustomEvent) => {
    if (e.detail.type === 'cart:add') { /* handle */ }
  });
});
```

## Independent Deploy

Each fragment is a standalone Worker. You can:

- Build and deploy a single fragment without touching other packages
- Use `pnpm run deploy:changed` to only deploy what changed since last commit
- Test a fragment in isolation with its own `wrangler dev`

The shell discovers fragments via service bindings (`FRAGMENT_HEADER`, etc.), generated automatically from the monorepo structure.

## Vite Config

```ts
// vite.config.ts
import { defineFragmentConfig } from 'framework/vite';
export default defineFragmentConfig();
```

Name is auto-inferred from directory name. Override with `defineFragmentConfig('custom-name')`.

The Vite config handles:
- **Server build**: bundles `entry-server.js` (SSR worker)
- **Client build** (`--mode client`): bundles `fragment-{name}.[hash].js` + CSS, externalizes Vue
