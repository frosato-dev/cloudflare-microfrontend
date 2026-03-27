import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  if (mode === 'client') {
    return {
      plugins: [vue()],
      build: {
        outDir: 'dist/client',
        rollupOptions: {
          input: resolve(__dirname, 'src/entry-client.ts'),
          output: { entryFileNames: 'fragment-header.js', format: 'es' },
        },
      },
    };
  }

  return {
    plugins: [vue()],
    build: {
      ssr: 'src/entry-server.ts',
      outDir: 'dist/server',
      rollupOptions: { output: { format: 'es' } },
    },
  };
});
