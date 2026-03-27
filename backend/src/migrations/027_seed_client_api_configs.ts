/**
 * Migration: Seed Silulumanzi Client API Gateway Config
 *
 * Migrates the legacy AiClient.php proxy setup to the standardized
 * client API gateway system.
 *
 * Before: Enterprise endpoint target_api_url → https://softaware.net.za/AiClient.php
 *   The PHP proxy at that URL forwarded requests to portal.silulumanzi.com/api/ai/
 *
 * After: Enterprise endpoint target_api_url → https://api.softaware.net.za/api/v1/client-api/silulumanzi
 *   The TypeScript gateway reads config from SQLite and forwards to portal.silulumanzi.com/api/ai/
 *
 * Run: npx tsx src/migrations/027_seed_client_api_configs.ts
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';

const DB_PATH = '/var/opt/backend/data/enterprise_endpoints.db';

function migrate() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  console.log('[Migration 027] Seeding client API gateway configs...\n');

  // 1. Ensure table exists (the service creates it, but be safe)
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_api_configs (
      id                TEXT PRIMARY KEY,
      client_id         TEXT NOT NULL UNIQUE,
      client_name       TEXT NOT NULL,
      contact_id        INTEGER,
      endpoint_id       TEXT,
      status            TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'disabled')),
      target_base_url   TEXT NOT NULL,
      auth_type         TEXT DEFAULT 'rolling_token' CHECK(auth_type IN ('rolling_token', 'bearer', 'basic', 'api_key', 'none')),
      auth_secret       TEXT,
      auth_header       TEXT DEFAULT 'X-AI-Auth-Token',
      allowed_actions   TEXT,
      rate_limit_rpm    INTEGER DEFAULT 60,
      timeout_ms        INTEGER DEFAULT 30000,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      total_requests    INTEGER DEFAULT 0,
      last_request_at   TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS client_api_logs (
      id                TEXT PRIMARY KEY,
      config_id         TEXT NOT NULL,
      client_id         TEXT NOT NULL,
      action            TEXT NOT NULL,
      status_code       INTEGER,
      duration_ms       INTEGER,
      error_message     TEXT,
      created_at        TEXT NOT NULL,
      FOREIGN KEY (config_id) REFERENCES client_api_configs(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_client_api_client_id ON client_api_configs(client_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_client_api_status ON client_api_configs(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_client_api_logs_config ON client_api_logs(config_id, created_at)`);

  // 2. Check if Silulumanzi config already exists
  const existing = db.prepare('SELECT id FROM client_api_configs WHERE client_id = ?').get('silulumanzi');
  if (existing) {
    console.log('[Migration 027] Silulumanzi config already exists, skipping seed.\n');
  } else {
    const now = new Date().toISOString();
    const configId = `capi_silulumanzi_${crypto.randomBytes(4).toString('hex')}`;

    const allowedActions = JSON.stringify([
      'getCustomerContext',
      'checkAreaOutages',
      'reportFault',
      'getFaultStatus',
      'getFinancials',
      'getStatements',
      'addCustomerNote',
      'getMaintenanceActivities',
      'getStatementLink',
      'getVacancies',
    ]);

    db.prepare(`
      INSERT INTO client_api_configs (
        id, client_id, client_name, contact_id, endpoint_id, status,
        target_base_url, auth_type, auth_secret, auth_header,
        allowed_actions, rate_limit_rpm, timeout_ms,
        created_at, updated_at, total_requests
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      configId,
      'silulumanzi',
      'Silulumanzi Water Services',
      68,  // contact_id — SA Water Works Utilities (Pty) Ltd
      'ep_silulumanzi_91374147',
      'active',
      'https://portal.silulumanzi.com/api/ai',  // The REAL target — no more PHP proxy
      'rolling_token',
      'SILULUMANZI_AI_SHARED_SECRET_KEY_2026',
      'X-AI-Auth-Token',
      allowedActions,
      60,
      30000,
      now,
      now,
      0
    );

    console.log(`[Migration 027] ✅ Created Silulumanzi client API config: ${configId}`);
    console.log(`  Target: https://portal.silulumanzi.com/api/ai`);
    console.log(`  Auth: rolling_token via X-AI-Auth-Token`);
    console.log(`  Actions: ${JSON.parse(allowedActions).length} allowed\n`);
  }

  // 3. Update the enterprise endpoint's target_api_url
  const endpoint = db.prepare('SELECT id, target_api_url FROM enterprise_endpoints WHERE id = ?').get('ep_silulumanzi_91374147') as any;

  if (endpoint) {
    const oldUrl = endpoint.target_api_url;
    const newUrl = 'https://api.softaware.net.za/api/v1/client-api/silulumanzi';

    if (oldUrl === newUrl) {
      console.log('[Migration 027] Enterprise endpoint target_api_url already updated.\n');
    } else {
      db.prepare('UPDATE enterprise_endpoints SET target_api_url = ?, updated_at = ? WHERE id = ?')
        .run(newUrl, new Date().toISOString(), 'ep_silulumanzi_91374147');

      console.log(`[Migration 027] ✅ Updated enterprise endpoint target_api_url:`);
      console.log(`  Old: ${oldUrl}`);
      console.log(`  New: ${newUrl}\n`);
    }
  } else {
    console.log('[Migration 027] ⚠️  Enterprise endpoint ep_silulumanzi_91374147 not found.\n');
  }

  db.close();
  console.log('[Migration 027] Done.\n');
}

migrate();
