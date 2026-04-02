import type { FrameworkConfig } from '@meta-framework/core';

const config: FrameworkConfig = {
  fragments: {
    header: {
      src: './packages/fragment-header',
      workerUrl: 'https://fragment-header.backmarket.workers.dev',
      cache: 'static',
      ssrEntry: './packages/fragment-header/src/entry-server.ts',
      clientEntry: './packages/fragment-header/src/entry-client.ts',
    },
    product: {
      src: './packages/fragment-product',
      workerUrl: 'https://fragment-product.backmarket.workers.dev',
      cache: 'personalized',
      ssrEntry: './packages/fragment-product/src/entry-server.ts',
      clientEntry: './packages/fragment-product/src/entry-client.ts',
    },
  },
  shell: {
    src: './packages/shell',
  },
};

export default config;
