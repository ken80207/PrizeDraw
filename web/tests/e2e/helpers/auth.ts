import { type Page } from '@playwright/test';
import { TEST_ACCOUNTS } from './seed-data';

const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:9092';

/**
 * Log in as a player by injecting the pre-obtained JWT into localStorage /
 * cookies so that the Next.js app treats the session as authenticated.
 *
 * In test mode the server accepts `idToken: "test-player-*-token"` directly
 * via POST /api/v1/auth/oauth without contacting Google — the mock OAuth
 * handler is enabled when the server starts with APP_ENV=test.
 */
export async function loginAsPlayer(
  page: Page,
  account: (typeof TEST_ACCOUNTS)[keyof Pick<
    typeof TEST_ACCOUNTS,
    'playerA' | 'playerB' | 'playerC'
  >],
): Promise<void> {
  // Obtain a real JWT by calling the auth endpoint directly (faster than UI)
  const token = await getPlayerToken(account as { idToken: string; phone: string; otp: string });

  await page.addInitScript((accessToken: string) => {
    // Store in both localStorage and a cookie so all auth strategies are covered
    try {
      localStorage.setItem('accessToken', accessToken);
    } catch {
      // localStorage may be unavailable in some contexts
    }
    document.cookie = `accessToken=${accessToken}; path=/; SameSite=Lax`;
  }, token);
}

/**
 * Log in as admin by navigating to the admin login page and filling credentials.
 * Admin app runs at http://localhost:3002 in test mode.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  const adminBase = process.env.TEST_ADMIN_URL ?? 'http://localhost:3002';
  await page.goto(`${adminBase}/login`);
  await page.fill('[name="email"]', TEST_ACCOUNTS.admin.email);
  await page.fill('[name="password"]', TEST_ACCOUNTS.admin.password);
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL(`${adminBase}/dashboard`, { timeout: 10_000 });
}

/**
 * Log in as customer-service staff.
 * CS app runs at http://localhost:3003 in test mode.
 */
export async function loginAsCS(page: Page): Promise<void> {
  const csBase = process.env.TEST_CS_URL ?? 'http://localhost:3003';
  await page.goto(`${csBase}/login`);
  await page.fill('[name="email"]', TEST_ACCOUNTS.staff.email);
  await page.fill('[name="password"]', TEST_ACCOUNTS.staff.password);
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL(`${csBase}/tickets`, { timeout: 10_000 });
}

/**
 * Obtain a JWT for a player account by hitting the test-mode OAuth endpoint
 * directly, bypassing the Google OAuth provider entirely.
 */
export async function getPlayerToken(account: {
  idToken: string;
  phone: string;
  otp: string;
}): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/auth/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'GOOGLE',
      idToken: account.idToken,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `getPlayerToken: auth endpoint returned ${response.status} — is the server running in test mode (APP_ENV=test)?`,
    );
  }

  const data = (await response.json()) as { accessToken?: string; token?: string };
  const token = data.accessToken ?? data.token;

  if (!token) {
    throw new Error('getPlayerToken: no token in response body');
  }

  return token;
}

/**
 * Obtain a JWT for a staff / admin account using email + password credentials.
 */
export async function getStaffToken(credentials: {
  email: string;
  password: string;
}): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(`getStaffToken: auth endpoint returned ${response.status}`);
  }

  const data = (await response.json()) as { accessToken?: string; token?: string };
  const token = data.accessToken ?? data.token;

  if (!token) {
    throw new Error('getStaffToken: no token in response body');
  }

  return token;
}
