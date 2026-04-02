import type { FrameworkConfig } from '@meta-framework/core';

const config: FrameworkConfig = {
  fragments: {
    header: {
      src: './packages/fragments/fragment-header',
      workerUrl: 'https://fragment-header.backmarket.workers.dev',
      cache: 'static',
      ssrEntry: './packages/fragments/fragment-header/src/entry-server.ts',
      clientEntry: './packages/fragments/fragment-header/src/entry-client.ts',
    },
    product: {
      src: './packages/fragments/fragment-product',
      workerUrl: 'https://fragment-product.backmarket.workers.dev',
      cache: 'personalized',
      ssrEntry: './packages/fragments/fragment-product/src/entry-server.ts',
      clientEntry: './packages/fragments/fragment-product/src/entry-client.ts',
    },
  },
  apps: {
    'front-office': {
      src: './packages/apps/front-office',
    },
  },
};

export default config;
