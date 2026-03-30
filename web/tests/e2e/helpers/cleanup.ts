/**
 * Database cleanup for E2E test isolation.
 * Truncates all tables (except flyway_schema_history) before seeding.
 */

import { execSync } from 'child_process';

const TEST_DB_CONTAINER = 'prizedraw-postgres'; // dev container, not test
const TEST_DB_USER = 'prizedraw';
const TEST_DB_NAME = 'prizedraw';

export async function truncateAllTables(): Promise<void> {
  // Get all table names except flyway
  // Then TRUNCATE them all with CASCADE
  // Use docker exec to run psql

  const tables = execSync(
    `docker exec -i ${TEST_DB_CONTAINER} psql -U ${TEST_DB_USER} -d ${TEST_DB_NAME} -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'flyway_schema_history'"`,
    { encoding: 'utf-8' },
  )
    .trim()
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  if (tables.length === 0) return;

  const truncateSQL = `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE;`;

  execSync(
    `docker exec -i ${TEST_DB_CONTAINER} psql -U ${TEST_DB_USER} -d ${TEST_DB_NAME} -c "${truncateSQL}"`,
    { encoding: 'utf-8' },
  );

  console.log(`[cleanup] Truncated ${tables.length} tables`);
}
