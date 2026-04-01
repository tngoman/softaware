/**
 * Studio Sites API — Staff-only site management
 *
 * Staff can view/edit/manage any client's sites through the Studio.
 * All operations are audit-logged via the admin auditLogger middleware.
 *
 * GET    /api/v1/studio/sites                        — list all sites (staff view)
 * GET    /api/v1/studio/sites/stats                  — aggregate stats
 * GET    /api/v1/studio/sites/:siteId                — get site with pages + owner info
 * PUT    /api/v1/studio/sites/:siteId                — update site data
 * POST   /api/v1/studio/sites                        — create site for a client
 * DELETE /api/v1/studio/sites/:siteId                — delete site
 *
 * Snapshots:
 * GET    /api/v1/studio/sites/:siteId/snapshots      — list snapshots
 * POST   /api/v1/studio/sites/:siteId/snapshots      — create snapshot
 * GET    /api/v1/studio/sites/:siteId/snapshots/:id  — get snapshot
 * DELETE /api/v1/studio/sites/:siteId/snapshots/:id  — delete snapshot
 *
 * Sticky Notes:
 * GET    /api/v1/studio/sites/:siteId/notes          — list sticky notes
 * POST   /api/v1/studio/sites/:siteId/notes          — create note
 * PUT    /api/v1/studio/sites/:siteId/notes/:id      — update note
 * DELETE /api/v1/studio/sites/:siteId/notes/:id      — delete note
 * POST   /api/v1/studio/sites/:siteId/notes/:id/replies — add reply
 *
 * Collections:
 * GET    /api/v1/studio/sites/:siteId/collections             — list site collections
 * POST   /api/v1/studio/sites/:siteId/collections/:name       — create record in site collection
 * PATCH  /api/v1/studio/sites/:siteId/collections/:name/meta  — update collection metadata
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// All studio routes require auth (staff check done at mount level via auditLogger / admin guard)
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Helper: get staff user ID from request
// ---------------------------------------------------------------------------
function staffId(req: Request): string {
  const authReq = req as AuthRequest;
  return authReq.auth?.userId || authReq.userId || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// SITES CRUD
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// GET /sites — list all sites (with pagination, search, filters)
// ---------------------------------------------------------------------------
router.get('/sites', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let where = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (search) {
      where += ' AND (gs.business_name LIKE ? OR gs.id LIKE ? OR u.email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status) {
      where += ' AND gs.status = ?';
      params.push(status);
    }

    const sites = await db.query<Record<string, unknown>>(
      `SELECT gs.id, gs.business_name, gs.tagline, gs.status, gs.tier,
              gs.max_pages, gs.logo_url, gs.custom_domain,
              gs.created_at, gs.updated_at, gs.user_id,
              u.email AS owner_email, u.name AS owner_name,
              (SELECT COUNT(*) FROM site_pages sp WHERE sp.site_id = gs.id) AS page_count,
              (SELECT COUNT(*) FROM site_deployments sd WHERE sd.site_id = gs.id) AS deploy_count
       FROM generated_sites gs
       LEFT JOIN users u ON u.id = gs.user_id
       ${where}
       ORDER BY gs.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countRow = await db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM generated_sites gs
       LEFT JOIN users u ON u.id = gs.user_id ${where}`,
      params
    );

    return res.json({
      success: true,
      sites,
      total: countRow?.total ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[Studio Sites]', err);
    return res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// ---------------------------------------------------------------------------
// GET /sites/stats — aggregate statistics
// ---------------------------------------------------------------------------
router.get('/sites/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await db.queryOne<Record<string, number>>(`
      SELECT
        COUNT(*) AS total_sites,
        SUM(status = 'deployed') AS deployed,
        SUM(status = 'generating') AS generating,
        SUM(status = 'failed') AS failed,
        SUM(status = 'draft') AS draft,
        (SELECT COUNT(*) FROM site_pages) AS total_pages,
        (SELECT COUNT(*) FROM site_deployments) AS total_deployments
      FROM generated_sites
    `);
    return res.json({ success: true, stats });
  } catch (err) {
    console.error('[Studio Stats]', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ---------------------------------------------------------------------------
// GET /sites/:siteId — get site with pages + owner info
// ---------------------------------------------------------------------------
router.get('/sites/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    const site = await db.queryOne<Record<string, unknown>>(
      `SELECT gs.*, u.email AS owner_email, u.name AS owner_name
       FROM generated_sites gs
       LEFT JOIN users u ON u.id = gs.user_id
       WHERE gs.id = ?`,
      [siteId]
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const pages = await db.query<Record<string, unknown>>(
      `SELECT id, site_id, page_type, 
              page_title AS title, page_title AS name, 
              page_slug AS slug, 
              generated_html AS html_content,
              content_data AS css_content,
              sort_order, 
              CASE WHEN is_published = 1 THEN 'published' ELSE 'draft' END AS status,
              created_at, updated_at
       FROM site_pages WHERE site_id = ? ORDER BY sort_order ASC`,
      [siteId]
    );

    const deployments = await db.query<Record<string, unknown>>(
      `SELECT * FROM site_deployments WHERE site_id = ? ORDER BY deployed_at DESC LIMIT 10`,
      [siteId]
    );

    return res.json({ success: true, site, pages, deployments });
  } catch (err) {
    console.error('[Studio Site Detail]', err);
    return res.status(500).json({ error: 'Failed to fetch site' });
  }
});

// ---------------------------------------------------------------------------
// PUT /sites/:siteId — update site data (staff can edit any field)
// ---------------------------------------------------------------------------
router.put('/sites/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const updates = req.body as Record<string, unknown>;

    const allowedFields = [
      'business_name', 'tagline', 'about', 'services', 'status',
      'max_pages', 'custom_domain', 'primary_color', 'font_family',
      'logo_url', 'hero_image_url', 'include_assistant', 'include_form',
    ];

    const sets: string[] = [];
    const vals: unknown[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sets.push(`${key} = ?`);
        vals.push(val);
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    sets.push('updated_at = ?');
    vals.push(toMySQLDate(new Date()));
    vals.push(siteId);

    await db.execute(
      `UPDATE generated_sites SET ${sets.join(', ')} WHERE id = ?`,
      vals
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[Studio Site Update]', err);
    return res.status(500).json({ error: 'Failed to update site' });
  }
});

// ---------------------------------------------------------------------------
// POST /sites — create a new site (for a client)
// ---------------------------------------------------------------------------
router.post('/sites', async (req: Request, res: Response) => {
  try {
    const {
      clientId, businessName, tagline, about, services,
      primaryColor, fontFamily, maxPages = 5,
    } = req.body as Record<string, unknown>;

    if (!businessName) {
      return res.status(400).json({ error: 'businessName is required' });
    }

    // Use clientId if provided, otherwise fall back to authenticated staff user
    const userId = (clientId as string) || staffId(req);
    if (!userId) {
      return res.status(400).json({ error: 'clientId is required (or must be authenticated)' });
    }

    const id = `site-${Date.now()}`;
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO generated_sites
         (id, user_id, business_name, tagline, about, services, primary_color, font_family,
          max_pages, status, tier, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'paid', ?, ?)`,
      [
        id, userId, businessName, tagline || '', about || '', services || '',
        primaryColor || '#3B82F6', fontFamily || 'Inter', maxPages, now, now,
      ]
    );

    // Create default home page
    const pageId = randomUUID();
    await db.execute(
      `INSERT INTO site_pages (id, site_id, page_type, page_title, page_slug, sort_order, is_published, created_at, updated_at)
       VALUES (?, ?, 'home', 'Home', '/', 0, 1, ?, ?)`,
      [pageId, id, now, now]
    );

    return res.status(201).json({ success: true, siteId: id, pageId });
  } catch (err) {
    console.error('[Studio Create Site]', err);
    return res.status(500).json({ error: 'Failed to create site' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /sites/:siteId
// ---------------------------------------------------------------------------
router.delete('/sites/:siteId', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    const site = await db.queryOne<{ id: string }>(
      'SELECT id FROM generated_sites WHERE id = ?', [siteId]
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Cascade delete related data
    await db.execute('DELETE FROM studio_note_replies WHERE note_id IN (SELECT id FROM studio_sticky_notes WHERE site_id = ?)', [siteId]);
    await db.execute('DELETE FROM studio_sticky_notes WHERE site_id = ?', [siteId]);
    await db.execute('DELETE FROM studio_snapshots WHERE site_id = ?', [siteId]);
    await db.execute('DELETE FROM site_api_keys WHERE site_id = ?', [siteId]);
    await db.execute('DELETE FROM site_pages WHERE site_id = ?', [siteId]);
    await db.execute('DELETE FROM site_deployments WHERE site_id = ?', [siteId]);
    await db.execute('DELETE FROM site_form_submissions WHERE site_id = ?', [siteId]);
    await db.execute('DELETE FROM generated_sites WHERE id = ?', [siteId]);

    return res.json({ success: true });
  } catch (err) {
    console.error('[Studio Delete Site]', err);
    return res.status(500).json({ error: 'Failed to delete site' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/sites/:siteId/snapshots', async (req: Request, res: Response) => {
  try {
    const snapshots = await db.query<Record<string, unknown>>(
      `SELECT id, label, staff_id, created_at FROM studio_snapshots
       WHERE site_id = ? ORDER BY created_at DESC`,
      [req.params.siteId]
    );
    return res.json({ success: true, snapshots });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

router.post('/sites/:siteId/snapshots', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { label } = req.body as { label?: string };

    // Capture current page data
    const pages = await db.query<Record<string, unknown>>(
      'SELECT * FROM site_pages WHERE site_id = ?', [siteId]
    );
    const site = await db.queryOne<Record<string, unknown>>(
      'SELECT primary_color, font_family, about, services FROM generated_sites WHERE id = ?', [siteId]
    );

    const id = randomUUID();
    await db.execute(
      `INSERT INTO studio_snapshots (id, site_id, staff_id, label, page_data, styles_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, siteId, staffId(req), label || `Snapshot ${new Date().toISOString()}`,
       JSON.stringify(pages), JSON.stringify(site || {}), toMySQLDate(new Date())]
    );

    return res.status(201).json({ success: true, snapshotId: id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

router.get('/sites/:siteId/snapshots/:id', async (req: Request, res: Response) => {
  try {
    const snapshot = await db.queryOne<Record<string, unknown>>(
      'SELECT * FROM studio_snapshots WHERE id = ? AND site_id = ?',
      [req.params.id, req.params.siteId]
    );
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
    return res.json({ success: true, snapshot });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
});

router.delete('/sites/:siteId/snapshots/:id', async (req: Request, res: Response) => {
  try {
    await db.execute(
      'DELETE FROM studio_snapshots WHERE id = ? AND site_id = ?',
      [req.params.id, req.params.siteId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STICKY NOTES
// ═══════════════════════════════════════════════════════════════════════════

router.get('/sites/:siteId/notes', async (req: Request, res: Response) => {
  try {
    const pageId = req.query.pageId as string;
    let query = `SELECT n.*, u.name AS staff_name,
                   (SELECT COUNT(*) FROM studio_note_replies r WHERE r.note_id = n.id) AS reply_count
                 FROM studio_sticky_notes n
                 LEFT JOIN users u ON u.id = n.staff_id
                 WHERE n.site_id = ?`;
    const params: string[] = [req.params.siteId];

    if (pageId) {
      query += ' AND n.page_id = ?';
      params.push(pageId);
    }

    query += ' ORDER BY n.created_at DESC';
    const notes = await db.query<Record<string, unknown>>(query, params);

    return res.json({ success: true, notes });
  } catch (err) {
    console.error('[Studio Notes] Error fetching notes:', err);
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.post('/sites/:siteId/notes', async (req: Request, res: Response) => {
  try {
    const { content, color = 'yellow', pageId, posX = 100, posY = 100 } = req.body;

    if (!content) return res.status(400).json({ error: 'content is required' });

    const id = randomUUID();
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO studio_sticky_notes (id, site_id, page_id, staff_id, content, color, pos_x, pos_y, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.siteId, pageId || null, staffId(req), content, color, posX, posY, now, now]
    );

    return res.status(201).json({ success: true, noteId: id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create note' });
  }
});

router.put('/sites/:siteId/notes/:id', async (req: Request, res: Response) => {
  try {
    const { content, color, posX, posY, width, height, minimized, resolved } = req.body;
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (content !== undefined) { sets.push('content = ?'); vals.push(content); }
    if (color !== undefined) { sets.push('color = ?'); vals.push(color); }
    if (posX !== undefined) { sets.push('pos_x = ?'); vals.push(posX); }
    if (posY !== undefined) { sets.push('pos_y = ?'); vals.push(posY); }
    if (width !== undefined) { sets.push('width = ?'); vals.push(width); }
    if (height !== undefined) { sets.push('height = ?'); vals.push(height); }
    if (minimized !== undefined) { sets.push('minimized = ?'); vals.push(minimized ? 1 : 0); }
    if (resolved !== undefined) { sets.push('resolved = ?'); vals.push(resolved ? 1 : 0); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    sets.push('updated_at = ?');
    vals.push(toMySQLDate(new Date()));
    vals.push(req.params.id);
    vals.push(req.params.siteId);

    await db.execute(
      `UPDATE studio_sticky_notes SET ${sets.join(', ')} WHERE id = ? AND site_id = ?`,
      vals
    );

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/sites/:siteId/notes/:id', async (req: Request, res: Response) => {
  try {
    await db.execute('DELETE FROM studio_note_replies WHERE note_id = ?', [req.params.id]);
    await db.execute(
      'DELETE FROM studio_sticky_notes WHERE id = ? AND site_id = ?',
      [req.params.id, req.params.siteId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete note' });
  }
});

router.post('/sites/:siteId/notes/:id/replies', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });

    const id = randomUUID();
    await db.execute(
      `INSERT INTO studio_note_replies (id, note_id, staff_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.params.id, staffId(req), content, toMySQLDate(new Date())]
    );

    return res.status(201).json({ success: true, replyId: id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add reply' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SITE COLLECTIONS (staff access to site-scoped CMS data)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/sites/:siteId/collections', async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    const site = await db.queryOne<{ user_id: string }>(
      'SELECT user_id FROM generated_sites WHERE id = ?', [siteId]
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const collections = await db.query<{ collection_name: string; count: number; total_bytes: number }>(
      `SELECT collection_name, COUNT(*) AS count, SUM(byte_size) AS total_bytes
       FROM client_custom_data
       WHERE client_id = ? AND site_id = ?
       GROUP BY collection_name
       ORDER BY collection_name`,
      [site.user_id, siteId]
    );

    // Merge with metadata
    const metaRows = await db.query<{ collection_name: string; allow_public_write: number; schema_template: string | null }>(
      `SELECT collection_name, allow_public_write, schema_template
       FROM collection_metadata
       WHERE client_id = ? AND site_id = ?`,
      [site.user_id, siteId]
    );
    const metaMap = new Map(metaRows.map(m => [m.collection_name, m]));

    const result = collections.map(c => ({
      ...c,
      allowPublicWrite: metaMap.get(c.collection_name)?.allow_public_write === 1,
      schemaTemplate: metaMap.get(c.collection_name)?.schema_template
        ? JSON.parse(metaMap.get(c.collection_name)!.schema_template!)
        : null,
    }));

    return res.json({ success: true, collections: result });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

router.post('/sites/:siteId/collections/:name', async (req: Request, res: Response) => {
  try {
    const { siteId, name } = req.params;
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body required' });
    }

    const site = await db.queryOne<{ user_id: string }>(
      'SELECT user_id FROM generated_sites WHERE id = ?', [siteId]
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const docStr = JSON.stringify(body);
    if (docStr.length > 65536) {
      return res.status(400).json({ error: 'Document too large (max 64KB)' });
    }

    const id = randomUUID();
    const now = toMySQLDate(new Date());
    const byteSize = Buffer.byteLength(docStr, 'utf8');

    await db.execute(
      `INSERT INTO client_custom_data (id, client_id, site_id, collection_name, document_data, byte_size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, site.user_id, siteId, name, docStr, byteSize, now, now]
    );

    return res.status(201).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create record' });
  }
});

router.patch('/sites/:siteId/collections/:name/meta', async (req: Request, res: Response) => {
  try {
    const { siteId, name } = req.params;
    const { allowPublicWrite, schemaTemplate } = req.body;

    const site = await db.queryOne<{ user_id: string }>(
      'SELECT user_id FROM generated_sites WHERE id = ?', [siteId]
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const now = toMySQLDate(new Date());
    const id = randomUUID();

    // Upsert metadata
    await db.execute(
      `INSERT INTO collection_metadata (id, client_id, site_id, collection_name, allow_public_write, schema_template, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         allow_public_write = VALUES(allow_public_write),
         schema_template = VALUES(schema_template),
         updated_at = VALUES(updated_at)`,
      [id, site.user_id, siteId, name, allowPublicWrite ? 1 : 0,
       schemaTemplate ? JSON.stringify(schemaTemplate) : null, now, now]
    );

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update collection metadata' });
  }
});

// ── GET /sites/:siteId/collections/:name — list items in a collection ────
router.get('/sites/:siteId/collections/:name', async (req: Request, res: Response) => {
  try {
    const { siteId, name } = req.params;
    const site = await db.queryOne<{ user_id: string }>(
      'SELECT user_id FROM generated_sites WHERE id = ?', [siteId]
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const items = await db.query<{ id: string; data_key: string | null; document_data: string; created_at: string }>(
      `SELECT id, data_key, document_data, created_at
       FROM client_custom_data
       WHERE client_id = ? AND site_id = ? AND collection_name = ?
       ORDER BY created_at DESC
       LIMIT 200`,
      [site.user_id, siteId, name]
    );

    const parsed = items.map(item => ({
      id: item.id,
      data_key: item.data_key,
      data: JSON.parse(item.document_data || '{}'),
      created_at: item.created_at,
    }));

    return res.json({ success: true, items: parsed });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch collection items' });
  }
});

// ── DELETE /sites/:siteId/collections/:name/:id — delete a collection item ─
router.delete('/sites/:siteId/collections/:name/:id', async (req: Request, res: Response) => {
  try {
    const { siteId, name, id } = req.params;
    const site = await db.queryOne<{ user_id: string }>(
      'SELECT user_id FROM generated_sites WHERE id = ?', [siteId]
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const result = await db.execute(
      `DELETE FROM client_custom_data
       WHERE id = ? AND client_id = ? AND site_id = ? AND collection_name = ?`,
      [id, site.user_id, siteId, name]
    );

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete collection item' });
  }
});

export default router;
