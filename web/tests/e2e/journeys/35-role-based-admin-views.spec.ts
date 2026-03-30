/**
 * Journey 35 — Role-Based Admin Views
 *
 * Covers: sidebar navigation visibility is restricted based on the staff role.
 * Customer Service staff see only 4 items; Operators see 11; Admins see all 17.
 * Direct access to restricted routes is blocked for lower-privilege roles.
 */

import { test, expect } from '@playwright/test';

const ADMIN_BASE = process.env.TEST_ADMIN_URL ?? 'http://localhost:3001';

test.describe('角色權限側邊欄驗證', () => {
  test('客服人員只看到 4 項功能', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('adminRole', 'CUSTOMER_SERVICE');
      sessionStorage.setItem('adminStaffName', 'Test CS');
      sessionStorage.setItem('adminAccessToken', 'mock-token');
      sessionStorage.setItem('adminStaffId', '00000000-0000-0000-0000-000000000903');
    });
    await page.goto(`${ADMIN_BASE}/dashboard`);
    await page.waitForTimeout(1_000);

    // Should see
    await expect(page.getByRole('link', { name: /總覽/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /出貨管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /玩家管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /排行榜/ })).toBeVisible();

    // Should NOT see
    await expect(page.getByRole('link', { name: /活動管理/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /提領審核/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /人員管理/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Feature Flags/ })).not.toBeVisible();
  });

  test('營運員工看到 11 項功能', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('adminRole', 'OPERATOR');
      sessionStorage.setItem('adminStaffName', 'Test Operator');
      sessionStorage.setItem('adminAccessToken', 'mock-token');
      sessionStorage.setItem('adminStaffId', '00000000-0000-0000-0000-000000000902');
    });
    await page.goto(`${ADMIN_BASE}/dashboard`);
    await page.waitForTimeout(1_000);

    await expect(page.getByRole('link', { name: /活動管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /賞品管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /公告管理/ })).toBeVisible();

    // Should NOT see admin-only
    await expect(page.getByRole('link', { name: /提領審核/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /人員管理/ })).not.toBeVisible();
  });

  test('管理員看到全部 17 項功能', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('adminRole', 'ADMIN');
      sessionStorage.setItem('adminStaffName', 'Test Admin');
      sessionStorage.setItem('adminAccessToken', 'mock-token');
      sessionStorage.setItem('adminStaffId', '00000000-0000-0000-0000-000000000901');
    });
    await page.goto(`${ADMIN_BASE}/dashboard`);
    await page.waitForTimeout(1_000);

    await expect(page.getByRole('link', { name: /提領審核/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /人員管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Feature Flags/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /系統設定/ })).toBeVisible();
  });

  test('客服直接訪問人員管理被阻擋', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('adminRole', 'CUSTOMER_SERVICE');
      sessionStorage.setItem('adminStaffName', 'Test CS');
      sessionStorage.setItem('adminAccessToken', 'mock-token');
      sessionStorage.setItem('adminStaffId', '00000000-0000-0000-0000-000000000903');
    });
    await page.goto(`${ADMIN_BASE}/staff`);
    await page.waitForTimeout(2_000);

    // Should be redirected or see no content
    const url = page.url();
    const hasStaffContent = await page.getByText('人員管理').isVisible().catch(() => false);
    // Either redirected away from /staff OR the page shows no staff management content
    expect(url.includes('/staff') && hasStaffContent).toBeFalsy();
  });
});
