import type { FragmentFetcher, FragmentResponse } from '../types.js';

export interface FragmentMeta {
  id: string;
  fetchStart: number;
  fetchEnd: number;
  cached: boolean;
}

export function wrapFetcherWithDebug(
  fetcher: FragmentFetcher,
  requestStart: number,
): { fetcher: FragmentFetcher; getMeta: () => Map<string, FragmentMeta> } {
  const meta = new Map<string, FragmentMeta>();

  const wrappedFetcher: FragmentFetcher = async (fragmentId, request, routeProps) => {
    const fetchStart = Date.now() - requestStart;
    const result = await fetcher(fragmentId, request, routeProps);
    const fetchEnd = Date.now() - requestStart;

    meta.set(fragmentId, {
      id: fragmentId,
      fetchStart,
      fetchEnd,
      cached: result._meta?.cached ?? false,
    });

    return result;
  };

  return { fetcher: wrappedFetcher, getMeta: () => meta };
}
