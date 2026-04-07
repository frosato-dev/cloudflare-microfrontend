# Routing & Middleware

Routes are defined in `src/router.ts` as an array of `AppRoute` objects. Middleware and layouts are auto-discovered from the filesystem. The framework handles both server-side matching and client-side vue-router setup.

---

## Routes

```ts
// src/router.ts
import Home from './pages/Home.vue'
import Product from './pages/Product.vue'

export const routes: AppRoute[] = [
  { path: '/', component: Home },
  { path: '/product/:slug', component: Product, layout: 'default', middleware: ['auth'] },
]
```

- `path` — express-style with `:params`
- `component` — Vue component for the page
- `layout` — name matching a file in `src/layouts/` (defaults to `"default"`)
- `middleware` — array of middleware names matching files in `src/middleware/`

**Server side:** `matchRoute()` converts paths to regex, extracts params, returns the matched route with props.

**Client side:** `toClientRoutes()` converts to vue-router format. Params are auto-bound as props when the route has `:params`.

## Middleware

```ts
// src/middleware/auth.ts
export default async function(request: Request) {
  if (!request.headers.get('authorization')) {
    return new Response('Unauthorized', { status: 401 })
  }
  // return nothing → continue to next middleware / render
}
```

Middleware runs in order before rendering. Return a `Response` to short-circuit. Return nothing to continue. Named by filename: `src/middleware/auth.ts` → middleware name `"auth"`.

## Layouts

```vue
<!-- src/layouts/default.vue -->
<template>
  <div>
    <Fragment id="header" />
    <main><slot /></main>
    <Fragment id="footer" />
  </div>
</template>
```

Layouts wrap page components. The `<slot>` receives the page. `<Fragment>` components place micro-frontend placeholders. Named by filename: `src/layouts/default.vue` → layout name `"default"`.
