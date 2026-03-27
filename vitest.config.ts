import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@meta-framework/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
