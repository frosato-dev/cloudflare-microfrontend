import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    // Framework unit tests only — e2e/ is Playwright (pnpm test:e2e)
    dir: '..',
    include: ['framework/src/**/*.test.ts'],
  },
});
