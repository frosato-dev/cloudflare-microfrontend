import { test, expect } from '@playwright/test';

test.describe('SPA navigation', () => {
  test('CTA navigates to product page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('.home a[href="/product/iphone-15"]').click();
    await expect(page).toHaveURL('/product/iphone-15');
    await expect(page.locator('.product-card')).toBeVisible();
  });

  test('no console errors during navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text());
    });
    await page.goto('/');
    await page.locator('.home a[href="/product/iphone-15"]').click();
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('header nav Products link works', async ({ page }) => {
    await page.goto('/');
    await page.locator('header.header nav a:has-text("Products")').click();
    await expect(page).toHaveURL(/\/product\//);
  });

  test('header nav Home link works', async ({ page }) => {
    await page.goto('/product/iphone-15');
    await page.locator('header.header nav a:has-text("Home")').click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('.home h1')).toBeVisible();
  });

  test('footer product links navigate', async ({ page }) => {
    await page.goto('/');
    const footerLink = page.locator('footer.footer a[href*="/product/"]').first();
    const href = await footerLink.getAttribute('href');
    await footerLink.click();
    await expect(page).toHaveURL(href!);
  });
});
