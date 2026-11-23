import { createSSRApp, createApp, type Component, type App } from 'vue';
import { fragmentRoot } from '../fragment-root.ts';

export interface FragmentEntry {
  mount: (container: Element) => void;
  app: App | null;
  hydratedProps: string;
  /** data-fragment-version of the mounted HTML (same deploy as the loaded JS) */
  version?: string;
}

export function hydrateFragment(id: string, App: Component) {
  const registry: Record<string, FragmentEntry> = ((globalThis as any).__fragmentRegistry ||= {});
  registry[id] = {
    mount: (container: Element) => mountFragment(id, App, container, false),
    app: null,
    hydratedProps: '',
  };

  mountFragment(id, App, document.querySelector(`[data-fragment="${id}"]`), true);
}

function mountFragment(id: string, App: Component, container: Element | null, ssr: boolean) {
  if (!container) return;
  const registry: Record<string, FragmentEntry> = (globalThis as any).__fragmentRegistry;
  const props = JSON.parse((container as HTMLElement).dataset.props || '{}');
  // Keep the fragment's own stylesheet links (rendered server-side by fragmentRoot)
  const css = [...container.querySelectorAll(':scope > link[rel="stylesheet"]')].map((l) => l.getAttribute('href')!);
  // Server render failed/timed out (empty slot) → client-side render instead of hydration
  const hydrate = ssr && !(container as HTMLElement).dataset.fragmentError;
  if (!hydrate) container.innerHTML = '';
  const root = fragmentRoot(App, props, css);
  const app = hydrate ? createSSRApp(root) : createApp(root);
  app.mount(container);
  if (registry[id]) {
    registry[id].app = app;
    registry[id].hydratedProps = (container as HTMLElement).dataset.props || '{}';
    registry[id].version = (container as HTMLElement).dataset.fragmentVersion;
  }
  console.log(`[fragment-${id}] hydrated`);
}
