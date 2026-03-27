/**
 * auditLog.ts — Admin Audit Log (SQLite)
 *
 * Stores every admin-panel action in a lightweight SQLite database
 * to avoid loading the main MySQL database with high-volume log data.
 *
 * The database lives at /var/opt/backend/data/audit_log.db and uses
 * WAL mode for safe concurrent reads/writes.
 *
 * Usage:
 *   import { auditLog } from '../db/auditLog.js';
 *   auditLog.log({ ... });                // fire-and-forget insert
 *   const rows = auditLog.query({ ... }); // paginated read
 *   auditLog.trim(30);                    // remove entries older than 30 days
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ── Types ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;          // HTTP method (GET/POST/PUT/PATCH/DELETE)
  resource: string;        // Route path e.g. /api/admin/clients/5/status
  resource_type: string;   // Derived category e.g. "clients", "credits", "settings"
  description: string;     // Human-readable description
  request_body: string;    // JSON stringified request body (sensitive fields stripped)
  response_status: number; // HTTP status code of the response
  ip_address: string;
  user_agent: string;
  duration_ms: number;
  created_at: string;
}

export interface AuditLogInsert {
  user_id: string;
  user_email?: string;
  user_name?: string;
  action: string;
  resource: string;
  resource_type?: string;
  description?: string;
  request_body?: string;
  response_status?: number;
  ip_address?: string;
  user_agent?: string;
  duration_ms?: number;
}

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  user_id?: string;
  action?: string;
  resource_type?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  status_min?: number;
  status_max?: number;
}

export interface AuditLogQueryResult {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogStats {
  total_entries: number;
  oldest_entry: string | null;
  newest_entry: string | null;
  entries_today: number;
  entries_this_week: number;
  entries_this_month: number;
  top_users: Array<{ user_email: string; count: number }>;
  top_resources: Array<{ resource_type: string; count: number }>;
  error_count: number;
  db_size_mb: number;
}

// ── Database Setup ───────────────────────────────────────────────────────

const DB_DIR  = path.resolve('/var/opt/backend/data');
const DB_PATH = path.join(DB_DIR, 'audit_log.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT NOT NULL,
      user_email      TEXT DEFAULT '',
      user_name       TEXT DEFAULT '',
      action          TEXT NOT NULL,
      resource        TEXT NOT NULL,
      resource_type   TEXT DEFAULT '',
      description     TEXT DEFAULT '',
      request_body    TEXT DEFAULT '{}',
      response_status INTEGER DEFAULT 0,
      ip_address      TEXT DEFAULT '',
      user_agent      TEXT DEFAULT '',
      duration_ms     INTEGER DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes for fast querying
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_user      ON admin_audit_log (user_id, created_at)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_created   ON admin_audit_log (created_at)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_resource  ON admin_audit_log (resource_type, created_at)`);
  _db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_action    ON admin_audit_log (action, created_at)`);

  return _db;
}

// ── Sensitive field stripping ────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password', 'secret', 'token', 'api_key', 'apiKey', 'credential',
  'credit_card', 'creditCard', 'ssn', 'pin', 'otp', 'backup_codes',
  'private_key', 'privateKey', 'access_token', 'accessToken',
  'refresh_token', 'refreshToken', 'authorization', 'smtp_pass',
]);

function stripSensitive(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripSensitive);

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = stripSensitive(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ── Resource type derivation ─────────────────────────────────────────────

function deriveResourceType(resourcePath: string): string {
  // Strip /api prefix and extract the admin sub-resource
  const clean = resourcePath.replace(/^\/api/, '').replace(/^\/admin\//, '');
  
  const mappings: [RegExp, string][] = [
    [/^clients/, 'clients'],
    [/^credits/, 'credits'],
    [/^config/, 'config'],
    [/^dashboard/, 'dashboard'],
    [/^packages/, 'packages'],
    [/^enterprise-endpoints/, 'enterprise-endpoints'],
    [/^cases/, 'cases'],
    [/^audit-log/, 'audit-log'],
    [/^stats/, 'stats'],
    [/^activation-keys/, 'activation-keys'],
    [/^teams/, 'teams'],
    [/^leads/, 'leads'],
    [/^payroll/, 'payroll'],
    [/^ai-overview/, 'ai-overview'],
    [/^client-api-configs/, 'client-api-configs'],
    [/^sites/, 'sites'],
  ];

  // Non /admin/* routes that are admin-protected
  const systemMappings: [RegExp, string][] = [
    [/^settings/, 'settings'],
    [/^users/, 'users'],
    [/^roles/, 'roles'],
    [/^permissions/, 'permissions'],
    [/^credentials/, 'credentials'],
    [/^email/, 'email'],
    [/^sms/, 'sms'],
    [/^database/, 'database'],
  ];

  for (const [pattern, type] of mappings) {
    if (pattern.test(clean)) return type;
  }

  const cleanSystem = resourcePath.replace(/^\/api\//, '');
  for (const [pattern, type] of systemMappings) {
    if (pattern.test(cleanSystem)) return type;
  }

  return 'other';
}

// ── Human-readable description builder ───────────────────────────────────

function buildDescription(method: string, resourcePath: string, body?: any): string {
  const clean = resourcePath.replace(/^\/api/, '');
  const verb = method === 'GET' ? 'Viewed' :
               method === 'POST' ? 'Created/Executed' :
               method === 'PUT' ? 'Updated' :
               method === 'PATCH' ? 'Modified' :
               method === 'DELETE' ? 'Deleted' : method;

  return `${verb} ${clean}`;
}

// ── Public API ───────────────────────────────────────────────────────────

export const auditLog = {
  /**
   * Log an admin action (fire-and-forget safe)
   */
  log(entry: AuditLogInsert): void {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO admin_audit_log
          (user_id, user_email, user_name, action, resource, resource_type,
           description, request_body, response_status, ip_address, user_agent, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const resourceType = entry.resource_type || deriveResourceType(entry.resource);
      const description = entry.description || buildDescription(entry.action, entry.resource, entry.request_body);
      const sanitizedBody = typeof entry.request_body === 'string'
        ? entry.request_body
        : JSON.stringify(stripSensitive(entry.request_body || {}));

      stmt.run(
        entry.user_id,
        entry.user_email || '',
        entry.user_name || '',
        entry.action,
        entry.resource,
        resourceType,
        description,
        sanitizedBody,
        entry.response_status || 0,
        entry.ip_address || '',
        entry.user_agent || '',
        entry.duration_ms || 0,
      );
    } catch (err) {
      console.error('[auditLog] Failed to write log entry:', err);
    }
  },

  /**
   * Query audit log with pagination and filters
   */
  query(params: AuditLogQueryParams = {}): AuditLogQueryResult {
    const db = getDb();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(500, Math.max(1, params.limit || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];

    if (params.user_id) {
      conditions.push('user_id = ?');
      values.push(params.user_id);
    }
    if (params.action) {
      conditions.push('action = ?');
      values.push(params.action.toUpperCase());
    }
    if (params.resource_type) {
      conditions.push('resource_type = ?');
      values.push(params.resource_type);
    }
    if (params.search) {
      conditions.push('(resource LIKE ? OR description LIKE ? OR user_email LIKE ? OR user_name LIKE ?)');
      const term = `%${params.search}%`;
      values.push(term, term, term, term);
    }
    if (params.from_date) {
      conditions.push('created_at >= ?');
      values.push(params.from_date);
    }
    if (params.to_date) {
      conditions.push('created_at <= ?');
      values.push(params.to_date);
    }
    if (params.status_min !== undefined) {
      conditions.push('response_status >= ?');
      values.push(params.status_min);
    }
    if (params.status_max !== undefined) {
      conditions.push('response_status <= ?');
      values.push(params.status_max);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM admin_audit_log ${whereClause}`).get(...values) as any;
    const total = countRow?.total || 0;

    const data = db.prepare(
      `SELECT * FROM admin_audit_log ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...values, limit, offset) as AuditLogEntry[];

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get audit log statistics
   */
  stats(): AuditLogStats {
    const db = getDb();

    const total = (db.prepare('SELECT COUNT(*) as cnt FROM admin_audit_log').get() as any)?.cnt || 0;
    const oldest = (db.prepare('SELECT MIN(created_at) as val FROM admin_audit_log').get() as any)?.val || null;
    const newest = (db.prepare('SELECT MAX(created_at) as val FROM admin_audit_log').get() as any)?.val || null;
    const today = (db.prepare("SELECT COUNT(*) as cnt FROM admin_audit_log WHERE created_at >= date('now')").get() as any)?.cnt || 0;
    const thisWeek = (db.prepare("SELECT COUNT(*) as cnt FROM admin_audit_log WHERE created_at >= date('now', '-7 days')").get() as any)?.cnt || 0;
    const thisMonth = (db.prepare("SELECT COUNT(*) as cnt FROM admin_audit_log WHERE created_at >= date('now', '-30 days')").get() as any)?.cnt || 0;
    const errorCount = (db.prepare('SELECT COUNT(*) as cnt FROM admin_audit_log WHERE response_status >= 400').get() as any)?.cnt || 0;

    const topUsers = db.prepare(
      'SELECT user_email, COUNT(*) as count FROM admin_audit_log GROUP BY user_email ORDER BY count DESC LIMIT 10'
    ).all() as Array<{ user_email: string; count: number }>;

    const topResources = db.prepare(
      'SELECT resource_type, COUNT(*) as count FROM admin_audit_log GROUP BY resource_type ORDER BY count DESC LIMIT 10'
    ).all() as Array<{ resource_type: string; count: number }>;

    // Get DB file size
    let dbSizeMb = 0;
    try {
      const stat = fs.statSync(DB_PATH);
      dbSizeMb = Math.round((stat.size / (1024 * 1024)) * 100) / 100;
    } catch { /* ignore */ }

    return {
      total_entries: total,
      oldest_entry: oldest,
      newest_entry: newest,
      entries_today: today,
      entries_this_week: thisWeek,
      entries_this_month: thisMonth,
      top_users: topUsers,
      top_resources: topResources,
      error_count: errorCount,
      db_size_mb: dbSizeMb,
    };
  },

  /**
   * Trim (delete) log entries older than `days` days
   * Returns the number of rows deleted
   */
  trim(days: number): number {
    const db = getDb();
    const result = db.prepare(
      "DELETE FROM admin_audit_log WHERE created_at < datetime('now', ? || ' days')"
    ).run(`-${days}`);
    return result.changes;
  },

  /**
   * Delete specific log entries by IDs
   */
  deleteByIds(ids: number[]): number {
    if (!ids.length) return 0;
    const db = getDb();
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(
      `DELETE FROM admin_audit_log WHERE id IN (${placeholders})`
    ).run(...ids);
    return result.changes;
  },

  /**
   * Purge all audit log entries (use with caution)
   */
  purgeAll(): number {
    const db = getDb();
    const result = db.prepare('DELETE FROM admin_audit_log').run();
    db.exec('VACUUM');
    return result.changes;
  },

  /**
   * Get distinct resource types for filter dropdowns
   */
  resourceTypes(): string[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT DISTINCT resource_type FROM admin_audit_log ORDER BY resource_type'
    ).all() as Array<{ resource_type: string }>;
    return rows.map(r => r.resource_type);
  },

  /**
   * Get distinct users for filter dropdowns
   */
  users(): Array<{ user_id: string; user_email: string; user_name: string }> {
    const db = getDb();
    return db.prepare(
      'SELECT DISTINCT user_id, user_email, user_name FROM admin_audit_log ORDER BY user_email'
    ).all() as Array<{ user_id: string; user_email: string; user_name: string }>;
  },
};
