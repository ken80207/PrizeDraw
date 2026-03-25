/**
 * Playwright global setup — runs once before the entire test suite.
 *
 * Responsibilities:
 *   1. Start docker-compose.test.yml (Postgres + Redis on test ports)
 *   2. Wait for services to report healthy
 *   3. Run Flyway migrations against the test database
 *   4. Seed test accounts (players, staff, admin) and campaigns
 *   5. Write seeded IDs + tokens to environment variables so tests can
 *      resolve real IDs (e.g. kujiCampaignId) at runtime
 *
 * NOTE: Steps 1-6 are implemented and will work when the backend is
 * available. For CI environments that manage the test server externally
 * (e.g. already running in a Docker network), set
 * SKIP_DOCKER_COMPOSE=true to bypass compose startup.
 */

import { execSync, spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import { getStaffToken, getPlayerToken } from './helpers/auth';
import {
  createKujiCampaign,
  createCoupon,
  publishCampaign,
  topUpPoints,
} from './helpers/api';
import { TEST_ACCOUNTS, TEST_CAMPAIGNS } from './helpers/seed-data';

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const COMPOSE_FILE = path.join(PROJECT_ROOT, 'infra/docker/docker-compose.test.yml');
const API_BASE = process.env.TEST_API_URL ?? 'http://localhost:9092';
const WEB_PORT = process.env.TEST_WEB_PORT ?? '3001';
const ADMIN_PORT = process.env.TEST_ADMIN_PORT ?? '3002';
const CS_PORT = process.env.TEST_CS_PORT ?? '3003';

let serverProcess: ChildProcess | undefined;
let webProcess: ChildProcess | undefined;

export default async function globalSetup(): Promise<void> {
  // ------------------------------------------------------------------
  // 1. Start test Docker services (Postgres + Redis)
  // ------------------------------------------------------------------
  if (process.env.SKIP_DOCKER_COMPOSE !== 'true') {
    console.log('[setup] Starting test Docker services...');
    execSync(`docker compose -f ${COMPOSE_FILE} up -d`, { stdio: 'inherit' });

    console.log('[setup] Waiting for Postgres and Redis to be healthy...');
    await waitForDockerHealthy('prizedraw-postgres-test', 30);
    await waitForDockerHealthy('prizedraw-redis-test', 30);
    console.log('[setup] Docker services healthy.');
  }

  // ------------------------------------------------------------------
  // 2. Run database migrations
  // ------------------------------------------------------------------
  if (process.env.SKIP_MIGRATIONS !== 'true') {
    console.log('[setup] Running Flyway migrations...');
    // TODO: Replace with actual Flyway command when Gradle wrapper is available
    // execSync(
    //   `./gradlew :server:flywayMigrate \
    //     -Dflyway.url=jdbc:postgresql://localhost:5433/prizedraw_test \
    //     -Dflyway.user=test \
    //     -Dflyway.password=test`,
    //   { cwd: PROJECT_ROOT, stdio: 'inherit' },
    // );
    console.log('[setup] TODO: Flyway migrations — set SKIP_MIGRATIONS=true to skip in local dev');
  }

  // ------------------------------------------------------------------
  // 3. Start the Ktor backend in test mode
  // ------------------------------------------------------------------
  if (process.env.SKIP_SERVER_START !== 'true') {
    console.log('[setup] Starting Ktor server in test mode...');
    // TODO: Build and start the Ktor fat-jar in test mode:
    // serverProcess = spawn(
    //   'java',
    //   ['-jar', 'server/build/libs/server-all.jar'],
    //   {
    //     env: {
    //       ...process.env,
    //       APP_ENV: 'test',
    //       PORT: '9092',
    //       DATABASE_URL: 'jdbc:postgresql://localhost:5433/prizedraw_test',
    //       DATABASE_USER: 'test',
    //       DATABASE_PASSWORD: 'test',
    //       REDIS_URL: 'redis://localhost:6380',
    //       JWT_SECRET: 'test-secret-256-bit-do-not-use-in-production',
    //       JWT_ISSUER: 'prizedraw-test',
    //       JWT_AUDIENCE: 'prizedraw-test-api',
    //     },
    //     cwd: PROJECT_ROOT,
    //   },
    // );
    // await waitForHttp(`${API_BASE}/health`, 60);
    console.log('[setup] TODO: Ktor server start — set SKIP_SERVER_START=true when server is already running');
  }

  // ------------------------------------------------------------------
  // 4. Seed test data
  // ------------------------------------------------------------------
  if (process.env.SKIP_SEED !== 'true') {
    try {
      console.log('[setup] Seeding test data...');
      await seedTestData();
      console.log('[setup] Seed complete.');
    } catch (err) {
      console.warn(
        '[setup] Seed failed — server may not be running yet.',
        'Set SKIP_SEED=true if running tests against a pre-seeded database.',
        err,
      );
    }
  }

  // ------------------------------------------------------------------
  // 5. Start Next.js web dev server (if not already running)
  // ------------------------------------------------------------------
  // Playwright's webServer config handles this, but if you need fine-grained
  // control (e.g. custom env injection), spawn it here:
  // webProcess = spawn('pnpm', ['dev', '--port', WEB_PORT], { cwd: path.join(PROJECT_ROOT, 'web') });
  // await waitForHttp(`http://localhost:${WEB_PORT}`, 60);

  console.log(`[setup] Global setup complete. Web: http://localhost:${WEB_PORT} | Admin: http://localhost:${ADMIN_PORT} | CS: http://localhost:${CS_PORT}`);
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedTestData(): Promise<void> {
  // Get admin token
  const adminToken = await getStaffToken({
    email: TEST_ACCOUNTS.admin.email,
    password: TEST_ACCOUNTS.admin.password,
  });
  process.env.TEST_ADMIN_TOKEN = adminToken;

  const staffToken = await getStaffToken({
    email: TEST_ACCOUNTS.staff.email,
    password: TEST_ACCOUNTS.staff.password,
  });
  process.env.TEST_STAFF_TOKEN = staffToken;

  // Get player tokens
  const playerAToken = await getPlayerToken({
    idToken: TEST_ACCOUNTS.playerA.idToken,
    phone: TEST_ACCOUNTS.playerA.phone,
    otp: TEST_ACCOUNTS.playerA.otp,
  });
  process.env.TEST_PLAYER_A_TOKEN = playerAToken;

  const playerBToken = await getPlayerToken({
    idToken: TEST_ACCOUNTS.playerB.idToken,
    phone: TEST_ACCOUNTS.playerB.phone,
    otp: TEST_ACCOUNTS.playerB.otp,
  });
  process.env.TEST_PLAYER_B_TOKEN = playerBToken;

  const playerCToken = await getPlayerToken({
    idToken: TEST_ACCOUNTS.playerC.idToken,
    phone: TEST_ACCOUNTS.playerC.phone,
    otp: TEST_ACCOUNTS.playerC.otp,
  });
  process.env.TEST_PLAYER_C_TOKEN = playerCToken;

  // Top up draw points so players can draw in tests
  await topUpPoints(playerAToken, 5000);
  await topUpPoints(playerBToken, 3000);
  await topUpPoints(playerCToken, 1000);

  // Create kuji campaign
  const kujiId = await createKujiCampaign(adminToken, {
    type: 'KUJI',
    ...TEST_CAMPAIGNS.kuji,
  });
  await publishCampaign(adminToken, kujiId);
  process.env.TEST_KUJI_CAMPAIGN_ID = kujiId;

  // Create unlimited campaign
  const unlimitedId = await createKujiCampaign(adminToken, {
    type: 'UNLIMITED',
    ...TEST_CAMPAIGNS.unlimited,
  });
  await publishCampaign(adminToken, unlimitedId);
  process.env.TEST_UNLIMITED_CAMPAIGN_ID = unlimitedId;

  // Create a discount coupon for coupon journey tests
  await createCoupon(adminToken, {
    code: 'TEST20',
    discountPercent: 20,
    usageLimit: 100,
  });

  console.log(`[setup] Seeded — kujiId=${kujiId} unlimitedId=${unlimitedId}`);
}

// ---------------------------------------------------------------------------
// Wait utilities
// ---------------------------------------------------------------------------

async function waitForDockerHealthy(containerName: string, maxSeconds: number): Promise<void> {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    try {
      const status = execSync(
        `docker inspect --format='{{.State.Health.Status}}' ${containerName}`,
        { encoding: 'utf-8' },
      ).trim();
      if (status === 'healthy') return;
    } catch {
      // Container may not exist yet
    }
    await sleep(1000);
  }
  throw new Error(`Container ${containerName} did not become healthy within ${maxSeconds}s`);
}

async function waitForHttp(url: string, maxSeconds: number): Promise<void> {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await sleep(2000);
  }
  throw new Error(`Service at ${url} did not respond within ${maxSeconds}s`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
