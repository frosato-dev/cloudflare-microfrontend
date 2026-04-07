import { createSSRApp, createApp, type Component } from 'vue';

export function hydrateFragment(id: string, App: Component) {
  // Register for re-hydration on SPA nav
  const registry = ((globalThis as any).__fragmentRegistry ||= {});
  registry[id] = (container: Element) => mountFragment(id, App, container, false);

  mountFragment(id, App, document.querySelector(`[data-fragment="${id}"]`), true);
}

function mountFragment(id: string, App: Component, container: Element | null, ssr: boolean) {
  if (!container) return;
  const props = JSON.parse((container as HTMLElement).dataset.props || '{}');
  const app = ssr ? createSSRApp(App, props) : createApp(App, props);
  app.mount(container);
  console.log(`[fragment-${id}] hydrated`);
}
