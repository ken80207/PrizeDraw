import { test, expect } from '@playwright/test';

test.describe('Support page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/support');
  });

  test('support page loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '客服中心' })).toBeVisible();
  });

  test('shows subtitle text', async ({ page }) => {
    await expect(page.getByText('查看你的客服工單和回覆記錄')).toBeVisible();
  });

  test('create new ticket link is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /建立新工單/ })).toBeVisible();
  });

  test('create new ticket link points to /support/new', async ({ page }) => {
    const link = page.getByRole('link', { name: /建立新工單/ });
    await expect(link).toHaveAttribute('href', '/support/new');
  });

  test('renders list, empty state, or error after loading', async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasEmptyState = await page.getByText('目前沒有客服工單').isVisible().catch(() => false);
    const hasTickets = await page.locator('a[href^="/support/"]').count() > 0;
    const hasError = await page.getByText('載入工單失敗').isVisible().catch(() => false);
    expect(hasEmptyState || hasTickets || hasError).toBeTruthy();
  });

  test('create new ticket button navigates to /support/new', async ({ page }) => {
    await page.getByRole('link', { name: /建立新工單/ }).click();
    await expect(page).toHaveURL('/support/new');
  });
});

test.describe('Create ticket page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/support/new');
  });

  test('create new ticket page loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '建立新工單' })).toBeVisible();
  });

  test('back link is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /返回客服中心/ })).toBeVisible();
  });

  test('category section is visible', async ({ page }) => {
    await expect(page.getByText('問題類別')).toBeVisible();
  });

  test('category buttons are displayed', async ({ page }) => {
    await expect(page.getByRole('button', { name: /交易爭議/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /抽獎問題/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /帳戶問題/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /寄送問題/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /付款問題/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /其他/ })).toBeVisible();
  });

  test('subject input is present', async ({ page }) => {
    await expect(page.getByLabel(/主旨/)).toBeVisible();
  });

  test('body textarea is present', async ({ page }) => {
    await expect(page.getByLabel(/問題描述/)).toBeVisible();
  });

  test('submit button is present and initially disabled', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: '送出工單' });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();
  });

  test('cancel button navigates back to support', async ({ page }) => {
    await page.getByRole('link', { name: '取消' }).click();
    await expect(page).toHaveURL('/support');
  });

  test('submit button enables when form is filled', async ({ page }) => {
    await page.getByLabel(/主旨/).fill('測試問題標題');
    await page.getByLabel(/問題描述/).fill('這是測試問題的詳細描述內容，用於驗證表單功能是否正常運作。');
    const submitBtn = page.getByRole('button', { name: '送出工單' });
    await expect(submitBtn).toBeEnabled();
  });

  test('selecting a category highlights it', async ({ page }) => {
    const tradeBtn = page.getByRole('button', { name: /交易爭議/ });
    await tradeBtn.click();
    // After clicking, it should have the active styling (border-indigo-500)
    await expect(tradeBtn).toHaveClass(/border-indigo-500/);
  });

  test('character count shows for subject', async ({ page }) => {
    const subjectInput = page.getByLabel(/主旨/);
    await subjectInput.fill('測試');
    await expect(page.getByText(/\/200/)).toBeVisible();
  });
});
