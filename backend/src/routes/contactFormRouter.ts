import express from 'express';
import { db } from '../db/mysql.js';
import { env } from '../config/env.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// Rate limiting map: IP -> [timestamp array]
const rateLimitMap = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 5;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

/**
 * Check rate limit for IP address
 */
function checkRateLimit(ip: string): boolean {
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
    } else {
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
    if (!checkRateLimit(clientIp as string)) {
      console.warn(`[Contact Form] Rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({
        error: 'Too many requests. Please try again later.'
      });
    }

    const { client_id, name, email, message, honeypot } = req.body;

    // Honeypot check (bot detection)
    if (honeypot) {
      console.warn('[Contact Form] Honeypot triggered, likely spam');
      // Silently drop the submission
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
    let ownerEmail: string | null = null;
    
    // Try to find by site ID
    const site = await db.queryOne<{ contact_email: string; user_id: string }>(
      'SELECT contact_email, user_id FROM generated_sites WHERE id = ? OR widget_client_id = ?',
      [client_id, client_id]
    );

    if (site) {
      ownerEmail = site.contact_email;
      
      // If no contact email on site, get user's email
      if (!ownerEmail && site.user_id) {
        const user = await db.queryOne<{ email: string }>(
          'SELECT email FROM users WHERE id = ?',
          [site.user_id]
        );
        ownerEmail = user?.email || null;
      }
    }

    // Try widget_clients table as fallback
    if (!ownerEmail) {
      const widgetClient = await db.queryOne<{ user_id: string }>(
        'SELECT user_id FROM widget_clients WHERE id = ?',
        [client_id]
      );
      
      if (widgetClient?.user_id) {
        const user = await db.queryOne<{ email: string }>(
          'SELECT email FROM users WHERE id = ?',
          [widgetClient.user_id]
        );
        ownerEmail = user?.email || null;
      }
    }

    if (!ownerEmail) {
      console.error('[Contact Form] Could not find owner email for client_id:', client_id);
      return res.status(404).json({
        error: 'Website configuration error. Please contact support.'
      });
    }

    // Send email using nodemailer
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: env.SMTP_FROM || 'noreply@softaware.net.za',
      to: ownerEmail,
      replyTo: email,
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          This message was sent via your Soft Aware website contact form.
        </p>
      `,
      text: `
New Contact Form Submission

From: ${name}
Email: ${email}

Message:
${message}

---
This message was sent via your Soft Aware website contact form.
      `
    };

    await transporter.sendMail(mailOptions);

    console.log(`[Contact Form] Email sent to ${ownerEmail} from ${name} (${email})`);

    return res.json({
      success: true,
      message: 'Thank you for your message. We will get back to you soon.'
    });

  } catch (error) {
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
