/**
 * Assistant Ingestion API Routes
 *
 * POST /api/assistants/:assistantId/ingest/url    — enqueue a URL for scraping
 * POST /api/assistants/:assistantId/ingest/file   — upload + enqueue a file
 * GET  /api/assistants/:assistantId/ingest/status — jobs list + indexed count
 * DELETE /api/assistants/:assistantId/ingest/job/:jobId — delete a job + its knowledge
 */
import express from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { deleteByJob as deleteVecByJob } from '../services/vectorStore.js';
import { createRequire } from 'module';
import { db, toMySQLDate } from '../db/mysql.js';
const router = express.Router({ mergeParams: true });
// ---------------------------------------------------------------------------
// Multer — memory storage, 10MB limit, allow PDF/TXT/DOC/DOCX
// ---------------------------------------------------------------------------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowed.includes(file.mimetype))
            return cb(null, true);
        cb(new Error('Only PDF, TXT, DOC, DOCX allowed'));
    },
});
// ---------------------------------------------------------------------------
// Queue position helper
// Counts:  all pending paid jobs  +  free pending jobs submitted before NOW
// Returns how many jobs are ahead of a newly submitted free-tier job.
// Paid-tier jobs return 0 (they jump the queue).
// ---------------------------------------------------------------------------
async function calculateQueuePosition(tier) {
    if (tier === 'paid')
        return 0;
    const row = await db.queryOne(`SELECT
       (SELECT COUNT(*) FROM ingestion_jobs WHERE status = 'pending' AND tier = 'paid') +
       (SELECT COUNT(*) FROM ingestion_jobs WHERE status = 'pending' AND tier = 'free')
     AS pos`);
    return row?.pos ?? 0;
}
// ---------------------------------------------------------------------------
// Validate assistant exists
// ---------------------------------------------------------------------------
async function assertAssistantExists(assistantId) {
    const row = await db.queryOne('SELECT id FROM assistants WHERE id = ?', [assistantId]);
    return !!row;
}
// ---------------------------------------------------------------------------
// POST /url — enqueue a URL crawl job
// ---------------------------------------------------------------------------
router.post('/url', async (req, res) => {
    try {
        const params = req.params;
        const { assistantId } = params;
        const { url, tier = 'free' } = req.body;
        if (!url)
            return res.status(400).json({ error: 'url is required' });
        try {
            new URL(url);
        }
        catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        if (!(await assertAssistantExists(assistantId))) {
            return res.status(404).json({ error: 'Assistant not found' });
        }
        const resolvedTier = (tier === 'paid' ? 'paid' : 'free');
        const queuePosition = await calculateQueuePosition(resolvedTier);
        const id = randomUUID();
        const now = toMySQLDate(new Date());
        await db.execute(`INSERT INTO ingestion_jobs
         (id, assistant_id, job_type, source, tier, status, queue_position, created_at, updated_at)
       VALUES (?, ?, 'url', ?, ?, 'pending', ?, ?, ?)`, [id, assistantId, url, resolvedTier, queuePosition, now, now]);
        return res.json({
            success: true,
            jobId: id,
            queuePosition,
            tier: resolvedTier,
            message: resolvedTier === 'paid'
                ? 'Your URL is being processed immediately (paid tier).'
                : `Queued at position ${queuePosition + 1}. Upgrade to paid for instant processing.`,
        });
    }
    catch (err) {
        console.error('[Ingest URL]', err);
        return res.status(500).json({ error: 'Failed to enqueue URL', details: err.message });
    }
});
// ---------------------------------------------------------------------------
// POST /file — upload + enqueue a file ingestion job
// ---------------------------------------------------------------------------
router.post('/file', upload.single('file'), async (req, res) => {
    try {
        const { assistantId } = req.params;
        const { tier = 'free' } = req.body;
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'file is required' });
        if (!(await assertAssistantExists(assistantId))) {
            return res.status(404).json({ error: 'Assistant not found' });
        }
        // Extract text from uploaded file
        let content = '';
        if (file.mimetype === 'text/plain') {
            content = file.buffer.toString('utf-8');
        }
        else if (file.mimetype === 'application/pdf') {
            // Use CommonJS require to work around ESM module issues with pdf-parse
            const require = createRequire(import.meta.url);
            const pdfParse = require('pdf-parse');
            const pdfData = await pdfParse(file.buffer);
            content = pdfData.text;
        }
        else {
            // DOC / DOCX via mammoth
            const require = createRequire(import.meta.url);
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            content = result.value;
        }
        if (content.trim().length < 20) {
            return res.status(400).json({ error: 'File content too short or unreadable' });
        }
        const resolvedTier = (tier === 'paid' ? 'paid' : 'free');
        const queuePosition = await calculateQueuePosition(resolvedTier);
        const id = randomUUID();
        const now = toMySQLDate(new Date());
        // Store original content for text files (so they can be edited later)
        const isTextFile = file.mimetype === 'text/plain' || !file.originalname.match(/\.(pdf|docx?)$/i);
        await db.execute(`INSERT INTO ingestion_jobs
         (id, assistant_id, job_type, source, file_content, original_content, tier, status, queue_position, created_at, updated_at)
       VALUES (?, ?, 'file', ?, ?, ?, ?, 'pending', ?, ?, ?)`, [id, assistantId, file.originalname, content, isTextFile ? content : null, resolvedTier, queuePosition, now, now]);
        return res.json({
            success: true,
            jobId: id,
            filename: file.originalname,
            queuePosition,
            tier: resolvedTier,
            contentLength: content.length,
            message: resolvedTier === 'paid'
                ? 'Your file is being processed immediately (paid tier).'
                : `Queued at position ${queuePosition + 1}. Upgrade to paid for instant processing.`,
        });
    }
    catch (err) {
        console.error('[Ingest File]', err);
        return res.status(500).json({ error: 'Failed to process file', details: err.message });
    }
});
// ---------------------------------------------------------------------------
// GET /status — jobs list and indexed page count for this assistant
// ---------------------------------------------------------------------------
router.get('/status', async (req, res) => {
    try {
        const params = req.params;
        const { assistantId } = params;
        const [assistant, jobs] = await Promise.all([
            db.queryOne('SELECT pages_indexed, tier FROM assistants WHERE id = ?', [assistantId]),
            db.query(`SELECT id, job_type, source, tier, status, queue_position, chunks_created, error_message, original_content, created_at
         FROM ingestion_jobs
         WHERE assistant_id = ?
         ORDER BY created_at DESC`, [assistantId]),
        ]);
        if (!assistant) {
            return res.status(404).json({ error: 'Assistant not found' });
        }
        const pendingCount = jobs.filter(j => j.status === 'pending' || j.status === 'processing').length;
        return res.json({
            success: true,
            pagesIndexed: assistant.pages_indexed,
            tier: assistant.tier,
            jobs,
            pendingCount,
        });
    }
    catch (err) {
        console.error('[Ingest Status]', err);
        return res.status(500).json({ error: 'Failed to fetch ingest status' });
    }
});
// ---------------------------------------------------------------------------
// DELETE /job/:jobId — remove a job + its knowledge chunks
// ---------------------------------------------------------------------------
router.delete('/job/:jobId', async (req, res) => {
    try {
        const params = req.params;
        const { assistantId, jobId } = params;
        // Verify job belongs to this assistant
        const job = await db.queryOne('SELECT id, chunks_created, status FROM ingestion_jobs WHERE id = ? AND assistant_id = ?', [jobId, assistantId]);
        if (!job)
            return res.status(404).json({ error: 'Job not found' });
        // Delete knowledge chunks from MySQL
        await db.execute('DELETE FROM assistant_knowledge WHERE job_id = ?', [jobId]);
        // Delete from sqlite-vec vector store
        try {
            const vecDeleted = deleteVecByJob(jobId);
            if (vecDeleted > 0)
                console.log(`[Ingest] Deleted ${vecDeleted} vectors from sqlite-vec for job ${jobId}`);
        }
        catch (vecErr) {
            console.warn('[Ingest] sqlite-vec delete failed (non-fatal):', vecErr.message);
        }
        // Decrement pages_indexed (only if job was completed)
        if (job.status === 'completed') {
            await db.execute('UPDATE assistants SET pages_indexed = GREATEST(0, pages_indexed - 1) WHERE id = ?', [assistantId]);
        }
        await db.execute('DELETE FROM ingestion_jobs WHERE id = ?', [jobId]);
        return res.json({ success: true });
    }
    catch (err) {
        console.error('[Ingest Delete Job]', err);
        return res.status(500).json({ error: 'Failed to delete job' });
    }
});
export default router;
