/**
 * Enterprise Endpoints Service — Dynamic Webhook Configuration
 *
 * Manages database-driven enterprise client endpoints. Each client gets a unique
 * webhook URL (/api/v1/webhook/:endpointId) with custom behavior configured in SQLite.
 *
 * This replaces hardcoded routes like /silulumanzi with dynamic, admin-configurable endpoints.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DB_DIR = path.resolve('/var/opt/backend/data');
const DB_PATH = path.join(DB_DIR, 'enterprise_endpoints.db');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EnterpriseEndpoint {
  id: string;                          // e.g., 'ep_silulumanzi_001'
  client_id: string;                   // e.g., 'silulumanzi'
  client_name: string;                 // Display name
  status: 'active' | 'paused' | 'disabled';
  
  // Inbound configuration (what's talking to us?)
  inbound_provider: 'whatsapp' | 'slack' | 'custom_rest' | 'sms' | 'email' | 'web';
  inbound_auth_type?: 'api_key' | 'bearer' | 'basic' | 'none';
  inbound_auth_value?: string;         // API key, bearer token, or basic auth (encrypted)
  
  // AI configuration (how should the brain behave?)
  llm_provider: 'ollama' | 'openrouter' | 'openai';
  llm_model: string;                   // e.g., 'qwen2.5:3b', 'openai/gpt-4o-mini'
  llm_temperature?: number;
  llm_max_tokens?: number;
  llm_system_prompt: string;
  llm_tools_config?: string;           // JSON array of tool definitions
  llm_knowledge_base?: string;         // Optional knowledge base text
  
  // Outbound configuration (where does the AI send actions?)
  target_api_url?: string;             // e.g., 'https://softaware.net.za/AiClient.php'
  target_api_auth_type?: 'bearer' | 'basic' | 'custom' | 'none';
  target_api_auth_value?: string;      // Encrypted auth credentials
  target_api_headers?: string;         // JSON object of custom headers
  
  // IP restriction (JSON array of allowed IPs, e.g. '["1.2.3.4","10.0.0.0/8"]')
  allowed_ips?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  last_request_at?: string;
  total_requests: number;
  
  // Package system link
  contact_id?: number;                 // Links to MySQL contacts.id for package billing
}

export interface EndpointCreateInput {
  client_id: string;
  client_name: string;
  contact_id?: number;
  inbound_provider: string;
  llm_provider: string;
  llm_model: string;
  llm_system_prompt: string;
  llm_tools_config?: string;
  target_api_url?: string;
  target_api_auth_type?: string;
  target_api_auth_value?: string;
}

// ---------------------------------------------------------------------------
// Database Singleton
// ---------------------------------------------------------------------------
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Create schema
  _db.exec(`
    CREATE TABLE IF NOT EXISTS enterprise_endpoints (
      id                      TEXT PRIMARY KEY,
      client_id               TEXT NOT NULL,
      client_name             TEXT NOT NULL,
      contact_id              INTEGER,
      status                  TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'disabled')),
      
      inbound_provider        TEXT NOT NULL,
      inbound_auth_type       TEXT,
      inbound_auth_value      TEXT,
      
      llm_provider            TEXT NOT NULL,
      llm_model               TEXT NOT NULL,
      llm_temperature         REAL DEFAULT 0.3,
      llm_max_tokens          INTEGER DEFAULT 1024,
      llm_system_prompt       TEXT NOT NULL,
      llm_tools_config        TEXT,
      llm_knowledge_base      TEXT,
      
      target_api_url          TEXT,
      target_api_auth_type    TEXT,
      target_api_auth_value   TEXT,
      target_api_headers      TEXT,
      
      allowed_ips             TEXT,
      
      created_at              TEXT NOT NULL,
      updated_at              TEXT NOT NULL,
      last_request_at         TEXT,
      total_requests          INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_client_id ON enterprise_endpoints(client_id);
    CREATE INDEX IF NOT EXISTS idx_status ON enterprise_endpoints(status);

    -- Request logs for analytics
    CREATE TABLE IF NOT EXISTS endpoint_requests (
      id                TEXT PRIMARY KEY,
      endpoint_id       TEXT NOT NULL,
      timestamp         TEXT NOT NULL,
      inbound_payload   TEXT,
      ai_response       TEXT,
      duration_ms       INTEGER,
      status            TEXT,
      error_message     TEXT,
      FOREIGN KEY (endpoint_id) REFERENCES enterprise_endpoints(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_endpoint_requests ON endpoint_requests(endpoint_id, timestamp);
  `);

  console.log('[EnterpriseEndpoints] Database initialized at', DB_PATH);
  return _db;
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new enterprise endpoint with auto-generated ID
 */
export function createEndpoint(input: EndpointCreateInput): EnterpriseEndpoint {
  const db = getDb();
  const now = new Date().toISOString();
  
  // Generate endpoint ID: ep_{client_id}_{random}
  const randomSuffix = randomBytes(4).toString('hex');
  const id = `ep_${input.client_id}_${randomSuffix}`;

  const endpoint: EnterpriseEndpoint = {
    id,
    client_id: input.client_id,
    client_name: input.client_name,
    status: 'active',
    inbound_provider: input.inbound_provider as any,
    llm_provider: input.llm_provider as any,
    llm_model: input.llm_model,
    llm_temperature: 0.3,
    llm_max_tokens: 1024,
    llm_system_prompt: input.llm_system_prompt,
    llm_tools_config: input.llm_tools_config,
    target_api_url: input.target_api_url,
    target_api_auth_type: input.target_api_auth_type as any,
    target_api_auth_value: input.target_api_auth_value,
    created_at: now,
    updated_at: now,
    total_requests: 0
  };

  db.prepare(`
    INSERT INTO enterprise_endpoints (
      id, client_id, client_name, contact_id, status, inbound_provider,
      llm_provider, llm_model, llm_temperature, llm_max_tokens,
      llm_system_prompt, llm_tools_config,
      target_api_url, target_api_auth_type, target_api_auth_value,
      created_at, updated_at, total_requests
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    endpoint.id,
    endpoint.client_id,
    endpoint.client_name,
    (input as any).contact_id || null,
    endpoint.status,
    endpoint.inbound_provider,
    endpoint.llm_provider,
    endpoint.llm_model,
    endpoint.llm_temperature,
    endpoint.llm_max_tokens,
    endpoint.llm_system_prompt,
    endpoint.llm_tools_config,
    endpoint.target_api_url,
    endpoint.target_api_auth_type,
    endpoint.target_api_auth_value,
    endpoint.created_at,
    endpoint.updated_at,
    endpoint.total_requests
  );

  return endpoint;
}

/**
 * Get an endpoint by ID
 */
export function getEndpoint(endpointId: string): EnterpriseEndpoint | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM enterprise_endpoints WHERE id = ?').get(endpointId);
  return row as EnterpriseEndpoint | null;
}

/**
 * Get ALL endpoints (for admin dashboard)
 */
export function getAllEndpoints(): EnterpriseEndpoint[] {
  const db = getDb();
  return db.prepare('SELECT * FROM enterprise_endpoints ORDER BY created_at DESC').all() as EnterpriseEndpoint[];
}

/**
 * Get all endpoints for a client
 */
export function getEndpointsByClient(clientId: string): EnterpriseEndpoint[] {
  const db = getDb();
  return db.prepare('SELECT * FROM enterprise_endpoints WHERE client_id = ?').all(clientId) as EnterpriseEndpoint[];
}

/**
 * Update endpoint configuration
 */
export function updateEndpoint(endpointId: string, updates: Partial<EnterpriseEndpoint>): boolean {
  const db = getDb();
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'created_at' && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(now, endpointId);

  const result = db.prepare(`
    UPDATE enterprise_endpoints 
    SET ${fields.join(', ')}
    WHERE id = ?
  `).run(...values);

  return result.changes > 0;
}

/**
 * Update endpoint status (active/paused/disabled)
 */
export function setEndpointStatus(endpointId: string, status: 'active' | 'paused' | 'disabled'): boolean {
  return updateEndpoint(endpointId, { status });
}

/**
 * Delete an endpoint
 */
export function deleteEndpoint(endpointId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM enterprise_endpoints WHERE id = ?').run(endpointId);
  return result.changes > 0;
}

/**
 * Log a request to an endpoint
 */
export function logRequest(
  endpointId: string,
  inboundPayload: any,
  aiResponse: any,
  durationMs: number,
  status: 'success' | 'error',
  errorMessage?: string
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `req_${randomBytes(8).toString('hex')}`;

  db.prepare(`
    INSERT INTO endpoint_requests (
      id, endpoint_id, timestamp, inbound_payload, ai_response,
      duration_ms, status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    endpointId,
    now,
    JSON.stringify(inboundPayload),
    JSON.stringify(aiResponse),
    durationMs,
    status,
    errorMessage || null
  );

  // Update last_request_at and total_requests
  db.prepare(`
    UPDATE enterprise_endpoints
    SET last_request_at = ?, total_requests = total_requests + 1
    WHERE id = ?
  `).run(now, endpointId);
}

/**
 * Get request logs for an endpoint (paginated)
 */
export function getRequestLogs(
  endpointId: string,
  limit: number = 50,
  offset: number = 0
): any[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM endpoint_requests
    WHERE endpoint_id = ?
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(endpointId, limit, offset);
}

/**
 * Get analytics / aggregate stats for an endpoint
 */
export function getEndpointStats(
  endpointId: string,
  days: number = 30
): {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  requests_per_day: Array<{ day: string; count: number; errors: number }>;
} {
  const db = getDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
      COALESCE(AVG(duration_ms), 0) as avg_duration_ms
    FROM endpoint_requests
    WHERE endpoint_id = ? AND timestamp >= ?
  `).get(endpointId, since) as any;

  // Approximate P95 using ORDER BY + LIMIT
  const p95Row = db.prepare(`
    SELECT duration_ms FROM endpoint_requests
    WHERE endpoint_id = ? AND timestamp >= ?
    ORDER BY duration_ms DESC
    LIMIT 1 OFFSET (
      SELECT MAX(0, CAST(COUNT(*) * 0.05 AS INTEGER))
      FROM endpoint_requests
      WHERE endpoint_id = ? AND timestamp >= ?
    )
  `).get(endpointId, since, endpointId, since) as any;

  const perDay = db.prepare(`
    SELECT
      DATE(timestamp) as day,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
    FROM endpoint_requests
    WHERE endpoint_id = ? AND timestamp >= ?
    GROUP BY DATE(timestamp)
    ORDER BY day ASC
  `).all(endpointId, since) as any[];

  return {
    total_requests: totals?.total || 0,
    success_count: totals?.success_count || 0,
    error_count: totals?.error_count || 0,
    avg_duration_ms: Math.round(totals?.avg_duration_ms || 0),
    p95_duration_ms: p95Row?.duration_ms || 0,
    requests_per_day: perDay || [],
  };
}

/**
 * Close database connection
 */
export function close(): void {
  if (_db) {
    _db.close();
    _db = null;
    console.log('[EnterpriseEndpoints] Database connection closed');
  }
}
