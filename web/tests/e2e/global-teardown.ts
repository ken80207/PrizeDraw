/**
 * Playwright global teardown — runs once after the entire test suite.
 *
 * Responsibilities:
 *   1. Stop the Next.js dev server (if spawned by global-setup)
 *   2. Stop the Ktor backend server (if spawned by global-setup)
 *   3. Stop and remove the test Docker services (Postgres + Redis)
 *   4. Clean up any temporary files written during setup
 */

import { execSync } from 'child_process';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const COMPOSE_FILE = path.join(PROJECT_ROOT, 'infra/docker/docker-compose.test.yml');

export default async function globalTeardown(): Promise<void> {
  console.log('[teardown] Starting global teardown...');

  // ------------------------------------------------------------------
  // 1. Stop Docker test services
  // ------------------------------------------------------------------
  if (process.env.SKIP_DOCKER_COMPOSE !== 'true') {
    try {
      console.log('[teardown] Stopping test Docker services...');
      execSync(`docker compose -f ${COMPOSE_FILE} down --volumes --remove-orphans`, {
        stdio: 'inherit',
      });
      console.log('[teardown] Docker services stopped.');
    } catch (err) {
      // Non-fatal — the container may already be stopped
      console.warn('[teardown] docker compose down encountered an error (may be safe to ignore):', err);
    }
  }

  // ------------------------------------------------------------------
  // 2. Clean up test environment variables written during setup
  // ------------------------------------------------------------------
  const envKeys = [
    'TEST_KUJI_CAMPAIGN_ID',
    'TEST_UNLIMITED_CAMPAIGN_ID',
    'TEST_PLAYER_A_TOKEN',
    'TEST_PLAYER_B_TOKEN',
    'TEST_PLAYER_C_TOKEN',
    'TEST_ADMIN_TOKEN',
    'TEST_STAFF_TOKEN',
  ];

  for (const key of envKeys) {
    delete process.env[key];
  }

  console.log('[teardown] Global teardown complete.');
}
