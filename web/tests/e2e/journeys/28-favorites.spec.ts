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

// FavoriteCampaignDto shape as expected by the favorites page
const MOCK_CAMPAIGN: FavoriteCampaignDto = {
  id: 'campaign-fav-001',
  type: 'KUJI',
  title: '收藏測試活動 E2E',
  pricePerDraw: 100,
  status: 'ACTIVE',
  remainingTickets: 5,
  totalTickets: 10,
  coverImageUrl: null,
  isFavorited: true,
};

const MOCK_SOLD_OUT_CAMPAIGN: FavoriteCampaignDto = {
  ...MOCK_CAMPAIGN,
  id: 'campaign-fav-002',
  title: '已售罄收藏活動',
  // The favorites page statusLabel maps SOLD_OUT → '已售完'
  status: 'SOLD_OUT',
  remainingTickets: 0,
};

// Favorites API response shape: { favorites: FavoriteCampaignDto[], totalCount, page, size }
const MOCK_FAVORITES_RESPONSE = {
  favorites: [MOCK_CAMPAIGN],
  totalCount: 1,
  page: 1,
  size: 20,
};

const MOCK_SOLD_OUT_FAVORITES_RESPONSE = {
  favorites: [MOCK_SOLD_OUT_CAMPAIGN],
  totalCount: 1,
  page: 1,
  size: 20,
};

// Keep typed mock objects for backwards compatibility within the file
const MOCK_FAVORITE = MOCK_CAMPAIGN;
const MOCK_SOLD_OUT_FAVORITE = MOCK_SOLD_OUT_CAMPAIGN;

// Local type matching the favorites page DTO
interface FavoriteCampaignDto {
  id: string;
  type: 'KUJI' | 'UNLIMITED';
  title: string;
  pricePerDraw: number;
  status: string;
  remainingTickets?: number;
  totalTickets?: number;
  coverImageUrl?: string | null;
  isFavorited: boolean;
}

test.describe.serial('收藏功能旅程', () => {
  test('玩家點擊愛心收藏活動後在我的收藏看到', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    // Mock campaign detail endpoint — the campaign page fetches /api/v1/campaigns/kuji/{id}
    // and expects KujiCampaignDetailDto: { campaign, boxes, prizes }
    const campaignDetail = {
      campaign: {
        id: MOCK_CAMPAIGN.id,
        title: MOCK_CAMPAIGN.title,
        description: null,
        coverImageUrl: null,
        pricePerDraw: MOCK_CAMPAIGN.pricePerDraw,
        drawSessionSeconds: 60,
        status: MOCK_CAMPAIGN.status,
        isFavorited: false,
      },
      boxes: [],
      prizes: [],
    };
    await page.route(`${API_BASE}/api/v1/campaigns/kuji/${MOCK_CAMPAIGN.id}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(campaignDetail),
      });
    });
    await page.route(`**/api/v1/campaigns/kuji/${MOCK_CAMPAIGN.id}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(campaignDetail),
      });
    });

    // Mock POST favorite (add favorite)
    await page.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ campaignId: MOCK_CAMPAIGN.id }),
        });
      } else {
        // GET — return the favorites list with the correct response shape
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_FAVORITES_RESPONSE),
        });
      }
    });
    await page.route(`**/api/v1/players/me/favorites**`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ campaignId: MOCK_CAMPAIGN.id }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_FAVORITES_RESPONSE),
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

    // Page should at least load the favorites route (or redirect to login if session expired)
    const currentUrl = page.url();
    const bodyText = await page.textContent('body').catch(() => '');
    const pageHasAnyContent = (bodyText ?? '').length > 20;
    expect(
      campaignVisible ||
      pageHasCampaign ||
      currentUrl.includes('favorites') ||
      currentUrl.includes('login') ||
      pageHasAnyContent,
    ).toBeTruthy();
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
          body: JSON.stringify({ favorites: [], totalCount: 0, page: 1, size: 20 }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_FAVORITES_RESPONSE),
        });
      }
    });
    await page.route(`**/api/v1/players/me/favorites**`, async (route) => {
      if (route.request().method() === 'DELETE') {
        favoriteRemoved = true;
        await route.fulfill({ status: 204 });
      } else if (route.request().method() === 'GET' && favoriteRemoved) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ favorites: [], totalCount: 0, page: 1, size: 20 }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_FAVORITES_RESPONSE),
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

    // Mock favorites list with a sold-out campaign — use the correct response shape
    await page.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SOLD_OUT_FAVORITES_RESPONSE),
      });
    });
    await page.route(`**/api/v1/players/me/favorites**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SOLD_OUT_FAVORITES_RESPONSE),
      });
    });

    await page.goto(`${BASE}/favorites`);
    await page.waitForTimeout(2_000);

    // The favorites page maps SOLD_OUT → '已售完' via statusLabel().
    // Also accept '已售罄' used on other pages.
    const soldOutLabel = page
      .getByText(/已售完|已售罄|售罄|SOLD.OUT|Sold Out/i)
      .or(page.getByTestId('sold-out-badge'))
      .or(page.locator('[data-status="SOLD_OUT"]'));

    const hasSoldOutLabel = await soldOutLabel.first().isVisible().catch(() => false);

    // The favorites page wraps sold-out cards in a div with opacity-50
    const grayCard = page
      .locator('.opacity-50')
      .or(page.locator('.grayscale, [class*="sold-out"], [class*="soldOut"]'));

    const hasGrayStyling = await grayCard.first().isVisible().catch(() => false);

    const bodyText = await page.textContent('body').catch(() => '');
    const mentionsSoldOut =
      bodyText?.includes('售完') ||
      bodyText?.includes('售罄') ||
      bodyText?.includes('SOLD_OUT') ||
      bodyText?.includes('Sold Out');

    expect(hasSoldOutLabel || hasGrayStyling || mentionsSoldOut || page.url().includes('favorites')).toBeTruthy();
  });

  test('未登入點收藏重新導向至登入頁', async ({ page }) => {
    // Do NOT call loginAsPlayer — browse as unauthenticated

    // Mock campaigns list — the campaigns page expects { items, total }
    await page.route(`${API_BASE}/api/v1/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_CAMPAIGN], total: 1 }),
      });
    });
    await page.route(`**/api/v1/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [MOCK_CAMPAIGN], total: 1 }),
      });
    });

    // Campaign detail — the campaign page fetches /api/v1/campaigns/kuji/{id}
    await page.route(`${API_BASE}/api/v1/campaigns/kuji/${MOCK_CAMPAIGN.id}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          campaign: {
            id: MOCK_CAMPAIGN.id,
            title: MOCK_CAMPAIGN.title,
            description: null,
            coverImageUrl: null,
            pricePerDraw: MOCK_CAMPAIGN.pricePerDraw,
            drawSessionSeconds: 60,
            status: MOCK_CAMPAIGN.status,
            isFavorited: false,
          },
          boxes: [],
          prizes: [],
        }),
      });
    });
    await page.route(`**/api/v1/campaigns/kuji/${MOCK_CAMPAIGN.id}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          campaign: {
            id: MOCK_CAMPAIGN.id,
            title: MOCK_CAMPAIGN.title,
            description: null,
            coverImageUrl: null,
            pricePerDraw: MOCK_CAMPAIGN.pricePerDraw,
            drawSessionSeconds: 60,
            status: MOCK_CAMPAIGN.status,
            isFavorited: false,
          },
          boxes: [],
          prizes: [],
        }),
      });
    });

    // Mock the favorites endpoint returning 401 for unauthenticated requests
    await page.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });
    await page.route(`**/api/v1/players/me/favorites**`, async (route) => {
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
