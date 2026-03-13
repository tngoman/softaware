/**
 * Updates – File Upload & Download Router
 *
 * POST /updates/upload              — API Key: upload update package (multipart/form-data)
 * GET  /updates/download?update_id= — Public: download update file (requires X-Software-Key)
 */
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/mysql.js';
import { badRequest, notFound, unauthorized } from '../utils/httpErrors.js';
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'updates');
// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// Multer config — store temporarily, rename after validation
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_');
        cb(null, `tmp_${Date.now()}_${safeName}`);
    },
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500 MB max
// The API key for upload operations (matches the old PHP system)
const UPLOAD_API_KEY = 'softaware_test_update_key_2026';
export const updFilesRouter = Router();
// ─── POST /upload ─ multipart file upload ──────────────────────────
updFilesRouter.post('/upload', upload.single('updatePackage'), async (req, res, next) => {
    try {
        // Validate API key or JWT Bearer token
        const apiKey = req.header('X-API-Key');
        const authHeader = req.header('Authorization');
        let uploadedBy = null;
        let isAuthorized = false;
        // Method 1: API key
        if (apiKey && apiKey === UPLOAD_API_KEY) {
            isAuthorized = true;
        }
        // Method 2: JWT Bearer token (admin)
        if (!isAuthorized && authHeader?.toLowerCase().startsWith('bearer ')) {
            try {
                const jwt = await import('jsonwebtoken');
                const { env } = await import('../config/env.js');
                const decoded = jwt.default.verify(authHeader.slice(7), env.JWT_SECRET);
                if (decoded?.userId) {
                    uploadedBy = decoded.userId;
                    isAuthorized = true;
                }
            }
            catch { /* invalid token */ }
        }
        if (!isAuthorized) {
            if (req.file)
                fs.unlinkSync(req.file.path);
            throw unauthorized('Invalid or missing API key or Bearer token');
        }
        if (!req.file)
            throw badRequest('No file uploaded (field: updatePackage)');
        const body = z.object({
            software_id: z.coerce.number(),
            version: z.string().min(1),
            description: z.string().optional(),
            has_migrations: z.coerce.number().optional(),
            migration_notes: z.string().optional(),
            checksum: z.string().optional(),
            update_id: z.coerce.number().optional(),
        }).parse(req.body);
        // Verify software exists
        const sw = await db.queryOne('SELECT id FROM update_software WHERE id = ?', [body.software_id]);
        if (!sw) {
            fs.unlinkSync(req.file.path);
            throw badRequest('Invalid software_id');
        }
        // Build final filename
        const safeName = req.file.originalname.replace(/[^A-Za-z0-9._-]/g, '_');
        const finalName = `${body.version}_${Math.floor(Date.now() / 1000)}_${safeName}`;
        const finalPath = path.join(UPLOAD_DIR, finalName);
        const relPath = `uploads/updates/${finalName}`;
        // Rename temp file to final name
        fs.renameSync(req.file.path, finalPath);
        // Compute checksum
        const fileBuffer = fs.readFileSync(finalPath);
        const computedChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        // uploadedBy was already extracted during auth check above
        // If we authed via API key, try to extract user from Bearer for attribution
        if (!uploadedBy) {
            const auth = req.header('authorization');
            if (auth?.toLowerCase().startsWith('bearer ')) {
                try {
                    const jwt = await import('jsonwebtoken');
                    const { env } = await import('../config/env.js');
                    const decoded = jwt.default.verify(auth.slice(7), env.JWT_SECRET);
                    if (decoded?.userId)
                        uploadedBy = decoded.userId;
                }
                catch { /* fall through */ }
            }
        }
        let updateId;
        if (body.update_id) {
            // Replace existing
            const existing = await db.queryOne('SELECT * FROM update_releases WHERE id = ?', [body.update_id]);
            if (!existing)
                throw notFound('Update not found for replacement');
            // Delete old file
            if (existing.file_path) {
                const oldPath = path.resolve(process.cwd(), existing.file_path);
                try {
                    fs.unlinkSync(oldPath);
                }
                catch { /* ok */ }
            }
            await db.execute(`UPDATE update_releases SET software_id = ?, version = ?, description = ?,
         file_path = ?, has_migrations = ?, migration_notes = ?, released_at = NOW()
         WHERE id = ?`, [
                body.software_id, body.version, body.description || null,
                relPath, body.has_migrations || 0, body.migration_notes || null,
                body.update_id,
            ]);
            updateId = body.update_id;
        }
        else {
            // Create new
            const result = await db.insert(`INSERT INTO update_releases (software_id, version, description, file_path,
          uploaded_by, has_migrations, migration_notes, released_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`, [
                body.software_id, body.version, body.description || null,
                relPath, uploadedBy, body.has_migrations || 0, body.migration_notes || null,
            ]);
            updateId = Number(result);
        }
        res.json({
            success: true,
            message: 'Update uploaded successfully',
            update_id: updateId,
            file_path: relPath,
            checksum: computedChecksum,
        });
    }
    catch (err) {
        // Clean up temp file on error
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            }
            catch { /* ok */ }
        }
        next(err);
    }
});
// ─── GET /download ─ file download ─────────────────────────────────
updFilesRouter.get('/download', async (req, res, next) => {
    try {
        const updateId = z.coerce.number().parse(req.query.update_id);
        const softwareKey = req.header('X-Software-Key') || req.query.software_key;
        if (!softwareKey)
            throw badRequest('Missing software key (X-Software-Key header or ?software_key= param)');
        // Verify software key is valid
        const sw = await db.queryOne('SELECT id FROM update_software WHERE software_key = ?', [softwareKey]);
        if (!sw)
            throw notFound('Invalid software key');
        const update = await db.queryOne('SELECT * FROM update_releases WHERE id = ?', [updateId]);
        if (!update)
            throw notFound('Update not found');
        if (!update.file_path)
            throw notFound('No file associated with this update');
        const filePath = path.resolve(process.cwd(), update.file_path);
        if (!fs.existsSync(filePath))
            throw notFound('File not found on disk');
        const filename = path.basename(filePath);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
    }
    catch (err) {
        next(err);
    }
});
