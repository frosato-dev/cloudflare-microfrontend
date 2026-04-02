import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const fw = (sub: string) => resolve(__dirname, `packages/framework/src/${sub}`);

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@meta-framework/core/worker/shell': fw('worker/shell.ts'),
      '@meta-framework/core/worker/fragment': fw('worker/fragment.ts'),
      '@meta-framework/core/hydration/shell': fw('hydration/shell.ts'),
      '@meta-framework/core/hydration/fragment': fw('hydration/fragment.ts'),
      '@meta-framework/core/vite/shell': fw('vite/shell.ts'),
      '@meta-framework/core/vite/fragment': fw('vite/fragment.ts'),
      '@meta-framework/core': fw('index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
