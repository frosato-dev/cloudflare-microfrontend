# Framework Documentation

POC for a Vue micro-frontend meta-framework running on Cloudflare Workers. Each team owns a "fragment" — an independently deployed Worker that SSR-renders a piece of the page. A shell Worker stitches fragments together at the edge, streams the response, and hydrates everything into a single SPA on the client.

Goal: prove that Back Market can break the monolith into independently deployable micro-frontends without sacrificing SSR performance or developer experience.

## I want to

| Goal                                  | Doc                                                            |
| ------------------------------------- | -------------------------------------------------------------- |
| Set up and run the project            | [Getting Started](external/getting-started.md)                 |
| Build a shell app                     | [App Guide](external/app-guide.md)                             |
| Build a fragment                      | [Fragment Guide](external/fragment-guide.md)                   |
| Configure routes, middleware, layouts | [Routing & Middleware](external/routing-and-middleware.md)     |
| Look up a public API                  | [API Reference](external/api-reference.md)                     |
| Use the CLI                           | [CLI](external/cli.md)                                         |
| Set up the monorepo workspace         | [Monorepo Setup](external/monorepo-setup.md)                   |
| Configure caching                     | [Caching](external/caching.md)                                 |
| Debug with the debug bar              | [Debugging](external/debugging.md)                             |
| Understand the architecture           | [Architecture Overview](internal/architecture-overview.md)     |
| Understand SSR streaming              | [SSR Rendering Pipeline](internal/ssr-rendering-pipeline.md)   |
| Understand hydration & SPA nav        | [Hydration & Navigation](internal/hydration-and-navigation.md) |
| Understand Vite plugins               | [Vite Plugins](internal/vite-plugins.md)                       |
| Understand asset collection           | [Build & Assets](internal/build-and-assets.md)                 |
| Understand worker internals           | [Worker Internals](internal/worker-internals.md)               |
| Understand discovery & codegen        | [Discovery & Codegen](internal/discovery-and-codegen.md)       |
| Understand caching internals          | [Caching Internals](internal/caching-internals.md)             |

## Sections

**[External](external/)** — for app and fragment developers. Covers file conventions, configuration, CLI commands, and day-to-day workflows.

**[Internal](internal/)** — for framework contributors. Covers design decisions, streaming pipeline, hydration mechanics, Vite plugin internals, and caching implementation.

## Raw Design Notes

The original design notes are in [`../docs/`](../docs/) — detailed internal thinking that preceded this documentation.
