import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('header visible', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header.header');
    await expect(header).toBeVisible();
    await expect(header.locator('.logo')).toBeVisible();
    await expect(header.locator('nav')).toBeVisible();
    await expect(header.locator('.cart-btn')).toBeVisible();
  });

  test('body visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home h1')).toHaveText('Back Market');
    const cta = page.locator('.home a[href="/product/iphone-15"]');
    await expect(cta).toBeVisible();
  });

  test('footer visible', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer.footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('.logo')).toBeVisible();
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('CSS loaded correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const app = page.locator('#app');
    await expect(app).toHaveCSS('display', 'flex');
    await expect(app).toHaveCSS('flex-direction', 'column');

    const header = page.locator('header.header');
    await expect(header).toHaveCSS('background-color', 'rgb(26, 26, 46)');

    const cta = page.locator('.home a[href="/product/iphone-15"]');
    await expect(cta).toHaveCSS('background-color', 'rgb(0, 200, 83)');
  });
});
