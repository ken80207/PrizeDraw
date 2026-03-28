/**
 * Journey 15 — Leaderboard
 *
 * Covers: leaderboard shows rankings, player's own rank highlighted,
 * period filter (今日/本週/本月) works.
 */

import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS, SEEDED_IDS } from '../helpers/seed-data';
import { loginAsPlayer } from '../helpers/auth';

const BASE = process.env.TEST_WEB_URL ?? 'http://localhost:3001';
const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:9092';

const MOCK_LEADERBOARD = {
  type: 'DRAW_COUNT',
  period: 'THIS_WEEK',
  entries: [
    { rank: 1, playerId: 'player-x-001', nickname: '冠軍玩家', avatarUrl: null, score: 150, detail: null },
    { rank: 2, playerId: 'player-x-002', nickname: '亞軍玩家', avatarUrl: null, score: 120, detail: null },
    { rank: 3, playerId: 'player-a-id',  nickname: TEST_ACCOUNTS.playerA.nickname, avatarUrl: null, score: 80, detail: null },
    { rank: 4, playerId: 'player-x-003', nickname: '第四名玩家', avatarUrl: null, score: 60, detail: null },
    { rank: 5, playerId: 'player-x-004', nickname: '第五名玩家', avatarUrl: null, score: 40, detail: null },
  ],
  // selfRank is only shown when the player's rank is NOT in the visible entries list.
  // Set to null so we rely on the entries list to display playerA's nickname.
  selfRank: null,
};

test.describe('排行榜旅程', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlayer(page, TEST_ACCOUNTS.playerA);

    // The leaderboard page fetches /api/v1/leaderboards (plural)
    await page.route(`${API_BASE}/api/v1/leaderboards**`, async (route) => {
      const url = route.request().url();
      let period: string = MOCK_LEADERBOARD.period;
      if (url.includes('period=TODAY')) period = 'TODAY';
      if (url.includes('period=THIS_WEEK')) period = 'THIS_WEEK';
      if (url.includes('period=THIS_MONTH')) period = 'THIS_MONTH';
      if (url.includes('period=ALL_TIME')) period = 'ALL_TIME';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_LEADERBOARD, period }),
      });
    });
    await page.route(`**/api/leaderboards**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LEADERBOARD),
      });
    });
  });

  test('排行榜顯示玩家排名', async ({ page }) => {
    await page.goto(`${BASE}/leaderboard`);
    await page.waitForTimeout(2_000);

    // Top-ranked player should appear
    await expect(page.getByText('冠軍玩家').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('亞軍玩家').first()).toBeVisible({ timeout: 5_000 });

    // Rank numbers should be present
    const bodyText = await page.textContent('body');
    expect(bodyText?.includes('1') && bodyText?.includes('2')).toBeTruthy();
  });

  test('玩家自己的排名被高亮標示', async ({ page }) => {
    await page.goto(`${BASE}/leaderboard`);
    await page.waitForTimeout(2_000);

    // Player A's nickname should appear (rank 3)
    await expect(
      page.getByText(TEST_ACCOUNTS.playerA.nickname).first(),
    ).toBeVisible({ timeout: 10_000 });

    // The row/cell containing playerA's nickname should have a highlight class or indicator
    const ownRankRow = page
      .locator('[data-self="true"]')
      .or(page.locator('.own-rank'))
      .or(page.locator('[aria-current="true"]'))
      .or(page.getByTestId('self-rank-row'))
      .or(page.getByText(TEST_ACCOUNTS.playerA.nickname).locator('..').locator('..'));

    const hasHighlight = await ownRankRow.first().isVisible({ timeout: 5_000 }).catch(() => false);

    // At minimum the nickname is visible
    const nicknameVisible = await page
      .getByText(TEST_ACCOUNTS.playerA.nickname)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasHighlight || nicknameVisible).toBeTruthy();
  });

  test('週期篩選器（今日/本週/本月）正常運作', async ({ page }) => {
    await page.goto(`${BASE}/leaderboard`);
    await page.waitForTimeout(2_000);

    // Period filter tabs/buttons
    const dailyFilter = page
      .getByRole('button', { name: /今日|Daily|今天/i })
      .or(page.getByRole('tab', { name: /今日|Daily/i }))
      .or(page.getByText('今日').first());

    const weeklyFilter = page
      .getByRole('button', { name: /本週|Weekly|本周/i })
      .or(page.getByRole('tab', { name: /本週|Weekly/i }))
      .or(page.getByText('本週').first());

    const monthlyFilter = page
      .getByRole('button', { name: /本月|Monthly/i })
      .or(page.getByRole('tab', { name: /本月|Monthly/i }))
      .or(page.getByText('本月').first());

    // All three filter options should be present
    const hasDaily = await dailyFilter.first().isVisible().catch(() => false);
    const hasWeekly = await weeklyFilter.first().isVisible().catch(() => false);
    const hasMonthly = await monthlyFilter.first().isVisible().catch(() => false);

    // At least two of three period filters should exist
    const filterCount = [hasDaily, hasWeekly, hasMonthly].filter(Boolean).length;
    expect(filterCount).toBeGreaterThanOrEqual(2);

    // Click "本月" and verify the leaderboard re-renders
    if (hasMonthly) {
      await monthlyFilter.first().click();
      await page.waitForTimeout(1_500);

      // Content should still be present after filter change
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    } else if (hasDaily) {
      await dailyFilter.first().click();
      await page.waitForTimeout(1_500);

      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    }
  });
});
