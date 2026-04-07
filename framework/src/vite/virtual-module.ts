import type { Plugin } from 'vite';

export function virtualModule(name: string, virtualId: string, generate: () => string): Plugin {
  const resolvedId = '\0' + virtualId;
  return {
    name,
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) return generate();
    },
  };
}
