import { test, expect } from '@playwright/test';

test.describe('Campaigns page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/campaigns');
  });

  test('renders campaigns page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '活動列表' })).toBeVisible();
  });

  test('shows page description text', async ({ page }) => {
    await expect(page.getByText('瀏覽所有開放中的一番賞及無限賞活動')).toBeVisible();
  });

  test('tab bar is visible with correct tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: '一番賞' })).toBeVisible();
    await expect(page.getByRole('button', { name: '無限賞' })).toBeVisible();
    await expect(page.getByRole('button', { name: '全部' })).toBeVisible();
  });

  test('ichiban tab is active by default', async ({ page }) => {
    // The default tab from page code is "ichiban"
    const ichibanBtn = page.getByRole('button', { name: '一番賞' });
    await expect(ichibanBtn).toHaveClass(/shadow|bg-white/);
  });

  test('switching to unlimited tab updates URL', async ({ page }) => {
    await page.getByRole('button', { name: '無限賞' }).click();
    await expect(page).toHaveURL(/type=unlimited/);
  });

  test('switching to all tab updates URL', async ({ page }) => {
    await page.getByRole('button', { name: '全部' }).click();
    await expect(page).toHaveURL(/type=all/);
  });

  test('search input is present', async ({ page }) => {
    await expect(page.getByPlaceholder('搜尋活動名稱...')).toBeVisible();
  });

  test('sort dropdown is present', async ({ page }) => {
    const select = page.getByRole('combobox');
    await expect(select).toBeVisible();
  });

  test('sort options include correct values', async ({ page }) => {
    await expect(page.getByRole('option', { name: '最新' })).toBeAttached();
    await expect(page.getByRole('option', { name: '最熱門' })).toBeAttached();
    await expect(page.getByRole('option', { name: '價格低到高' })).toBeAttached();
    await expect(page.getByRole('option', { name: '價格高到低' })).toBeAttached();
  });

  test('content area renders (cards or empty state)', async ({ page }) => {
    // Wait for loading to finish
    await page.waitForTimeout(2000);
    const emptyState = page.getByText('沒有符合條件的活動');
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    // Content rendered in some form — either empty state or campaign cards
    const hasContent = hasEmpty || (await page.locator('a[href^="/campaigns/"]').count()) > 0;
    expect(hasContent).toBeTruthy();
  });

  test('navigating to unlimited tab from URL param works', async ({ page }) => {
    await page.goto('/campaigns?type=unlimited');
    const unlimitedBtn = page.getByRole('button', { name: '無限賞' });
    await expect(unlimitedBtn).toHaveClass(/shadow|bg-white/);
  });
});
