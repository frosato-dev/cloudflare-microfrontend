import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals/attribution';
import type { MetricWithAttribution } from 'web-vitals/attribution';

/** Fragment owning a DOM node (closest [data-fragment]) → per-team attribution of LCP / INP / CLS */
function fragmentOf(node: Node | null | undefined): string | undefined {
  const el = node instanceof Element ? node : node?.parentElement;
  return el?.closest('[data-fragment]')?.getAttribute('data-fragment') ?? undefined;
}

function culprit(metric: MetricWithAttribution): Node | null | undefined {
  const a: any = metric.attribution;
  if (metric.name === 'LCP') return a.lcpEntry?.element;
  if (metric.name === 'INP') return a.interactionTargetElement;
  if (metric.name === 'CLS') return a.largestShiftSource?.node;
}

/** Collect Core Web Vitals, send them once when the page is hidden (sendBeacon survives unload) */
export function startRum(endpoint = '/__rum') {
  const queue: object[] = [];
  const push = (metric: MetricWithAttribution) => {
    queue.push({
      name: metric.name,
      value: metric.name === 'CLS' ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value),
      rating: metric.rating,
      fragment: fragmentOf(culprit(metric)),
    });
  };
  onLCP(push);
  onINP(push);
  onCLS(push);
  onFCP(push);
  onTTFB(push);

  const flush = () => {
    if (!queue.length) return;
    const versions: Record<string, string> = {};
    document.querySelectorAll<HTMLElement>('[data-fragment][data-fragment-version]').forEach((el) => {
      versions[el.dataset.fragment!] = el.dataset.fragmentVersion!;
    });
    navigator.sendBeacon(endpoint, JSON.stringify({ path: location.pathname, versions, metrics: queue.splice(0) }));
  };
  // On window (bubble) → runs after web-vitals' own document listener has reported final LCP/CLS/INP
  addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  addEventListener('pagehide', flush);
}
