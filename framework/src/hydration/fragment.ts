import { createSSRApp, createApp, type Component, type App } from 'vue';

export interface FragmentEntry {
  mount: (container: Element) => void;
  app: App | null;
}

export function hydrateFragment(id: string, App: Component) {
  const registry: Record<string, FragmentEntry> = ((globalThis as any).__fragmentRegistry ||= {});
  registry[id] = {
    mount: (container: Element) => mountFragment(id, App, container, false),
    app: null,
  };

  mountFragment(id, App, document.querySelector(`[data-fragment="${id}"]`), true);
}

function mountFragment(id: string, App: Component, container: Element | null, ssr: boolean) {
  if (!container) return;
  const registry: Record<string, FragmentEntry> = (globalThis as any).__fragmentRegistry;
  const props = JSON.parse((container as HTMLElement).dataset.props || '{}');
  if (!ssr) container.innerHTML = '';
  const app = ssr ? createSSRApp(App, props) : createApp(App, props);
  app.mount(container);
  if (registry[id]) registry[id].app = app;
  console.log(`[fragment-${id}] hydrated`);
}
