import { buildLayoutRegistry } from '@meta-framework/core';

export const layouts = buildLayoutRegistry(
  import.meta.glob('./layouts/*.vue', { eager: true }) as any,
);
