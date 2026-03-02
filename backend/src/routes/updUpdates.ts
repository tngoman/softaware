/**
 * Updates – Update Packages CRUD Router
 *
 * GET    /updates/updates             — Public: list all
 * GET    /updates/updates?id=N        — Public: single
 * GET    /updates/updates?limit=N     — Public: limit results
 * POST   /updates/updates             — Admin: create update record
 * PUT    /updates/updates             — Admin: modify update
 * DELETE /updates/updates?id=N        — Admin: delete update + file
 */

import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/mysql.js';
import type { UpdUpdate } from '../db/updatesTypes.js';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

export const updUpdatesRouter = Router();

// ─── GET ─ list / single ───────────────────────────────────────────
updUpdatesRouter.get('/', async (req, res, next) => {
  try {
    const id = req.query.id ? Number(req.query.id) : null;
    const limit = req.query.limit ? Number(req.query.limit) : null;

    if (id) {
      const update = await db.queryOne<any>(
        `SELECT u.*, s.name AS software_name, usr.name AS uploaded_by_name
         FROM update_releases u
         LEFT JOIN update_software s ON u.software_id = s.id
         LEFT JOIN users usr ON u.uploaded_by = usr.id
         WHERE u.id = ?`,
        [id]
      );
      if (!update) throw notFound('Update not found');
      return res.json({ success: true, update });
    }

    let sql = `SELECT u.*, s.name AS software_name, usr.name AS uploaded_by_name
       FROM update_releases u
       LEFT JOIN update_software s ON u.software_id = s.id
       LEFT JOIN users usr ON u.uploaded_by = usr.id
       ORDER BY u.created_at DESC`;
    const params: any[] = [];

    if (limit && limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const updates = await db.query<any>(sql, params);
    res.json({ success: true, updates });
  } catch (err) {
    next(err);
  }
});

// ─── POST ─ create record ──────────────────────────────────────────
updUpdatesRouter.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const body = z.object({
      software_id: z.number().optional(),
      version: z.string().min(1),
      description: z.string().optional(),
      file_path: z.string().optional(),
      has_migrations: z.union([z.boolean(), z.number()]).optional(),
      migration_notes: z.string().optional(),
      schema_file: z.string().optional(),
    }).parse(req.body);

    const result = await db.insert(
      `INSERT INTO update_releases (software_id, version, description, file_path,
        uploaded_by, has_migrations, migration_notes, schema_file, released_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        body.software_id || null,
        body.version,
        body.description || null,
        body.file_path || null,
        userId,
        body.has_migrations ? 1 : 0,
        body.migration_notes || null,
        body.schema_file || null,
      ]
    );

    res.json({ success: true, message: 'Update created successfully', id: Number(result) });
  } catch (err) {
    next(err);
  }
});

// ─── PUT ─ modify ──────────────────────────────────────────────────
updUpdatesRouter.put('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      id: z.number(),
      software_id: z.number().optional(),
      version: z.string().optional(),
      description: z.string().optional(),
      file_path: z.string().optional(),
      has_migrations: z.union([z.boolean(), z.number()]).optional(),
      migration_notes: z.string().optional(),
      schema_file: z.string().optional(),
    }).parse(req.body);

    const existing = await db.queryOne<UpdUpdate>('SELECT * FROM update_releases WHERE id = ?', [body.id]);
    if (!existing) throw notFound('Update not found');

    const fields: string[] = [];
    const params: any[] = [];
    const add = (col: string, val: any) => {
      if (val !== undefined) { fields.push(`${col} = ?`); params.push(val); }
    };

    add('software_id', body.software_id);
    add('version', body.version);
    add('description', body.description);
    add('file_path', body.file_path);
    add('has_migrations', body.has_migrations !== undefined ? (body.has_migrations ? 1 : 0) : undefined);
    add('migration_notes', body.migration_notes);
    add('schema_file', body.schema_file);

    if (fields.length === 0) throw badRequest('No fields to update');

    params.push(body.id);
    await db.execute(`UPDATE update_releases SET ${fields.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Update modified successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE ────────────────────────────────────────────────────────
updUpdatesRouter.delete('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.coerce.number().parse(req.query.id);
    const existing = await db.queryOne<UpdUpdate>('SELECT * FROM update_releases WHERE id = ?', [id]);
    if (!existing) throw notFound('Update not found');

    // Delete associated file
    if (existing.file_path) {
      const filePath = path.join(UPLOAD_DIR, '..', existing.file_path);
      try { fs.unlinkSync(filePath); } catch { /* file may not exist */ }
    }

    await db.execute('DELETE FROM update_releases WHERE id = ?', [id]);
    res.json({ success: true, message: 'Update deleted successfully' });
  } catch (err) {
    next(err);
  }
});
