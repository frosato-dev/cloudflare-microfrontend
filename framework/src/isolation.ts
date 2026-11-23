import type { FragmentFetcher, FragmentResponse } from './types.js';

export const DEFAULT_FRAGMENT_TIMEOUT = 1000;

/**
 * Time-box + catch every fragment fetch. A slow or broken fragment degrades to an empty slot
 * (`error` set) — it never stalls or breaks the page owned by other teams.
 */
export function isolateFetcher(fetcher: FragmentFetcher, timeoutMs = DEFAULT_FRAGMENT_TIMEOUT): FragmentFetcher {
  return async (fragmentId, request, routeProps) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<FragmentResponse>((resolve) => {
      timer = setTimeout(() => resolve({ html: '', error: `timeout after ${timeoutMs}ms` }), timeoutMs);
    });
    const attempt = fetcher(fragmentId, request, routeProps).catch(
      (err): FragmentResponse => ({ html: '', error: String(err?.message ?? err) }),
    );
    try {
      return await Promise.race([attempt, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };
}
