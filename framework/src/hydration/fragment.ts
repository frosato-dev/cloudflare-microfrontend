import { createSSRApp, type Component } from 'vue';

export function hydrateFragment(id: string, App: Component) {
  const container = document.querySelector(`[data-fragment="${id}"]`);
  if (!container) return;

  const props = JSON.parse((container as HTMLElement).dataset.props || '{}');
  const app = createSSRApp(App, props);
  app.mount(container);
  console.log(`[fragment-${id}] hydrated`);
}
