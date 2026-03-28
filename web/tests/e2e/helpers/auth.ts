import { type Page } from '@playwright/test';
import { TEST_ACCOUNTS } from './seed-data';

const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:9092';

/**
 * Build a mock PlayerDto matching the server contract.
 */
function mockPlayerDto(account: { idToken: string; phone: string; nickname: string }) {
  return {
    id: `player-${account.idToken}`,
    nickname: account.nickname,
    avatarUrl: null,
    phoneNumber: account.phone,
    drawPointsBalance: 5000,
    revenuePointsBalance: 200,
    preferredAnimationMode: 'NORMAL',
    locale: 'zh-TW',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Log in as a player for E2E tests.
 *
 * The app uses Zustand (in-memory) for auth state. The store is exposed
 * on `window.__AUTH_STORE__` in non-production builds.
 *
 * Strategy:
 * 1. Register an `addInitScript` that runs on EVERY page load to inject
 *    auth state into the Zustand store as soon as it's available.
 * 2. Also mock /api/v1/auth/refresh so token rotation doesn't fail.
 *
 * This ensures auth persists across `page.goto()` navigations.
 */
export async function loginAsPlayer(
  page: Page,
  account: (typeof TEST_ACCOUNTS)[keyof Pick<
    typeof TEST_ACCOUNTS,
    'playerA' | 'playerB' | 'playerC'
  >],
): Promise<void> {
  const acct = account as { idToken: string; phone: string; otp: string; nickname: string };
  let token: string;

  try {
    token = await getPlayerToken(acct);
  } catch {
    token = `mock-jwt-${acct.idToken}`;
  }

  const player = mockPlayerDto(acct);
  const refreshToken = `mock-refresh-${acct.idToken}`;

  // Mock /api/v1/auth/refresh
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: token, refreshToken, expiresIn: 3600 }),
    });
  });

  // Register init script that injects auth state on EVERY page load.
  // Uses MutationObserver to detect when the Zustand store becomes available
  // (since module execution order is unpredictable).
  await page.addInitScript(
    ({ mockPlayer, mockToken, mockRefreshToken }) => {
      // Poll for the Zustand store to be available (modules may not have loaded yet)
      const inject = () => {
        const store = (window as Record<string, unknown>).__AUTH_STORE__ as
          | { getState: () => { setSession: (p: unknown, t: string, rt: string) => void; isAuthenticated: boolean } }
          | undefined;
        if (store?.getState && !store.getState().isAuthenticated) {
          store.getState().setSession(mockPlayer, mockToken, mockRefreshToken);
          return true;
        }
        return false;
      };

      // Try immediately (in case store is already available)
      if (!inject()) {
        // Poll at short intervals until the store is ready
        const interval = setInterval(() => {
          if (inject()) clearInterval(interval);
        }, 50);
        // Stop polling after 10 seconds
        setTimeout(() => clearInterval(interval), 10_000);
      }
    },
    { mockPlayer: player, mockToken: token, mockRefreshToken: refreshToken },
  );
}

/**
 * Log in as admin.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('accessToken', 'mock-admin-jwt-token');
      localStorage.setItem('adminRole', 'ADMIN');
    } catch { /* noop */ }
    document.cookie = 'accessToken=mock-admin-jwt-token; path=/; SameSite=Lax';
  });

  const adminBase = process.env.TEST_ADMIN_URL ?? 'http://localhost:3002';
  try {
    await page.goto(`${adminBase}/login`, { timeout: 5_000 });
    await page.fill('[name="email"]', TEST_ACCOUNTS.admin.email);
    await page.fill('[name="password"]', TEST_ACCOUNTS.admin.password);
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL(`${adminBase}/dashboard`, { timeout: 10_000 });
  } catch {
    // Admin app not running — token already injected
  }
}

/**
 * Log in as customer-service staff.
 */
export async function loginAsCS(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('accessToken', 'mock-staff-jwt-token');
      localStorage.setItem('staffRole', 'CUSTOMER_SERVICE');
    } catch { /* noop */ }
    document.cookie = 'accessToken=mock-staff-jwt-token; path=/; SameSite=Lax';
  });

  const csBase = process.env.TEST_CS_URL ?? 'http://localhost:3003';
  try {
    await page.goto(`${csBase}/login`, { timeout: 5_000 });
    await page.fill('[name="email"]', TEST_ACCOUNTS.staff.email);
    await page.fill('[name="password"]', TEST_ACCOUNTS.staff.password);
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL(`${csBase}/tickets`, { timeout: 10_000 });
  } catch {
    // CS app not running — token already injected
  }
}

/**
 * Obtain a JWT for a player account by hitting the test-mode OAuth endpoint.
 */
export async function getPlayerToken(account: {
  idToken: string;
  phone: string;
  otp: string;
}): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/auth/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'GOOGLE', idToken: account.idToken }),
  });

  if (!response.ok) {
    throw new Error(
      `getPlayerToken: auth endpoint returned ${response.status} — is the server running in test mode?`,
    );
  }

  const data = (await response.json()) as { accessToken?: string; token?: string };
  const token = data.accessToken ?? data.token;
  if (!token) throw new Error('getPlayerToken: no token in response body');
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
  if (!token) throw new Error('getStaffToken: no token in response body');
  return token;
}
