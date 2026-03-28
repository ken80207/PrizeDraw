import { test, expect } from '@playwright/test';

test.describe('Support page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/support');
  });

  test('support page loads with correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: '客服中心' })).toBeVisible();
  });

  test('shows correct subtitle text', async ({ page }) => {
    await expect(page.getByText('管理你的問題與賞品申訴。')).toBeVisible();
  });

  test('create new ticket link is visible in header', async ({ page }) => {
    // The header button is a <Link> rendered as an <a>
    await expect(page.getByRole('link', { name: /建立新工單/ }).first()).toBeVisible();
  });

  test('create new ticket link points to /support/new', async ({ page }) => {
    const link = page.getByRole('link', { name: /建立新工單/ }).first();
    await expect(link).toHaveAttribute('href', '/support/new');
  });

  test('active cases section header is visible', async ({ page }) => {
    await expect(page.getByText('進行中的工單')).toBeVisible();
    await expect(page.getByText('排序：最近')).toBeVisible();
  });

  test('renders list, empty state, or error after loading', async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasEmptyState = await page.getByText('目前沒有客服工單').isVisible().catch(() => false);
    const hasTickets = await page.locator('a[href^="/support/"]').count() > 0;
    const hasError = await page.getByText('重試').isVisible().catch(() => false);
    expect(hasEmptyState || hasTickets || hasError).toBeTruthy();
  });

  test('empty state shows correct title and description', async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasEmptyState = await page.getByText('目前沒有客服工單').isVisible().catch(() => false);
    if (hasEmptyState) {
      await expect(page.getByText('目前沒有客服工單')).toBeVisible();
      await expect(page.getByText('遇到任何問題？建立工單讓我們協助你！')).toBeVisible();
      // The empty state action is a <button> (via EmptyState component)
      await expect(page.getByRole('button', { name: '建立新工單' })).toBeVisible();
    }
  });

  test('error state shows retry button', async ({ page }) => {
    await page.waitForTimeout(2000);
    const hasError = await page.getByText('重試').isVisible().catch(() => false);
    if (hasError) {
      await expect(page.getByRole('button', { name: '重試' })).toBeVisible();
    }
  });

  test('create new ticket link navigates to /support/new', async ({ page }) => {
    await page.getByRole('link', { name: /建立新工單/ }).first().click();
    await expect(page).toHaveURL('/support/new');
  });
});

test.describe('Create ticket page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/support/new');
  });

  test('create new ticket page loads with correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: '新建客服工單' })).toBeVisible();
  });

  test('back link shows "客服中心" and points to /support', async ({ page }) => {
    const backLink = page.getByRole('link', { name: '客服中心' });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/support');
  });

  test('page description is visible', async ({ page }) => {
    await expect(page.getByText('描述你的問題，我們的團隊將盡快回覆。')).toBeVisible();
  });

  test('category section label is visible', async ({ page }) => {
    await expect(page.getByText('問題類別')).toBeVisible();
  });

  test('all six category buttons are displayed', async ({ page }) => {
    await expect(page.getByRole('button', { name: /交易爭議/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /抽獎問題/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /帳戶問題/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /寄送問題/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /付款問題/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /其他/ })).toBeVisible();
  });

  test('subject input is present via id', async ({ page }) => {
    await expect(page.locator('#subject')).toBeVisible();
  });

  test('body textarea is present via id', async ({ page }) => {
    await expect(page.locator('#body')).toBeVisible();
  });

  test('subject label text is visible', async ({ page }) => {
    // Label uses htmlFor="subject" with text "主旨" and a child "*" span
    await expect(page.locator('label[for="subject"]')).toContainText('主旨');
  });

  test('description label text is visible', async ({ page }) => {
    // Label uses htmlFor="body" with text "問題描述" and a child "*" span
    await expect(page.locator('label[for="body"]')).toContainText('問題描述');
  });

  test('submit button is present and initially disabled', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: '送出工單' });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();
  });

  test('cancel link navigates back to /support', async ({ page }) => {
    await page.getByRole('link', { name: '取消' }).click();
    await expect(page).toHaveURL('/support');
  });

  test('submit button enables when subject and body are filled', async ({ page }) => {
    await page.locator('#subject').fill('測試問題標題');
    await page.locator('#body').fill('這是測試問題的詳細描述內容，用於驗證表單功能是否正常運作。');
    const submitBtn = page.getByRole('button', { name: '送出工單' });
    await expect(submitBtn).toBeEnabled();
  });

  test('submit button remains disabled with only subject filled', async ({ page }) => {
    await page.locator('#subject').fill('只填主旨');
    const submitBtn = page.getByRole('button', { name: '送出工單' });
    await expect(submitBtn).toBeDisabled();
  });

  test('submit button remains disabled with only body filled', async ({ page }) => {
    await page.locator('#body').fill('只填描述內容');
    const submitBtn = page.getByRole('button', { name: '送出工單' });
    await expect(submitBtn).toBeDisabled();
  });

  test('selecting a category highlights it with amber inset shadow', async ({ page }) => {
    const tradeBtn = page.getByRole('button', { name: /交易爭議/ });
    await tradeBtn.click();
    // Active category uses inset box-shadow, not a border class
    await expect(tradeBtn).toHaveClass(/shadow-\[inset_0_0_0_1px_rgba\(255,193,116,0\.4\)\]/);
  });

  test('previously selected category loses active styling when another is chosen', async ({ page }) => {
    const tradeBtn = page.getByRole('button', { name: /交易爭議/ });
    const drawBtn = page.getByRole('button', { name: /抽獎問題/ });
    await tradeBtn.click();
    await drawBtn.click();
    await expect(drawBtn).toHaveClass(/shadow-\[inset_0_0_0_1px_rgba\(255,193,116,0\.4\)\]/);
    await expect(tradeBtn).not.toHaveClass(/shadow-\[inset_0_0_0_1px_rgba\(255,193,116,0\.4\)\]/);
  });

  test('character counter shows for subject input', async ({ page }) => {
    await page.locator('#subject').fill('測試');
    // Counter format: "{n}/200"
    await expect(page.getByText(/\/200/)).toBeVisible();
  });

  test('character counter reflects actual character count', async ({ page }) => {
    await page.locator('#subject').fill('測試文字');
    await expect(page.getByText('4/200')).toBeVisible();
  });
});
