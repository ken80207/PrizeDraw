import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the page without crashing', async ({ page }) => {
    await expect(page).toHaveTitle(/PrizeDraw/i);
  });

  test('hero section is visible', async ({ page }) => {
    // Main heading in the hero
    await expect(page.getByRole('heading', { name: 'PrizeDraw' })).toBeVisible();
    // Hero CTA buttons
    await expect(page.getByRole('link', { name: /立即抽獎/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /無限賞體驗/ })).toBeVisible();
  });

  test('hero subtext is present', async ({ page }) => {
    await expect(page.getByText('台灣最好玩的線上一番賞平台')).toBeVisible();
  });

  test('hot campaigns section heading is visible', async ({ page }) => {
    await expect(page.getByText('🔥 熱門活動')).toBeVisible();
  });

  test('view-all campaigns link is present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /查看全部/ })).toBeVisible();
  });

  test('how-to-play section is visible', async ({ page }) => {
    await expect(page.getByText('玩法說明')).toBeVisible();
    await expect(page.getByText('一番賞')).toBeVisible();
    await expect(page.getByText('無限賞')).toBeVisible();
  });

  test('feature highlights section is visible', async ({ page }) => {
    await expect(page.getByText('為什麼選擇 PrizeDraw？')).toBeVisible();
    await expect(page.getByRole('link', { name: /交易市集/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /賞品交換/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /實體寄送/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /收益提領/ })).toBeVisible();
  });

  test('campaign cards or empty state render after loading', async ({ page }) => {
    // Wait for loading skeleton to disappear or empty state to appear
    await page.waitForTimeout(2000);
    const hasCards = await page.locator('[class*="CampaignCard"]').count() > 0;
    const hasEmpty = await page.getByText('目前沒有進行中的活動').isVisible().catch(() => false);
    // Either campaign cards loaded or the empty state is shown
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test('navbar logo links to home', async ({ page }) => {
    const logoLink = page.getByRole('link', { name: /PrizeDraw/ }).first();
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute('href', '/');
  });
});
