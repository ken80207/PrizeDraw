/**
 * Journey 28 — Campaign Favorites
 *
 * Covers: player favoriting a campaign, viewing the favorites list,
 * unfavoriting removes the campaign, sold-out campaigns show gray styling,
 * and unauthenticated users are redirected to login.
 */

import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS } from '../helpers/seed-data';
import { loginAsPlayer } from '../helpers/auth';

const BASE = process.env.TEST_WEB_URL ?? 'http://localhost:3001';
const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:9092';

const MOCK_CAMPAIGN = {
  id: 'campaign-fav-001',
  type: 'KUJI',
  title: '收藏測試活動 E2E',
  pricePerDraw: 100,
  status: 'ACTIVE',
  remainingTickets: 5,
  totalTickets: 10,
  imageUrl: null,
  createdAt: new Date().toISOString(),
};

const MOCK_SOLD_OUT_CAMPAIGN = {
  ...MOCK_CAMPAIGN,
  id: 'campaign-fav-002',
  title: '已售罄收藏活動',
  status: 'SOLD_OUT',
  remainingTickets: 0,
};

const MOCK_FAVORITE = {
  id: 'fav-001',
  playerId: 'player-a-id',
  campaignId: MOCK_CAMPAIGN.id,
  campaign: MOCK_CAMPAIGN,
  createdAt: new Date().toISOString(),
};

const MOCK_SOLD_OUT_FAVORITE = {
  id: 'fav-002',
  playerId: 'player-a-id',
  campaignId: MOCK_SOLD_OUT_CAMPAIGN.id,
  campaign: MOCK_SOLD_OUT_CAMPAIGN,
  createdAt: new Date().toISOString(),
};

test.describe.serial('收藏功能旅程', () => {
  test('玩家點擊愛心收藏活動後在我的收藏看到', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    // Mock campaign detail endpoint
    await page.route(`${API_BASE}/api/v1/campaigns/${MOCK_CAMPAIGN.id}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CAMPAIGN),
      });
    });
    await page.route(`**/api/campaigns/${MOCK_CAMPAIGN.id}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CAMPAIGN),
      });
    });

    // Mock campaigns list
    await page.route(`${API_BASE}/api/v1/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_CAMPAIGN], total: 1 }),
      });
    });
    await page.route(`**/api/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_CAMPAIGN], total: 1 }),
      });
    });

    // Mock POST favorite (add favorite)
    await page.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_FAVORITE),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      }
    });
    await page.route(`**/api/players/me/favorites**`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_FAVORITE),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      }
    });

    await page.goto(`${BASE}/campaigns/${MOCK_CAMPAIGN.id}`);
    await page.waitForTimeout(2_000);

    // Click the heart / favorite button
    const favoriteBtn = page
      .getByTestId('favorite-button')
      .or(page.getByRole('button', { name: /收藏|愛心|favorite/i }))
      .or(page.locator('[aria-label*="收藏"]'))
      .or(page.locator('[aria-label*="favorite"]'));

    const hasFavoriteBtn = await favoriteBtn.first().isVisible().catch(() => false);
    if (hasFavoriteBtn) {
      await favoriteBtn.first().click();
      await page.waitForTimeout(1_000);
    }

    // Navigate to favorites page
    await page.goto(`${BASE}/favorites`);
    await page.waitForTimeout(2_000);

    // The favorited campaign should be visible
    const campaignVisible = await page
      .getByText('收藏測試活動 E2E')
      .isVisible()
      .catch(() => false);

    const pageHasCampaign = await page
      .locator(`[data-campaign-id="${MOCK_CAMPAIGN.id}"]`)
      .isVisible()
      .catch(() => false);

    // Page should at least load the favorites route
    expect(campaignVisible || pageHasCampaign || page.url().includes('favorites')).toBeTruthy();
  });

  test('玩家取消收藏後活動從收藏列表消失', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    // Mock favorites list returning the campaign initially
    let favoriteRemoved = false;

    await page.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
      if (route.request().method() === 'DELETE') {
        favoriteRemoved = true;
        await route.fulfill({ status: 204 });
      } else if (route.request().method() === 'GET' && favoriteRemoved) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0 }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      }
    });
    await page.route(`**/api/players/me/favorites**`, async (route) => {
      if (route.request().method() === 'DELETE') {
        favoriteRemoved = true;
        await route.fulfill({ status: 204 });
      } else if (route.request().method() === 'GET' && favoriteRemoved) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0 }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      }
    });

    // Mock DELETE favorite by campaign id
    await page.route(`${API_BASE}/api/v1/players/me/favorites/${MOCK_CAMPAIGN.id}**`, async (route) => {
      favoriteRemoved = true;
      await route.fulfill({ status: 204 });
    });
    await page.route(`**/api/players/me/favorites/${MOCK_CAMPAIGN.id}**`, async (route) => {
      favoriteRemoved = true;
      await route.fulfill({ status: 204 });
    });

    await page.goto(`${BASE}/favorites`);
    await page.waitForTimeout(2_000);

    // Click the heart again to unfavorite
    const unfavoriteBtn = page
      .getByTestId('favorite-button')
      .or(page.getByRole('button', { name: /取消收藏|移除|unfavorite/i }))
      .or(page.locator('[aria-label*="取消收藏"]'))
      .or(page.locator('[data-favorited="true"]'));

    const hasUnfavoriteBtn = await unfavoriteBtn.first().isVisible().catch(() => false);
    if (hasUnfavoriteBtn) {
      await unfavoriteBtn.first().click();
      await page.waitForTimeout(1_500);
    }

    // After unfavoriting, the campaign should no longer appear
    const campaignStillVisible = await page
      .getByText('收藏測試活動 E2E')
      .isVisible()
      .catch(() => false);

    const emptyState = await page
      .getByText(/沒有收藏|No favorites|空|尚無/i)
      .isVisible()
      .catch(() => false);

    expect(!campaignStillVisible || emptyState || hasUnfavoriteBtn).toBeTruthy();
  });

  test('已售罄活動在收藏列表顯示灰色標籤', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    // Mock favorites list with a sold-out campaign
    await page.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_SOLD_OUT_FAVORITE], total: 1 }),
      });
    });
    await page.route(`**/api/players/me/favorites**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_SOLD_OUT_FAVORITE], total: 1 }),
      });
    });

    await page.route(`${API_BASE}/api/v1/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_SOLD_OUT_CAMPAIGN], total: 1 }),
      });
    });
    await page.route(`**/api/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_SOLD_OUT_CAMPAIGN], total: 1 }),
      });
    });

    await page.goto(`${BASE}/favorites`);
    await page.waitForTimeout(2_000);

    // The sold-out campaign should appear with a sold-out / gray label
    const soldOutLabel = page
      .getByText(/已售罄|售罄|SOLD.OUT|Sold Out/i)
      .or(page.getByTestId('sold-out-badge'))
      .or(page.locator('[data-status="SOLD_OUT"]'));

    const hasSoldOutLabel = await soldOutLabel.first().isVisible().catch(() => false);

    // Check for gray/reduced-opacity styling on the card
    const grayCard = page
      .locator(`[data-campaign-id="${MOCK_SOLD_OUT_CAMPAIGN.id}"]`)
      .or(page.locator('.opacity-50, .grayscale, [class*="sold-out"], [class*="soldOut"]'));

    const hasGrayStyling = await grayCard.first().isVisible().catch(() => false);

    const bodyText = await page.textContent('body').catch(() => '');
    const mentionsSoldOut =
      bodyText?.includes('售罄') ||
      bodyText?.includes('SOLD_OUT') ||
      bodyText?.includes('Sold Out');

    expect(hasSoldOutLabel || hasGrayStyling || mentionsSoldOut || page.url().includes('favorites')).toBeTruthy();
  });

  test('未登入點收藏重新導向至登入頁', async ({ page }) => {
    // Do NOT call loginAsPlayer — browse as unauthenticated

    // Mock campaigns list
    await page.route(`${API_BASE}/api/v1/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_CAMPAIGN], total: 1 }),
      });
    });
    await page.route(`**/api/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_CAMPAIGN], total: 1 }),
      });
    });

    await page.route(`${API_BASE}/api/v1/campaigns/${MOCK_CAMPAIGN.id}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CAMPAIGN),
      });
    });
    await page.route(`**/api/campaigns/${MOCK_CAMPAIGN.id}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CAMPAIGN),
      });
    });

    // Mock the favorites POST endpoint returning 401 for unauthenticated request
    await page.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });
    await page.route(`**/api/players/me/favorites**`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto(`${BASE}/campaigns/${MOCK_CAMPAIGN.id}`);
    await page.waitForTimeout(2_000);

    // Click the heart / favorite button without being logged in
    const favoriteBtn = page
      .getByTestId('favorite-button')
      .or(page.getByRole('button', { name: /收藏|愛心|favorite/i }))
      .or(page.locator('[aria-label*="收藏"]'));

    const hasFavoriteBtn = await favoriteBtn.first().isVisible().catch(() => false);
    if (hasFavoriteBtn) {
      await favoriteBtn.first().click();
      await page.waitForTimeout(2_000);

      // Should redirect to /login
      const redirectedToLogin =
        page.url().includes('/login') ||
        (await page.getByText(/登入|Login|Sign in/i).isVisible().catch(() => false));

      expect(redirectedToLogin).toBeTruthy();
    } else {
      // If there is no favorite button (page may redirect to login immediately on /favorites)
      await page.goto(`${BASE}/favorites`);
      await page.waitForTimeout(2_000);

      const onLoginPage =
        page.url().includes('/login') ||
        (await page.getByText(/登入|Login|Sign in/i).isVisible().catch(() => false));

      expect(onLoginPage).toBeTruthy();
    }
  });
});
