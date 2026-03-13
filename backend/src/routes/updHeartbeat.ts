/**
 * Updates – Client Heartbeat Router
 *
 * POST /updates/heartbeat — Public (requires software_key):
 *   - Register / update client presence
 *   - Check for available updates
 *   - Deliver one-shot remote commands (force_logout, server_message)
 *   - Accept piggybacked error reports (recent_errors[])
 *
 * GET  /updates/check — Public (requires software_key):
 *   - Lightweight update availability check (no client registration)
 */

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '../db/mysql.js';
import type { UpdClient } from '../db/updatesTypes.js';
import { badRequest, forbidden } from '../utils/httpErrors.js';

export const updHeartbeatRouter = Router();

// ─── Helper: store piggybacked errors from heartbeat ────────────────
async function storeRecentErrors(
  softwareKey: string,
  clientIdentifier: string,
  hostname: string | null,
  appVersion: string | null,
  osInfo: string | null,
  recentErrors: any[]
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
      await db.insert(
        `INSERT INTO error_reports (
          software_key, client_identifier, hostname, source,
          error_type, error_level, error_label, error_message,
          error_file, error_line, error_column, error_trace, error_url,
          request_method, request_uri,
          app_version, os_info,
          error_occurred_at, received_at
        ) VALUES (?, ?, ?, 'backend', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
          error.timestamp || new Date().toISOString(),
        ]
      );
      stored++;
    } catch { /* ignore individual error storage failures */ }
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

// ─── GET /check — Lightweight update check (no registration) ────────
updHeartbeatRouter.get('/check', async (req, res, next) => {
  try {
    const softwareKey = (req.query.software_key as string) || req.header('X-Software-Key');
    if (!softwareKey) throw badRequest('Missing software_key (query param or X-Software-Key header)');

    const currentVersion = req.query.version as string || req.query.app_version as string;

    const sw = await db.queryOne<any>(
      'SELECT id, name FROM update_software WHERE software_key = ?',
      [softwareKey]
    );
    if (!sw) throw badRequest('Invalid software_key');

    const latest = await db.queryOne<any>(
      `SELECT id, version, description, has_migrations, released_at, file_path
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

// ─── POST / — Full heartbeat ────────────────────────────────────────
updHeartbeatRouter.post('/', async (req, res, next) => {
  try {
    const body = z.object({
      software_key: z.string().optional(),
      client_identifier: z.string().optional(),
      hostname: z.string().optional(),
      machine_name: z.string().optional(),
      os_info: z.string().optional(),
      app_version: z.string().optional(),
      user_name: z.string().optional(),
      user_id: z.number().optional(),
      active_page: z.string().optional(),
      ai_sessions_active: z.number().optional(),
      ai_model: z.string().optional(),
      update_installed: z.boolean().optional(),
      update_id: z.number().optional(),
      metadata: z.any().optional(),
      recent_errors: z.array(z.any()).optional(),
    }).parse(req.body);

    // Software key can come from body or header
    const softwareKey = body.software_key || req.header('X-Software-Key');
    if (!softwareKey) throw badRequest('Missing software_key');

    // Resolve software
    const sw = await db.queryOne<any>(
      'SELECT id, name FROM update_software WHERE software_key = ?',
      [softwareKey]
    );
    if (!sw) throw badRequest('Invalid software_key');

    // Generate client identifier if not provided
    const clientId = body.client_identifier || crypto
      .createHash('sha256')
      .update([body.hostname, body.machine_name, body.os_info, req.ip].filter(Boolean).join('|'))
      .digest('hex');

    // Detect client IP
    const ip = (req.header('cf-connecting-ip')
      || req.header('x-real-ip')
      || req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || req.ip) ?? '';

    const userAgent = req.header('user-agent') || null;

    // Check if client exists
    const existing = await db.queryOne<UpdClient>(
      'SELECT * FROM update_clients WHERE software_id = ? AND client_identifier = ?',
      [sw.id, clientId]
    );

    // If blocked, reject
    if (existing?.is_blocked) {
      return res.status(403).json({
        success: false,
        error: 'Client is blocked',
        blocked: true,
        reason: existing.blocked_reason || null,
      });
    }

    // Handle update installation recording
    if (body.update_installed && body.update_id) {
      await db.execute(
        `INSERT IGNORE INTO update_installed (update_id, status) VALUES (?, 'installed')`,
        [body.update_id]
      );
    }

    // Append last_check_time to metadata
    const metadataObj = typeof body.metadata === 'object' && body.metadata !== null
      ? { ...body.metadata, last_check_time: new Date().toISOString() }
      : { last_check_time: new Date().toISOString() };
    const metadataJson = JSON.stringify(metadataObj);

    let action: string;
    let recordId: number;

    if (existing) {
      // Update existing client
      await db.execute(
        `UPDATE update_clients SET
          ip_address = ?, hostname = ?, machine_name = ?, os_info = ?,
          app_version = ?, user_agent = ?, metadata = ?,
          user_name = ?, user_id = ?, active_page = ?,
          ai_sessions_active = ?, ai_model = ?,
          last_heartbeat = NOW()
          ${body.update_installed && body.update_id ? ', last_update_id = ?, last_update_installed_at = NOW()' : ''}
         WHERE id = ?`,
        [
          ip, body.hostname || existing.hostname, body.machine_name || existing.machine_name,
          body.os_info || existing.os_info, body.app_version || existing.app_version,
          userAgent, metadataJson,
          body.user_name ?? existing.user_name, body.user_id ?? existing.user_id,
          body.active_page ?? existing.active_page,
          body.ai_sessions_active ?? existing.ai_sessions_active,
          body.ai_model ?? existing.ai_model,
          ...(body.update_installed && body.update_id ? [body.update_id] : []),
          existing.id,
        ]
      );
      action = 'updated';
      recordId = existing.id;
    } else {
      // Create new client
      const result = await db.insert(
        `INSERT INTO update_clients (software_id, client_identifier, ip_address, hostname,
          machine_name, os_info, app_version, user_agent, metadata,
          user_name, user_id, active_page, ai_sessions_active, ai_model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sw.id, clientId, ip, body.hostname || null, body.machine_name || null,
          body.os_info || null, body.app_version || null, userAgent, metadataJson,
          body.user_name || null, body.user_id || null, body.active_page || null,
          body.ai_sessions_active || 0, body.ai_model || null,
        ]
      );
      action = 'created';
      recordId = Number(result);
    }

    // Check for latest update available
    const latest = await db.queryOne<any>(
      `SELECT id, version, description, has_migrations, released_at
       FROM update_releases WHERE software_id = ?
       ORDER BY id DESC LIMIT 1`,
      [sw.id]
    );

    const updateAvailable = latest && body.app_version
      ? latest.version !== body.app_version
      : !!latest;

    // Process piggybacked errors (recent_errors[])
    let errorsStored = 0;
    if (body.recent_errors && Array.isArray(body.recent_errors) && body.recent_errors.length > 0) {
      errorsStored = await storeRecentErrors(
        softwareKey, clientId,
        body.hostname || null,
        body.app_version || null,
        body.os_info || null,
        body.recent_errors
      );
    }

    // Build response
    const response: any = {
      success: true,
      client_id: recordId,
      action,
      software: sw.name,
      update_available: updateAvailable,
      latest_update: latest || null,
      message: updateAvailable ? 'Update available' : 'Up to date',
      is_blocked: false,
      blocked_reason: null,
      force_logout: false,
      server_message: null,
      errors_received: errorsStored,
    };

    // Deliver one-shot commands
    if (existing) {
      if (existing.force_logout) {
        response.force_logout = true;
        await db.execute('UPDATE update_clients SET force_logout = 0 WHERE id = ?', [existing.id]);
      }
      if (existing.server_message) {
        response.server_message = existing.server_message;
        await db.execute(
          'UPDATE update_clients SET server_message = NULL, server_message_id = NULL WHERE id = ?',
          [existing.id]
        );
      }
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});
