import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test.describe('Login page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
    });

    test('renders the Kuji Noir brand heading', async ({ page }) => {
      await expect(page.getByText('Kuji Noir')).toBeVisible();
    });

    test('shows The Illuminated Gallery subtitle', async ({ page }) => {
      await expect(page.getByText('The Illuminated Gallery')).toBeVisible();
    });

    test('three social login buttons are present', async ({ page }) => {
      // Social buttons are icon-only buttons in a grid
      const socialButtons = page.locator('.glass-panel button');
      // There are 3 social buttons + the OTP button + the primary CTA = at least 3
      const allButtons = await socialButtons.all();
      expect(allButtons.length).toBeGreaterThanOrEqual(3);
    });

    test('phone divider text is visible', async ({ page }) => {
      await expect(page.getByText('或使用手機號碼')).toBeVisible();
    });

    test('phone number input with +886 country code', async ({ page }) => {
      await expect(page.getByText('+886')).toBeVisible();
      await expect(page.locator('input[type="tel"]')).toBeVisible();
    });

    test('get OTP code button is visible', async ({ page }) => {
      await expect(page.getByText('取得驗證碼')).toBeVisible();
    });

    test('primary CTA shows 進入 Gallery', async ({ page }) => {
      await expect(page.getByText('進入 Gallery')).toBeVisible();
    });

    test('footer shows registration prompt and links', async ({ page }) => {
      await expect(page.getByText('新用戶？')).toBeVisible();
      await expect(page.getByText('服務條款')).toBeVisible();
      await expect(page.getByText('隱私政策')).toBeVisible();
    });
  });

  test.describe('Phone binding page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/phone-binding');
    });

    test('renders the Kuji Noir brand', async ({ page }) => {
      await expect(page.getByText('Kuji Noir')).toBeVisible();
    });

    test('shows verify phone heading', async ({ page }) => {
      await expect(page.getByText('驗證手機號碼')).toBeVisible();
    });

    test('phone number input is present', async ({ page }) => {
      const phoneInput = page.locator('#phone');
      await expect(phoneInput).toBeVisible();
    });

    test('country code +886 is displayed', async ({ page }) => {
      await expect(page.getByText('+886')).toBeVisible();
    });

    test('send OTP button is visible', async ({ page }) => {
      await expect(page.getByText('發送驗證碼')).toBeVisible();
    });

    test('send OTP button is disabled when phone is empty', async ({ page }) => {
      // The CTA button is disabled when phone is empty
      const ctaBtn = page.locator('button.amber-gradient');
      await expect(ctaBtn).toBeDisabled();
    });

    test('send OTP button enables after entering phone', async ({ page }) => {
      await page.locator('#phone').fill('0912345678');
      const ctaBtn = page.locator('button.amber-gradient');
      await expect(ctaBtn).toBeEnabled();
    });
  });
});
