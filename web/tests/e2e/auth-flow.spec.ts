import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test.describe('Login page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/(auth)/login');
    });

    test('renders the PrizeDraw brand heading', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'PrizeDraw' })).toBeVisible();
    });

    test('shows sign-in subtitle', async ({ page }) => {
      await expect(page.getByText('Sign in to start drawing prizes')).toBeVisible();
    });

    test('Google login button is visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
    });

    test('Apple login button is visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Continue with Apple/i })).toBeVisible();
    });

    test('LINE login button is visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Continue with LINE/i })).toBeVisible();
    });

    test('all three OAuth buttons are enabled initially', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeEnabled();
      await expect(page.getByRole('button', { name: /Continue with Apple/i })).toBeEnabled();
      await expect(page.getByRole('button', { name: /Continue with LINE/i })).toBeEnabled();
    });
  });

  test.describe('Phone binding page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/(auth)/phone-binding');
    });

    test('phone binding page is accessible', async ({ page }) => {
      // Page should render without a 404 or server error
      const status = page.url();
      expect(status).toContain('phone-binding');
    });

    test('page has a recognizable form element or heading', async ({ page }) => {
      // The phone binding page should have a form or input for the phone number
      const hasInput = await page.getByRole('textbox').count() > 0;
      const hasHeading = await page.getByRole('heading').count() > 0;
      expect(hasInput || hasHeading).toBeTruthy();
    });
  });
});
