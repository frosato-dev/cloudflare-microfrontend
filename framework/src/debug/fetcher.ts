import type { FragmentFetcher, FragmentResponse } from '../types.js';

export interface FragmentMeta {
  id: string;
  fetchStart: number;
  fetchEnd: number;
  cached: boolean;
}

export interface DebugMeta {
  fetcher: FragmentFetcher;
  getMeta: () => Map<string, FragmentMeta>;
  setShellEnd: (ms: number) => void;
  setTotalEnd: (ms: number) => void;
}

export function wrapFetcherWithDebug(
  fetcher: FragmentFetcher,
  requestStart: number,
): DebugMeta {
  const meta = new Map<string, FragmentMeta>();

  meta.set('__shell', { id: '__shell', fetchStart: 0, fetchEnd: 0, cached: false });

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

  return {
    fetcher: wrappedFetcher,
    getMeta: () => meta,
    setShellEnd: (ms) => meta.set('__shell', { id: '__shell', fetchStart: 0, fetchEnd: ms - requestStart, cached: false }),
    setTotalEnd: (ms) => meta.set('__total', { id: '__total', fetchStart: 0, fetchEnd: ms - requestStart, cached: false }),
  };
}
