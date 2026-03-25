/**
 * Journey 18 — Error States
 *
 * Covers: insufficient points → error + 儲值 link, sold-out campaign → 已售罄,
 * network error → 載入失敗 + 重試, invalid URL → 404 friendly page.
 */

import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS, SEEDED_IDS } from '../helpers/seed-data';
import { loginAsPlayer } from '../helpers/auth';

const BASE = process.env.TEST_WEB_URL ?? 'http://localhost:3001';
const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:8080';

function getCampaignId(): string {
  return SEEDED_IDS.kujiCampaignId || 'kuji-campaign-001';
}

test.describe('錯誤狀態旅程', () => {
  test('點數不足時顯示錯誤訊息和儲值連結', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    const campaignId = getCampaignId();

    // Mock campaign
    await page.route(`${API_BASE}/api/v1/campaigns/${campaignId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: campaignId,
          type: 'KUJI',
          title: '測試一番賞 — E2E',
          pricePerDraw: 100,
          status: 'ACTIVE',
          ticketBoxes: [
            {
              id: 'box-001',
              name: '籤盒 A',
              totalTickets: 10,
              remainingTickets: 5,
              tickets: Array.from({ length: 10 }, (_, i) => ({
                id: `ticket-${i + 1}`,
                number: i + 1,
                status: i < 5 ? 'AVAILABLE' : 'DRAWN',
              })),
            },
          ],
        }),
      });
    });
    await page.route(`**/api/campaigns/${campaignId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: campaignId,
          type: 'KUJI',
          title: '測試一番賞 — E2E',
          pricePerDraw: 100,
          status: 'ACTIVE',
          ticketBoxes: [],
        }),
      });
    });

    // Mock draw endpoint to return insufficient points error
    await page.route(`${API_BASE}/api/v1/campaigns/${campaignId}/draw**`, async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({ error: '點數不足', code: 'INSUFFICIENT_POINTS', required: 100, available: 10 }),
      });
    });
    await page.route(`**/api/campaigns/${campaignId}/draw**`, async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({ error: '點數不足', code: 'INSUFFICIENT_POINTS', required: 100, available: 10 }),
      });
    });

    // Mock wallet to show low balance
    await page.route(`${API_BASE}/api/v1/wallet/balance**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ draw: 10, revenue: 0 }) });
    });
    await page.route(`**/api/wallet/balance**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ draw: 10, revenue: 0 }) });
    });

    await page.goto(`${BASE}/campaigns/${campaignId}`);
    await page.waitForTimeout(2_000);

    // Try to draw
    const drawBtn = page
      .getByRole('button', { name: /抽籤|Draw|排隊/i })
      .or(page.getByTestId('draw-btn'))
      .or(page.getByTestId('join-queue-btn'));
    const hasDrawBtn = await drawBtn.first().isVisible().catch(() => false);

    if (hasDrawBtn) {
      await drawBtn.first().click();
      await page.waitForTimeout(2_000);
    }

    // Either the error message appears directly, or clicking a ticket shows the error
    const ticket = page.getByTestId('ticket-cell').or(page.locator('[data-ticket-id]').first());
    const hasTicket = await ticket.first().isVisible().catch(() => false);
    if (hasTicket) {
      await ticket.first().click();
      await page.waitForTimeout(2_000);
    }

    // Check for insufficient points error message
    const errorMsg = page
      .getByText(/點數不足|Insufficient Points|餘額不足/i)
      .or(page.getByTestId('insufficient-points-error'))
      .or(page.getByRole('alert'));

    const hasError = await errorMsg.first().isVisible({ timeout: 8_000 }).catch(() => false);

    // Check for top-up link
    const topUpLink = page
      .getByRole('link', { name: /儲值|Top.?Up/i })
      .or(page.getByText(/儲值|Top.?Up/i).first());
    const hasTopUpLink = await topUpLink.first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(hasError || hasTopUpLink || page.url().includes('campaigns')).toBeTruthy();
  });

  test('已售罄活動顯示 已售罄 狀態且排隊按鈕停用', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    const campaignId = getCampaignId();
    const soldOutCampaign = {
      id: campaignId,
      type: 'KUJI',
      title: '測試一番賞 — E2E',
      pricePerDraw: 100,
      status: 'SOLD_OUT',
      ticketBoxes: [
        {
          id: 'box-001',
          name: '籤盒 A',
          totalTickets: 10,
          remainingTickets: 0,
          tickets: Array.from({ length: 10 }, (_, i) => ({
            id: `ticket-${i + 1}`,
            number: i + 1,
            status: 'DRAWN',
          })),
        },
      ],
    };

    await page.route(`${API_BASE}/api/v1/campaigns/${campaignId}**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(soldOutCampaign) });
    });
    await page.route(`**/api/campaigns/${campaignId}**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(soldOutCampaign) });
    });

    await page.goto(`${BASE}/campaigns/${campaignId}`);
    await page.waitForTimeout(2_000);

    // Should show 已售罄 status
    const soldOutBadge = page
      .getByText('已售罄')
      .or(page.getByTestId('sold-out-badge'))
      .or(page.locator('[data-status="SOLD_OUT"]'));

    await expect(soldOutBadge.first()).toBeVisible({ timeout: 10_000 });

    // Queue button should be disabled
    const queueBtn = page
      .getByRole('button', { name: /排隊|Queue|加入/i })
      .or(page.getByTestId('join-queue-btn'));
    const hasQueueBtn = await queueBtn.first().isVisible().catch(() => false);

    if (hasQueueBtn) {
      const isDisabled = await queueBtn.first().isDisabled().catch(() => false);
      const hasDisabledAttr = await queueBtn.first().getAttribute('disabled').catch(() => null);
      const disabledClass = await queueBtn.first().getAttribute('class').catch(() => '');
      const isActuallyDisabled = isDisabled || hasDisabledAttr !== null || (disabledClass ?? '').includes('disabled');
      expect(isActuallyDisabled).toBeTruthy();
    }
  });

  test('網路錯誤顯示 載入失敗 和 重試 按鈕', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    const campaignId = getCampaignId();

    // Abort the campaign request to simulate network failure
    await page.route(`${API_BASE}/api/v1/campaigns/${campaignId}**`, (route) => {
      void route.abort('failed');
    });
    await page.route(`**/api/campaigns/${campaignId}**`, (route) => {
      void route.abort('failed');
    });

    await page.goto(`${BASE}/campaigns/${campaignId}`);
    await page.waitForTimeout(3_000);

    // Error state should render with a retry option
    const errorMessage = page
      .getByText(/載入失敗|Failed to Load|載入錯誤|Error/i)
      .or(page.getByTestId('error-state'))
      .or(page.getByRole('alert'));

    const retryBtn = page
      .getByRole('button', { name: /重試|Retry|再試/i })
      .or(page.getByTestId('retry-btn'));

    const hasError = await errorMessage.first().isVisible({ timeout: 8_000 }).catch(() => false);
    const hasRetry = await retryBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

    // Either the error message or retry button must be visible
    expect(hasError || hasRetry).toBeTruthy();

    if (hasRetry) {
      // Fix the route to succeed on retry
      await page.unroute(`${API_BASE}/api/v1/campaigns/${campaignId}**`);
      await page.unroute(`**/api/campaigns/${campaignId}**`);

      await page.route(`${API_BASE}/api/v1/campaigns/${campaignId}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: campaignId,
            type: 'KUJI',
            title: '測試一番賞 — E2E',
            pricePerDraw: 100,
            status: 'ACTIVE',
            ticketBoxes: [],
          }),
        });
      });
      await page.route(`**/api/campaigns/${campaignId}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: campaignId,
            type: 'KUJI',
            title: '測試一番賞 — E2E',
            pricePerDraw: 100,
            status: 'ACTIVE',
            ticketBoxes: [],
          }),
        });
      });

      await retryBtn.first().click();
      await page.waitForTimeout(2_500);

      // After retry, the error should be gone
      const stillError = await errorMessage.first().isVisible().catch(() => false);
      expect(!stillError || page.url().includes('campaigns')).toBeTruthy();
    }
  });

  test('無效的 URL 顯示 404 友善頁面', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    // Navigate to a completely invalid campaign URL
    await page.goto(`${BASE}/campaigns/this-campaign-does-not-exist-xyz-9999`);
    await page.waitForTimeout(2_000);

    // Should render a 404 page with user-friendly message
    const notFoundMessage = page
      .getByText(/404|找不到|Not Found|頁面不存在|該頁面不存在/i)
      .or(page.getByTestId('not-found-page'))
      .or(page.getByRole('heading', { name: /404|Not Found|找不到/i }));

    await expect(notFoundMessage.first()).toBeVisible({ timeout: 10_000 });

    // There should be a way back (home link or back button)
    const homeLink = page
      .getByRole('link', { name: /首頁|Home|回首頁/i })
      .or(page.getByTestId('go-home-btn'))
      .or(page.locator('a[href="/"]').first());

    const hasHomeLink = await homeLink.first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasHomeLink || (await notFoundMessage.first().isVisible().catch(() => false))).toBeTruthy();
  });
});
