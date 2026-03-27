/**
 * siteData.ts — Generic Headless CMS CRUD Router (Storage Ledger Edition)
 *
 * Provides the universal REST API for AI-generated sites to read/write
 * dynamic data (blog posts, products, testimonials, etc.).
 *
 * Storage Model:
 *   - Every CMS record stores its JSON byte_size in the row itself
 *   - users.storage_used_bytes is a running tally, updated atomically
 *     inside a MySQL transaction so the save + the ledger always agree
 *   - users.storage_limit_bytes is set per-tier on upgrade/downgrade
 *   - The enforceStorageLimit middleware pre-checks before the route runs
 *
 * Endpoints:
 *   GET    /api/v1/site-data/_usage                  — storage & quota stats
 *   GET    /api/v1/site-data/_collections             — list collections
 *   GET    /api/v1/site-data/:collectionName          — list all records
 *   GET    /api/v1/site-data/:collectionName/:id      — get one record
 *   POST   /api/v1/site-data/:collectionName          — create record
 *   PUT    /api/v1/site-data/:collectionName/:id      — update record
 *   DELETE /api/v1/site-data/:collectionName/:id      — delete record
 *
 * Dual-Write:
 *   - POST/PUT writes to MySQL (client_custom_data) inside a transaction
 *   - Then queues an async embedding job to shadow the data into sqlite-vec
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, pool } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireApiKey, ApiKeyRequest } from '../middleware/apiKey.js';
import { enforceStorageLimit, StorageLimitRequest } from '../middleware/storageLimit.js';
import { calculateByteSize } from '../utils/byteCalculator.js';
import { queueEmbeddingJob } from '../services/cmsEmbeddingQueue.js';
import { guardNewCollection, TierLimitError } from '../middleware/tierGuard.js';
import { requireActivePackageForUser } from '../services/packageResolver.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Middleware: Accept either session auth OR API key
// ---------------------------------------------------------------------------
function flexAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    return requireApiKey(req as ApiKeyRequest, res, next);
  }
  return requireAuth(req, res, next);
}

/**
 * Resolve the client_id from whichever auth method was used.
 */
function getClientId(req: Request): string {
  const apiKeyReq = req as ApiKeyRequest;
  if (apiKeyReq.apiKey?.userId) return apiKeyReq.apiKey.userId;
  const authReq = req as AuthRequest;
  if (authReq.auth?.userId) return authReq.auth.userId;
  if (authReq.userId) return authReq.userId;
  throw new Error('No authenticated client ID');
}

// Create the storage limit middleware bound to our getClientId resolver
const storageBouncer = enforceStorageLimit(getClientId);

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
const COLLECTION_NAME_REGEX = /^[a-z][a-z0-9_]{1,48}$/;

function validateCollectionName(name: string): boolean {
  return COLLECTION_NAME_REGEX.test(name);
}

// Max individual document size: 64 KB
const MAX_DOC_SIZE_BYTES = 64 * 1024;

async function getClientTierLimits(clientId: string) {
  const pkg = await requireActivePackageForUser(clientId);
  return pkg.limits;
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per client)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(clientId: string, maxRpm: number): boolean {
  if (maxRpm <= 0) return false;
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientId) || [];
  const recent = timestamps.filter(ts => now - ts < 60_000);
  if (recent.length >= maxRpm) return false;
  recent.push(now);
  rateLimitMap.set(clientId, recent);
  return true;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, timestamps] of rateLimitMap.entries()) {
    const recent = timestamps.filter(ts => now - ts < 60_000);
    if (recent.length === 0) rateLimitMap.delete(id);
    else rateLimitMap.set(id, recent);
  }
}, 5 * 60_000);

// ---------------------------------------------------------------------------
// Helper: build flat text for AI embedding
// ---------------------------------------------------------------------------
function buildEmbeddingText(collectionName: string, data: Record<string, any>): string {
  const flatText = Object.entries(data)
    .filter(([_, v]) => v !== null && v !== undefined)
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ');
      if (typeof value === 'object') return `${label}: ${JSON.stringify(value)}`;
      return `${label} is ${value}`;
    })
    .join('. ');
  return `Record in ${collectionName.replace(/_/g, ' ')}: ${flatText}.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Routes (read-only routes first, then _usage/_collections before :param)
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /_usage — Client storage & quota stats (progress bar data) ────────
router.get('/_usage', flexAuth, async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req);

    // Read the ledger directly from the users table
    const ledger = await db.queryOne<{
      storage_used_bytes: number;
      storage_limit_bytes: number;
    }>(`SELECT storage_used_bytes, storage_limit_bytes FROM users WHERE id = ?`, [clientId]);

    if (!ledger) return res.status(404).json({ error: 'Client not found.' });

    const limits = await getClientTierLimits(clientId);
    
    // Per-collection breakdown (live query, not cached)
    const collections = await db.query<{
      collection_name: string;
      cnt: number;
      total_bytes: number;
    }>(
      `SELECT collection_name,
              COUNT(*) as cnt,
              COALESCE(SUM(byte_size), 0) as total_bytes
       FROM client_custom_data
       WHERE client_id = ?
       GROUP BY collection_name
       ORDER BY total_bytes DESC`,
      [clientId]
    );

    const totalRecords = collections.reduce((sum, c) => sum + c.cnt, 0);
    const usedMb = ledger.storage_used_bytes / (1024 * 1024);
    const limitMb = ledger.storage_limit_bytes / (1024 * 1024);

    return res.json({
      success: true,
      usage: {
        storage: {
          usedBytes: ledger.storage_used_bytes,
          limitBytes: ledger.storage_limit_bytes,
          usedMb: Math.round(usedMb * 100) / 100,
          limitMb: Math.round(limitMb * 100) / 100,
          percent: limitMb > 0 ? Math.round((usedMb / limitMb) * 100) : 0
        },
        records: {
          used: totalRecords,
          // Removed arbitrary max boundaries, scaled naturally by storage
          limit: 99999,
          percent: 0
        },
        collections: {
          used: collections.length,
          limit: 999
        },
        rateLimit: { rpm: 600 }
      },
      breakdown: collections.map(c => ({
        collection: c.collection_name,
        records: c.cnt,
        storageBytes: c.total_bytes,
        storageMb: Math.round((c.total_bytes / (1024 * 1024)) * 100) / 100
      }))
    });
  } catch (error) {
    console.error('[SiteData] GET _usage error:', error);
    return res.status(500).json({ error: 'Failed to fetch usage stats.' });
  }
});

// ── GET /_collections — List all collection names for this client ─────────
router.get('/_collections', flexAuth, async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req);
    const collections = await db.query<{ collection_name: string; cnt: number }>(
      `SELECT collection_name, COUNT(*) as cnt
       FROM client_custom_data WHERE client_id = ?
       GROUP BY collection_name ORDER BY collection_name`,
      [clientId]
    );
    return res.json({
      success: true,
      collections: collections.map(c => ({ name: c.collection_name, recordCount: c.cnt }))
    });
  } catch (error) {
    console.error('[SiteData] GET _collections error:', error);
    return res.status(500).json({ error: 'Failed to fetch collections.' });
  }
});

// ── GET /:collectionName — List all records in a collection ────────────────
router.get('/:collectionName', flexAuth, async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req);
    const { collectionName } = req.params;

    if (!validateCollectionName(collectionName)) {
      return res.status(400).json({ error: 'Invalid collection name. Use lowercase letters, numbers, underscores (2-49 chars).' });
    }

    const rows = await db.query<{ id: string; document_data: any; created_at: string; updated_at: string }>(
      `SELECT id, document_data, created_at, updated_at
       FROM client_custom_data
       WHERE client_id = ? AND collection_name = ?
       ORDER BY created_at DESC`,
      [clientId, collectionName]
    );

    const records = rows.map(r => ({
      id: r.id,
      data: typeof r.document_data === 'string' ? JSON.parse(r.document_data) : r.document_data,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return res.json({ success: true, collection: collectionName, count: records.length, records });
  } catch (error) {
    console.error('[SiteData] GET list error:', error);
    return res.status(500).json({ error: 'Failed to fetch records.' });
  }
});

// ── GET /:collectionName/:id — Get a single record ────────────────────────
router.get('/:collectionName/:id', flexAuth, async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req);
    const { collectionName, id } = req.params;

    const row = await db.queryOne<{ id: string; document_data: any; created_at: string; updated_at: string }>(
      `SELECT id, document_data, created_at, updated_at
       FROM client_custom_data
       WHERE id = ? AND client_id = ? AND collection_name = ?`,
      [id, clientId, collectionName]
    );

    if (!row) return res.status(404).json({ error: 'Record not found.' });

    return res.json({
      success: true,
      record: {
        id: row.id,
        data: typeof row.document_data === 'string' ? JSON.parse(row.document_data) : row.document_data,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error) {
    console.error('[SiteData] GET one error:', error);
    return res.status(500).json({ error: 'Failed to fetch record.' });
  }
});

// ── POST /:collectionName — Create a new record ───────────────────────────
// Middleware chain: flexAuth → storageBouncer → handler
router.post('/:collectionName', flexAuth, storageBouncer, async (req: StorageLimitRequest, res: Response) => {
  try {
    const clientId = getClientId(req);
    const { collectionName } = req.params;
    const { data } = req.body;

    // ── Validation ──────────────────────────────────────────────────────
    if (!validateCollectionName(collectionName)) {
      return res.status(400).json({ error: 'Invalid collection name. Use lowercase letters, numbers, underscores (2-49 chars).' });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Request body must contain a "data" object.' });
    }

    const jsonStr = JSON.stringify(data);
    const bytesToAdd = req.incomingBytes || calculateByteSize(data);

    if (bytesToAdd > MAX_DOC_SIZE_BYTES) {
      return res.status(413).json({ error: `Document too large. Max ${MAX_DOC_SIZE_BYTES / 1024}KB per record.` });
    }

    // ── Tier limit checks (record count + collection count removed) ─────────────
    if (!checkRateLimit(clientId, 600)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    // ── Collection cap: reject if this is a NEW collection and user is at limit
    await guardNewCollection(clientId, collectionName);

    // ── Atomic Transaction: save CMS row + charge ledger ────────────────
    const itemId = crypto.randomUUID();

    await db.transaction(async (conn) => {
      // 1. Insert the CMS record with its byte_size
      await conn.query(
        `INSERT INTO client_custom_data (id, client_id, collection_name, document_data, byte_size)
         VALUES (?, ?, ?, ?, ?)`,
        [itemId, clientId, collectionName, jsonStr, bytesToAdd]
      );

      // 2. Charge the storage ledger
      await conn.query(
        `UPDATE users SET storage_used_bytes = storage_used_bytes + ? WHERE id = ?`,
        [bytesToAdd, clientId]
      );
    });

    // ── Queue AI embedding (non-blocking, outside transaction) ──────────
    const textToEmbed = buildEmbeddingText(collectionName, data);
    queueEmbeddingJob({ itemId, clientId, collectionName, textToEmbed, operation: 'upsert' });

    return res.status(201).json({
      success: true,
      id: itemId,
      message: 'Saved to CMS and queued for AI knowledge base.'
    });
  } catch (error) {
    if (error instanceof TierLimitError) {
      return res.status(error.status).json({
        error: error.message, code: error.code,
        resource: error.resource, current: error.current, limit: error.limit, tier: error.tier,
      });
    }
    console.error('[SiteData] POST error:', error);
    return res.status(500).json({ error: 'Failed to save record.' });
  }
});

// ── PUT /:collectionName/:id — Update a record ────────────────────────────
// storageBouncer is a pre-check; the real delta math happens in the transaction
router.put('/:collectionName/:id', flexAuth, storageBouncer, async (req: StorageLimitRequest, res: Response) => {
  try {
    const clientId = getClientId(req);
    const { collectionName, id } = req.params;
    const { data } = req.body;

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: 'Request body must contain a "data" object.' });
    }

    const jsonStr = JSON.stringify(data);
    const newBytes = req.incomingBytes || calculateByteSize(data);

    if (newBytes > MAX_DOC_SIZE_BYTES) {
      return res.status(413).json({ error: `Document too large. Max ${MAX_DOC_SIZE_BYTES / 1024}KB per record.` });
    }

    // Rate limit
        
    // Verify ownership + get old byte_size
    const existing = await db.queryOne<{ byte_size: number }>(
      `SELECT byte_size FROM client_custom_data WHERE id = ? AND client_id = ? AND collection_name = ?`,
      [id, clientId, collectionName]
    );
    if (!existing) return res.status(404).json({ error: 'Record not found.' });

    const oldBytes = existing.byte_size || 0;
    const bytesDelta = newBytes - oldBytes;

    // If expanding, verify the delta won't exceed the limit
    if (bytesDelta > 0) {
      const ledger = await db.queryOne<{ storage_used_bytes: number; storage_limit_bytes: number }>(
        `SELECT storage_used_bytes, storage_limit_bytes FROM users WHERE id = ?`,
        [clientId]
      );
      if (ledger && (ledger.storage_used_bytes + bytesDelta) > ledger.storage_limit_bytes) {
        return res.status(403).json({
          error: 'Storage limit would be exceeded. Please upgrade your plan.',
          code: 'STORAGE_FULL',
          requiredUpgrade: true
        });
      }
    }

    // ── Atomic Transaction: update row + adjust ledger ──────────────────
    await db.transaction(async (conn) => {
      // 1. Update the CMS record + its byte_size
      await conn.query(
        `UPDATE client_custom_data SET document_data = ?, byte_size = ? WHERE id = ? AND client_id = ?`,
        [jsonStr, newBytes, id, clientId]
      );

      // 2. Adjust the storage ledger by the delta (can be negative if shrinking)
      await conn.query(
        `UPDATE users SET storage_used_bytes = GREATEST(storage_used_bytes + ?, 0) WHERE id = ?`,
        [bytesDelta, clientId]
      );
    });

    // Queue updated embedding
    const textToEmbed = buildEmbeddingText(collectionName, data);
    queueEmbeddingJob({ itemId: id, clientId, collectionName, textToEmbed, operation: 'upsert' });

    return res.json({
      success: true,
      id,
      message: 'Record updated and re-queued for AI knowledge base.'
    });
  } catch (error) {
    console.error('[SiteData] PUT error:', error);
    return res.status(500).json({ error: 'Failed to update record.' });
  }
});

// ── DELETE /:collectionName/:id — Delete a record ─────────────────────────
router.delete('/:collectionName/:id', flexAuth, async (req: Request, res: Response) => {
  try {
    const clientId = getClientId(req);
    const { collectionName, id } = req.params;

    // Get the byte_size from the stored row
    const existing = await db.queryOne<{ byte_size: number }>(
      `SELECT byte_size FROM client_custom_data WHERE id = ? AND client_id = ? AND collection_name = ?`,
      [id, clientId, collectionName]
    );
    if (!existing) return res.status(404).json({ error: 'Record not found.' });

    const bytesToRefund = existing.byte_size || 0;

    // ── Atomic Transaction: delete row + refund ledger ──────────────────
    await db.transaction(async (conn) => {
      // 1. Delete the CMS record
      await conn.query(
        `DELETE FROM client_custom_data WHERE id = ? AND client_id = ?`,
        [id, clientId]
      );

      // 2. Refund the storage ledger
      await conn.query(
        `UPDATE users SET storage_used_bytes = GREATEST(storage_used_bytes - ?, 0) WHERE id = ?`,
        [bytesToRefund, clientId]
      );
    });

    // Queue deletion from sqlite-vec
    queueEmbeddingJob({ itemId: id, clientId, collectionName, textToEmbed: '', operation: 'delete' });

    return res.json({ success: true, message: 'Record deleted.' });
  } catch (error) {
    console.error('[SiteData] DELETE error:', error);
    return res.status(500).json({ error: 'Failed to delete record.' });
  }
});

export default router;
