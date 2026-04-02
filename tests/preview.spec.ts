import { test, expect } from '@playwright/test';

test('back-office on :8787 renders with fragment-header', async ({ page }) => {
  await page.goto('http://localhost:8787/');
  await expect(page.locator('h1')).toHaveText('Back Office');
  await expect(page.locator('[data-fragment="header"]')).toBeVisible();
});

test('front-office on :8788 renders with fragment-header', async ({ page }) => {
  await page.goto('http://localhost:8788/');
  await expect(page.locator('h1')).toHaveText('Back Market');
  await expect(page.locator('[data-fragment="header"]')).toBeVisible();
});
