import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export function defineShellConfig() {
  return defineConfig(({ mode }) => {
    if (mode === 'client') {
      return {
        plugins: [vue()],
        build: {
          outDir: 'dist/client',
          manifest: true,
          rollupOptions: {
            input: resolve(process.cwd(), 'src/entry-client.ts'),
            output: {
              entryFileNames: `shell.[hash].js`,
              assetFileNames: `shell.[hash].[ext]`,
              format: 'es' as const,
              chunkFileNames: '[name].[hash].js',
              manualChunks: { vue: ['vue'] },
            },
          },
        },
      };
    }

    return {
      plugins: [vue()],
      build: {
        ssr: 'src/entry-server.ts',
        outDir: 'dist/server',
        rollupOptions: { output: { format: 'es' as const } },
      },
      ssr: { noExternal: true, target: 'webworker' as const },
    };
  });
}
