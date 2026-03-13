import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
import { documentService } from './documentService.js';
export const crawlerService = {
    /**
     * Add a URL to the crawl queue
     */
    async enqueueCrawl(clientId, url) {
        const id = randomUUID();
        const now = toMySQLDate(new Date());
        await db.execute(`INSERT INTO crawl_queue (
        id, client_id, url, status, retries, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, clientId, url, 'pending', 0, now, now]);
        return {
            id,
            client_id: clientId,
            url,
            status: 'pending',
            error_message: null,
            retries: 0,
            created_at: now,
            updated_at: now
        };
    },
    /**
     * Get next pending crawl job
     */
    async getNextJob() {
        const job = await db.queryOne(`SELECT * FROM crawl_queue 
       WHERE status = 'pending' 
       AND retries < 3 
       ORDER BY created_at ASC 
       LIMIT 1`);
        return job || null;
    },
    /**
     * Mark job as processing
     */
    async markProcessing(jobId) {
        await db.execute(`UPDATE crawl_queue 
       SET status = 'processing', updated_at = ? 
       WHERE id = ?`, [toMySQLDate(new Date()), jobId]);
    },
    /**
     * Mark job as completed
     */
    async markCompleted(jobId) {
        await db.execute(`UPDATE crawl_queue 
       SET status = 'completed', updated_at = ? 
       WHERE id = ?`, [toMySQLDate(new Date()), jobId]);
    },
    /**
     * Mark job as failed
     */
    async markFailed(jobId, errorMessage) {
        await db.execute(`UPDATE crawl_queue 
       SET status = 'failed', error_message = ?, retries = retries + 1, updated_at = ? 
       WHERE id = ?`, [errorMessage, toMySQLDate(new Date()), jobId]);
    },
    /**
     * Process pending crawl jobs
     */
    async processPendingJobs(maxJobs = 10) {
        let processed = 0;
        let succeeded = 0;
        let failed = 0;
        for (let i = 0; i < maxJobs; i++) {
            const job = await this.getNextJob();
            if (!job)
                break;
            processed++;
            await this.markProcessing(job.id);
            const result = await documentService.crawlWebsite(job.client_id, job.url);
            if (result.success) {
                await this.markCompleted(job.id);
                succeeded++;
            }
            else {
                await this.markFailed(job.id, result.error || 'Unknown error');
                failed++;
            }
        }
        return { processed, succeeded, failed };
    },
    /**
     * Get all crawl jobs for a client
     */
    async getClientJobs(clientId) {
        return db.query('SELECT * FROM crawl_queue WHERE client_id = ? ORDER BY created_at DESC', [clientId]);
    },
    /**
     * Re-enqueue all completed jobs for re-crawling
     */
    async reEnqueueCompleted() {
        const completedJobs = await db.query(`SELECT * FROM crawl_queue WHERE status = 'completed'`);
        let count = 0;
        for (const job of completedJobs) {
            await db.execute(`UPDATE crawl_queue 
         SET status = 'pending', error_message = NULL, updated_at = ? 
         WHERE id = ?`, [toMySQLDate(new Date()), job.id]);
            count++;
        }
        return count;
    }
};
