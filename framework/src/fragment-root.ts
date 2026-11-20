import { h, type Component } from 'vue';

/**
 * Fragment root component: the fragment's own stylesheet links, then App.
 * Rendered identically on server and client → links stay in place through hydration (no FOUC, no mismatch).
 */
export function fragmentRoot(App: Component, props: Record<string, unknown>, css: string[]): Component {
  return {
    render: () => [...css.map((href) => h('link', { rel: 'stylesheet', href })), h(App, props)],
  };
}
