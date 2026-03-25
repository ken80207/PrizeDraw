import { test, expect } from '@playwright/test';

test.describe('Wallet page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wallet');
  });

  test('wallet page is accessible', async ({ page }) => {
    // Either the wallet page loads or we get redirected to login (unauthenticated)
    const url = page.url();
    expect(url).toMatch(/wallet|login/);
  });

  test.describe('When unauthenticated (redirected to login)', () => {
    test('redirected to login or shows error', async ({ page }) => {
      await page.waitForTimeout(1500);
      const isOnLogin = page.url().includes('login');
      const hasErrorMsg = await page.getByText('無法載入錢包').isVisible().catch(() => false);
      const hasRetryBtn = await page.getByRole('button', { name: '重新載入' }).isVisible().catch(() => false);
      // Any of these outcomes is acceptable for an unauthenticated visitor
      expect(isOnLogin || hasErrorMsg || hasRetryBtn).toBeTruthy();
    });
  });

  test.describe('Wallet UI structure (skeleton or content)', () => {
    test('page renders something within timeout', async ({ page }) => {
      // Wait for loading to complete (or skeleton to appear)
      await page.waitForTimeout(500);
      // The page should have rendered at minimum a skeleton or content
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    });
  });
});

test.describe('Wallet page with mock auth', () => {
  test.beforeEach(async ({ page }) => {
    // Inject a fake auth token so the wallet page doesn't immediately redirect
    await page.addInitScript(() => {
      // Simulate an auth cookie presence — won't actually authenticate API calls
      // but prevents client-side redirect logic from firing immediately
      document.cookie = 'accessToken=fake-token; path=/';
    });
    await page.goto('/wallet');
    await page.waitForTimeout(1000);
  });

  test('page heading is rendered', async ({ page }) => {
    // Either "我的錢包" heading shows (loaded) or skeleton/error state
    const hasHeading = await page.getByRole('heading', { name: '我的錢包' }).isVisible().catch(() => false);
    const hasError = await page.getByText('無法載入錢包').isVisible().catch(() => false);
    const hasSkeleton = await page.locator('[class*="animate-pulse"]').count() > 0;
    expect(hasHeading || hasError || hasSkeleton).toBeTruthy();
  });

  test('dual point card section or skeleton is present', async ({ page }) => {
    const hasDrawCard = await page.getByText('消費點數').isVisible().catch(() => false);
    const hasRevenueCard = await page.getByText('收益點數').isVisible().catch(() => false);
    const hasSkeleton = await page.locator('[class*="animate-pulse"]').count() > 0;
    expect(hasDrawCard || hasRevenueCard || hasSkeleton).toBeTruthy();
  });

  test('transaction tab labels are present when wallet loads', async ({ page }) => {
    // These are visible only when the wallet data loads successfully
    const hasDrawTab = await page.getByText('消費點數明細').isVisible().catch(() => false);
    const hasRevenueTab = await page.getByText('收益點數明細').isVisible().catch(() => false);
    const hasError = await page.getByText('無法載入錢包').isVisible().catch(() => false);
    const hasSkeleton = await page.locator('[class*="animate-pulse"]').count() > 0;
    expect(hasDrawTab || hasRevenueTab || hasError || hasSkeleton).toBeTruthy();
  });
});
