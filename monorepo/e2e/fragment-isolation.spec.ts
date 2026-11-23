import { test, expect } from '@playwright/test';

// Faults are injected server-side via the debug-only cookie __debug_fault=<fragment>:<timeout|error>
const faultCookie = (fault: string) => ({ cookie: `__debug=1; __debug_fault=${fault}` });

test.describe('Fragment isolation', () => {
  test('failing fragment → empty slot, rest of the page renders and the stream completes', async ({ request }) => {
    const res = await request.get('/', { headers: faultCookie('footer:error') });
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-fragment="footer"');
    expect(html).toContain('data-fragment-error="injected fault"');
    expect(html).toContain('<header class="header"');
    expect(html.trimEnd()).toMatch(/<\/html>$/);
  });

  test('timed-out fragment does not stall the page and renders client-side', async ({ page, request, baseURL }) => {
    // Shell learns the header's assets from normal requests → used for the client-side fallback
    for (let i = 0; i < 3; i++) await request.get(`/?warm=isolation-${i}`);

    await page.context().addCookies([
      { name: '__debug', value: '1', url: baseURL! },
      { name: '__debug_fault', value: 'header:timeout', url: baseURL! },
    ]);
    const start = Date.now();
    await page.goto('/');
    expect(Date.now() - start).toBeLessThan(5_000); // default fragment timeout = 1s

    const header = page.locator('[data-fragment="header"]');
    await expect(header).toHaveAttribute('data-fragment-error', /timeout/);
    await expect(page.locator('footer.footer')).toBeVisible();
    await expect(page.locator('.cart-btn')).toHaveText('Cart (0)'); // client-side rendered
  });

});
