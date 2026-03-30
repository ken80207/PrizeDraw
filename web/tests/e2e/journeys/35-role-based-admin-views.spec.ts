/**
 * Journey 35 — Role-Based Admin Sidebar Views
 *
 * Verifies that different admin roles (CUSTOMER_SERVICE, OPERATOR, ADMIN)
 * see different sidebar navigation items based on the role hierarchy
 * defined in admin/src/lib/roles.ts.
 */

import { test, expect } from '@playwright/test';

const ADMIN_BASE = process.env.TEST_ADMIN_URL ?? 'http://localhost:3001';

function injectRole(role: string, staffId: string, name: string) {
  return (page: import('@playwright/test').Page) =>
    page.addInitScript(
      ([r, id, n]: string[]) => {
        sessionStorage.setItem('adminRole', r);
        sessionStorage.setItem('adminStaffId', id);
        sessionStorage.setItem('adminStaffName', n);
        sessionStorage.setItem('adminAccessToken', 'mock-e2e-token');
      },
      [role, staffId, name],
    );
}

test.describe('角色權限側邊欄驗證', () => {
  test('客服人員只看到 4 項功能', async ({ page }) => {
    await injectRole(
      'CUSTOMER_SERVICE',
      '00000000-0000-0000-0000-000000000903',
      'E2E 客服',
    )(page);

    await page.goto(`${ADMIN_BASE}/dashboard`);
    await page.waitForTimeout(1500);

    // Should see (minRole: CUSTOMER_SERVICE)
    await expect(page.getByRole('link', { name: /總覽/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /出貨管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /玩家管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /排行榜/ })).toBeVisible();

    // Should NOT see (minRole: OPERATOR or higher)
    await expect(page.getByRole('link', { name: /活動管理/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /等級模板/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /交易監控/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /賞品管理/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /優惠券/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /輪播橫幅/ })).not.toBeVisible();

    // Should NOT see (minRole: ADMIN)
    await expect(page.getByRole('link', { name: /提領審核/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /金流紀錄/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /人員管理/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /稽核紀錄/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Feature Flags/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /系統設定/ })).not.toBeVisible();
  });

  test('營運員工看到營運功能但不看到管理功能', async ({ page }) => {
    await injectRole(
      'OPERATOR',
      '00000000-0000-0000-0000-000000000902',
      'E2E 營運員工',
    )(page);

    await page.goto(`${ADMIN_BASE}/dashboard`);
    await page.waitForTimeout(1500);

    // Should see (minRole: OPERATOR)
    await expect(page.getByRole('link', { name: /活動管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /等級模板/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /交易監控/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /賞品管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /優惠券/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /輪播橫幅/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /公告管理/ })).toBeVisible();

    // Should also see CS-level items
    await expect(page.getByRole('link', { name: /總覽/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /出貨管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /玩家管理/ })).toBeVisible();

    // Should NOT see (minRole: ADMIN)
    await expect(page.getByRole('link', { name: /提領審核/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /金流紀錄/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /人員管理/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /稽核紀錄/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /Feature Flags/ })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /系統設定/ })).not.toBeVisible();
  });

  test('管理員看到全部功能', async ({ page }) => {
    await injectRole(
      'ADMIN',
      '00000000-0000-0000-0000-000000000901',
      'E2E 管理員',
    )(page);

    await page.goto(`${ADMIN_BASE}/dashboard`);
    await page.waitForTimeout(1500);

    // Should see ALL items including admin-only
    await expect(page.getByRole('link', { name: /總覽/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /活動管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /提領審核/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /金流紀錄/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /人員管理/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /稽核紀錄/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Feature Flags/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /系統設定/ })).toBeVisible();
  });

  test('客服直接訪問人員管理頁面被阻擋', async ({ page }) => {
    await injectRole(
      'CUSTOMER_SERVICE',
      '00000000-0000-0000-0000-000000000903',
      'E2E 客服',
    )(page);

    await page.goto(`${ADMIN_BASE}/staff`);
    await page.waitForTimeout(2000);

    // The sidebar should NOT show 人員管理 link
    await expect(page.getByRole('link', { name: /人員管理/ })).not.toBeVisible();

    // The page content should either:
    // - Be redirected to dashboard
    // - Show no staff management content
    // - Show access denied
    const url = page.url();
    const bodyText = await page.textContent('body') ?? '';

    const isRedirected = !url.includes('/staff');
    const hasNoContent = bodyText.length < 200; // nearly empty page
    const hasAccessDenied = /權限不足|Access Denied|Unauthorized/i.test(bodyText);

    expect(isRedirected || hasNoContent || hasAccessDenied).toBeTruthy();
  });
});
