/**
 * Admin Client Manager Routes
 * 
 * Provides API endpoints for the admin dashboard to manage client accounts,
 * assistants, and widget endpoints. Supports the global kill switch system
 * with status updates (active / suspended / demo_expired).
 * 
 * All routes are protected by requireAuth + requireAdmin.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest, signAccessToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { buildFrontendUser } from './auth.js';
import { getAllEndpoints } from '../services/enterpriseEndpoints.js';

// Base path for enterprise client documentation
const DOCS_BASE = '/var/opt/documentation/Enterprise/Clients';

export const adminClientManagerRouter = Router();

// All routes require admin authentication
adminClientManagerRouter.use(requireAuth, requireAdmin);

// ─── Validation Schemas ─────────────────────────────────────────────────
const statusSchema = z.enum(['active', 'suspended', 'demo_expired']);

const updateAccountStatusSchema = z.object({
  status: statusSchema,
});

const updateAssistantStatusSchema = z.object({
  status: statusSchema,
});

const updateWidgetStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'demo_expired', 'upgraded']),
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/clients/overview
// Full overview: all users with their assistants and widget endpoints
// ═════════════════════════════════════════════════════════════════════════
adminClientManagerRouter.get('/overview', async (_req: AuthRequest, res: Response) => {
  try {
    // Get all users that are clients (exclude admin/staff)
    const users = await db.query<any>(
      `SELECT u.id, u.email, u.name, u.account_status, u.contact_id, u.createdAt,
              c.company_name AS contact_name, c.contact_person, c.email AS contact_email,
              c.phone AS contact_phone, c.location AS contact_address,
              (SELECT COUNT(*) FROM assistants a WHERE a.userId = u.id) AS assistant_count,
              (SELECT COUNT(*) FROM widget_clients wc WHERE wc.user_id = u.id) AS widget_count
       FROM users u
       LEFT JOIN contacts c ON c.id = u.contact_id
       WHERE u.is_admin = 0 AND u.is_staff = 0
       ORDER BY u.createdAt DESC`
    );

    // Get all assistants with their owner info + knowledge stats
    const assistants = await db.query<any>(
      `SELECT a.id, a.name, a.description, a.status, a.tier, a.userId, a.pages_indexed,
              a.business_type, a.personality, a.primary_goal, a.website, a.lead_capture_email,
              a.knowledge_categories,
              a.created_at, a.updated_at, u.email AS owner_email, u.name AS owner_name,
              u.account_status AS owner_account_status,
              (SELECT COUNT(DISTINCT ak.source) FROM assistant_knowledge ak WHERE ak.assistant_id = a.id COLLATE utf8mb4_0900_ai_ci) AS knowledge_source_count,
              (SELECT COUNT(*) FROM assistant_knowledge ak WHERE ak.assistant_id = a.id COLLATE utf8mb4_0900_ai_ci) AS knowledge_chunk_count
       FROM assistants a
       LEFT JOIN users u ON u.id = a.userId
       ORDER BY a.created_at DESC`
    );

    // Get all widget clients with their owner info
    const widgets = await db.query<any>(
      `SELECT wc.id, wc.user_id, wc.website_url, wc.status, wc.subscription_tier,
              wc.message_count, wc.max_messages, wc.pages_ingested, wc.max_pages,
              wc.monthly_price, wc.created_at, wc.last_active,
              u.email AS owner_email, u.name AS owner_name,
              u.account_status AS owner_account_status
       FROM widget_clients wc
       LEFT JOIN users u ON u.id = wc.user_id
       ORDER BY wc.last_active DESC`
    );

    // Get all landing pages / generated sites with their owner info
    const landingPages = await db.query<any>(
      `SELECT gs.id, gs.widget_client_id, gs.business_name, gs.tagline,
              gs.contact_email, gs.contact_phone,
              gs.status, gs.theme_color, gs.created_at, gs.updated_at,
              gs.ftp_server, gs.ftp_directory, gs.ftp_protocol,
              gs.logo_url, gs.hero_image_url,
              gs.about_us, gs.services,
              gs.last_deployed_at,
              (gs.generated_html IS NOT NULL) AS has_html,
              LENGTH(gs.generated_html) AS html_size,
              u.email AS owner_email, u.name AS owner_name, u.id AS user_id,
              u.account_status AS owner_account_status
       FROM generated_sites gs
       LEFT JOIN users u ON u.id = gs.user_id
       ORDER BY gs.updated_at DESC`
    );

    // Get enterprise endpoints from SQLite
    let enterpriseEndpoints: any[] = [];
    try {
      enterpriseEndpoints = getAllEndpoints();
    } catch (_e) { /* SQLite may not be ready */ }

    // Count contacts by type for client stats
    const contactStats = await db.query<any>(
      `SELECT 
         COUNT(*) AS total,
         SUM(active = 1) AS active
       FROM contacts WHERE COALESCE(contact_type, 1) = 1`
    );
    const supplierStats = await db.query<any>(
      `SELECT COUNT(*) AS total FROM contacts WHERE contact_type = 2 AND active = 1`
    );

    // Summary stats
    const stats = {
      totalClients: contactStats[0]?.total ?? 0,
      activeClients: contactStats[0]?.active ?? 0,
      totalSuppliers: supplierStats[0]?.total ?? 0,
      suspendedClients: users.filter((u: any) => u.account_status === 'suspended').length,
      demoExpiredClients: users.filter((u: any) => u.account_status === 'demo_expired').length,
      totalAssistants: assistants.length,
      activeAssistants: assistants.filter((a: any) => a.status === 'active').length,
      totalWidgets: widgets.length,
      activeWidgets: widgets.filter((w: any) => w.status === 'active').length,
      totalLandingPages: landingPages.length,
      deployedLandingPages: landingPages.filter((lp: any) => lp.status === 'deployed').length,
      totalEndpoints: enterpriseEndpoints.length,
      activeEndpoints: enterpriseEndpoints.filter((ep: any) => ep.status === 'active').length,
    };

    res.json({
      success: true,
      stats,
      clients: users,
      assistants,
      widgets,
      landingPages,
      enterpriseEndpoints,
    });
  } catch (err) {
    console.error('[AdminClientManager] Overview error:', err);
    res.status(500).json({ success: false, error: 'Failed to load client overview' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/clients/:userId
// Single client detail with all assets
// ═════════════════════════════════════════════════════════════════════════
adminClientManagerRouter.get('/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;

    const user = await db.queryOne<any>(
      `SELECT id, email, name, account_status, createdAt, updatedAt,
              telemetry_consent_accepted, telemetry_opted_out, telemetry_consent_date
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const assistants = await db.query<any>(
      `SELECT a.id, a.name, a.description, a.status, a.tier, a.pages_indexed,
              a.business_type, a.personality, a.primary_goal, a.website, a.lead_capture_email,
              a.knowledge_categories,
              a.created_at, a.updated_at,
              (SELECT COUNT(DISTINCT ak.source) FROM assistant_knowledge ak WHERE ak.assistant_id = a.id COLLATE utf8mb4_0900_ai_ci) AS knowledge_source_count,
              (SELECT COUNT(*) FROM assistant_knowledge ak WHERE ak.assistant_id = a.id COLLATE utf8mb4_0900_ai_ci) AS knowledge_chunk_count
       FROM assistants a WHERE a.userId = ? ORDER BY a.created_at DESC`,
      [userId]
    );

    const landingPages = await db.query<any>(
      `SELECT gs.id, gs.widget_client_id, gs.business_name, gs.tagline,
              gs.contact_email, gs.contact_phone,
              gs.status, gs.theme_color, gs.created_at, gs.updated_at,
              gs.ftp_server, gs.ftp_directory, gs.ftp_protocol,
              gs.logo_url, gs.hero_image_url,
              gs.about_us, gs.services,
              gs.last_deployed_at,
              (gs.generated_html IS NOT NULL) AS has_html,
              LENGTH(gs.generated_html) AS html_size
       FROM generated_sites gs WHERE gs.user_id = ? ORDER BY gs.updated_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      client: user,
      assistants,
      landingPages,
    });
  } catch (err) {
    console.error('[AdminClientManager] Client detail error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load client details' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /admin/clients/:userId/chat-logs
// Sanitized AI chat history from SQLite analytics logs (developer only)
// ═════════════════════════════════════════════════════════════════════════
adminClientManagerRouter.get('/:userId/chat-logs', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const source = req.query.source as string; // optional filter: 'assistant' | 'widget' | 'enterprise'

    // Verify user exists
    const user = await db.queryOne<any>('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Query sanitized logs from SQLite (vectors.db)
    const Database = (await import('better-sqlite3')).default;
    const dbPath = '/var/opt/backend/data/vectors.db';
    const sqlite = new Database(dbPath, { readonly: true });

    let query = `SELECT id, client_id, source, sanitized_prompt, sanitized_response, model, provider, duration_ms, created_at
                 FROM ai_analytics_logs WHERE client_id = ?`;
    const params: any[] = [userId];

    if (source && ['assistant', 'widget', 'enterprise'].includes(source)) {
      query += ' AND source = ?';
      params.push(source);
    }

    // Get total count
    let countQuery = `SELECT COUNT(*) AS total FROM ai_analytics_logs WHERE client_id = ?`;
    const countParams: any[] = [userId];
    if (source && ['assistant', 'widget', 'enterprise'].includes(source)) {
      countQuery += ' AND source = ?';
      countParams.push(source);
    }
    const countResult = sqlite.prepare(countQuery).get(...countParams) as any;
    const total = countResult?.total || 0;

    // Get paginated results
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const logs = sqlite.prepare(query).all(...params);

    sqlite.close();

    return res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('[AdminClientManager] Chat logs error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load chat logs' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PATCH /admin/clients/:userId/status
// Update global account status (THE MASTER KILL SWITCH)
// ═════════════════════════════════════════════════════════════════════════
adminClientManagerRouter.patch('/:userId/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;
    const { status } = updateAccountStatusSchema.parse(req.body);

    const result = await db.execute(
      'UPDATE users SET account_status = ? WHERE id = ?',
      [status, userId]
    );

    if (result === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    console.log(`[AdminClientManager] Account ${userId} status → ${status} (by admin ${(req as any).userId})`);

    return res.json({
      success: true,
      message: `Account status updated to ${status}`,
      userId,
      status,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid status value', details: err.errors });
    }
    console.error('[AdminClientManager] Update account status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update account status' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PATCH /admin/clients/assistants/:assistantId/status
// Update individual assistant status
// ═════════════════════════════════════════════════════════════════════════
adminClientManagerRouter.patch('/assistants/:assistantId/status', async (req: AuthRequest, res: Response) => {
  try {
    const assistantId = req.params.assistantId;
    const { status } = updateAssistantStatusSchema.parse(req.body);

    const result = await db.execute(
      'UPDATE assistants SET status = ? WHERE id = ?',
      [status, assistantId]
    );

    if (result === 0) {
      return res.status(404).json({ success: false, error: 'Assistant not found' });
    }

    console.log(`[AdminClientManager] Assistant ${assistantId} status → ${status} (by admin ${(req as any).userId})`);

    return res.json({
      success: true,
      message: `Assistant status updated to ${status}`,
      assistantId,
      status,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid status value', details: err.errors });
    }
    console.error('[AdminClientManager] Update assistant status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update assistant status' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PATCH /admin/clients/widgets/:widgetId/status
// Update individual widget/endpoint status
// ═════════════════════════════════════════════════════════════════════════
adminClientManagerRouter.patch('/widgets/:widgetId/status', async (req: AuthRequest, res: Response) => {
  try {
    const widgetId = req.params.widgetId;
    const { status } = updateWidgetStatusSchema.parse(req.body);

    const result = await db.execute(
      'UPDATE widget_clients SET status = ? WHERE id = ?',
      [status, widgetId]
    );

    if (result === 0) {
      return res.status(404).json({ success: false, error: 'Widget client not found' });
    }

    console.log(`[AdminClientManager] Widget ${widgetId} status → ${status} (by admin ${(req as any).userId})`);

    return res.json({
      success: true,
      message: `Widget status updated to ${status}`,
      widgetId,
      status,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid status value', details: err.errors });
    }
    console.error('[AdminClientManager] Update widget status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update widget status' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /admin/clients/:userId/suspend-all
// Nuclear option: suspend account + all assets in one go
// ═════════════════════════════════════════════════════════════════════════
adminClientManagerRouter.post('/:userId/suspend-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;

    // Suspend account
    await db.execute(
      'UPDATE users SET account_status = ? WHERE id = ?',
      ['suspended', userId]
    );

    // Suspend all assistants
    const assistantResult = await db.execute(
      'UPDATE assistants SET status = ? WHERE userId = ?',
      ['suspended', userId]
    );

    // Suspend all widget clients
    const widgetResult = await db.execute(
      "UPDATE widget_clients SET status = ? WHERE user_id = ?",
      ['suspended', userId]
    );

    console.log(`[AdminClientManager] FULL SUSPEND: Account ${userId} + ${assistantResult} assistants + ${widgetResult} widgets (by admin ${(req as any).userId})`);

    return res.json({
      success: true,
      message: 'Account and all assets suspended',
      userId,
      assistantsSuspended: assistantResult,
      widgetsSuspended: widgetResult,
    });
  } catch (err) {
    console.error('[AdminClientManager] Suspend all error:', err);
    return res.status(500).json({ success: false, error: 'Failed to suspend account' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /admin/clients/:userId/reactivate-all
// Reactivate account + all assets
// ═════════════════════════════════════════════════════════════════════════
adminClientManagerRouter.post('/:userId/reactivate-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId;

    await db.execute(
      'UPDATE users SET account_status = ? WHERE id = ?',
      ['active', userId]
    );

    const assistantResult = await db.execute(
      'UPDATE assistants SET status = ? WHERE userId = ?',
      ['active', userId]
    );

    const widgetResult = await db.execute(
      "UPDATE widget_clients SET status = ? WHERE user_id = ?",
      ['active', userId]
    );

    console.log(`[AdminClientManager] FULL REACTIVATE: Account ${userId} + ${assistantResult} assistants + ${widgetResult} widgets (by admin ${(req as any).userId})`);

    return res.json({
      success: true,
      message: 'Account and all assets reactivated',
      userId,
      assistantsReactivated: assistantResult,
      widgetsReactivated: widgetResult,
    });
  } catch (err) {
    console.error('[AdminClientManager] Reactivate all error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reactivate account' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /admin/clients/:userId/masquerade
// Admin logs in as any user (issues JWT for target user)
// ═════════════════════════════════════════════════════════════════════════
adminClientManagerRouter.post('/:userId/masquerade', async (req: AuthRequest, res: Response) => {
  try {
    const adminId = (req as any).userId;
    const targetUserId = req.params.userId;

    // Verify target user exists
    const targetUser = await db.queryOne<any>(
      'SELECT id, email, name, account_status FROM users WHERE id = ?',
      [targetUserId]
    );

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Prevent masquerading as yourself
    if (adminId === targetUserId) {
      return res.status(400).json({ success: false, error: 'Cannot masquerade as yourself' });
    }

    // Build the frontend user shape for the target user
    const frontendUser = await buildFrontendUser(targetUserId);
    if (!frontendUser) {
      return res.status(404).json({ success: false, error: 'Failed to build user profile' });
    }

    // Issue a JWT for the target user (1h expiry, shorter for safety)
    const masqueradeToken = signAccessToken({ userId: targetUserId }, '1h');

    // Issue a separate admin restore token (so admin can return to their own session)
    const adminRestoreToken = signAccessToken({ userId: adminId }, '2h');

    console.log(`[AdminClientManager] MASQUERADE: Admin ${adminId} → User ${targetUserId} (${targetUser.email})`);

    return res.json({
      success: true,
      message: `Now masquerading as ${targetUser.email}`,
      data: {
        token: masqueradeToken,
        user: frontendUser,
        adminRestoreToken,
        masquerading: true,
        adminId,
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
        },
      },
    });
  } catch (err) {
    console.error('[AdminClientManager] Masquerade error:', err);
    return res.status(500).json({ success: false, error: 'Failed to masquerade as user' });
  }
});

// ─── Client Documentation ───────────────────────────────────────────────
/**
 * GET /admin/clients/:contactId/documentation
 *
 * Reads the Api.md file from the enterprise documentation folder for a contact.
 * Path: /var/opt/documentation/Enterprise/Clients/:contactId/Api.md
 *
 * This is a standard pattern — every enterprise client can have an Api.md
 * in their numbered folder. The frontend Documentation tab renders it.
 *
 * Query params:
 *   ?file=<filename>  — optional, defaults to "Api.md"
 *
 * Returns:
 *   { success: true, content: "# Markdown...", filename: "Api.md", contactId: "68" }
 */
adminClientManagerRouter.get('/:contactId/documentation', async (req: AuthRequest, res: Response) => {
  try {
    const { contactId } = req.params;
    const filename = (req.query.file as string) || 'Api.md';

    // Sanitize: only allow simple filenames ending in .md, no path traversal
    if (!/^[a-zA-Z0-9_-]+\.md$/.test(filename)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename. Only .md files with alphanumeric names are allowed.',
      });
    }

    // Sanitize contactId — must be numeric
    if (!/^\d+$/.test(contactId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contact ID.',
      });
    }

    const filePath = path.join(DOCS_BASE, contactId, filename);

    // Verify the resolved path stays within the docs directory (prevent traversal)
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(DOCS_BASE))) {
      return res.status(403).json({
        success: false,
        error: 'Access denied.',
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'DOCUMENTATION_NOT_FOUND',
        message: `No documentation file '${filename}' found for contact ${contactId}.`,
      });
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    return res.json({
      success: true,
      content,
      filename,
      contactId,
    });
  } catch (err) {
    console.error('[AdminClientManager] Documentation read error:', err);
    return res.status(500).json({ success: false, error: 'Failed to read documentation' });
  }
});

/**
 * GET /admin/clients/:contactId/documentation/list
 *
 * Lists all .md documentation files available for a contact.
 * Returns filenames and sizes for the frontend to offer a file picker.
 */
adminClientManagerRouter.get('/:contactId/documentation/list', async (req: AuthRequest, res: Response) => {
  try {
    const { contactId } = req.params;

    if (!/^\d+$/.test(contactId)) {
      return res.status(400).json({ success: false, error: 'Invalid contact ID.' });
    }

    const dirPath = path.join(DOCS_BASE, contactId);

    if (!fs.existsSync(dirPath)) {
      return res.json({ success: true, files: [], contactId });
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => {
        const stat = fs.statSync(path.join(dirPath, e.name));
        return {
          filename: e.name,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => {
        // Api.md always first
        if (a.filename === 'Api.md') return -1;
        if (b.filename === 'Api.md') return 1;
        return a.filename.localeCompare(b.filename);
      });

    return res.json({ success: true, files, contactId });
  } catch (err) {
    console.error('[AdminClientManager] Documentation list error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list documentation' });
  }
});
