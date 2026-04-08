# Vite Plugins

Source: `framework/src/vite/shell.ts`, `framework/src/vite/fragment.ts`, `framework/src/vite/virtual-module.ts`

## Overview

`defineShellConfig()` and `defineFragmentConfig()` return Vite configs that handle:
- **Dual build**: server (default) + client (`--mode client`)
- **Virtual entry modules**: auto-generated entry points that wire framework internals
- **Vue browser bundle**: emit once in shell, externalize in fragments
- **Import map**: shared Vue via `<script type="importmap">`

## `virtualModule()` Pattern

```ts
// framework/src/vite/virtual-module.ts
function virtualModule(name: string, virtualId: string, generate: () => string): Plugin {
  const resolvedId = '\0' + virtualId;
  return {
    name,
    resolveId(id) { if (id === virtualId) return resolvedId; },
    load(id) { if (id === resolvedId) return generate(); },
  };
}
```

Vite convention: `\0` prefix marks virtual modules (not on disk). The `generate()` function returns the source code string.

## Shell Virtual Entries

### Server Entry (`virtual:shell-entry-server`)

Generated code:

```ts
import { createShellWorker } from 'framework/worker';
import { routes } from '/abs/path/src/router.ts';
import config from '/abs/path/application.config.ts';
import * as mw0 from '/abs/path/src/middleware/logger.ts';
import * as layout0 from '/abs/path/src/layouts/default.vue';

const middleware = { './middleware/logger.ts': mw0 };
const layouts = { './layouts/default.vue': layout0 };

export default createShellWorker({
  routes, middleware, layouts,
  document: config.document,
});
```

Auto-discovers `src/middleware/*.ts` and `src/layouts/*.vue`.

### Client Entry (`virtual:shell-entry-client`)

```ts
import { hydrateShell } from 'framework/hydration';
import { routes } from '/abs/path/src/router.ts';
import * as layout0 from '/abs/path/src/layouts/default.vue';

const layouts = { './layouts/default.vue': layout0 };

hydrateShell({ routes, layouts });
```

## Fragment Virtual Entries

### Server Entry (`virtual:fragment-entry-server`)

```ts
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createFragmentWorker } from 'framework/worker';
import App from '/abs/path/src/App.vue';
import config from '/abs/path/fragment.config.ts';

async function render(request) {
  const props = config.props ? config.props(request) : {};
  const app = createSSRApp(App, props);
  const html = await renderToString(app);
  return { html };
}

export default createFragmentWorker(render, config.cache ?? 'private, no-cache');
```

### Client Entry (`virtual:fragment-entry-client`)

```ts
import { hydrateFragment } from 'framework/hydration';
import App from '/abs/path/src/App.vue';
hydrateFragment('header', App);  // ID from dirname
```

Fragment can override with a real `src/entry-client.ts` file — if it exists, the virtual module is skipped.

## `vueBrowserBundlePlugin()`

Shell-only plugin. Emits Vue's pre-built browser bundle as a hashed asset:

```ts
function vueBrowserBundlePlugin(): Plugin {
  return {
    name: 'meta-framework:vue-browser-bundle',
    async buildStart() {
      // Resolve vue/dist/vue.runtime.esm-browser.prod.js
    },
    generateBundle() {
      const source = readFileSync(vuePath);
      const hash = createHash('sha256').update(source).digest('hex').slice(0, 8);
      this.emitFile({ type: 'asset', fileName: `vue.${hash}.js`, source });
    },
  };
}
```

This avoids re-bundling Vue and eliminates a runtime-dom import waterfall.

## Vue Externalization

Fragment client builds use `external: ['vue']`:

```ts
rollupOptions: {
  external: ['vue'],
  // ...
}
```

At runtime, `import 'vue'` resolves via the import map in `<head>` to `/assets/vue.[hash].js`.

## Build Pipeline

```mermaid
flowchart TB
    subgraph "vite build (server)"
        SS[Shell server entry] --> SW[dist/server/entry-server.js]
        FS[Fragment server entry] --> FW[dist/server/entry-server.js]
    end

    subgraph "vite build --mode client"
        SC[Shell client entry] --> SCA[dist/client/shell.[hash].js\nshell.[hash].css\nvue.[hash].js]
        FC[Fragment client entry] --> FCA["dist/client/fragment-{name}.[hash].js\nfragment-{name}.[hash].css"]
    end

    subgraph collectAssets
        SCA & FCA --> MERGE[Merge into dist/static/assets/]
        MERGE --> MAN[manifest.json]
        MERGE --> HDR[_headers]
    end

    SW & FW -->|"Cloudflare Workers"| DEPLOY[wrangler deploy]
    MERGE -->|"Static assets"| DEPLOY
```

## Dual Build Configuration

### Shell

| Mode | Entry | Output | Notes |
|------|-------|--------|-------|
| server (default) | `virtual:shell-entry-server` | `dist/server/entry-server.js` | `ssr: true`, `target: 'webworker'` |
| client | `virtual:shell-entry-client` | `dist/client/shell.[hash].js` | `manifest: true`, emits Vue bundle |

### Fragment

| Mode | Entry | Output | Notes |
|------|-------|--------|-------|
| server (default) | `virtual:fragment-entry-server` | `dist/server/entry-server.js` | `ssr: true`, `target: 'webworker'` |
| client | `virtual:fragment-entry-client` | `dist/client/fragment-{name}.[hash].js` | `manifest: true`, `external: ['vue']` |
