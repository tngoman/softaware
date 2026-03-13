/**
 * Email Service — SMTP Integration via Credentials Table
 *
 * Follows the same pattern as smsService.ts:
 *   - Credentials pulled from `credentials` table (service_name = 'SMTP')
 *   - Supports AES-256-GCM encrypted credential_value
 *   - Caches transporter until credentials change
 *   - Logs sends to `email_log` table
 *
 * Credentials table format:
 *   service_name     = 'SMTP'
 *   credential_value = SMTP password (optionally encrypted)
 *   additional_data  = {
 *     "host": "smtp.example.com",
 *     "port": 587,
 *     "username": "user@example.com",
 *     "from_name": "Company Name",
 *     "from_email": "noreply@example.com",
 *     "encryption": "tls"  // "tls" | "ssl" | "none"
 *   }
 *
 * Falls back to env vars (SMTP_HOST etc.) if no credentials row exists.
 */
import nodemailer from 'nodemailer';
import { db } from '../db/mysql.js';
import { decryptPassword } from '../utils/cryptoUtils.js';
import { env } from '../config/env.js';
// ─── Transporter Cache ─────────────────────────────────────────────
let cachedTransporter = null;
let cachedCredentialsHash = null;
function hashCredentials(creds) {
    return `${creds.host}:${creds.port}:${creds.username}:${creds.password}:${creds.encryption}`;
}
// ─── Credential Loading ────────────────────────────────────────────
async function getSmtpCredentials() {
    // Try credentials table first
    const row = await db.queryOne(`SELECT credential_value, additional_data
       FROM credentials
      WHERE service_name = ? AND is_active = 1
      LIMIT 1`, ['SMTP']);
    if (row?.additional_data) {
        const extra = typeof row.additional_data === 'string'
            ? JSON.parse(row.additional_data)
            : row.additional_data;
        // Decrypt password if encrypted (colon-delimited hex format)
        let password = row.credential_value || '';
        const parts = password.split(':');
        if (parts.length === 3 && parts.every((p) => /^[0-9a-f]{16,}$/i.test(p))) {
            password = decryptPassword(password) ?? '';
            if (!password)
                throw new Error('[Email] Failed to decrypt SMTP credential_value');
        }
        const creds = {
            host: extra.host || '',
            port: parseInt(extra.port, 10) || 587,
            username: extra.username || '',
            password,
            from_name: extra.from_name || '',
            from_email: extra.from_email || '',
            encryption: extra.encryption || 'tls',
        };
        if (!creds.host || !creds.username) {
            throw new Error('[Email] SMTP credentials in DB are incomplete (missing host or username)');
        }
        // Update last_used_at
        db.execute('UPDATE credentials SET last_used_at = NOW() WHERE service_name = ? AND is_active = 1', ['SMTP']).catch(() => { });
        return creds;
    }
    // Fall back to environment variables
    if (env.SMTP_HOST) {
        return {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            username: env.SMTP_USER,
            password: env.SMTP_PASS,
            from_name: 'SoftAware',
            from_email: env.SMTP_FROM,
            encryption: env.SMTP_SECURE ? 'ssl' : 'tls',
        };
    }
    throw new Error('[Email] No SMTP credentials found in credentials table or environment variables');
}
// ─── Transporter Factory ───────────────────────────────────────────
async function getTransporter() {
    const credentials = await getSmtpCredentials();
    const hash = hashCredentials(credentials);
    if (cachedTransporter && cachedCredentialsHash === hash) {
        return { transporter: cachedTransporter, credentials };
    }
    // Determine secure flag
    const secure = credentials.encryption === 'ssl' || credentials.port === 465;
    cachedTransporter = nodemailer.createTransport({
        host: credentials.host,
        port: credentials.port,
        secure,
        auth: {
            user: credentials.username,
            pass: credentials.password,
        },
        tls: credentials.encryption === 'none' ? { rejectUnauthorized: false } : undefined,
    });
    cachedCredentialsHash = hash;
    console.log(`[Email] SMTP transporter created: ${credentials.host}:${credentials.port} (${credentials.encryption})`);
    return { transporter: cachedTransporter, credentials };
}
/** Invalidate cached transporter (call after credential update) */
export function invalidateTransporter() {
    cachedTransporter = null;
    cachedCredentialsHash = null;
}
// ─── Send Email ────────────────────────────────────────────────────
export async function sendEmail(options) {
    try {
        const { transporter, credentials } = await getTransporter();
        const fromAddress = options.from || `"${credentials.from_name}" <${credentials.from_email}>`;
        const info = await transporter.sendMail({
            from: fromAddress,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            replyTo: options.replyTo,
            cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
            bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
            attachments: options.attachments,
        });
        console.log(`[Email] Sent to ${options.to} — messageId: ${info.messageId}`);
        // Log asynchronously
        logEmailSend(options, info.messageId, 'sent').catch(() => { });
        return { success: true, messageId: info.messageId };
    }
    catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown email error';
        console.error('[Email] Send failed:', error);
        // Log failure
        logEmailSend(options, undefined, 'failed', error).catch(() => { });
        return { success: false, error };
    }
}
// ─── Send Test Email ───────────────────────────────────────────────
export async function sendTestEmail(to) {
    return sendEmail({
        to,
        subject: 'SoftAware — SMTP Test Email',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #00A4EE, #0088CC); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ SMTP Configuration Working!</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            This is a test email from your SoftAware application. If you're reading this, 
            your SMTP settings are configured correctly.
          </p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>Sent at:</strong> ${new Date().toISOString()}<br />
              <strong>To:</strong> ${to}
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
            This email was sent by SoftAware System Settings — SMTP Test.
          </p>
        </div>
      </div>
    `,
        text: `SMTP Configuration Working! This is a test email from SoftAware. Sent at: ${new Date().toISOString()}`,
    });
}
// ─── Send 2FA OTP Email ────────────────────────────────────────────
export async function sendTwoFactorOtp(to, code, userName) {
    return sendEmail({
        to,
        subject: `${code} — Your SoftAware Verification Code`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #00A4EE, #0088CC); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Verification Code</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Hi${userName ? ` ${userName}` : ''},
          </p>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Your two-factor authentication code is:
          </p>
          <div style="background: white; border: 2px solid #00A4EE; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937; font-family: monospace;">
              ${code}
            </span>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            This code expires in <strong>5 minutes</strong>. Do not share it with anyone.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
            If you did not request this code, please ignore this email or contact support.
          </p>
        </div>
      </div>
    `,
        text: `Your SoftAware verification code is: ${code}. This code expires in 5 minutes.`,
    });
}
// ─── Email Logging ─────────────────────────────────────────────────
async function logEmailSend(options, messageId, status, error) {
    try {
        await db.execute(`
      CREATE TABLE IF NOT EXISTS email_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        to_address VARCHAR(500) NOT NULL,
        subject VARCHAR(500) NULL,
        status VARCHAR(50) NULL,
        message_id VARCHAR(200) NULL,
        error TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_date (created_at),
        INDEX idx_email_to (to_address(100))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
        await db.execute(`INSERT INTO email_log (to_address, subject, status, message_id, error)
       VALUES (?, ?, ?, ?, ?)`, [
            Array.isArray(options.to) ? options.to.join(', ') : options.to,
            options.subject || null,
            status || null,
            messageId || null,
            error || null,
        ]);
    }
    catch (err) {
        console.error('[Email] Failed to log email send:', err);
    }
}
// ─── Export ────────────────────────────────────────────────────────
export const emailService = {
    sendEmail,
    sendTestEmail,
    sendTwoFactorOtp,
    invalidateTransporter,
};
