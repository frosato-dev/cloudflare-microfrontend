import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export function defineFragmentConfig(name: string) {
  return defineConfig(({ mode }) => {
    if (mode === 'client') {
      return {
        plugins: [vue()],
        build: {
          outDir: 'dist/client',
          manifest: true,
          rollupOptions: {
            input: resolve(process.cwd(), 'src/entry-client.ts'),
            external: ['vue'],
            output: {
              entryFileNames: `${name}.[hash].js`,
              assetFileNames: `${name}.[hash].[ext]`,
              format: 'es' as const,
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
