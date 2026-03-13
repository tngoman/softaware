import express from 'express';
import { db } from '../db/mysql.js';
import { sendEmail } from '../services/emailService.js';
import { randomUUID } from 'crypto';
const router = express.Router();
// Rate limiting map: IP -> [timestamp array]
const rateLimitMap = new Map();
const MAX_REQUESTS_PER_MINUTE = 5;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
/**
 * Check rate limit for IP address
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const timestamps = rateLimitMap.get(ip) || [];
    // Filter out timestamps older than the window
    const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recentTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
        return false; // Rate limit exceeded
    }
    // Add current timestamp
    recentTimestamps.push(now);
    rateLimitMap.set(ip, recentTimestamps);
    return true;
}
/**
 * Clean up old rate limit entries every 5 minutes
 */
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of rateLimitMap.entries()) {
        const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
        if (recentTimestamps.length === 0) {
            rateLimitMap.delete(ip);
        }
        else {
            rateLimitMap.set(ip, recentTimestamps);
        }
    }
}, 5 * 60000);
/**
 * POST /v1/leads/submit
 *
 * Contact form router for generated websites
 * Handles submissions from static sites and emails site owners
 */
router.post('/submit', async (req, res) => {
    try {
        // Get client IP
        const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        // Rate limiting
        if (!checkRateLimit(clientIp)) {
            console.warn(`[Contact Form] Rate limit exceeded for IP: ${clientIp}`);
            return res.status(429).json({
                error: 'Too many requests. Please try again later.'
            });
        }
        const { client_id, name, email, message, honeypot } = req.body;
        // Honeypot check (bot detection)
        if (honeypot) {
            console.warn('[Contact Form] Honeypot triggered, likely spam');
            // Store as spam for tracking, then silently drop
            try {
                await db.execute(`INSERT INTO form_submissions
            (id, site_id, sender_name, sender_email, sender_phone, message, ip_address, honeypot_triggered, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'spam', NOW(), NOW())`, [randomUUID(), client_id || 'unknown', name || '', email || '', req.body.phone || null, message || '', clientIp]);
            }
            catch { /* best-effort */ }
            return res.json({
                success: true,
                message: 'Thank you for your message. We will get back to you soon.'
            });
        }
        // Validate required fields
        if (!client_id || !name || !email || !message) {
            return res.status(400).json({
                error: 'Missing required fields: client_id, name, email, message'
            });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }
        // Look up site owner's email
        let ownerEmail = null;
        // Try to find by site ID
        const site = await db.queryOne('SELECT contact_email, user_id FROM generated_sites WHERE id = ? OR widget_client_id = ?', [client_id, client_id]);
        if (site) {
            ownerEmail = site.contact_email;
            // If no contact email on site, get user's email
            if (!ownerEmail && site.user_id) {
                const user = await db.queryOne('SELECT email FROM users WHERE id = ?', [site.user_id]);
                ownerEmail = user?.email || null;
            }
        }
        // Try widget_clients table as fallback
        if (!ownerEmail) {
            const widgetClient = await db.queryOne('SELECT user_id FROM widget_clients WHERE id = ?', [client_id]);
            if (widgetClient?.user_id) {
                const user = await db.queryOne('SELECT email FROM users WHERE id = ?', [widgetClient.user_id]);
                ownerEmail = user?.email || null;
            }
        }
        if (!ownerEmail) {
            console.error('[Contact Form] Could not find owner email for client_id:', client_id);
            return res.status(404).json({
                error: 'Website configuration error. Please contact support.'
            });
        }
        // Resolve site_id for DB storage
        const siteId = site?.contact_email ? client_id : client_id;
        const resolvedSiteId = await (async () => {
            // Try to find a generated_sites row to get the proper UUID
            const s = await db.queryOne('SELECT id FROM generated_sites WHERE id = ? OR widget_client_id = ? LIMIT 1', [client_id, client_id]);
            return s?.id || client_id;
        })();
        // ── Store submission in form_submissions table ──────────────
        const submissionId = randomUUID();
        const isHoneypot = false; // already filtered above, but track explicit attempts
        try {
            await db.execute(`INSERT INTO form_submissions
          (id, site_id, sender_name, sender_email, sender_phone, message, source_page, ip_address, honeypot_triggered, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', NOW(), NOW())`, [
                submissionId,
                resolvedSiteId,
                name,
                email,
                req.body.phone || null,
                message,
                req.body.source_page || null,
                clientIp,
                isHoneypot ? 1 : 0,
            ]);
            console.log(`[Contact Form] Submission ${submissionId} stored for site ${resolvedSiteId}`);
        }
        catch (dbErr) {
            // Log but don't block the email — DB storage is additive
            console.error('[Contact Form] Failed to store submission in DB:', dbErr);
        }
        // ── Send email using shared emailService ───────────────────
        const emailResult = await sendEmail({
            to: ownerEmail,
            replyTo: email,
            subject: `New Contact Form Submission from ${name}`,
            html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${req.body.phone ? `<p><strong>Phone:</strong> ${req.body.phone}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This message was sent via your Soft Aware website contact form.<br>
          Submission ID: ${submissionId}
        </p>
      `,
            text: `New Contact Form Submission\n\nFrom: ${name}\nEmail: ${email}${req.body.phone ? `\nPhone: ${req.body.phone}` : ''}\n\nMessage:\n${message}\n\n---\nSubmission ID: ${submissionId}`,
        });
        if (!emailResult.success) {
            console.warn(`[Contact Form] Email delivery failed for submission ${submissionId}: ${emailResult.error}`);
        }
        else {
            console.log(`[Contact Form] Email sent to ${ownerEmail} from ${name} (${email})`);
        }
        return res.json({
            success: true,
            message: 'Thank you for your message. We will get back to you soon.'
        });
    }
    catch (error) {
        console.error('[Contact Form] Error:', error);
        return res.status(500).json({
            error: 'Failed to send message. Please try again later.',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /v1/leads/test
 * Test endpoint to check if service is running
 */
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Contact form router is operational',
        rateLimit: {
            maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
            windowMs: RATE_LIMIT_WINDOW_MS
        }
    });
});
export default router;
