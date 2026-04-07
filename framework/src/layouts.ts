import type { Component } from 'vue';

export function buildModuleRegistry<T>(
  modules: Record<string, { default: T }>,
  extPattern: RegExp,
): Record<string, T> {
  const registry: Record<string, T> = {};
  for (const [path, mod] of Object.entries(modules)) {
    const match = path.match(extPattern);
    if (match) registry[match[1]] = mod.default;
  }
  return registry;
}

export function buildLayoutRegistry(
  modules: Record<string, { default: Component }>,
): Record<string, Component> {
  return buildModuleRegistry(modules, /\/([^/]+)\.vue$/);
}
