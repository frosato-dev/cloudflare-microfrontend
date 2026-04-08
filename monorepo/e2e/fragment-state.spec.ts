import { test, expect } from '@playwright/test';

test('header cart count persists across SPA navigation', async ({ page }) => {
  await page.goto('/product/iphone-15');

  // Wait for header fragment to hydrate
  const cartBtn = page.locator('.cart-btn');
  await expect(cartBtn).toHaveText('Cart (0)');

  // Add item to cart
  await page.locator('.add-btn').click();
  await expect(cartBtn).toHaveText('Cart (1)');

  // SPA-navigate to home via header nav
  await page.locator('header nav a', { hasText: 'Home' }).click();
  await expect(page).toHaveURL('/');

  // Cart count should be preserved (fragment not re-hydrated)
  await expect(cartBtn).toHaveText('Cart (1)');
});

test('footer link updates product card with new price', async ({ page }) => {
  await page.goto('/product/iphone-15');
  await expect(page.locator('.product-card')).toBeVisible();
  await expect(page.locator('.product-card .price')).toHaveText('From $699');

  await page.locator('footer a[href="/product/macbook-pro"]').click();
  await expect(page).toHaveURL('/product/macbook-pro');
  await expect(page.locator('.product-card')).toBeVisible();
  await expect(page.locator('.product-card .price')).toHaveText('From $499');
});

test('SPA navigation from home to product shows correct product card (x2)', async ({ page }) => {
  await page.goto('/');

  await page.locator('header nav a', { hasText: 'Products' }).click();
  await expect(page).toHaveURL('/product/iphone-15');
  await expect(page.locator('.product-card')).toBeVisible();
  await expect(page.locator('.product-card .price')).toHaveText('From $699');

  await page.locator('header nav a', { hasText: 'Home' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.home h1')).toBeVisible();

  await page.locator('header nav a', { hasText: 'Products' }).click();
  await expect(page).toHaveURL('/product/iphone-15');
  await expect(page.locator('.product-card')).toBeVisible();
  await expect(page.locator('.product-card .price')).toHaveText('From $699');
});
