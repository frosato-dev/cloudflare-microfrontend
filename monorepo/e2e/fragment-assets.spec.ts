import { test, expect } from '@playwright/test';

test.describe('Fragment-owned assets', () => {
  test('fragment scripts served by owning fragment under /_fragments/<id>/', async ({ page, request }) => {
    await page.goto('/');
    const srcs = await page.locator('script[type="module"][src^="/_fragments/"]').evaluateAll(
      (els) => els.map((el) => el.getAttribute('src')!),
    );
    expect(srcs.some((s) => s.startsWith('/_fragments/header/'))).toBe(true);
    expect(srcs.some((s) => s.startsWith('/_fragments/footer/'))).toBe(true);

    for (const src of srcs) {
      const res = await request.get(src);
      expect(res.status()).toBe(200);
      expect(res.headers()['cache-control']).toContain('immutable');
    }
  });

  test('unknown fragment asset → 404', async ({ request }) => {
    expect((await request.get('/_fragments/nope/x.js')).status()).toBe(404);
    expect((await request.get('/_fragments/header/nope.js')).status()).toBe(404);
  });

  test('fragment HTML carries its own stylesheet and version', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('[data-fragment="header"]');
    await expect(header.locator(':scope > link[rel="stylesheet"][href^="/_fragments/header/"]')).toHaveCount(1);
    await expect(header).toHaveAttribute('data-fragment-version', /^header@[0-9a-f]{8}$/);
  });

  test('head preloads fragment assets once the shell has seen them', async ({ request }) => {
    // Unique query strings → bypass page cache
    await request.get('/?warm=1');
    const html = await (await request.get('/?warm=2')).text();
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toMatch(/<link rel="modulepreload" href="\/_fragments\/header\/[^"]+\.js">/);
    expect(head).toMatch(/<link rel="preload" as="style" href="\/_fragments\/header\/[^"]+\.css">/);
  });
});

test.describe('Version skew', () => {
  async function hydratedHome(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.waitForFunction(() => (globalThis as any).__fragmentRegistry?.header?.version);
    await page.evaluate(() => ((window as any).__sameDocument = true));
  }

  test('SPA nav keeps the document when versions are unchanged', async ({ page }) => {
    await hydratedHome(page);
    await page.locator('header nav a', { hasText: 'Products' }).click();
    await expect(page.locator('.product-card')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__sameDocument)).toBe(true);
  });

  test('SPA nav does a full load when a live fragment was redeployed', async ({ page }) => {
    await hydratedHome(page);

    // Simulate a header deploy between page load and navigation
    await page.route('**/product/iphone-15', async (route) => {
      if (route.request().headers()['x-navigate'] !== '1') return route.continue();
      const res = await route.fetch();
      const body = (await res.text()).replace(/data-fragment-version="header@[^"]+"/, 'data-fragment-version="header@deadbeef"');
      return route.fulfill({ response: res, body });
    });

    await page.locator('header nav a', { hasText: 'Products' }).click();
    await expect(page).toHaveURL('/product/iphone-15');
    await expect.poll(() => page.evaluate(() => (window as any).__sameDocument)).toBeUndefined();
    await expect(page.locator('.product-card')).toBeVisible();
  });
});
