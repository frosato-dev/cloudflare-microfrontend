import { test, expect } from '@playwright/test';

test.describe('Cross-fragment pub-sub', () => {
  test('add to cart increments header cart count', async ({ page }) => {
    await page.goto('/product/iphone-15');
    await page.waitForLoadState('networkidle');
    await page.locator('.add-btn').click();
    await expect(page.locator('.cart-btn')).toContainText('Cart (1)');
  });

  test('multiple add-to-cart increments correctly', async ({ page }) => {
    await page.goto('/product/iphone-15');
    await page.waitForLoadState('networkidle');
    await page.locator('.add-btn').click();
    await expect(page.locator('.cart-btn')).toContainText('Cart (1)');
    await page.locator('.add-btn').click();
    await expect(page.locator('.cart-btn')).toContainText('Cart (2)');
  });
});

test.describe('SSR without JS', () => {
  test('content rendered server-side', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('header.header')).toBeVisible();
    await expect(page.locator('.home h1')).toBeVisible();
    await expect(page.locator('footer.footer')).toBeVisible();
    await context.close();
  });
});

test.describe('Hydration', () => {
  test('no hydration mismatch warnings', async ({ page }) => {
    const mismatches: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().toLowerCase().includes('mismatch')) mismatches.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(mismatches).toEqual([]);
  });
});

test.describe('Cache headers', () => {
  test('home page has cache-control', async ({ request }) => {
    const res = await request.get('/');
    const cc = res.headers()['cache-control'] ?? '';
    expect(cc).toContain('public');
    expect(cc).toContain('stale-while-revalidate=60');
  });

  test('product page has cache-control', async ({ request }) => {
    const res = await request.get('/product/iphone-15');
    const cc = res.headers()['cache-control'] ?? '';
    expect(cc).toContain('public');
    expect(cc).toContain('stale-while-revalidate=30');
  });
});

test.describe('Error handling', () => {
  test('unknown route returns 404', async ({ request }) => {
    const res = await request.get('/this-route-does-not-exist', {
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(404);
  });
});
