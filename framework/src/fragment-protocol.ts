import type { FragmentBuildInfo, FragmentResponse } from './types.js';

/** Same-origin path where fragment client assets are served: /_fragments/<id>/<file> (shell → fragment worker) */
export const FRAGMENT_ASSET_PREFIX = '/_fragments';

/** Shell ↔ fragment wire contract: body = raw HTML, build info in headers */
export const FRAGMENT_HEADERS = {
  version: 'X-Fragment-Version',
  vue: 'X-Fragment-Vue',
  assets: 'X-Fragment-Assets',
} as const;

export function fragmentHeaders(info: FragmentBuildInfo): Record<string, string> {
  return {
    [FRAGMENT_HEADERS.version]: info.version,
    [FRAGMENT_HEADERS.vue]: info.vue,
    [FRAGMENT_HEADERS.assets]: JSON.stringify(info.assets),
  };
}

export async function readFragmentResponse(res: Response): Promise<FragmentResponse> {
  if (!res.ok) return { html: '' };
  let assets: FragmentResponse['assets'];
  try {
    assets = JSON.parse(res.headers.get(FRAGMENT_HEADERS.assets) || 'null') ?? undefined;
  } catch {}
  return {
    html: await res.text(),
    version: res.headers.get(FRAGMENT_HEADERS.version) ?? undefined,
    vue: res.headers.get(FRAGMENT_HEADERS.vue) ?? undefined,
    assets,
  };
}
