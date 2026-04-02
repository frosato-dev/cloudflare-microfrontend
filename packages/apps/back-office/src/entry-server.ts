import { createShellWorker } from '@meta-framework/core/worker/shell';
import { routes } from './router.js';
import { middlewareRegistry } from './middleware.js';
import { layouts } from './layouts/index.js';

const streamLayoutFn = (ctx: {
  headerHtml: string;
  otherFragments: string;
  pageHtml: string;
  headLinks: string;
  clientScripts: string;
  inlineStyles: string;
}) => ({
  before: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Back Office</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a2e; }
  </style>
  ${ctx.headLinks}
</head>
<body>
  <div id="app">
    ${ctx.headerHtml}
    <main>
      <div data-page>${ctx.pageHtml}</div>
      ${ctx.otherFragments}
    </main>
  </div>
  ${ctx.clientScripts}
`,
  after: `</body>\n</html>`,
});

export default createShellWorker({
  routes,
  layouts,
  middlewareRegistry,
  streamLayoutFn,
});
