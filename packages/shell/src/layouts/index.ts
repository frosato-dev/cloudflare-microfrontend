import { wrapFragment, type LayoutContext } from '@meta-framework/core';

export const layouts: Record<string, (ctx: LayoutContext) => string> = {
  default: (ctx) => {
    const headerHtml = ctx.fragments.header
      ? wrapFragment('header', ctx.fragments.header.html)
      : '';

    const productHtml = ctx.fragments.product
      ? wrapFragment('product', ctx.fragments.product.html, ctx.route.props)
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Meta Framework POC</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a2e; }
  </style>
  ${Object.values(ctx.fragments).map(f => f.css ? `<style>${f.css}</style>` : '').join('\n')}
  ${ctx.headLinks}
</head>
<body>
  <div id="app">
    ${headerHtml}
    <main>
      <div data-page>${ctx.pageHtml}</div>
      ${productHtml}
    </main>
  </div>
  ${ctx.clientScripts}
</body>
</html>`;
  },
};
