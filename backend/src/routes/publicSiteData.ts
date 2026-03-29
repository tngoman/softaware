/**
 * Public Site Data API
 *
 * Unauthenticated read (and optionally write) API for deployed sites
 * to fetch their CMS collection data.
 *
 * GET  /api/v1/public/site-data/:siteId/:collectionName       — list records
 * GET  /api/v1/public/site-data/:siteId/:collectionName/:id   — get record
 * POST /api/v1/public/site-data/:siteId/:collectionName       — public write (if enabled)
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req: Request) => `site-read:${req.params.siteId}:${req.ip}`,
  message: { error: 'Rate limit exceeded. Try again shortly.' },
});

const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req: Request) => `site-write:${req.params.siteId}:${req.ip}`,
  message: { error: 'Write rate limit exceeded. Try again shortly.' },
});

// ---------------------------------------------------------------------------
// Validate site exists & get owner for CORS
// ---------------------------------------------------------------------------
async function getSiteInfo(siteId: string) {
  return db.queryOne<{
    id: string;
    user_id: string;
    custom_domain: string | null;
    business_name: string;
  }>(
    'SELECT id, user_id, custom_domain, business_name FROM generated_sites WHERE id = ?',
    [siteId]
  );
}

// ---------------------------------------------------------------------------
// CORS middleware scoped to site domain
// ---------------------------------------------------------------------------
function siteCors(req: Request, res: Response, next: () => void) {
  // Allow all origins for public API (sites are deployed to various domains)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Site-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

router.use(siteCors);

// ---------------------------------------------------------------------------
// GET /:siteId/:collectionName — list records
// ---------------------------------------------------------------------------
router.get('/:siteId/:collectionName', readLimiter, async (req: Request, res: Response) => {
  try {
    const { siteId, collectionName } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const sort = (req.query.sort as string) || '-created_at';

    const site = await getSiteInfo(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Determine sort direction
    const sortDesc = sort.startsWith('-');
    const sortField = sortDesc ? sort.slice(1) : sort;
    const allowedSortFields = ['created_at', 'updated_at'];
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
    const sortDir = sortDesc ? 'DESC' : 'ASC';

    const records = await db.query<{ id: string; document_data: string; created_at: string; updated_at: string }>(
      `SELECT id, document_data, created_at, updated_at
       FROM client_custom_data
       WHERE client_id = ? AND site_id = ? AND collection_name = ?
       ORDER BY ${safeSortField} ${sortDir}
       LIMIT ? OFFSET ?`,
      [site.user_id, siteId, collectionName, limit, offset]
    );

    const countRow = await db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM client_custom_data
       WHERE client_id = ? AND site_id = ? AND collection_name = ?`,
      [site.user_id, siteId, collectionName]
    );

    return res.json({
      success: true,
      data: records.map(r => ({
        id: r.id,
        ...JSON.parse(r.document_data),
        _created: r.created_at,
        _updated: r.updated_at,
      })),
      total: countRow?.total ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[PublicSiteData] List error:', (err as Error).message);
    return res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// ---------------------------------------------------------------------------
// GET /:siteId/:collectionName/:id — get single record
// ---------------------------------------------------------------------------
router.get('/:siteId/:collectionName/:id', readLimiter, async (req: Request, res: Response) => {
  try {
    const { siteId, collectionName, id } = req.params;

    const site = await getSiteInfo(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const record = await db.queryOne<{ id: string; document_data: string; created_at: string; updated_at: string }>(
      `SELECT id, document_data, created_at, updated_at
       FROM client_custom_data
       WHERE id = ? AND client_id = ? AND site_id = ? AND collection_name = ?`,
      [id, site.user_id, siteId, collectionName]
    );

    if (!record) return res.status(404).json({ error: 'Record not found' });

    return res.json({
      success: true,
      data: {
        id: record.id,
        ...JSON.parse(record.document_data),
        _created: record.created_at,
        _updated: record.updated_at,
      },
    });
  } catch (err) {
    console.error('[PublicSiteData] Get error:', (err as Error).message);
    return res.status(500).json({ error: 'Failed to fetch record' });
  }
});

// ---------------------------------------------------------------------------
// POST /:siteId/:collectionName — public write (if collection allows it)
// ---------------------------------------------------------------------------
router.post('/:siteId/:collectionName', writeLimiter, async (req: Request, res: Response) => {
  try {
    const { siteId, collectionName } = req.params;
    const body = req.body;

    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    const site = await getSiteInfo(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Check if collection allows public writes
    const meta = await db.queryOne<{ allow_public_write: number }>(
      `SELECT allow_public_write FROM collection_metadata
       WHERE client_id = ? AND site_id = ? AND collection_name = ?`,
      [site.user_id, siteId, collectionName]
    );

    if (!meta || !meta.allow_public_write) {
      return res.status(403).json({ error: 'Public writes not enabled for this collection' });
    }

    // Enforce max document size (64KB)
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
      [id, site.user_id, siteId, collectionName, docStr, byteSize, now, now]
    );

    // Update storage ledger
    await db.execute(
      `UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?`,
      [byteSize, site.user_id]
    );

    return res.status(201).json({ success: true, id });
  } catch (err) {
    console.error('[PublicSiteData] Write error:', (err as Error).message);
    return res.status(500).json({ error: 'Failed to write record' });
  }
});

export default router;
