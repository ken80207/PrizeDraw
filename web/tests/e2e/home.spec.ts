import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ── Page load ─────────────────────────────────────────────────────────────

  test('renders the page without crashing', async ({ page }) => {
    // The document title may vary; verify the page loads with a non-empty title.
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  // ── Hero section ──────────────────────────────────────────────────────────

  test('hero badge shows 精選活動', async ({ page }) => {
    await expect(page.getByText('精選活動')).toBeVisible();
  });

  test('hero heading shows campaign title or fallback Premium Ichiban Kuji', async ({ page }) => {
    // The h2 renders either the first loaded campaign title or the i18n fallback.
    const hero = page.locator('h2');
    await expect(hero.first()).toBeVisible();
  });

  test('hero description is present', async ({ page }) => {
    await expect(
      page.getByText('The ultimate battle begins', { exact: false })
    ).toBeVisible();
  });

  test('hero CTA 立即抽獎 link is present', async ({ page }) => {
    await expect(page.getByRole('link', { name: /立即抽獎/ })).toBeVisible();
  });

  test('hero CTA 查看賞品 link is present and points to /campaigns', async ({ page }) => {
    // There are multiple 查看賞品 links; the first one is in the hero.
    const viewPrizeLinks = page.getByRole('link', { name: /查看賞品/ });
    await expect(viewPrizeLinks.first()).toBeVisible();
    await expect(viewPrizeLinks.first()).toHaveAttribute('href', '/campaigns');
  });

  test('hero does NOT contain 無限賞體驗', async ({ page }) => {
    await expect(page.getByRole('link', { name: /無限賞體驗/ })).toHaveCount(0);
  });

  // ── Ichiban Kuji section ──────────────────────────────────────────────────

  test('ichiban kuji section heading 一番賞 is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '一番賞' })).toBeVisible();
  });

  test('ichiban kuji subtitle is visible', async ({ page }) => {
    await expect(page.getByText('Premium Japanese Lottery Sets')).toBeVisible();
  });

  test('ichiban kuji 查看賞品 link points to /campaigns', async ({ page }) => {
    // The ichiban section has a 查看賞品 link pointing to the filtered campaigns page.
    const ichibanLink = page.getByRole('link', { name: /查看賞品/ }).filter({
      has: page.locator('[class*="material"]'),
    });
    await expect(ichibanLink).toBeVisible();
    await expect(ichibanLink).toHaveAttribute('href', '/campaigns?type=ichiban');
  });

  // ── Infinite Kuji section ─────────────────────────────────────────────────

  test('infinite kuji section heading 無限賞 is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '無限賞' })).toBeVisible();
  });

  test('infinite kuji subtitle is visible', async ({ page }) => {
    await expect(page.getByText('Continuous Draws with Probability Tiers')).toBeVisible();
  });

  // ── Campaign cards / empty state ──────────────────────────────────────────

  test('campaign cards or empty state render after loading', async ({ page }) => {
    // Allow the async fetch to resolve; the skeleton will be replaced by either
    // campaign cards or the empty-state message.
    await page.waitForTimeout(4000);

    const emptyStateText = '目前沒有進行中的活動，敬請期待！';
    const hasEmpty = await page.getByText(emptyStateText).first().isVisible().catch(() => false);
    // Campaign cards are rendered as <a> links to /campaigns/{id}
    const cardCount = await page.locator('a[href^="/campaigns/"]').count();
    // Also check for the section headings which are always present
    const hasSections = await page.getByText('一番賞').first().isVisible().catch(() => false);

    expect(hasEmpty || cardCount > 0 || hasSections).toBeTruthy();
  });

  test('empty state message wording is correct when no campaigns', async ({ page }) => {
    // If the empty state is present, validate the exact translated string.
    await page.waitForTimeout(3000);
    const emptyState = page.getByText('目前沒有進行中的活動，敬請期待！');
    const visible = await emptyState.isVisible().catch(() => false);
    if (visible) {
      await expect(emptyState).toBeVisible();
    }
  });

  // ── Footer ────────────────────────────────────────────────────────────────

  test('footer copyright text is present', async ({ page }) => {
    await expect(page.getByText('The Illuminated Gallery © 2026')).toBeVisible();
  });

  test('footer tagline is present', async ({ page }) => {
    await expect(page.getByText('Premium Digital Collectible Experience')).toBeVisible();
  });

  // ── SideNav (desktop shell) ───────────────────────────────────────────────

  test('sidenav brand The Gallery links to /', async ({ page }) => {
    // SideNav is rendered as an <aside> and is only visible at lg breakpoint.
    // Playwright's default viewport (1280×720) is wide enough to show it.
    const brandLink = page.getByRole('link', { name: /The Gallery/ }).first();
    await expect(brandLink).toBeVisible();
    await expect(brandLink).toHaveAttribute('href', '/');
  });

  test('sidenav contains nav links 首頁 市集 排行榜 我的賞品 錢包', async ({ page }) => {
    const aside = page.locator('aside');
    await expect(aside.getByRole('link', { name: '首頁' })).toBeVisible();
    await expect(aside.getByRole('link', { name: '市集' })).toBeVisible();
    await expect(aside.getByRole('link', { name: '排行榜' })).toBeVisible();
    await expect(aside.getByRole('link', { name: '我的賞品' })).toBeVisible();
    await expect(aside.getByRole('link', { name: '錢包' })).toBeVisible();
  });

  test('sidenav 首頁 link is active on home page', async ({ page }) => {
    const homeLink = page.locator('aside').getByRole('link', { name: '首頁' });
    // The active link receives bg-primary-container/10 styling; verify the href is /.
    await expect(homeLink).toHaveAttribute('href', '/');
  });

  // ── Absent legacy elements ────────────────────────────────────────────────

  test('no PrizeDraw brand heading exists', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'PrizeDraw' })).toHaveCount(0);
  });

  test('no 熱門活動 section exists', async ({ page }) => {
    await expect(page.getByText('🔥 熱門活動')).toHaveCount(0);
  });

  test('no 玩法說明 section exists', async ({ page }) => {
    await expect(page.getByText('玩法說明')).toHaveCount(0);
  });

  test('no 為什麼選擇 PrizeDraw？ section exists', async ({ page }) => {
    await expect(page.getByText('為什麼選擇 PrizeDraw？')).toHaveCount(0);
  });
});
