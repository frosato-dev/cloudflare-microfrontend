import type { FragmentMeta } from './debug/fetcher.js';
import { matchRoute } from './router.js';
import type { RouteEntry } from './types.js';

/**
 * Structured logs (one JSON line per event) → queryable per fragment/team in Workers Logs
 * (wrangler `observability.enabled`). `route` is the route pattern (low cardinality), never the raw URL.
 *
 * Note: in Workers, Date.now() only advances on I/O — fragment fetch durations are accurate,
 * pure CPU time (shell SSR) is not (see Workers CPU time metrics).
 */
export function logRequestMetrics(route: string, meta: Map<string, FragmentMeta>) {
  for (const [id, m] of meta) {
    if (id.startsWith('__')) continue;
    console.log(JSON.stringify({
      type: 'fragment',
      fragment: id,
      route,
      ms: m.fetchEnd - m.fetchStart,
      cached: m.cached,
      outcome: !m.error ? 'ok' : m.error.startsWith('timeout') ? 'timeout' : 'error',
      error: m.error,
      version: m.version,
    }));
  }
  console.log(JSON.stringify({
    type: 'page',
    route,
    totalMs: meta.get('__total')?.fetchEnd ?? 0,
    fragments: [...meta.keys()].filter((k) => !k.startsWith('__')).length,
  }));
}

const RUM_METRICS = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

/** POST /__rum — Web Vitals beacon from the browser (see hydration/rum.ts) → one log line per metric */
export async function handleRumRequest(request: Request, routes: RouteEntry[]): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const body = await request.text();
  if (body.length > 16_384) return new Response('Payload Too Large', { status: 413 });
  let payload: { path?: string; versions?: Record<string, string>; metrics?: any[] };
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  const route = matchRoute(routes, String(payload.path ?? ''))?.routePath ?? 'unmatched';
  for (const m of payload.metrics ?? []) {
    if (!RUM_METRICS.has(m?.name) || typeof m.value !== 'number') continue;
    const fragment = typeof m.fragment === 'string' ? m.fragment : undefined;
    console.log(JSON.stringify({
      type: 'rum',
      route,
      metric: m.name,
      value: m.value,
      rating: m.rating,
      fragment,
      version: fragment ? payload.versions?.[fragment] : undefined,
    }));
  }
  return new Response(null, { status: 204 });
}
