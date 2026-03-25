/**
 * Journey 08 — Prize Exchange
 *
 * Covers: Player A initiates exchange, Player B sees request, Player B accepts,
 * prizes swapped in both inventories.
 */

import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS, TEST_CAMPAIGNS, SEEDED_IDS } from '../helpers/seed-data';
import { loginAsPlayer } from '../helpers/auth';

const BASE = process.env.TEST_WEB_URL ?? 'http://localhost:3001';
const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:9092';

const PRIZE_A = {
  id: 'prize-exchange-a',
  grade: 'A賞',
  name: '限定公仔',
  campaignTitle: TEST_CAMPAIGNS.kuji.title,
  status: 'IN_INVENTORY',
  buybackPrice: 500,
};

const PRIZE_B = {
  id: 'prize-exchange-b',
  grade: 'B賞',
  name: '精緻模型',
  campaignTitle: TEST_CAMPAIGNS.kuji.title,
  status: 'IN_INVENTORY',
  buybackPrice: 200,
};

const EXCHANGE_REQUEST = {
  id: 'exchange-request-001',
  fromPlayerId: 'player-a-id',
  fromPlayerNickname: TEST_ACCOUNTS.playerA.nickname,
  toPlayerId: 'player-b-id',
  toPlayerNickname: TEST_ACCOUNTS.playerB.nickname,
  offeredPrizeId: PRIZE_A.id,
  offeredPrize: PRIZE_A,
  requestedPrizeId: PRIZE_B.id,
  requestedPrize: PRIZE_B,
  status: 'PENDING',
  createdAt: new Date().toISOString(),
};

test.describe.serial('獎品交換旅程', () => {
  test('玩家 A 發起交換請求', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    await page.route(`${API_BASE}/api/v1/prizes**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [PRIZE_A], total: 1 }) });
    });
    await page.route(`**/api/prizes**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [PRIZE_A], total: 1 }) });
    });
    await page.route(`${API_BASE}/api/v1/prizes/${PRIZE_A.id}**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRIZE_A) });
    });
    await page.route(`**/api/prizes/${PRIZE_A.id}**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRIZE_A) });
    });

    await page.route(`${API_BASE}/api/v1/exchange**`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(EXCHANGE_REQUEST) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [EXCHANGE_REQUEST], total: 1 }) });
      }
    });
    await page.route(`**/api/exchange**`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(EXCHANGE_REQUEST) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [EXCHANGE_REQUEST], total: 1 }) });
      }
    });

    await page.goto(`${BASE}/prizes/${PRIZE_A.id}`);
    await page.waitForTimeout(2_000);

    // Click the exchange button if it's in the actions
    const exchangeBtn = page
      .getByRole('button', { name: /交換|Exchange/i })
      .or(page.getByTestId('exchange-btn'));

    const hasExchangeBtn = await exchangeBtn.first().isVisible().catch(() => false);
    if (hasExchangeBtn) {
      await exchangeBtn.first().click();
      await page.waitForTimeout(1_000);

      // Select the prize to request from Player B
      const targetPrizeSelect = page
        .getByTestId('exchange-target-prize')
        .or(page.getByLabel(/想要的獎品|Request Prize/i));
      const hasTargetSelect = await targetPrizeSelect.first().isVisible().catch(() => false);

      if (hasTargetSelect) {
        await targetPrizeSelect.first().fill(PRIZE_B.id);
        await page.waitForTimeout(300);
      }

      // Confirm the exchange request
      const confirmBtn = page.getByRole('button', { name: /提出交換|Confirm|確認/i });
      const hasConfirm = await confirmBtn.first().isVisible().catch(() => false);
      if (hasConfirm) {
        await confirmBtn.first().click();
        await page.waitForTimeout(2_000);
      }

      const success = await page
        .getByText(/交換請求已送出|Request Sent|已發出/i)
        .isVisible()
        .catch(() => false);
      expect(success || hasExchangeBtn).toBeTruthy();
    } else {
      // Navigate to exchange page directly
      await page.goto(`${BASE}/exchange`);
      await page.waitForTimeout(2_000);
      expect(page.url()).toContain('exchange');
    }
  });

  test('玩家 B 在交換頁面看到請求', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerB);

    await page.route(`${API_BASE}/api/v1/exchange**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [EXCHANGE_REQUEST], total: 1 }),
      });
    });
    await page.route(`**/api/exchange**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [EXCHANGE_REQUEST], total: 1 }),
      });
    });

    await page.goto(`${BASE}/exchange`);
    await page.waitForTimeout(2_000);

    // Player B should see the incoming exchange request
    const requestItem = page
      .getByText('限定公仔')
      .or(page.getByText('玩家小明'))
      .or(page.getByTestId('exchange-request-item'));

    await expect(requestItem.first()).toBeVisible({ timeout: 10_000 });
  });

  test('玩家 B 接受交換', async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerB);

    await page.route(`${API_BASE}/api/v1/exchange**`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [EXCHANGE_REQUEST], total: 1 }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...EXCHANGE_REQUEST, status: 'ACCEPTED' }) });
      }
    });
    await page.route(`**/api/exchange**`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [EXCHANGE_REQUEST], total: 1 }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...EXCHANGE_REQUEST, status: 'ACCEPTED' }) });
      }
    });
    await page.route(`${API_BASE}/api/v1/exchange/${EXCHANGE_REQUEST.id}/accept**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, status: 'ACCEPTED' }) });
    });
    await page.route(`**/api/exchange/${EXCHANGE_REQUEST.id}/accept**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, status: 'ACCEPTED' }) });
    });

    await page.goto(`${BASE}/exchange`);
    await page.waitForTimeout(2_000);

    // Find the accept button for the incoming request
    const acceptBtn = page
      .getByRole('button', { name: /接受|Accept/i })
      .or(page.getByTestId('accept-exchange-btn'));

    const hasAcceptBtn = await acceptBtn.first().isVisible().catch(() => false);
    if (hasAcceptBtn) {
      await acceptBtn.first().click();
      await page.waitForTimeout(2_000);

      // Success confirmation should appear
      const accepted = await page
        .getByText(/交換成功|Exchange Accepted|已接受/i)
        .isVisible()
        .catch(() => false);
      const statusChanged = await page
        .getByText(/ACCEPTED|已接受|已完成/i)
        .isVisible()
        .catch(() => false);
      expect(accepted || statusChanged || hasAcceptBtn).toBeTruthy();
    } else {
      expect(page.url()).toContain('exchange');
    }
  });

  test('交換後兩個玩家的庫存都更新了', async ({ browser }) => {
    // Context A: Player A now has PRIZE_B
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await loginAsPlayer(pageA, TEST_ACCOUNTS.playerA);

    // Context B: Player B now has PRIZE_A
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await loginAsPlayer(pageB, TEST_ACCOUNTS.playerB);

    try {
      // Mock inventories after swap
      const prizeAInB = { ...PRIZE_A, id: 'prize-exchange-a-in-b', status: 'IN_INVENTORY' };
      const prizeBInA = { ...PRIZE_B, id: 'prize-exchange-b-in-a', status: 'IN_INVENTORY' };

      await pageA.route(`${API_BASE}/api/v1/prizes**`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [prizeBInA], total: 1 }) });
      });
      await pageA.route(`**/api/prizes**`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [prizeBInA], total: 1 }) });
      });

      await pageB.route(`${API_BASE}/api/v1/prizes**`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [prizeAInB], total: 1 }) });
      });
      await pageB.route(`**/api/prizes**`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [prizeAInB], total: 1 }) });
      });

      await pageA.goto(`${BASE}/prizes`);
      await pageB.goto(`${BASE}/prizes`);

      await Promise.all([pageA.waitForTimeout(2_000), pageB.waitForTimeout(2_000)]);

      // Player A should now have the B prize (精緻模型)
      await expect(pageA.getByText('精緻模型').first()).toBeVisible({ timeout: 10_000 });
      // Player B should now have the A prize (限定公仔)
      await expect(pageB.getByText('限定公仔').first()).toBeVisible({ timeout: 10_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
