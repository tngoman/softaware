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
// Database Singleton
// ---------------------------------------------------------------------------
let _db = null;
function getDb() {
    if (_db)
        return _db;
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
export function createEndpoint(input) {
    const db = getDb();
    const now = new Date().toISOString();
    // Generate endpoint ID: ep_{client_id}_{random}
    const randomSuffix = randomBytes(4).toString('hex');
    const id = `ep_${input.client_id}_${randomSuffix}`;
    const endpoint = {
        id,
        client_id: input.client_id,
        client_name: input.client_name,
        status: 'active',
        inbound_provider: input.inbound_provider,
        llm_provider: input.llm_provider,
        llm_model: input.llm_model,
        llm_temperature: 0.3,
        llm_max_tokens: 1024,
        llm_system_prompt: input.llm_system_prompt,
        llm_tools_config: input.llm_tools_config,
        target_api_url: input.target_api_url,
        target_api_auth_type: input.target_api_auth_type,
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
  `).run(endpoint.id, endpoint.client_id, endpoint.client_name, input.contact_id || null, endpoint.status, endpoint.inbound_provider, endpoint.llm_provider, endpoint.llm_model, endpoint.llm_temperature, endpoint.llm_max_tokens, endpoint.llm_system_prompt, endpoint.llm_tools_config, endpoint.target_api_url, endpoint.target_api_auth_type, endpoint.target_api_auth_value, endpoint.created_at, endpoint.updated_at, endpoint.total_requests);
    return endpoint;
}
/**
 * Get an endpoint by ID
 */
export function getEndpoint(endpointId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM enterprise_endpoints WHERE id = ?').get(endpointId);
    return row;
}
/**
 * Get ALL endpoints (for admin dashboard)
 */
export function getAllEndpoints() {
    const db = getDb();
    return db.prepare('SELECT * FROM enterprise_endpoints ORDER BY created_at DESC').all();
}
/**
 * Get all endpoints for a client
 */
export function getEndpointsByClient(clientId) {
    const db = getDb();
    return db.prepare('SELECT * FROM enterprise_endpoints WHERE client_id = ?').all(clientId);
}
/**
 * Update endpoint configuration
 */
export function updateEndpoint(endpointId, updates) {
    const db = getDb();
    const now = new Date().toISOString();
    const fields = [];
    const values = [];
    Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at' && value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    });
    if (fields.length === 0)
        return false;
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
export function setEndpointStatus(endpointId, status) {
    return updateEndpoint(endpointId, { status });
}
/**
 * Delete an endpoint
 */
export function deleteEndpoint(endpointId) {
    const db = getDb();
    const result = db.prepare('DELETE FROM enterprise_endpoints WHERE id = ?').run(endpointId);
    return result.changes > 0;
}
/**
 * Log a request to an endpoint
 */
export function logRequest(endpointId, inboundPayload, aiResponse, durationMs, status, errorMessage) {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `req_${randomBytes(8).toString('hex')}`;
    db.prepare(`
    INSERT INTO endpoint_requests (
      id, endpoint_id, timestamp, inbound_payload, ai_response,
      duration_ms, status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, endpointId, now, JSON.stringify(inboundPayload), JSON.stringify(aiResponse), durationMs, status, errorMessage || null);
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
export function getRequestLogs(endpointId, limit = 50, offset = 0) {
    const db = getDb();
    return db.prepare(`
    SELECT * FROM endpoint_requests
    WHERE endpoint_id = ?
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(endpointId, limit, offset);
}
/**
 * Close database connection
 */
export function close() {
    if (_db) {
        _db.close();
        _db = null;
        console.log('[EnterpriseEndpoints] Database connection closed');
    }
}
