/**
 * Updates – Client Heartbeat Router (v4 Telemetry & Privacy)
 *
 * POST /updates/heartbeat — Public (requires software_key):
 *   - Register / update client presence
 *   - Check for available updates
 *   - Deliver one-shot remote commands (force_logout, server_message)
 *   - Accept piggybacked error reports (recent_errors[])
 *   - Process queued heartbeats (queued_heartbeats[]) from offline periods
 *   - Respect privacy directives: IP masking, data retention hints
 *
 * GET  /updates/heartbeat/check — Public (requires software_key):
 *   - Lightweight update availability check (no client registration)
 *
 * v4 Changes:
 *   - All non-essential fields are optional (telemetry categories)
 *   - metadata.ip_masked → server masks IP before storage
 *   - metadata.retention_hint → per-record TTL ('24h'|'7d'|'30d'|'90d')
 *   - queued_heartbeats[] → replay of previously failed heartbeats
 *   - queued_processed returned in response
 *   - Backward compatible with v3 clients (no retention_hint = 90d default)
 */

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '../db/mysql.js';
import type { UpdClient } from '../db/updatesTypes.js';
import { badRequest, forbidden } from '../utils/httpErrors.js';

export const updHeartbeatRouter = Router();

// ─── Constants ──────────────────────────────────────────────────────
const RETENTION_DURATIONS: Record<string, string> = {
  '24h': 'INTERVAL 1 DAY',
  '7d':  'INTERVAL 7 DAY',
  '30d': 'INTERVAL 30 DAY',
  '90d': 'INTERVAL 90 DAY',
};
const DEFAULT_RETENTION = '90d';
const VALID_RETENTIONS = new Set(['24h', '7d', '30d', '90d']);

// ─── Helper: Mask an IP address ─────────────────────────────────────
function maskIp(ipAddress: string): string {
  if (!ipAddress) return '';
  if (ipAddress.includes(':')) {
    // IPv6 — zero the last 64 bits (host portion)
    const parts = ipAddress.split(':');
    return parts.slice(0, 4).join(':') + '::0';
  }
  // IPv4 — zero the last octet
  const octets = ipAddress.split('.');
  if (octets.length === 4) {
    octets[3] = '0';
    return octets.join('.');
  }
  return ipAddress; // fallback: return as-is if format is unexpected
}

// ─── Helper: Convert ISO/Date to MySQL DATETIME string ──────────────
function toMySqlDatetime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// ─── Helper: Resolve client IP from request ─────────────────────────
function resolveClientIp(req: any): string {
  return (
    req.header('cf-connecting-ip')
    || req.header('x-real-ip')
    || req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || req.ip
  ) ?? '';
}

// ─── Helper: Compute expires_at SQL expression ─────────────────────
function retentionToInterval(hint: string): string {
  return RETENTION_DURATIONS[hint] || RETENTION_DURATIONS[DEFAULT_RETENTION];
}

// ─── Helper: store piggybacked errors from heartbeat ────────────────
async function storeRecentErrors(
  softwareKey: string,
  clientIdentifier: string,
  clientRecordId: number,
  hostname: string | null,
  appVersion: string | null,
  osInfo: string | null,
  recentErrors: any[],
  retentionHint: string = DEFAULT_RETENTION
): Promise<number> {
  let stored = 0;
  for (const error of recentErrors) {
    // Accept both spec names (error_type) and short names (type)
    const errorType = error.type || error.error_type;
    const errorLevel = error.level || error.error_level;
    const errorLabel = error.label || errorType || 'unknown';
    const errorMessage = error.message;
    if (!errorType || !errorLevel || !errorMessage) continue;
    try {
      const interval = retentionToInterval(retentionHint);
      await db.insert(
        `INSERT INTO error_reports (
          software_key, client_identifier, hostname, source,
          error_type, error_level, error_label, error_message,
          error_file, error_line, error_column, error_trace, error_url,
          request_method, request_uri,
          app_version, os_info,
          error_occurred_at, received_at,
          retention_hint, expires_at
        ) VALUES (?, ?, ?, 'backend', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, DATE_ADD(NOW(), ${interval}))`,
        [
          softwareKey, clientIdentifier, hostname,
          errorType, errorLevel, errorLabel,
          String(errorMessage).substring(0, 65000),
          error.file || null, error.line || null, error.column || null,
          error.trace || error.stack_trace || null,
          error.url || null,
          error.request_method || error.request?.method || null,
          error.request_uri || error.request?.uri || null,
          appVersion, osInfo,
          toMySqlDatetime(error.timestamp || new Date().toISOString()),
          retentionHint,
        ]
      );
      stored++;
    } catch { /* ignore individual error storage failures */ }

    // Upsert into client_errors (deduplicated by hash)
    try {
      const msgStr = String(errorMessage).substring(0, 500);
      const errorHash = crypto
        .createHash('sha256')
        .update([errorType, errorLevel, msgStr, error.file || ''].join('|'))
        .digest('hex');

      await db.execute(
        `INSERT INTO client_errors
          (client_id, error_type, error_level, error_message, error_file, error_line, error_trace, occurrences, first_seen_at, last_seen_at, is_cleared, error_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), 0, ?)
         ON DUPLICATE KEY UPDATE
           occurrences = occurrences + 1,
           last_seen_at = NOW(),
           is_cleared = 0,
           error_message = VALUES(error_message),
           error_trace = VALUES(error_trace)`,
        [
          clientRecordId, errorType, errorLevel,
          String(errorMessage).substring(0, 65000),
          error.file || null, error.line || null,
          error.trace || error.stack_trace || null,
          errorHash,
        ]
      );
    } catch { /* ignore client_errors upsert failures */ }
  }

  // Update summary
  if (stored > 0) {
    const errorCount = recentErrors.filter(e => (e.level || e.error_level) === 'error').length;
    const warningCount = recentErrors.filter(e => (e.level || e.error_level) === 'warning').length;
    const noticeCount = recentErrors.filter(e => (e.level || e.error_level) === 'notice').length;
    try {
      await db.execute(
        `INSERT INTO client_error_summaries
          (software_key, client_identifier, hostname, app_version,
           total_errors, total_warnings, total_notices,
           last_error_message, last_error_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           hostname = VALUES(hostname),
           app_version = VALUES(app_version),
           total_errors = total_errors + VALUES(total_errors),
           total_warnings = total_warnings + VALUES(total_warnings),
           total_notices = total_notices + VALUES(total_notices),
           last_error_message = VALUES(last_error_message),
           last_error_at = NOW()`,
        [
          softwareKey, clientIdentifier, hostname, appVersion,
          errorCount, warningCount, noticeCount,
          recentErrors[0]?.message || null,
        ]
      );
    } catch { /* ignore summary failures */ }
  }
  return stored;
}

// ─── Helper: ingest a single heartbeat payload ──────────────────────
// Used by both the main heartbeat and queued heartbeat replay.
// Returns { recordId, action, errorsStored }
async function ingestHeartbeat(
  sw: { id: number; name: string },
  body: any,
  rawIp: string,
  userAgent: string | null,
  effectiveTimestamp: string | null, // ISO string — for queued replays; null = NOW()
): Promise<{ recordId: number; action: string; errorsStored: number }> {

  // Resolve client identifier
  const clientId = body.client_identifier || crypto
    .createHash('sha256')
    .update([body.hostname, body.machine_name, body.os_info, rawIp].filter(Boolean).join('|'))
    .digest('hex');

  // Extract privacy directives from metadata
  const metadata = (typeof body.metadata === 'object' && body.metadata !== null)
    ? body.metadata
    : {};
  const ipMasked = metadata.ip_masked === true;
  const retentionHint = VALID_RETENTIONS.has(metadata.retention_hint)
    ? metadata.retention_hint
    : DEFAULT_RETENTION;

  // Apply IP masking directive
  const storedIp = ipMasked ? null : rawIp;
  const storedMaskedIp = ipMasked ? maskIp(rawIp) : null;

  // Build metadata JSON — preserve client metadata, add server timestamp
  const metadataObj = { ...metadata, last_check_time: new Date().toISOString() };
  const metadataJson = JSON.stringify(metadataObj);

  // Check if client exists
  const existing = await db.queryOne<UpdClient>(
    'SELECT * FROM update_clients WHERE software_id = ? AND client_identifier = ?',
    [sw.id, clientId]
  );

  let action: string;
  let recordId: number;

  // Timestamp expression for SQL — use effectiveTimestamp for queued replays
  const tsValue = toMySqlDatetime(effectiveTimestamp || new Date().toISOString());

  if (existing) {
    // v4: Only overwrite fields that are PRESENT in the payload.
    // Absent fields = consent withdrawn → store NULL (not fallback to existing).
    const updateIp = ipMasked ? existing.ip_address : (storedIp || existing.ip_address);
    const updateMaskedIp = ipMasked ? storedMaskedIp : existing.masked_ip;

    await db.execute(
      `UPDATE update_clients SET
        ip_address = ?,
        masked_ip = ?,
        ip_masked = ?,
        hostname = ?,
        machine_name = ?,
        os_info = ?,
        app_version = ?,
        user_agent = ?,
        metadata = ?,
        user_name = ?,
        user_id = ?,
        active_page = ?,
        ai_sessions_active = ?,
        ai_model = ?,
        retention_hint = ?,
        last_heartbeat = ?
        ${body.update_installed && body.last_update_id ? ', last_update_id = ?, last_update_installed_at = ?' : ''}
       WHERE id = ?`,
      [
        ipMasked ? null : (rawIp || existing.ip_address),
        storedMaskedIp ?? existing.masked_ip,
        ipMasked ? 1 : 0,
        body.hostname ?? null,         // absent = NULL (consent withdrawn)
        body.machine_name ?? null,
        body.os_info ?? null,
        body.app_version || existing.app_version,
        userAgent,
        metadataJson,
        body.user_name ?? null,        // absent = NULL (usage category off)
        body.user_id ?? null,
        body.active_page ?? null,
        body.ai_sessions_active ?? existing.ai_sessions_active ?? 0,
        body.ai_model ?? null,
        retentionHint,
        tsValue,
        ...(body.update_installed && body.last_update_id ? [body.last_update_id, tsValue] : []),
        existing.id,
      ]
    );
    action = 'updated';
    recordId = existing.id;
  } else {
    // Create new client
    const result = await db.insert(
      `INSERT INTO update_clients (
        software_id, client_identifier, ip_address, masked_ip, ip_masked,
        hostname, machine_name, os_info, app_version, user_agent, metadata,
        user_name, user_id, active_page, ai_sessions_active, ai_model,
        retention_hint, last_heartbeat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sw.id, clientId,
        storedIp, storedMaskedIp, ipMasked ? 1 : 0,
        body.hostname || null, body.machine_name || null,
        body.os_info || null, body.app_version || null,
        userAgent, metadataJson,
        body.user_name || null, body.user_id || null,
        body.active_page || null, body.ai_sessions_active || 0,
        body.ai_model || null,
        retentionHint, tsValue,
      ]
    );
    action = 'created';
    recordId = Number(result);
  }

  // Handle update installation recording
  if (body.update_installed && body.last_update_id) {
    try {
      await db.execute(
        `INSERT IGNORE INTO update_installed (update_id, status) VALUES (?, 'installed')`,
        [body.last_update_id]
      );
    } catch { /* ignore */ }
  }

  // Process piggybacked errors (recent_errors[])
  let errorsStored = 0;
  if (body.recent_errors && Array.isArray(body.recent_errors) && body.recent_errors.length > 0) {
    errorsStored = await storeRecentErrors(
      sw.software_key || body.software_key,
      clientId, recordId,
      body.hostname || null,
      body.app_version || null,
      body.os_info || null,
      body.recent_errors,
      retentionHint
    );
  }

  return { recordId, action, errorsStored };
}

// ─── GET /check — Lightweight update check (no registration) ────────
updHeartbeatRouter.get('/check', async (req, res, next) => {
  try {
    const softwareKey = (req.query.software_key as string) || req.header('X-Software-Key');
    if (!softwareKey) throw badRequest('Missing software_key (query param or X-Software-Key header)');

    const currentVersion = req.query.version as string || req.query.app_version as string || req.query.v as string;

    const sw = await db.queryOne<any>(
      'SELECT id, name FROM update_software WHERE software_key = ?',
      [softwareKey]
    );
    if (!sw) return res.status(404).json({ error: 'Unknown software key' });

    const latest = await db.queryOne<any>(
      `SELECT id, version, description, has_migrations, released_at, file_path, created_at
       FROM update_releases WHERE software_id = ?
       ORDER BY id DESC LIMIT 1`,
      [sw.id]
    );

    const updateAvailable = latest && currentVersion
      ? latest.version !== currentVersion
      : !!latest;

    res.json({
      success: true,
      software: sw.name,
      software_id: sw.id,
      current_version: currentVersion || null,
      update_available: updateAvailable,
      latest_update: latest ? {
        id: latest.id,
        version: latest.version,
        description: latest.description,
        has_migrations: latest.has_migrations,
        released_at: latest.released_at,
        has_file: !!latest.file_path,
      } : null,
      message: updateAvailable ? 'Update available' : 'Up to date',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST / — Full heartbeat (v4 telemetry-aware) ───────────────────
updHeartbeatRouter.post('/', async (req, res, next) => {
  try {
    // v4: Lenient schema — all non-essential fields optional
    const body = z.object({
      software_key:       z.string().optional(),
      client_identifier:  z.string().optional(),
      hostname:           z.string().optional(),
      machine_name:       z.string().optional(),
      os_info:            z.string().optional(),
      app_version:        z.string().optional(),
      user_name:          z.string().nullable().optional(),
      user_id:            z.number().nullable().optional(),
      active_page:        z.string().nullable().optional(),
      ai_sessions_active: z.number().optional(),
      ai_model:           z.string().nullable().optional(),
      update_installed:   z.boolean().optional(),
      last_update_id:     z.union([z.number(), z.string()]).optional(),
      update_id:          z.union([z.number(), z.string()]).optional(), // v3 compat alias
      metadata:           z.any().optional(),
      recent_errors:      z.array(z.any()).optional(),
      queued_heartbeats:  z.array(z.object({
        payload:    z.any(),
        reason:     z.string().optional(),
        queued_at:  z.string().optional(),
      })).optional(),
    }).parse(req.body);

    // Normalize v3 update_id → last_update_id
    if (!body.last_update_id && body.update_id) {
      body.last_update_id = body.update_id;
    }

    // Software key can come from body or header
    const softwareKey = body.software_key || req.header('X-Software-Key');
    if (!softwareKey) throw badRequest('Missing software_key');

    // Resolve software
    const sw = await db.queryOne<any>(
      'SELECT id, name, software_key FROM update_software WHERE software_key = ?',
      [softwareKey]
    );
    if (!sw) return res.status(404).json({ error: 'Unknown software key' });

    // Resolve client identifier for block check
    const clientId = body.client_identifier || crypto
      .createHash('sha256')
      .update([body.hostname, body.machine_name, body.os_info, req.ip].filter(Boolean).join('|'))
      .digest('hex');

    // Check if client is blocked (before any processing)
    const existingForBlock = await db.queryOne<UpdClient>(
      'SELECT id, is_blocked, blocked_reason FROM update_clients WHERE software_id = ? AND client_identifier = ?',
      [sw.id, clientId]
    );
    if (existingForBlock?.is_blocked) {
      return res.status(403).json({
        blocked: true,
        reason: existingForBlock.blocked_reason || null,
      });
    }

    const rawIp = resolveClientIp(req);
    const userAgent = req.header('user-agent') || null;

    // ─── Process queued heartbeats first (replay offline heartbeats) ──
    let queuedProcessed = 0;
    if (body.queued_heartbeats && Array.isArray(body.queued_heartbeats)) {
      for (const entry of body.queued_heartbeats) {
        try {
          if (!entry.payload || typeof entry.payload !== 'object') continue;
          const queuedPayload = entry.payload;
          const queuedAt = entry.queued_at || null;

          // Apply privacy rules from the QUEUED payload's own metadata
          await ingestHeartbeat(sw, queuedPayload, rawIp, userAgent, queuedAt);
          queuedProcessed++;
        } catch {
          // Do not fail the parent heartbeat if a queued entry has issues
          // Just skip and continue
        }
      }
    }

    // ─── Process the primary (current) heartbeat ─────────────────────
    const { recordId, action, errorsStored } = await ingestHeartbeat(
      sw, body, rawIp, userAgent, null
    );

    // ─── Check for latest update available ───────────────────────────
    const latest = await db.queryOne<any>(
      `SELECT id, version, description, has_migrations, released_at, created_at
       FROM update_releases WHERE software_id = ?
       ORDER BY id DESC LIMIT 1`,
      [sw.id]
    );

    const updateAvailable = latest && body.app_version
      ? latest.version !== body.app_version
      : !!latest;

    // ─── Build response ──────────────────────────────────────────────
    const response: any = {
      success: true,
      client_id: recordId,
      action,
      software: sw.name,
      update_available: updateAvailable,
      latest_update: latest ? {
        id: latest.id,
        version: latest.version,
        description: latest.description,
        created_at: latest.created_at,
        download_url: `https://updates.softaware.net.za/api/updates/download?update_id=${latest.id}&software_key=${softwareKey}`,
      } : null,
      message: updateAvailable ? 'Update available' : 'Portal is up to date',
      is_blocked: false,
      force_logout: false,
      server_message: null,
      errors_received: errorsStored,
      queued_processed: queuedProcessed,
    };

    // ─── Deliver one-shot commands ───────────────────────────────────
    // Re-read client for commands (may have been created by ingestHeartbeat)
    const clientForCommands = await db.queryOne<UpdClient>(
      'SELECT id, force_logout, server_message, server_message_id FROM update_clients WHERE id = ?',
      [recordId]
    );
    if (clientForCommands) {
      if (clientForCommands.force_logout) {
        response.force_logout = true;
        await db.execute('UPDATE update_clients SET force_logout = 0 WHERE id = ?', [recordId]);
      }
      if (clientForCommands.server_message) {
        response.server_message = clientForCommands.server_message;
        await db.execute(
          'UPDATE update_clients SET server_message = NULL, server_message_id = NULL WHERE id = ?',
          [recordId]
        );
      }
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});
