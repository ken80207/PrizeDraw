import { test, expect } from '@playwright/test';

test.describe('Campaigns page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/campaigns');
  });

  test('renders campaigns page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Campaign Gallery' })).toBeVisible();
  });

  test('shows page description text', async ({ page }) => {
    await expect(page.getByText('瀏覽所有進行中的一番賞與無限賞活動')).toBeVisible();
  });

  test('tab bar is visible with correct tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: '一番賞' })).toBeVisible();
    await expect(page.getByRole('button', { name: '無限賞' })).toBeVisible();
    await expect(page.getByRole('button', { name: '全部' })).toBeVisible();
  });

  test('ichiban tab is active by default', async ({ page }) => {
    const ichibanBtn = page.getByRole('button', { name: '一番賞' });
    await expect(ichibanBtn).toHaveClass(/from-primary/);
    await expect(ichibanBtn).toHaveClass(/to-primary-container/);
  });

  test('switching to unlimited tab updates URL', async ({ page }) => {
    await page.getByRole('button', { name: '無限賞' }).click();
    await expect(page).toHaveURL(/type=unlimited/);
  });

  test('switching to all tab updates URL', async ({ page }) => {
    await page.getByRole('button', { name: '全部' }).click();
    await expect(page).toHaveURL(/type=all/);
  });

  test('switching back to ichiban tab updates URL', async ({ page }) => {
    // First go to unlimited, then back to ichiban
    await page.getByRole('button', { name: '無限賞' }).click();
    await expect(page).toHaveURL(/type=unlimited/);
    await page.getByRole('button', { name: '一番賞' }).click();
    await expect(page).toHaveURL(/type=ichiban/);
  });

  test('search input is present with correct placeholder', async ({ page }) => {
    await expect(page.getByPlaceholder('搜尋活動...')).toBeVisible();
  });

  test('sort select is present', async ({ page }) => {
    // The sort control is a native <select> element, not a role="combobox"
    const select = page.locator('select');
    await expect(select).toBeVisible();
  });

  test('sort options include correct values', async ({ page }) => {
    await expect(page.getByRole('option', { name: '最新' })).toBeAttached();
    await expect(page.getByRole('option', { name: '最熱門' })).toBeAttached();
    await expect(page.getByRole('option', { name: '價格低到高' })).toBeAttached();
    await expect(page.getByRole('option', { name: '價格高到低' })).toBeAttached();
  });

  test('content area renders (cards or empty state)', async ({ page }) => {
    // Wait for loading skeletons to resolve
    await page.waitForTimeout(2000);
    const emptyState = page.getByText('找不到符合條件的活動');
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    // Content rendered in some form — either empty state or campaign cards
    const hasContent =
      hasEmpty || (await page.locator('a[href^="/campaigns/"]').count()) > 0;
    expect(hasContent).toBeTruthy();
  });

  test('navigating to unlimited tab via URL param activates the unlimited button', async ({
    page,
  }) => {
    await page.goto('/campaigns?type=unlimited');
    const unlimitedBtn = page.getByRole('button', { name: '無限賞' });
    await expect(unlimitedBtn).toHaveClass(/from-primary/);
    await expect(unlimitedBtn).toHaveClass(/to-primary-container/);
  });

  test('navigating to all tab via URL param activates the all button', async ({ page }) => {
    await page.goto('/campaigns?type=all');
    const allBtn = page.getByRole('button', { name: '全部' });
    await expect(allBtn).toHaveClass(/from-primary/);
    await expect(allBtn).toHaveClass(/to-primary-container/);
  });

  test('inactive tabs do not carry the active gradient class', async ({ page }) => {
    // By default ichiban is active; unlimited and all should NOT have the gradient
    const unlimitedBtn = page.getByRole('button', { name: '無限賞' });
    const allBtn = page.getByRole('button', { name: '全部' });
    await expect(unlimitedBtn).not.toHaveClass(/from-primary/);
    await expect(allBtn).not.toHaveClass(/from-primary/);
  });
});
