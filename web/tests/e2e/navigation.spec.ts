import { test, expect } from '@playwright/test';

test.describe('Navbar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('navbar is visible', async ({ page }) => {
    await expect(page.getByRole('banner')).toBeVisible();
  });

  test('logo link is present and href is /', async ({ page }) => {
    const logoLink = page.getByRole('link', { name: /PrizeDraw/ }).first();
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute('href', '/');
  });

  test('campaigns nav link navigates correctly', async ({ page }) => {
    await page.getByRole('link', { name: '活動' }).first().click();
    await expect(page).toHaveURL(/\/campaigns/);
    await expect(page.getByRole('heading', { name: '活動列表' })).toBeVisible();
  });

  test('market nav link navigates correctly', async ({ page }) => {
    await page.getByRole('link', { name: '市集' }).first().click();
    await expect(page).toHaveURL(/\/trade/);
  });

  test('leaderboard nav link navigates correctly', async ({ page }) => {
    await page.getByRole('link', { name: '排行榜' }).first().click();
    await expect(page).toHaveURL(/\/leaderboard/);
  });
});

test.describe('Footer navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('footer is visible', async ({ page }) => {
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('footer logo is visible', async ({ page }) => {
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByText('PrizeDraw')).toBeVisible();
  });

  test('footer about link is present', async ({ page }) => {
    await expect(page.getByRole('link', { name: '關於我們' })).toBeVisible();
  });

  test('footer terms link is present', async ({ page }) => {
    await expect(page.getByRole('link', { name: '服務條款' })).toBeVisible();
  });

  test('footer support link is present', async ({ page }) => {
    await expect(page.getByRole('link', { name: '聯絡客服' })).toBeVisible();
  });

  test('footer support link navigates to /support', async ({ page }) => {
    await page.getByRole('link', { name: '聯絡客服' }).click();
    await expect(page).toHaveURL(/\/support/);
  });

  test('footer copyright text is present', async ({ page }) => {
    await expect(page.getByText(/© 2026 PrizeDraw/)).toBeVisible();
  });
});

test.describe('No 404s on key routes', () => {
  const routes = [
    '/',
    '/campaigns',
    '/trade',
    '/leaderboard',
    '/support',
    '/support/new',
    '/(auth)/login',
  ];

  for (const route of routes) {
    test(`route ${route} does not return a 404 page`, async ({ page }) => {
      const response = await page.goto(route);
      // Accept 200 (OK) or 3xx (redirect) — but not 404
      if (response) {
        expect(response.status()).not.toBe(404);
      }
      // Also make sure the page body doesn't contain a plain 404 message
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toMatch(/^404$/m);
    });
  }
});

test.describe('Hero CTA navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('立即抽獎 button navigates to campaigns', async ({ page }) => {
    await page.getByRole('link', { name: /立即抽獎/ }).click();
    await expect(page).toHaveURL(/\/campaigns/);
  });

  test('無限賞體驗 button navigates to campaigns with type=unlimited', async ({ page }) => {
    await page.getByRole('link', { name: /無限賞體驗/ }).click();
    await expect(page).toHaveURL(/\/campaigns\?type=unlimited/);
  });
});
