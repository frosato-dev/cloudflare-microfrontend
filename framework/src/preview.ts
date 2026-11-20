import { buildShellTags, fragmentScriptTag } from './request-handler.js';
import type { AssetManifest, FragmentAssets, FragmentFetcher } from './types.js';

const defaultBaseStyles = `* { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a2e; }`;

function previewIndexHtml(fragmentIds: string[]): string {
  const list = fragmentIds.length
    ? fragmentIds.map(id => `<li><a href="/__preview/${id}">${id}</a></li>`).join('\n')
    : '<li>No fragments found</li>';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fragment Preview</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; color: #1a1a2e; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Fragment Preview</h1>
  <ul>${list}</ul>
</body>
</html>`;
}

function previewFragmentHtml(
  fragmentId: string,
  html: string,
  props: Record<string, string>,
  assets: FragmentAssets | undefined,
  manifest?: AssetManifest,
  document?: { title: string; baseStyles?: string },
): string {
  const { headLinks: shellLinks, scripts: shellScripts } = buildShellTags(manifest);
  const fragScript = fragmentScriptTag(assets);
  const baseStyles = document?.baseStyles || defaultBaseStyles;
  const propsJson = JSON.stringify(props);
  const escapedProps = propsJson.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${fragmentId}</title>
  ${baseStyles ? `<style>${baseStyles}</style>` : ''}
  ${shellLinks}
  ${shellScripts}
</head>
<body>
  <div data-fragment="${fragmentId}" data-props="${escapedProps}" data-allow-mismatch>${html}</div>
  ${fragScript}
</body>
</html>`;
}

export function handlePreviewRequest(
  request: Request,
  fetchFragment: FragmentFetcher,
  fragmentIds: string[],
  manifest?: AssetManifest,
  document?: { title: string; baseStyles?: string },
): Response {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === '/__preview') {
    return new Response(previewIndexHtml([...fragmentIds].sort()), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const match = pathname.match(/^\/__preview\/([^/]+)$/);
  if (!match) {
    return new Response('Not Found', { status: 404 });
  }

  const fragmentId = match[1];
  const routeProps: Record<string, string> = {};
  for (const [k, v] of url.searchParams) {
    routeProps[k] = v;
  }

  const fragmentPromise = fetchFragment(fragmentId, request, routeProps);

  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const result = await fragmentPromise;
          const html = previewFragmentHtml(fragmentId, result.html, routeProps, result.assets, manifest, document);
          controller.enqueue(encoder.encode(html));
          controller.close();
        } catch (err: any) {
          controller.enqueue(encoder.encode(
            `<!DOCTYPE html><html><body><h1>Error fetching fragment "${fragmentId}"</h1><pre>${err.message}</pre></body></html>`,
          ));
          controller.close();
        }
      },
    }),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
