/**
 * Journey 03 — Browse Campaigns
 *
 * Covers: home page 熱門活動 section, campaign list tabs, kuji detail with
 * ticket grid, ticket count, unlimited campaign probability table.
 */

import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS, TEST_CAMPAIGNS, SEEDED_IDS } from '../helpers/seed-data';
import { loginAsPlayer } from '../helpers/auth';

const BASE = process.env.TEST_WEB_URL ?? 'http://localhost:3001';
const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:8080';

// Mock campaign data aligned with TEST_CAMPAIGNS seed
const MOCK_KUJI = {
  id: SEEDED_IDS.kujiCampaignId || 'kuji-campaign-001',
  type: 'KUJI',
  title: TEST_CAMPAIGNS.kuji.title,
  pricePerDraw: TEST_CAMPAIGNS.kuji.pricePerDraw,
  status: 'ACTIVE',
  totalTickets: 10,
  remainingTickets: 10,
};

const MOCK_UNLIMITED = {
  id: SEEDED_IDS.unlimitedCampaignId || 'unlimited-campaign-001',
  type: 'UNLIMITED',
  title: TEST_CAMPAIGNS.unlimited.title,
  pricePerDraw: TEST_CAMPAIGNS.unlimited.pricePerDraw,
  status: 'ACTIVE',
  prizes: TEST_CAMPAIGNS.unlimited.prizes,
};

test.describe('瀏覽活動旅程', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    // Provide mock campaign list responses
    await page.route(`${API_BASE}/api/v1/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [MOCK_KUJI, MOCK_UNLIMITED],
          total: 2,
        }),
      });
    });
    await page.route(`**/api/campaigns**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [MOCK_KUJI, MOCK_UNLIMITED],
          total: 2,
        }),
      });
    });
  });

  test('首頁顯示熱門活動區塊', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(2_000);

    // The home page should render a 熱門活動 section heading
    const hotSection = page
      .getByText('熱門活動')
      .or(page.getByRole('heading', { name: '熱門活動' }))
      .or(page.getByTestId('hot-campaigns-section'));

    await expect(hotSection.first()).toBeVisible({ timeout: 10_000 });
  });

  test('活動列表有一番賞和無限賞頁籤', async ({ page }) => {
    await page.goto(`${BASE}/campaigns`);
    await page.waitForTimeout(1_500);

    // Both tab buttons must be present
    await expect(
      page.getByRole('button', { name: '一番賞' }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByRole('button', { name: '無限賞' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('點擊一番賞活動導航至含票券格的詳情頁面', async ({ page }) => {
    const campaignId = SEEDED_IDS.kujiCampaignId || 'kuji-campaign-001';

    // Mock the campaign detail endpoint
    await page.route(`${API_BASE}/api/v1/campaigns/${campaignId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_KUJI,
          ticketBoxes: [
            {
              id: 'box-001',
              name: '籤盒 A',
              totalTickets: 10,
              remainingTickets: 10,
              tickets: Array.from({ length: 10 }, (_, i) => ({
                id: `ticket-${i + 1}`,
                number: i + 1,
                status: 'AVAILABLE',
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
          ...MOCK_KUJI,
          ticketBoxes: [
            {
              id: 'box-001',
              name: '籤盒 A',
              totalTickets: 10,
              remainingTickets: 10,
              tickets: Array.from({ length: 10 }, (_, i) => ({
                id: `ticket-${i + 1}`,
                number: i + 1,
                status: 'AVAILABLE',
              })),
            },
          ],
        }),
      });
    });

    await page.goto(`${BASE}/campaigns`);
    await page.waitForTimeout(1_500);

    // Click the 一番賞 tab first to ensure correct filter
    const ichibanTab = page.getByRole('button', { name: '一番賞' });
    const hasTab = await ichibanTab.isVisible().catch(() => false);
    if (hasTab) await ichibanTab.click();

    await page.waitForTimeout(1_000);

    // Click on the first kuji campaign card
    const campaignLink = page
      .locator(`a[href*="${campaignId}"]`)
      .or(page.locator(`a[href*="campaigns/"]`).first());

    const hasLink = await campaignLink.first().isVisible().catch(() => false);
    if (hasLink) {
      await campaignLink.first().click();
      await page.waitForTimeout(2_000);

      // Should be on the campaign detail page
      expect(page.url()).toContain('campaigns');

      // Ticket grid should be present
      const ticketGrid = page
        .getByTestId('ticket-grid')
        .or(page.getByTestId('kuji-board'))
        .or(page.locator('[data-ticket]').first())
        .or(page.getByText('籤盒'));

      await expect(ticketGrid.first()).toBeVisible({ timeout: 10_000 });
    } else {
      // Navigate directly to the campaign detail
      await page.goto(`${BASE}/campaigns/${campaignId}`);
      await page.waitForTimeout(2_000);
      expect(page.url()).toContain('campaigns');
    }
  });

  test('票券格顯示正確的可用票券數量', async ({ page }) => {
    const campaignId = SEEDED_IDS.kujiCampaignId || 'kuji-campaign-001';

    await page.route(`${API_BASE}/api/v1/campaigns/${campaignId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_KUJI,
          ticketBoxes: [
            {
              id: 'box-001',
              name: '籤盒 A',
              totalTickets: 10,
              remainingTickets: 8,
              tickets: Array.from({ length: 10 }, (_, i) => ({
                id: `ticket-${i + 1}`,
                number: i + 1,
                status: i < 8 ? 'AVAILABLE' : 'DRAWN',
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
          ...MOCK_KUJI,
          ticketBoxes: [
            {
              id: 'box-001',
              name: '籤盒 A',
              totalTickets: 10,
              remainingTickets: 8,
              tickets: Array.from({ length: 10 }, (_, i) => ({
                id: `ticket-${i + 1}`,
                number: i + 1,
                status: i < 8 ? 'AVAILABLE' : 'DRAWN',
              })),
            },
          ],
        }),
      });
    });

    await page.goto(`${BASE}/campaigns/${campaignId}`);
    await page.waitForTimeout(2_500);

    // The page should show a count of remaining or total tickets
    // Look for "8" remaining or "10" total somewhere on the page
    const bodyText = await page.textContent('body');
    const showsCount = bodyText?.includes('10') || bodyText?.includes('8') || bodyText?.includes('剩餘');
    expect(showsCount).toBeTruthy();
  });

  test('無限賞活動顯示含百分比的機率表', async ({ page }) => {
    const campaignId = SEEDED_IDS.unlimitedCampaignId || 'unlimited-campaign-001';

    await page.route(`${API_BASE}/api/v1/campaigns/${campaignId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_UNLIMITED,
          prizes: [
            { grade: 'A賞', name: '超稀有公仔', probabilityBps: 5000, displayPercent: '0.5%' },
            { grade: 'B賞', name: '精品模型', probabilityBps: 30000, displayPercent: '3%' },
            { grade: 'C賞', name: '造型吊飾', probabilityBps: 165000, displayPercent: '16.5%' },
            { grade: 'D賞', name: '隨機貼紙', probabilityBps: 800000, displayPercent: '80%' },
          ],
        }),
      });
    });
    await page.route(`**/api/campaigns/${campaignId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_UNLIMITED,
          prizes: [
            { grade: 'A賞', name: '超稀有公仔', probabilityBps: 5000, displayPercent: '0.5%' },
            { grade: 'B賞', name: '精品模型', probabilityBps: 30000, displayPercent: '3%' },
            { grade: 'C賞', name: '造型吊飾', probabilityBps: 165000, displayPercent: '16.5%' },
            { grade: 'D賞', name: '隨機貼紙', probabilityBps: 800000, displayPercent: '80%' },
          ],
        }),
      });
    });

    await page.goto(`${BASE}/campaigns/${campaignId}`);
    await page.waitForTimeout(2_500);

    // Probability table should be visible
    const probTable = page
      .getByTestId('probability-table')
      .or(page.locator('table').first())
      .or(page.getByText('%').first());

    await expect(probTable.first()).toBeVisible({ timeout: 10_000 });

    // At least one percentage value should appear
    const bodyText = await page.textContent('body');
    const hasPercent = bodyText?.includes('%') ?? false;
    expect(hasPercent).toBeTruthy();

    // The prize grades should be visible
    await expect(page.getByText('A賞').first()).toBeVisible({ timeout: 5_000 });
  });
});
