import { test, expect } from '@playwright/test';

test('Web Vitals beacon with fragment attribution', async ({ page }) => {
  const beacons: any[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/__rum') && r.method() === 'POST') beacons.push(JSON.parse(r.postData()!));
  });
  await page.goto('/product/iphone-15');

  // RUM loads after `load` and web-vitals reports asynchronously → toggle hidden/visible until all metrics arrived
  const metric = (name: string) => beacons.flatMap((b) => b.metrics).find((m) => m.name === name);
  await expect.poll(async () => {
    await page.evaluate(() => {
      const set = (v: string) => Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
      set('hidden');
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true })); // real event bubbles to window
      set('visible');
    });
    return ['TTFB', 'FCP', 'LCP', 'CLS'].filter((n) => !metric(n));
  }, { timeout: 15_000 }).toEqual([]);

  expect(beacons[0].path).toBe('/product/iphone-15');
  expect(beacons[0].versions.product).toMatch(/^product@[0-9a-f]{8}$/);
  // LCP element attributed to the fragment that rendered it (INP only appears for slow-enough interactions)
  expect(['header', 'product', 'footer']).toContain(metric('LCP').fragment);
});
