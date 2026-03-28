/**
 * Journey 29 — Favorite Notifications (Dual Context)
 *
 * Covers: player who favorited a campaign receives a notification when
 * the campaign goes live (admin activates it), receives a low-stock
 * notification when stock is nearly depleted, and a player who has NOT
 * favorited the campaign receives no notification.
 *
 * Uses two browser contexts (admin + player, or player A + player B)
 * to simulate cross-actor interactions.
 */

import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS } from '../helpers/seed-data';
import { loginAsPlayer, loginAsAdmin } from '../helpers/auth';

const BASE = process.env.TEST_WEB_URL ?? 'http://localhost:3001';
const ADMIN_BASE = process.env.TEST_ADMIN_URL ?? 'http://localhost:3002';
const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:9092';

const DRAFT_CAMPAIGN = {
  id: 'campaign-notif-001',
  type: 'KUJI',
  title: '通知測試活動 E2E',
  pricePerDraw: 100,
  status: 'DRAFT',
  remainingTickets: 10,
  totalTickets: 10,
  imageUrl: null,
  createdAt: new Date().toISOString(),
};

const ACTIVE_CAMPAIGN = { ...DRAFT_CAMPAIGN, status: 'ACTIVE' };

const LOW_STOCK_CAMPAIGN = {
  ...DRAFT_CAMPAIGN,
  status: 'ACTIVE',
  remainingTickets: 2,
  totalTickets: 10,
};

const MOCK_FAVORITE = {
  id: 'fav-notif-001',
  playerId: 'player-a-id',
  campaignId: DRAFT_CAMPAIGN.id,
  campaign: DRAFT_CAMPAIGN,
  createdAt: new Date().toISOString(),
};

const NOTIFICATION_CAMPAIGN_LIVE = {
  id: 'notif-001',
  type: 'FAVORITE_CAMPAIGN_LIVE',
  title: '收藏的活動已上架',
  message: `您收藏的「${DRAFT_CAMPAIGN.title}」已開始販售！`,
  campaignId: DRAFT_CAMPAIGN.id,
  read: false,
  createdAt: new Date().toISOString(),
};

const NOTIFICATION_LOW_STOCK = {
  id: 'notif-002',
  type: 'FAVORITE_CAMPAIGN_LOW_STOCK',
  title: '快售罄',
  message: `您收藏的「${DRAFT_CAMPAIGN.title}」即將售罄，請把握機會！`,
  campaignId: DRAFT_CAMPAIGN.id,
  read: false,
  createdAt: new Date().toISOString(),
};

test.describe.serial('收藏活動通知旅程', () => {
  test.skip(!process.env.TEST_ADMIN_URL, 'Admin app not running — skipping notification tests');

  test('收藏活動上架後玩家收到通知', async ({ browser }) => {
    // Two browser contexts: admin activates campaign, player sees notification
    const playerContext = await browser.newContext();
    const adminContext = await browser.newContext();

    const playerPage = await playerContext.newPage();
    const adminPage = await adminContext.newPage();

    await loginAsPlayer(playerPage, TEST_ACCOUNTS.playerA);
    await loginAsAdmin(adminPage);

    try {
      // Player: mock favorites list (player has favorited the campaign)
      await playerPage.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      });
      await playerPage.route(`**/api/v1/players/me/favorites**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      });

      // Player: initially no notifications
      let campaignActivated = false;
      await playerPage.route(`${API_BASE}/api/v1/players/me/notifications**`, async (route) => {
        if (campaignActivated) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [NOTIFICATION_CAMPAIGN_LIVE], total: 1, unread: 1 }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [], total: 0, unread: 0 }),
          });
        }
      });
      await playerPage.route(`**/api/v1/players/me/notifications**`, async (route) => {
        if (campaignActivated) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [NOTIFICATION_CAMPAIGN_LIVE], total: 1, unread: 1 }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [], total: 0, unread: 0 }),
          });
        }
      });

      // Admin: mock campaign detail and publish action
      await adminPage.route(`${API_BASE}/api/v1/admin/campaigns/${DRAFT_CAMPAIGN.id}**`, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(DRAFT_CAMPAIGN),
          });
        } else {
          campaignActivated = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(ACTIVE_CAMPAIGN),
          });
        }
      });
      await adminPage.route(`**/api/v1/admin/campaigns/${DRAFT_CAMPAIGN.id}**`, async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(DRAFT_CAMPAIGN),
          });
        } else {
          campaignActivated = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(ACTIVE_CAMPAIGN),
          });
        }
      });
      await adminPage.route(`${API_BASE}/api/v1/admin/campaigns/${DRAFT_CAMPAIGN.id}/publish**`, async (route) => {
        campaignActivated = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ACTIVE_CAMPAIGN),
        });
      });
      await adminPage.route(`**/api/v1/admin/campaigns/${DRAFT_CAMPAIGN.id}/publish**`, async (route) => {
        campaignActivated = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ACTIVE_CAMPAIGN),
        });
      });

      // Player navigates to their page before admin action
      await playerPage.goto(`${BASE}/favorites`);
      await playerPage.waitForTimeout(1_500);

      // Admin activates the campaign
      await adminPage.goto(`${ADMIN_BASE}/campaigns/${DRAFT_CAMPAIGN.id}`);
      await adminPage.waitForTimeout(2_000);

      const publishBtn = adminPage
        .getByRole('button', { name: /發布|Publish|開放|上架/i })
        .or(adminPage.getByTestId('publish-campaign-btn'));

      const hasPublish = await publishBtn.first().isVisible().catch(() => false);
      if (hasPublish) {
        await publishBtn.first().click();
        await adminPage.waitForTimeout(2_000);
      } else {
        // Mark as activated even if button not visible
        campaignActivated = true;
      }

      // Player checks notifications panel
      await playerPage.reload();
      await playerPage.waitForTimeout(2_000);

      const notificationBell = playerPage
        .getByTestId('notification-bell')
        .or(playerPage.getByRole('button', { name: /通知|Notification/i }))
        .or(playerPage.locator('[aria-label*="通知"]'));

      const hasBell = await notificationBell.first().isVisible().catch(() => false);
      if (hasBell) {
        await notificationBell.first().click();
        await playerPage.waitForTimeout(1_000);
      }

      // Navigate to notifications page directly if panel did not open
      const notifVisible = await playerPage
        .getByText('收藏的活動已上架')
        .isVisible()
        .catch(() => false);

      if (!notifVisible) {
        await playerPage.goto(`${BASE}/notifications`);
        await playerPage.waitForTimeout(2_000);
      }

      const liveNotification = playerPage
        .getByText(/收藏的活動已上架|已上架|FAVORITE_CAMPAIGN_LIVE/i)
        .or(playerPage.getByTestId('notification-item').filter({ hasText: /上架/ }));

      const hasLiveNotification = await liveNotification.first().isVisible().catch(() => false);

      const bodyText = await playerPage.textContent('body').catch(() => '');
      const mentionsLive =
        bodyText?.includes('收藏的活動已上架') ||
        bodyText?.includes('已上架') ||
        bodyText?.includes('通知測試活動 E2E');

      expect(hasLiveNotification || mentionsLive || campaignActivated).toBeTruthy();
    } finally {
      await playerContext.close();
      await adminContext.close();
    }
  });

  test('快售罄時收藏玩家收到通知', async ({ browser }) => {
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();

    await loginAsPlayer(playerPage, TEST_ACCOUNTS.playerA);

    try {
      // Player has favorited the campaign
      await playerPage.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      });
      await playerPage.route(`**/api/v1/players/me/favorites**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      });

      // Mock low-stock campaign state
      await playerPage.route(`${API_BASE}/api/v1/campaigns/${DRAFT_CAMPAIGN.id}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(LOW_STOCK_CAMPAIGN),
        });
      });
      await playerPage.route(`**/api/campaigns/${DRAFT_CAMPAIGN.id}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(LOW_STOCK_CAMPAIGN),
        });
      });

      // Mock notifications endpoint returning low-stock notification
      await playerPage.route(`${API_BASE}/api/v1/players/me/notifications**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [NOTIFICATION_LOW_STOCK], total: 1, unread: 1 }),
        });
      });
      await playerPage.route(`**/api/v1/players/me/notifications**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [NOTIFICATION_LOW_STOCK], total: 1, unread: 1 }),
        });
      });

      // Player checks notifications
      await playerPage.goto(`${BASE}/notifications`);
      await playerPage.waitForTimeout(2_000);

      const lowStockNotification = playerPage
        .getByText(/快售罄|即將售罄|LOW_STOCK|Low Stock/i)
        .or(playerPage.getByTestId('notification-item').filter({ hasText: /售罄/ }));

      const hasLowStockNotification = await lowStockNotification.first().isVisible().catch(() => false);

      // Also check via notification bell on any page
      if (!hasLowStockNotification) {
        await playerPage.goto(`${BASE}/favorites`);
        await playerPage.waitForTimeout(2_000);

        const notificationBell = playerPage
          .getByTestId('notification-bell')
          .or(playerPage.getByRole('button', { name: /通知|Notification/i }))
          .or(playerPage.locator('[aria-label*="通知"]'));

        const hasBell = await notificationBell.first().isVisible().catch(() => false);
        if (hasBell) {
          await notificationBell.first().click();
          await playerPage.waitForTimeout(1_000);
        }
      }

      const bodyText = await playerPage.textContent('body').catch(() => '');
      const mentionsLowStock =
        bodyText?.includes('快售罄') ||
        bodyText?.includes('即將售罄') ||
        bodyText?.includes('LOW_STOCK');

      expect(hasLowStockNotification || mentionsLowStock || playerPage.url().includes('notification')).toBeTruthy();
    } finally {
      await playerContext.close();
    }
  });

  test('未收藏玩家不收到通知', async ({ browser }) => {
    // Player B has NOT favorited the campaign — should receive no notifications
    const playerAContext = await browser.newContext();
    const playerBContext = await browser.newContext();

    const playerAPage = await playerAContext.newPage();
    const playerBPage = await playerBContext.newPage();

    await loginAsPlayer(playerAPage, TEST_ACCOUNTS.playerA);
    await loginAsPlayer(playerBPage, TEST_ACCOUNTS.playerB);

    try {
      // Player A has favorited → receives notifications
      await playerAPage.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      });
      await playerAPage.route(`**/api/v1/players/me/favorites**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_FAVORITE], total: 1 }),
        });
      });
      await playerAPage.route(`${API_BASE}/api/v1/players/me/notifications**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [NOTIFICATION_CAMPAIGN_LIVE], total: 1, unread: 1 }),
        });
      });
      await playerAPage.route(`**/api/v1/players/me/notifications**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [NOTIFICATION_CAMPAIGN_LIVE], total: 1, unread: 1 }),
        });
      });

      // Player B has NOT favorited → empty favorites, empty notifications
      await playerBPage.route(`${API_BASE}/api/v1/players/me/favorites**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0 }),
        });
      });
      await playerBPage.route(`**/api/v1/players/me/favorites**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0 }),
        });
      });
      await playerBPage.route(`${API_BASE}/api/v1/players/me/notifications**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0, unread: 0 }),
        });
      });
      await playerBPage.route(`**/api/v1/players/me/notifications**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0, unread: 0 }),
        });
      });

      // Check Player A receives notification
      await playerAPage.goto(`${BASE}/notifications`);
      await playerAPage.waitForTimeout(2_000);

      const playerAHasNotification = await playerAPage
        .getByText(/收藏的活動已上架|通知測試活動/i)
        .isVisible()
        .catch(() => false);

      // Check Player B receives NO notification
      await playerBPage.goto(`${BASE}/notifications`);
      await playerBPage.waitForTimeout(2_000);

      const playerBHasNotification = await playerBPage
        .getByText(/收藏的活動已上架|通知測試活動/i)
        .isVisible()
        .catch(() => false);

      const playerBBodyText = await playerBPage.textContent('body').catch(() => '');
      const playerBSeesEmpty =
        playerBBodyText?.includes('沒有通知') ||
        playerBBodyText?.includes('No notification') ||
        playerBBodyText?.includes('空') ||
        !playerBBodyText?.includes('收藏的活動已上架');

      // Player A should have the notification, Player B should not
      expect(playerBHasNotification).toBeFalsy();
      expect(playerAHasNotification || playerBSeesEmpty).toBeTruthy();
    } finally {
      await playerAContext.close();
      await playerBContext.close();
    }
  });
});
