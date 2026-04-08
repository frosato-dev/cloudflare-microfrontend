# Routing & Middleware

## Route Definition

Routes are defined in `src/router.ts` as `AppRoute[]`:

```ts
import type { AppRoute } from "framework";

export const routes: AppRoute[] = [
  {
    path: "/",
    component: IndexPage,
    layout: "default",
    middleware: ["logger"],
    cache: "public, s-maxage=300",
  },
  {
    path: "/product/:id",
    component: ProductPage,
    layout: "default",
    middleware: ["logger", "auth"],
    cache: "public, s-maxage=60, stale-while-revalidate=30",
  },
];
```

## `AppRoute` Fields

| Field        | Type        | Default     | Description                                                     |
| ------------ | ----------- | ----------- | --------------------------------------------------------------- |
| `path`       | `string`    | required    | URL pattern                                                     |
| `component`  | `Component` | required    | Page component                                                  |
| `layout`     | `string`    | `'default'` | Layout name (filename without `.vue` in `src/layouts/`)         |
| `middleware` | `string[]`  | `[]`        | Middleware chain (filenames without `.ts` in `src/middleware/`) |
| `cache`      | `string`    | —           | `Cache-Control` header. `s-maxage` enables edge caching         |

## Path Matching

Dynamic segments use `:param` syntax, converted to regex at startup:

| Pattern                   | Matches                    | Params                        |
| ------------------------- | -------------------------- | ----------------------------- |
| `/`                       | `/`                        | —                             |
| `/product/:id`            | `/product/iphone-15`       | `{ id: 'iphone-15' }`         |
| `/category/:cat/item/:id` | `/category/phones/item/42` | `{ cat: 'phones', id: '42' }` |

Implementation: `pathToPattern()` in `framework/src/router.ts` converts `:param` to `([^/]+)` capture groups. Routes are matched in definition order — first match wins.

## Middleware

Middleware files in `src/middleware/` export a default function:

```ts
// src/middleware/logger.ts
import type { Middleware } from "framework";

const logger: Middleware = (request) => {
  console.log(`[${request.method}] ${new URL(request.url).pathname}`);
};

export default logger;
```

### Execution Order

Middleware runs in the order listed in `route.middleware`:

```ts
middleware: ["logger", "auth", "rate-limit"];
// Runs: logger → auth → rate-limit → render
```

### Short-Circuit

Return a `Response` to stop the chain and skip rendering:

```ts
const auth: Middleware = (request) => {
  if (!request.headers.get("Authorization")) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Return nothing → continue to next middleware
};
```

### Registration

Middleware is auto-discovered from `src/middleware/*.ts`. The filename becomes the middleware name: `src/middleware/auth.ts` → `'auth'`.

## Layouts

Layout components live in `src/layouts/` and must include a `<slot>` for page content:

```vue
<!-- src/layouts/default.vue -->
<template>
  <Fragment id="header" />
  <main><slot /></main>
  <Fragment id="footer" />
</template>
```

Layout name = filename without `.vue`: `src/layouts/default.vue` → `'default'`.

Routes reference layouts by name: `layout: 'default'`. If omitted, `'default'` is used.

## Client-Side Navigation

On the client, routes are converted to `vue-router` routes via `toClientRoutes()`. SPA navigation uses:

1. **Link interception** — `<a href="/...">` clicks are intercepted and pushed to `vue-router`
2. **View Transitions API** — if `viewTransitions: true` in app config, cross-page transitions use `document.startViewTransition()`
3. **Fragment diffing** — on SPA nav, the shell fetches the new page with `X-Navigate: 1` header, diffs fragment props, and only re-mounts fragments that changed

See [Hydration & Navigation](../internal/hydration-and-navigation.md) for the full SPA nav flow.
