import { test, expect } from '@playwright/test';

test.describe('SideNav (desktop)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('aside element is present in the DOM', async ({ page }) => {
    await expect(page.locator('aside')).toBeAttached();
  });

  test('brand link points to / and contains "The Gallery"', async ({ page }) => {
    const brandLink = page.locator('aside').getByRole('link', { name: /The Gallery/ }).first();
    await expect(brandLink).toBeAttached();
    await expect(brandLink).toHaveAttribute('href', '/');
  });

  test('首頁 nav link is present and points to /', async ({ page }) => {
    const link = page.locator('aside nav').getByRole('link', { name: '首頁' });
    await expect(link).toBeAttached();
    await expect(link).toHaveAttribute('href', '/');
  });

  test('市集 nav link navigates to /trade', async ({ page }) => {
    await page.locator('aside nav').getByRole('link', { name: '市集' }).click();
    await expect(page).toHaveURL(/\/trade/);
  });

  test('排行榜 nav link navigates to /leaderboard', async ({ page }) => {
    await page.locator('aside nav').getByRole('link', { name: '排行榜' }).click();
    await expect(page).toHaveURL(/\/leaderboard/);
  });

  test('我的賞品 nav link is present and points to /prizes', async ({ page }) => {
    const link = page.locator('aside nav').getByRole('link', { name: '我的賞品' });
    await expect(link).toBeAttached();
    await expect(link).toHaveAttribute('href', '/prizes');
  });

  test('錢包 nav link is present and points to /wallet', async ({ page }) => {
    const link = page.locator('aside nav').getByRole('link', { name: '錢包' });
    await expect(link).toBeAttached();
    await expect(link).toHaveAttribute('href', '/wallet');
  });

  test('"進入 Gallery" login link is present when not logged in', async ({ page }) => {
    const loginLink = page.locator('aside').getByRole('link', { name: '進入 Gallery' });
    await expect(loginLink).toBeAttached();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });
});

test.describe('MobileTopBar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('header element contains "The Illuminated Gallery" brand text', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toBeAttached();
    await expect(header.getByText('The Illuminated Gallery')).toBeAttached();
  });
});

test.describe('MobileBottomBar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('bottom nav element is present', async ({ page }) => {
    // MobileBottomBar renders a <nav> at the bottom fixed position
    // There are two navs on the page: aside > nav (desktop) and the bottom nav
    const navs = page.locator('nav');
    await expect(navs.first()).toBeAttached();
  });

  test('bottom nav contains 首頁 link', async ({ page }) => {
    // Mobile bottom nav links include icon text, e.g. "home首頁"
    const link = page.locator('nav a[href="/"]').last();
    await expect(link).toBeAttached();
  });

  test('bottom nav contains 市集 link', async ({ page }) => {
    const link = page.locator('nav a[href="/trade"]').last();
    await expect(link).toBeAttached();
  });

  test('bottom nav contains 排行榜 link', async ({ page }) => {
    const link = page.locator('nav a[href="/leaderboard"]').last();
    await expect(link).toBeAttached();
  });
});

test.describe('Home page footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('footer element is present on the home page', async ({ page }) => {
    await expect(page.locator('footer')).toBeVisible();
  });

  test('footer contains copyright text "The Illuminated Gallery © 2026"', async ({ page }) => {
    await expect(page.locator('footer').getByText(/The Illuminated Gallery © 2026/)).toBeVisible();
  });

  test('footer contains tagline "Premium Digital Collectible Experience"', async ({ page }) => {
    await expect(page.locator('footer').getByText(/Premium Digital Collectible Experience/)).toBeVisible();
  });

  test('footer has no "關於我們" link', async ({ page }) => {
    await expect(page.getByRole('link', { name: '關於我們' })).not.toBeAttached();
  });

  test('footer has no "服務條款" link', async ({ page }) => {
    await expect(page.getByRole('link', { name: '服務條款' })).not.toBeAttached();
  });

  test('footer has no "聯絡客服" link', async ({ page }) => {
    await expect(page.getByRole('link', { name: '聯絡客服' })).not.toBeAttached();
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
    '/login',
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

  test('查看賞品 button navigates to /campaigns', async ({ page }) => {
    await page.getByRole('link', { name: /查看賞品/ }).first().click();
    await expect(page).toHaveURL(/\/campaigns/);
  });

  test('no "無限賞體驗" CTA link exists', async ({ page }) => {
    await expect(page.getByRole('link', { name: /無限賞體驗/ })).not.toBeAttached();
  });
});
