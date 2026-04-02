import type { FragmentResponse, LayoutContext, StreamLayoutContext } from './types.js';

export function wrapFragment(id: string, html: string, props: Record<string, string> = {}): string {
  return `<div data-fragment="${id}" data-props='${JSON.stringify(props)}'>${html}</div>`;
}

export function renderLayout(
  layouts: Record<string, (ctx: LayoutContext) => string>,
  name: string,
  ctx: LayoutContext,
): string {
  const layout = layouts[name] || layouts.default;
  return layout(ctx);
}

export async function* streamLayout(
  layoutFn: (ctx: {
    headerHtml: string;
    otherFragments: string;
    pageHtml: string;
    headLinks: string;
    clientScripts: string;
    inlineStyles: string;
  }) => { before: string; after: string },
  ctx: StreamLayoutContext,
): AsyncGenerator<string> {
  const resolvedFragments: Record<string, FragmentResponse> = {};
  const deferredIds: string[] = [];

  // Race all fragments — resolve what we can in ~5ms, defer the rest
  await Promise.all(
    ctx.route.fragments.map((id) =>
      Promise.race([
        ctx.fragmentPromises[id].then((res) => { resolvedFragments[id] = res; }),
        new Promise((r) => setTimeout(r, 5)),
      ]),
    ),
  );

  for (const id of ctx.route.fragments) {
    if (!resolvedFragments[id]) deferredIds.push(id);
  }

  const pageHtml = await ctx.pageHtmlPromise;

  // Build fragment HTML
  const fragmentHtmlParts: string[] = [];
  for (const id of ctx.route.fragments) {
    const props = id === 'header' ? {} : ctx.route.props;
    const f = resolvedFragments[id];
    fragmentHtmlParts.push(
      f ? wrapFragment(id, f.html, props) : `<div data-fragment="${id}" data-props='${JSON.stringify(props)}'></div>`,
    );
  }

  const headerHtml = fragmentHtmlParts.find((_, i) => ctx.route.fragments[i] === 'header') || '';
  const otherFragments = fragmentHtmlParts.filter((_, i) => ctx.route.fragments[i] !== 'header').join('\n      ');

  const inlineStyles = Object.values(resolvedFragments).map(f => f.css ? `<style>${f.css}</style>` : '').join('\n');

  const { before, after } = layoutFn({
    headerHtml,
    otherFragments,
    pageHtml,
    headLinks: ctx.headLinks,
    clientScripts: ctx.clientScripts,
    inlineStyles,
  });

  // 1. Flush shell immediately
  yield before;

  // 2. Stream deferred fragments
  for (const id of deferredIds) {
    const fragment = await ctx.fragmentPromises[id];
    if (fragment) {
      const escapedHtml = fragment.html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/<\/script>/gi, '<\\/script>');
      yield `<script>document.querySelector('[data-fragment="${id}"]').innerHTML=\`${escapedHtml}\`;</script>\n`;
    }
  }

  // 3. Close
  yield after;
}
