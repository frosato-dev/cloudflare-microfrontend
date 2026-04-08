import { test, expect } from '@playwright/test';

test.describe('Product page', () => {
  test('header and footer visible', async ({ page }) => {
    await page.goto('/product/iphone-15');
    await expect(page.locator('header.header')).toBeVisible();
    await expect(page.locator('footer.footer')).toBeVisible();
  });

  test('product heading', async ({ page }) => {
    await page.goto('/product/iphone-15');
    await expect(page.locator('.product-page h2')).toContainText('Product: iphone-15');
  });

  test('product card details', async ({ page }) => {
    await page.goto('/product/iphone-15');
    const card = page.locator('.product-card');
    await expect(card).toBeVisible();
    await expect(card.locator('h3')).toBeVisible();
    await expect(card.locator('.price')).toContainText('$699');
    await expect(card).toContainText('Excellent condition');
    await expect(card.locator('.add-btn')).toBeVisible();
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text());
    });
    await page.goto('/product/iphone-15');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('unknown product shows default price', async ({ page }) => {
    await page.goto('/product/unknown-device');
    await expect(page.locator('.product-card .price')).toContainText('$499');
  });
});
