/**
 * Client API Gateway — Standardized Enterprise Client API Proxy
 *
 * Replaces the legacy pattern of placing client-specific PHP/Python/etc. proxy
 * files in random web-accessible locations (e.g., https://softaware.net.za/AiClient.php).
 *
 * Instead, all client API proxies are served through a single, standardized
 * TypeScript gateway at:
 *
 *     POST /api/v1/client-api/:clientId/:action
 *
 * Each client's configuration (target URL, secret key, allowed actions, auth type)
 * is stored in the `client_api_configs` table in the enterprise_endpoints SQLite DB.
 *
 * Benefits:
 *   • Single language (TypeScript) — no PHP/Python proxy files scattered around
 *   • Database-driven — add new clients without code changes
 *   • Centralized logging, auth, and error handling
 *   • Standardized URL patterns for all clients
 *   • Admin UI management via /admin/client-api-configs
 *
 * @module clientApiGateway
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Database — Reuses enterprise_endpoints.db with a new table
// ---------------------------------------------------------------------------
const DB_DIR = path.resolve('/var/opt/backend/data');
const DB_PATH = path.join(DB_DIR, 'enterprise_endpoints.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');

  // Create the client API configs table
  _db.exec(`
    CREATE TABLE IF NOT EXISTS client_api_configs (
      id                TEXT PRIMARY KEY,
      client_id         TEXT NOT NULL UNIQUE,
      client_name       TEXT NOT NULL,
      contact_id        INTEGER,
      endpoint_id       TEXT,
      status            TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'disabled')),
      
      -- Target API (the real client server we proxy to)
      target_base_url   TEXT NOT NULL,
      
      -- Authentication to the target
      auth_type         TEXT DEFAULT 'rolling_token' CHECK(auth_type IN ('rolling_token', 'bearer', 'basic', 'api_key', 'none')),
      auth_secret       TEXT,
      auth_header       TEXT DEFAULT 'X-AI-Auth-Token',
      
      -- Allowed actions (JSON array of strings, null = allow all)
      allowed_actions   TEXT,
      
      -- Rate limiting
      rate_limit_rpm    INTEGER DEFAULT 60,
      
      -- Request config
      timeout_ms        INTEGER DEFAULT 30000,
      
      -- Metadata
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      total_requests    INTEGER DEFAULT 0,
      last_request_at   TEXT
    )
  `);

  _db.exec(`
    CREATE INDEX IF NOT EXISTS idx_client_api_client_id ON client_api_configs(client_id);
    CREATE INDEX IF NOT EXISTS idx_client_api_status ON client_api_configs(status);
  `);

  // Request log for client API calls
  _db.exec(`
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

  _db.exec(`
    CREATE INDEX IF NOT EXISTS idx_client_api_logs_config ON client_api_logs(config_id, created_at);
  `);

  console.log('[ClientApiGateway] Database tables initialized');
  return _db;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientApiConfig {
  id: string;
  client_id: string;
  client_name: string;
  contact_id: number | null;
  endpoint_id: string | null;
  status: 'active' | 'paused' | 'disabled';
  target_base_url: string;
  auth_type: 'rolling_token' | 'bearer' | 'basic' | 'api_key' | 'none';
  auth_secret: string | null;
  auth_header: string;
  allowed_actions: string | null;
  rate_limit_rpm: number;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
  total_requests: number;
  last_request_at: string | null;
}

export interface ClientApiConfigInput {
  client_id: string;
  client_name: string;
  contact_id?: number;
  endpoint_id?: string;
  target_base_url: string;
  auth_type?: string;
  auth_secret?: string;
  auth_header?: string;
  allowed_actions?: string[];
  rate_limit_rpm?: number;
  timeout_ms?: number;
}

// ---------------------------------------------------------------------------
// Authentication Token Generators
// ---------------------------------------------------------------------------

/**
 * Generate a daily rolling SHA-256 authentication token.
 * Both the gateway and the client's target API must use the same shared secret
 * and UTC date to compute matching tokens.
 *
 * Token = SHA256(secret + YYYY-MM-DD)
 */
export function generateRollingToken(secret: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC
  return crypto.createHash('sha256').update(secret + today).digest('hex');
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

export function createConfig(input: ClientApiConfigInput): ClientApiConfig {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `capi_${input.client_id}_${crypto.randomBytes(4).toString('hex')}`;

  const config: ClientApiConfig = {
    id,
    client_id: input.client_id,
    client_name: input.client_name,
    contact_id: input.contact_id || null,
    endpoint_id: input.endpoint_id || null,
    status: 'active',
    target_base_url: input.target_base_url,
    auth_type: (input.auth_type as any) || 'rolling_token',
    auth_secret: input.auth_secret || null,
    auth_header: input.auth_header || 'X-AI-Auth-Token',
    allowed_actions: input.allowed_actions ? JSON.stringify(input.allowed_actions) : null,
    rate_limit_rpm: input.rate_limit_rpm || 60,
    timeout_ms: input.timeout_ms || 30000,
    created_at: now,
    updated_at: now,
    total_requests: 0,
    last_request_at: null,
  };

  db.prepare(`
    INSERT INTO client_api_configs (
      id, client_id, client_name, contact_id, endpoint_id, status,
      target_base_url, auth_type, auth_secret, auth_header,
      allowed_actions, rate_limit_rpm, timeout_ms,
      created_at, updated_at, total_requests
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    config.id,
    config.client_id,
    config.client_name,
    config.contact_id,
    config.endpoint_id,
    config.status,
    config.target_base_url,
    config.auth_type,
    config.auth_secret,
    config.auth_header,
    config.allowed_actions,
    config.rate_limit_rpm,
    config.timeout_ms,
    config.created_at,
    config.updated_at,
    config.total_requests
  );

  return config;
}

export function getConfigByClientId(clientId: string): ClientApiConfig | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM client_api_configs WHERE client_id = ?').get(clientId);
  return row as ClientApiConfig | null;
}

export function getConfigById(id: string): ClientApiConfig | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM client_api_configs WHERE id = ?').get(id);
  return row as ClientApiConfig | null;
}

export function getAllConfigs(): ClientApiConfig[] {
  const db = getDb();
  return db.prepare('SELECT * FROM client_api_configs ORDER BY created_at DESC').all() as ClientApiConfig[];
}

export function getConfigsByContactId(contactId: number): ClientApiConfig[] {
  const db = getDb();
  return db.prepare('SELECT * FROM client_api_configs WHERE contact_id = ? ORDER BY created_at DESC').all(contactId) as ClientApiConfig[];
}

export function updateConfig(id: string, updates: Partial<ClientApiConfig>): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'created_at' && value !== undefined) {
      if (key === 'allowed_actions' && Array.isArray(value)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
  });

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(now, id);

  const result = db.prepare(`UPDATE client_api_configs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteConfig(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM client_api_configs WHERE id = ?').run(id);
  return result.changes > 0;
}

export function recordRequest(configId: string, clientId: string, action: string, statusCode: number, durationMs: number, errorMessage?: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `calog_${crypto.randomBytes(6).toString('hex')}`;

  db.prepare(`
    INSERT INTO client_api_logs (id, config_id, client_id, action, status_code, duration_ms, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, configId, clientId, action, statusCode, durationMs, errorMessage || null, now);

  // Update stats
  db.prepare(`
    UPDATE client_api_configs 
    SET total_requests = total_requests + 1, last_request_at = ?
    WHERE id = ?
  `).run(now, configId);
}

export function getRequestLogs(configId: string, limit = 50, offset = 0): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM client_api_logs WHERE config_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(configId, limit, offset);
}

// ---------------------------------------------------------------------------
// Client-Facing Usage Stats (authenticated via shared secret)
// ---------------------------------------------------------------------------

export interface UsageSummary {
  client_id: string;
  client_name: string;
  status: string;
  total_requests: number;
  last_request_at: string | null;
  period: { from: string; to: string };
  period_total: number;
  period_success: number;
  period_errors: number;
  avg_response_ms: number;
  daily_breakdown: Array<{
    date: string;
    requests: number;
    success: number;
    errors: number;
    avg_ms: number;
  }>;
  action_breakdown: Array<{
    action: string;
    requests: number;
    success: number;
    errors: number;
    avg_ms: number;
    last_called: string;
  }>;
  recent_requests: Array<{
    action: string;
    status_code: number;
    duration_ms: number;
    error_message: string | null;
    created_at: string;
  }>;
}

/**
 * Validate a client's auth token against the stored shared secret.
 * Accepts either:
 *   1. The raw shared secret (direct match)
 *   2. Today's rolling token: SHA256(secret + YYYY-MM-DD)
 *   3. Yesterday's rolling token (grace period for timezone edge cases)
 */
export function validateClientSecret(config: ClientApiConfig, token: string): boolean {
  if (!config.auth_secret || !token) return false;

  // Direct secret match (constant-time comparison)
  const secretBuf = Buffer.from(config.auth_secret);
  const tokenBuf = Buffer.from(token);
  if (secretBuf.length === tokenBuf.length) {
    try {
      if (crypto.timingSafeEqual(secretBuf, tokenBuf)) return true;
    } catch { /* length mismatch safety net */ }
  }

  // Rolling token — today
  const todayToken = generateRollingToken(config.auth_secret);
  if (token === todayToken) return true;

  // Rolling token — yesterday (grace window for timezone edge cases)
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const yesterdayToken = crypto.createHash('sha256').update(config.auth_secret + yesterdayStr).digest('hex');
  if (token === yesterdayToken) return true;

  return false;
}

/**
 * Get usage stats for a client gateway. Aggregates from client_api_logs.
 * @param configId  The gateway config ID
 * @param days      Number of days to look back (default 30)
 * @param recentLimit  Max recent requests to return (default 25)
 */
export function getUsageStats(config: ClientApiConfig, days = 30, recentLimit = 25): UsageSummary {
  const db = getDb();
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);
  const fromStr = from.toISOString();
  const toStr = now.toISOString();

  // Period totals
  const periodStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status_code >= 400 OR status_code IS NULL THEN 1 ELSE 0 END) as errors,
      COALESCE(AVG(duration_ms), 0) as avg_ms
    FROM client_api_logs 
    WHERE config_id = ? AND created_at >= ?
  `).get(config.id, fromStr) as any;

  // Daily breakdown
  const dailyRows = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as requests,
      SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status_code >= 400 OR status_code IS NULL THEN 1 ELSE 0 END) as errors,
      COALESCE(AVG(duration_ms), 0) as avg_ms
    FROM client_api_logs 
    WHERE config_id = ? AND created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all(config.id, fromStr) as any[];

  // Action breakdown
  const actionRows = db.prepare(`
    SELECT 
      action,
      COUNT(*) as requests,
      SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status_code >= 400 OR status_code IS NULL THEN 1 ELSE 0 END) as errors,
      COALESCE(AVG(duration_ms), 0) as avg_ms,
      MAX(created_at) as last_called
    FROM client_api_logs 
    WHERE config_id = ? AND created_at >= ?
    GROUP BY action
    ORDER BY requests DESC
  `).all(config.id, fromStr) as any[];

  // Recent requests
  const recentRows = db.prepare(`
    SELECT action, status_code, duration_ms, error_message, created_at
    FROM client_api_logs 
    WHERE config_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(config.id, recentLimit) as any[];

  return {
    client_id: config.client_id,
    client_name: config.client_name,
    status: config.status,
    total_requests: config.total_requests,
    last_request_at: config.last_request_at,
    period: { from: fromStr.split('T')[0], to: toStr.split('T')[0] },
    period_total: periodStats?.total || 0,
    period_success: periodStats?.success || 0,
    period_errors: periodStats?.errors || 0,
    avg_response_ms: Math.round(periodStats?.avg_ms || 0),
    daily_breakdown: dailyRows.map(r => ({
      date: r.date,
      requests: r.requests,
      success: r.success,
      errors: r.errors,
      avg_ms: Math.round(r.avg_ms),
    })),
    action_breakdown: actionRows.map(r => ({
      action: r.action,
      requests: r.requests,
      success: r.success,
      errors: r.errors,
      avg_ms: Math.round(r.avg_ms),
      last_called: r.last_called,
    })),
    recent_requests: recentRows.map(r => ({
      action: r.action,
      status_code: r.status_code,
      duration_ms: r.duration_ms,
      error_message: r.error_message,
      created_at: r.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Client-Facing Self-Service Operations
// ---------------------------------------------------------------------------

/**
 * Rotate the shared secret for a client gateway.
 * Generates a new random 64-char hex secret and returns it (shown once).
 */
export function rotateSecret(configId: string): string {
  const db = getDb();
  const newSecret = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  db.prepare('UPDATE client_api_configs SET auth_secret = ?, updated_at = ? WHERE id = ?')
    .run(newSecret, now, configId);
  return newSecret;
}

/**
 * Set a custom secret for a client gateway.
 * Returns the secret on success.
 */
export function setCustomSecret(configId: string, secret: string): string {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE client_api_configs SET auth_secret = ?, updated_at = ? WHERE id = ?')
    .run(secret, now, configId);
  return secret;
}

/**
 * Get request logs by client_id (not config_id).
 * Used by the client-facing logs endpoint.
 */
export function getRequestLogsByClientId(clientId: string, limit = 50, offset = 0): { logs: any[]; total: number } {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM client_api_logs WHERE client_id = ?').get(clientId) as any)?.cnt || 0;
  const logs = db.prepare(
    'SELECT id, action, status_code, duration_ms, error_message, created_at FROM client_api_logs WHERE client_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(clientId, limit, offset);
  return { logs, total };
}

/**
 * Build the authorization headers for a request to the target API.
 */
export function buildAuthHeaders(config: ClientApiConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!config.auth_secret || config.auth_type === 'none') return headers;

  switch (config.auth_type) {
    case 'rolling_token':
      headers[config.auth_header || 'X-AI-Auth-Token'] = generateRollingToken(config.auth_secret);
      break;
    case 'bearer':
      headers['Authorization'] = `Bearer ${config.auth_secret}`;
      break;
    case 'basic':
      headers['Authorization'] = `Basic ${config.auth_secret}`;
      break;
    case 'api_key':
      headers[config.auth_header || 'X-API-Key'] = config.auth_secret;
      break;
  }

  return headers;
}
