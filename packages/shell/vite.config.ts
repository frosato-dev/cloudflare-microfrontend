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
          output: { entryFileNames: 'shell.js', assetFileNames: 'shell.[ext]', format: 'es' },
        },
      },
    };
  }

  // SSR / Worker build — bundle all deps for CF Workers
  return {
    plugins: [vue()],
    build: {
      ssr: 'src/entry-server.ts',
      outDir: 'dist/server',
      rollupOptions: {
        output: { format: 'es' },
      },
    },
    ssr: { noExternal: true, target: 'webworker' },
  };
});
