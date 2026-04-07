import type { Component } from 'vue';

export function buildModuleRegistry<T>(
  modules: Record<string, { default: T }>,
  extPattern: RegExp,
): Record<string, T> {
  const registry: Record<string, T> = {};
  for (const [path, mod] of Object.entries(modules)) {
    const match = path.match(extPattern);
    if (match) registry[match[1]] = mod.default;
  }
  return registry;
}

export function buildLayoutRegistry(
  modules: Record<string, { default: Component }>,
): Record<string, Component> {
  return buildModuleRegistry(modules, /\/([^/]+)\.vue$/);
}

export async function* streamResponse(ctx: {
  title: string;
  baseStyles: string;
  headLinks: string;
  inlineStyles: string;
  appHtml: string;
  clientScripts: string;
  viewTransitions?: boolean;
}): AsyncGenerator<string> {
  const viewTransitionStyles = ctx.viewTransitions
    ? `\n  <style>@view-transition { navigation: auto; }
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
  animation-timing-function: ease-in-out;
}</style>`
    : '';
  yield `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${ctx.title}</title>
  <style>${ctx.baseStyles}</style>${viewTransitionStyles}
  ${ctx.headLinks}
  ${ctx.inlineStyles}
</head>
<body>
  <div id="app">${ctx.appHtml}</div>
  ${ctx.clientScripts}
`;

  yield `</body>\n</html>`;
}
