import type { FragmentFetcher } from '../types.js';

/**
 * Debug-only fault injection, to see how the page degrades:
 *   cookie __debug_fault=header:timeout,footer:error
 * `timeout` never resolves (isolation timeout kicks in), `error` throws.
 */
export function withFaults(fetcher: FragmentFetcher, request: Request): FragmentFetcher {
  const cookie = request.headers.get('cookie') ?? '';
  const raw = /(?:^|;\s*)__debug_fault=([^;]*)/.exec(cookie)?.[1];
  if (!raw) return fetcher;
  const faults = new Map(decodeURIComponent(raw).split(',').map((f) => f.split(':') as [string, string]));
  return (fragmentId, req, routeProps) => {
    const fault = faults.get(fragmentId);
    if (fault === 'timeout') return new Promise(() => {});
    if (fault === 'error') return Promise.reject(new Error('injected fault'));
    return fetcher(fragmentId, req, routeProps);
  };
}
