import { Router } from 'express';
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { db, type User } from '../db/mysql.js';
import { requireAuth, AuthRequest, getAuth, signAccessToken, setAuthCookie } from '../middleware/auth.js';
import { badRequest } from '../utils/httpErrors.js';
import { env } from '../config/env.js';
import { buildFrontendUser } from './auth.js';
import { sendTwoFactorOtp } from '../services/emailService.js';
import { sendSms } from '../services/smsService.js';

export const twoFactorRouter = Router();

// ─── Types ─────────────────────────────────────────────────────────
type TwoFactorMethod = 'totp' | 'email' | 'sms';

interface TwoFactorRow {
  id: number;
  user_id: string;
  secret: string;
  is_enabled: number;
  preferred_method: TwoFactorMethod | null;
  otp_code: string | null;
  otp_expires_at: string | null;
  backup_codes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Schema Migration (auto-add columns if missing) ────────────────
async function ensureSchema(): Promise<void> {
  try {
    await db.execute(`
      ALTER TABLE user_two_factor 
        ADD COLUMN IF NOT EXISTS preferred_method ENUM('totp','email','sms') DEFAULT 'totp' AFTER is_enabled,
        ADD COLUMN IF NOT EXISTS otp_code VARCHAR(255) NULL AFTER preferred_method,
        ADD COLUMN IF NOT EXISTS otp_expires_at DATETIME NULL AFTER otp_code
    `);
  } catch {
    // Columns may already exist or DB doesn't support IF NOT EXISTS — ignore
  }
}
// Run once at import
ensureSchema().catch(() => {});

// ─── Helpers ───────────────────────────────────────────────────────

/** Generate 10 random backup codes */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase()); // e.g. "A3F1B2C8"
  }
  return codes;
}

/** Generate a 6-digit numeric OTP */
function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

/** Create a TOTP instance from a base32 secret */
function createTOTP(secretBase32: string, userEmail: string): TOTP {
  return new TOTP({
    issuer: env.TWO_FACTOR_APP_NAME,
    label: userEmail,
    secret: Secret.fromBase32(secretBase32),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
}

/** Check if user role is staff/admin (cannot disable 2FA) */
async function isStaffOrAdmin(userId: string): Promise<boolean> {
  const roleRow = await db.queryOne<{ slug: string }>(
    `SELECT r.slug FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
     LIMIT 1`,
    [userId],
  );
  if (!roleRow) return false;
  const staffSlugs = ['admin', 'super_admin', 'developer', 'client_manager', 'qa_specialist', 'deployer'];
  return staffSlugs.includes(roleRow.slug);
}

/** Send OTP via the chosen method */
async function sendOtpByMethod(
  userId: string,
  method: TwoFactorMethod,
  userEmail: string,
  userName?: string,
  userPhone?: string,
): Promise<void> {
  if (method === 'totp') return; // TOTP doesn't need sending — user has the app

  const otp = generateOtp();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  // Store hashed OTP — use MySQL NOW() so expiry is in the DB's own timezone
  await db.execute(
    `UPDATE user_two_factor SET otp_code = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE), updated_at = NOW() WHERE user_id = ?`,
    [otpHash, userId],
  );

  if (method === 'email') {
    const result = await sendTwoFactorOtp(userEmail, otp, userName);
    if (!result.success) {
      throw badRequest(`Failed to send verification email to ${userEmail}. Please check your email address in profile settings.`);
    }
  } else if (method === 'sms') {
    if (!userPhone) throw badRequest('No phone number on file. Please update your profile to use SMS 2FA.');
    // Normalise and send SMS
    const message = `Your SoftAware verification code is: ${otp}. This code expires in 5 minutes.`;
    await sendSms(userPhone, message);
  }
}

// ─── GET /auth/2fa/status ──────────────────────────────────────────
// Check whether 2FA is enabled for the authenticated user
twoFactorRouter.get('/status', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const row = await db.queryOne<TwoFactorRow>(
      `SELECT is_enabled, preferred_method FROM user_two_factor WHERE user_id = ?`,
      [userId],
    );

    const isStaff = await isStaffOrAdmin(userId);

    res.json({
      success: true,
      data: {
        is_enabled: row ? Boolean(row.is_enabled) : false,
        has_setup: !!row,
        preferred_method: row?.preferred_method || 'totp',
        is_required: isStaff, // Staff/admin cannot disable 2FA
        available_methods: isStaff
          ? ['totp', 'email', 'sms']       // Staff/Admin: all 3 methods
          : ['totp', 'email'],              // Clients: totp + email only
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/setup ──────────────────────────────────────────
// Start 2FA setup for the chosen method
// For TOTP: generates secret + QR code
// For email/SMS: stores preferred method (OTP sent at login time)
const SetupSchema = z.object({
  method: z.enum(['totp', 'email', 'sms']).default('totp'),
});

twoFactorRouter.post('/setup', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = SetupSchema.parse(req.body);

    // Validate method availability
    const isStaff = await isStaffOrAdmin(userId);
    if (input.method === 'sms' && !isStaff) {
      throw badRequest('SMS two-factor authentication is only available for staff and admin users.');
    }

    // Check if 2FA is already enabled
    const existing = await db.queryOne<TwoFactorRow>(
      `SELECT is_enabled, preferred_method FROM user_two_factor WHERE user_id = ?`,
      [userId],
    );
    if (existing?.is_enabled && existing.preferred_method === input.method) {
      throw badRequest('Two-factor authentication is already enabled with this method.');
    }
    // If switching methods, temporarily disable so we can re-verify
    if (existing?.is_enabled) {
      await db.execute(
        `UPDATE user_two_factor SET is_enabled = 0, otp_code = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE user_id = ?`,
        [userId],
      );
    }

    // Get user email for the authenticator label
    const user = await db.queryOne<User>('SELECT email, name, phone FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    if (input.method === 'sms' && !(user as any).phone) {
      throw badRequest('Please add a phone number to your profile before enabling SMS 2FA.');
    }

    if (input.method === 'totp') {
      // ── TOTP Setup: generate secret + QR ────────────────────
      const secret = new Secret();
      const secretBase32 = secret.base32;
      const totp = createTOTP(secretBase32, user.email);
      const otpauthUrl = totp.toString();
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

      if (existing) {
        await db.execute(
          `UPDATE user_two_factor SET secret = ?, preferred_method = ?, is_enabled = 0, backup_codes = NULL, updated_at = NOW() WHERE user_id = ?`,
          [secretBase32, 'totp', userId],
        );
      } else {
        await db.execute(
          `INSERT INTO user_two_factor (user_id, secret, preferred_method, is_enabled) VALUES (?, ?, ?, 0)`,
          [userId, secretBase32, 'totp'],
        );
      }

      return res.json({
        success: true,
        message: 'Scan the QR code with your authenticator app, then verify with a code.',
        data: {
          method: 'totp',
          secret: secretBase32,
          qr_code: qrCodeDataUrl,
          otpauth_url: otpauthUrl,
        },
      });
    }

    // ── Email / SMS Setup ─────────────────────────────────────
    // Generate a placeholder secret (not used for email/sms, but column is NOT NULL)
    const placeholderSecret = new Secret().base32;

    if (existing) {
      await db.execute(
        `UPDATE user_two_factor SET secret = ?, preferred_method = ?, is_enabled = 0, backup_codes = NULL, updated_at = NOW() WHERE user_id = ?`,
        [placeholderSecret, input.method, userId],
      );
    } else {
      await db.execute(
        `INSERT INTO user_two_factor (user_id, secret, preferred_method, is_enabled) VALUES (?, ?, ?, 0)`,
        [userId, placeholderSecret, input.method],
      );
    }

    // Send a verification OTP to confirm the method works
    await sendOtpByMethod(userId, input.method, user.email, (user as any).name, (user as any).phone);

    res.json({
      success: true,
      message: input.method === 'email'
        ? `A verification code has been sent to ${user.email}. Enter it to complete setup.`
        : `A verification code has been sent to your phone. Enter it to complete setup.`,
      data: {
        method: input.method,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/verify-setup ──────────────────────────────────
// Verify the code to confirm setup and enable 2FA (works for all methods)
const VerifySetupSchema = z.object({
  code: z.string().trim().min(6).max(8),
});

twoFactorRouter.post('/verify-setup', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = VerifySetupSchema.parse(req.body);

    const row = await db.queryOne<TwoFactorRow>(
      `SELECT * FROM user_two_factor WHERE user_id = ?`,
      [userId],
    );
    if (!row) throw badRequest('Two-factor setup not initiated. Call /auth/2fa/setup first.');
    if (row.is_enabled) throw badRequest('Two-factor authentication is already enabled.');

    const user = await db.queryOne<User>('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    const method = (row.preferred_method as TwoFactorMethod) || 'totp';
    let isValid = false;

    if (method === 'totp') {
      // Verify TOTP code
      const totp = createTOTP(row.secret, user.email);
      const delta = totp.validate({ token: input.code, window: 1 });
      isValid = delta !== null;
    } else {
      // Verify email/SMS OTP
      if (!row.otp_code || !row.otp_expires_at) {
        throw badRequest('No verification code was sent. Please restart 2FA setup.');
      }
      const now = new Date();
      const expiresAt = new Date(row.otp_expires_at);
      if (now > expiresAt) {
        throw badRequest('Verification code has expired. Please restart 2FA setup.');
      }
      const codeHash = crypto.createHash('sha256').update(input.code).digest('hex');
      isValid = codeHash === row.otp_code;
    }

    if (!isValid) throw badRequest('Invalid verification code. Please try again.');

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedCodes = backupCodes.map((code) => ({
      code: crypto.createHash('sha256').update(code).digest('hex'),
      used: false,
    }));

    await db.execute(
      `UPDATE user_two_factor SET is_enabled = 1, otp_code = NULL, otp_expires_at = NULL, backup_codes = ?, updated_at = NOW() WHERE user_id = ?`,
      [JSON.stringify(hashedCodes), userId],
    );

    res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully.',
      data: {
        method,
        backup_codes: backupCodes, // Show ONCE — user must save these
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/verify ────────────────────────────────────────
// Verify a 2FA code during login (called after login returns requires_2fa)
// Supports TOTP, email OTP, SMS OTP, and backup codes
const VerifyLoginSchema = z.object({
  temp_token: z.string().min(1),
  code: z.string().trim().min(1), // 6-digit TOTP/OTP or 8-char backup code
});

twoFactorRouter.post('/verify', async (req, res, next) => {
  try {
    const input = VerifyLoginSchema.parse(req.body);

    // Verify the temporary token
    let decoded: any;
    try {
      decoded = jwt.verify(input.temp_token, env.JWT_SECRET);
    } catch {
      throw badRequest('Invalid or expired temporary token. Please log in again.');
    }

    if (!decoded?.userId || decoded?.purpose !== '2fa') {
      throw badRequest('Invalid temporary token.');
    }

    const userId = String(decoded.userId);

    const row = await db.queryOne<TwoFactorRow>(
      `SELECT * FROM user_two_factor WHERE user_id = ? AND is_enabled = 1`,
      [userId],
    );
    if (!row) throw badRequest('Two-factor authentication is not enabled for this account.');

    const user = await db.queryOne<User>('SELECT email, name FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    const method = (row.preferred_method as TwoFactorMethod) || 'totp';
    let isValid = false;
    let usedBackupCode = false;

    if (method === 'totp') {
      // Try TOTP verification first
      if (input.code.length === 6 && /^\d+$/.test(input.code)) {
        const totp = createTOTP(row.secret, user.email);
        const delta = totp.validate({ token: input.code, window: 1 });
        isValid = delta !== null;
      }
    } else {
      // Email/SMS OTP verification
      if (row.otp_code && row.otp_expires_at) {
        const now = new Date();
        const expiresAt = new Date(row.otp_expires_at);
        if (now <= expiresAt) {
          const codeHash = crypto.createHash('sha256').update(input.code).digest('hex');
          isValid = codeHash === row.otp_code;
          if (isValid) {
            // Clear used OTP
            await db.execute(
              `UPDATE user_two_factor SET otp_code = NULL, otp_expires_at = NULL, updated_at = NOW() WHERE user_id = ?`,
              [userId],
            );
          }
        }
      }
    }

    // If primary method failed, try backup code
    if (!isValid) {
      const codeHash = crypto.createHash('sha256').update(input.code.toUpperCase()).digest('hex');
      const backupCodes: Array<{ code: string; used: boolean }> = row.backup_codes
        ? (typeof row.backup_codes === 'string' ? JSON.parse(row.backup_codes) : row.backup_codes)
        : [];

      const matchIdx = backupCodes.findIndex((bc) => bc.code === codeHash && !bc.used);
      if (matchIdx !== -1) {
        isValid = true;
        usedBackupCode = true;
        backupCodes[matchIdx].used = true;
        await db.execute(
          `UPDATE user_two_factor SET backup_codes = ?, updated_at = NOW() WHERE user_id = ?`,
          [JSON.stringify(backupCodes), userId],
        );
      }
    }

    if (!isValid) {
      throw badRequest('Invalid verification code.');
    }

    // 2FA verified — issue the real access token
    const tokenExpiry = decoded.rememberMe ? '30d' : undefined;
    const token = signAccessToken({ userId }, tokenExpiry);

    // Set HTTP-only cookie for session persistence
    const cookieMaxAge = decoded.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    setAuthCookie(req, res, token, cookieMaxAge);

    const frontendUser = await buildFrontendUser(userId);

    const backupCodes: Array<{ code: string; used: boolean }> = row.backup_codes
      ? (typeof row.backup_codes === 'string' ? JSON.parse(row.backup_codes) : row.backup_codes)
      : [];
    const remainingBackupCodes = backupCodes.filter((bc) => !bc.used).length;

    res.json({
      success: true,
      message: usedBackupCode
        ? `Login successful. Backup code used. ${remainingBackupCodes} remaining.`
        : 'Login successful. Two-factor verification passed.',
      data: {
        token,
        user: frontendUser,
        used_backup_code: usedBackupCode,
        remaining_backup_codes: remainingBackupCodes,
      },
      accessToken: token,
      token,
      expiresIn: decoded.rememberMe ? '30d' : undefined,
      user: frontendUser,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/send-otp ──────────────────────────────────────
// Resend OTP during login (for email/SMS methods)
const SendOtpSchema = z.object({
  temp_token: z.string().min(1),
});

twoFactorRouter.post('/send-otp', async (req, res, next) => {
  try {
    const input = SendOtpSchema.parse(req.body);

    let decoded: any;
    try {
      decoded = jwt.verify(input.temp_token, env.JWT_SECRET);
    } catch {
      throw badRequest('Invalid or expired temporary token. Please log in again.');
    }

    if (!decoded?.userId || decoded?.purpose !== '2fa') {
      throw badRequest('Invalid temporary token.');
    }

    const userId = String(decoded.userId);

    const row = await db.queryOne<TwoFactorRow>(
      `SELECT preferred_method FROM user_two_factor WHERE user_id = ? AND is_enabled = 1`,
      [userId],
    );
    if (!row) throw badRequest('Two-factor authentication is not enabled for this account.');

    const method = (row.preferred_method as TwoFactorMethod) || 'totp';
    if (method === 'totp') {
      throw badRequest('TOTP method does not require sending a code. Use your authenticator app.');
    }

    const user = await db.queryOne<User>('SELECT email, name, phone FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    await sendOtpByMethod(userId, method, user.email, (user as any).name, (user as any).phone);

    res.json({
      success: true,
      message: method === 'email'
        ? `Verification code sent to ${user.email}`
        : 'Verification code sent to your phone',
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/disable ───────────────────────────────────────
// Disable 2FA (requires password confirmation)
// Staff/admin CANNOT disable 2FA — they can only change method
const DisableSchema = z.object({
  password: z.string().min(1),
});

twoFactorRouter.post('/disable', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = DisableSchema.parse(req.body);

    // Check if user is staff/admin — they cannot disable 2FA
    const isStaff = await isStaffOrAdmin(userId);
    if (isStaff) {
      throw badRequest('Staff and admin users cannot disable two-factor authentication. You may change your 2FA method instead.');
    }

    // Verify password
    const user = await db.queryOne<User>('SELECT passwordHash FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw badRequest('Invalid password');

    // Remove 2FA record entirely
    await db.execute(`DELETE FROM user_two_factor WHERE user_id = ?`, [userId]);

    res.json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /auth/2fa/method — Change preferred 2FA method ───────────
const ChangeMethodSchema = z.object({
  method: z.enum(['totp', 'email', 'sms']),
  password: z.string().min(1),
});

twoFactorRouter.put('/method', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = ChangeMethodSchema.parse(req.body);

    // Validate method availability
    const isStaff = await isStaffOrAdmin(userId);
    if (input.method === 'sms' && !isStaff) {
      throw badRequest('SMS two-factor authentication is only available for staff and admin users.');
    }

    // Verify password
    const user = await db.queryOne<User>('SELECT passwordHash, email, name, phone FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw badRequest('Invalid password');

    if (input.method === 'sms' && !(user as any).phone) {
      throw badRequest('Please add a phone number to your profile before switching to SMS 2FA.');
    }

    // Check if 2FA exists
    const existing = await db.queryOne<TwoFactorRow>(
      `SELECT is_enabled FROM user_two_factor WHERE user_id = ?`,
      [userId],
    );

    if (!existing || !existing.is_enabled) {
      throw badRequest('Two-factor authentication is not enabled. Set it up first.');
    }

    // If switching to TOTP, need new secret + QR setup
    if (input.method === 'totp') {
      const secret = new Secret();
      const secretBase32 = secret.base32;
      const totp = createTOTP(secretBase32, user.email);
      const otpauthUrl = totp.toString();
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

      // Temporarily disable until re-verified
      await db.execute(
        `UPDATE user_two_factor SET secret = ?, preferred_method = ?, is_enabled = 0, updated_at = NOW() WHERE user_id = ?`,
        [secretBase32, 'totp', userId],
      );

      return res.json({
        success: true,
        message: 'Scan the QR code with your authenticator app, then verify to confirm the switch.',
        data: {
          method: 'totp',
          requires_verification: true,
          secret: secretBase32,
          qr_code: qrCodeDataUrl,
          otpauth_url: otpauthUrl,
        },
      });
    }

    // Email/SMS: send verification OTP to confirm the new method
    const placeholderSecret = new Secret().base32;
    await db.execute(
      `UPDATE user_two_factor SET secret = ?, preferred_method = ?, is_enabled = 0, updated_at = NOW() WHERE user_id = ?`,
      [placeholderSecret, input.method, userId],
    );

    await sendOtpByMethod(userId, input.method, user.email, (user as any).name, (user as any).phone);

    res.json({
      success: true,
      message: `Verification code sent. Enter it to confirm switching to ${input.method} 2FA.`,
      data: {
        method: input.method,
        requires_verification: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/backup-codes ──────────────────────────────────
// Regenerate backup codes (requires password confirmation)
const BackupCodesSchema = z.object({
  password: z.string().min(1),
});

twoFactorRouter.post('/backup-codes', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = BackupCodesSchema.parse(req.body);

    // Verify password
    const user = await db.queryOne<User>('SELECT passwordHash FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw badRequest('Invalid password');

    // Ensure 2FA is enabled
    const row = await db.queryOne<TwoFactorRow>(
      `SELECT is_enabled FROM user_two_factor WHERE user_id = ? AND is_enabled = 1`,
      [userId],
    );
    if (!row) throw badRequest('Two-factor authentication is not enabled.');

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    const hashedCodes = backupCodes.map((code) => ({
      code: crypto.createHash('sha256').update(code).digest('hex'),
      used: false,
    }));

    await db.execute(
      `UPDATE user_two_factor SET backup_codes = ?, updated_at = NOW() WHERE user_id = ?`,
      [JSON.stringify(hashedCodes), userId],
    );

    res.json({
      success: true,
      message: 'New backup codes generated. Previous codes are now invalid.',
      data: {
        backup_codes: backupCodes, // Show ONCE
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════
// MOBILE APP QR-BASED TOTP AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════
//
// Flow:
//   1. Mobile app logs in → gets { requires_2fa, method: 'totp', temp_token }
//   2. Mobile app calls POST /auth/2fa/mobile-challenge { temp_token }
//        → gets { challengeId }
//   3. User opens their web profile (already logged in on web)
//        → web polls GET /auth/2fa/mobile-qr and shows QR code
//   4. Mobile app scans QR → extracts { challengeId, secret }
//   5. Mobile app calls POST /auth/2fa/mobile-verify { temp_token, challengeId, secret }
//        → gets { token, user } — full JWT, login complete
//
// The QR secret proves the mobile user has physical access to a device
// that is already authenticated (the web session).
// ═══════════════════════════════════════════════════════════════════

// Auto-create mobile_auth_challenges table
async function ensureMobileChallengeTable(): Promise<void> {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS mobile_auth_challenges (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        challenge_secret VARCHAR(64) NOT NULL,
        status ENUM('pending','completed','expired') DEFAULT 'pending',
        remember_me TINYINT(1) DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_pending (user_id, status, expires_at)
      )
    `);
  } catch {
    // Table may already exist
  }
}
ensureMobileChallengeTable().catch(() => {});

// ─── POST /auth/2fa/mobile-challenge ──────────────────────────────
// Mobile app creates a challenge after login returns requires_2fa + method: 'totp'
const MobileChallengeSchema = z.object({
  temp_token: z.string().min(1),
});

twoFactorRouter.post('/mobile-challenge', async (req, res, next) => {
  try {
    const input = MobileChallengeSchema.parse(req.body);

    // Verify the temporary 2FA token
    let decoded: any;
    try {
      decoded = jwt.verify(input.temp_token, env.JWT_SECRET);
    } catch {
      throw badRequest('Invalid or expired temporary token. Please log in again.');
    }

    if (!decoded?.userId || decoded?.purpose !== '2fa') {
      throw badRequest('Invalid temporary token.');
    }

    const userId = String(decoded.userId);

    // Confirm the user has TOTP 2FA enabled
    const row = await db.queryOne<TwoFactorRow>(
      `SELECT preferred_method FROM user_two_factor WHERE user_id = ? AND is_enabled = 1`,
      [userId],
    );
    if (!row) throw badRequest('Two-factor authentication is not enabled.');
    if (row.preferred_method !== 'totp') {
      throw badRequest('Mobile QR challenge is only available for TOTP (app) 2FA method.');
    }

    // Expire any existing pending challenges for this user
    await db.execute(
      `UPDATE mobile_auth_challenges SET status = 'expired' WHERE user_id = ? AND status = 'pending'`,
      [userId],
    );

    // Create new challenge
    const challengeId = crypto.randomUUID();
    const challengeSecret = crypto.randomBytes(32).toString('hex');

    await db.execute(
      `INSERT INTO mobile_auth_challenges (id, user_id, challenge_secret, status, remember_me, expires_at)
       VALUES (?, ?, ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
      [challengeId, userId, challengeSecret, decoded.rememberMe ? 1 : 0],
    );

    res.json({
      success: true,
      message: 'Mobile authentication challenge created. Open your profile on the web to scan the QR code.',
      data: {
        challenge_id: challengeId,
        expires_in: 300, // 5 minutes in seconds
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/2fa/mobile-qr ─────────────────────────────────────
// Web profile fetches the QR code for a pending mobile challenge.
// Requires: authenticated web session (JWT)
twoFactorRouter.get('/mobile-qr', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);

    // Find the latest pending challenge for this user
    const challenge = await db.queryOne<{
      id: string;
      challenge_secret: string;
      expires_at: string;
    }>(
      `SELECT id, challenge_secret, expires_at 
       FROM mobile_auth_challenges 
       WHERE user_id = ? AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );

    if (!challenge) {
      return res.json({
        success: true,
        data: { has_pending: false },
      });
    }

    // Build QR payload — the mobile app scans this
    const qrPayload = JSON.stringify({
      type: 'softaware_mobile_auth',
      challengeId: challenge.id,
      secret: challenge.challenge_secret,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });

    res.json({
      success: true,
      data: {
        has_pending: true,
        challenge_id: challenge.id,
        qr_code: qrCodeDataUrl,
        expires_at: challenge.expires_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/2fa/mobile-qr/status/:challengeId ─────────────────
// Poll endpoint — check if a mobile challenge has been completed
twoFactorRouter.get('/mobile-qr/status/:challengeId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const { challengeId } = req.params;

    const challenge = await db.queryOne<{ status: string }>(
      `SELECT status FROM mobile_auth_challenges WHERE id = ? AND user_id = ?`,
      [challengeId, userId],
    );

    res.json({
      success: true,
      data: {
        status: challenge?.status || 'not_found',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/mobile-verify ─────────────────────────────────
// Mobile app scans the QR, extracts challengeId + secret, sends here to complete auth
const MobileVerifySchema = z.object({
  temp_token: z.string().min(1),
  challenge_id: z.string().uuid(),
  secret: z.string().min(1),
});

twoFactorRouter.post('/mobile-verify', async (req, res, next) => {
  try {
    const input = MobileVerifySchema.parse(req.body);

    // Verify the temporary 2FA token
    let decoded: any;
    try {
      decoded = jwt.verify(input.temp_token, env.JWT_SECRET);
    } catch {
      throw badRequest('Invalid or expired temporary token. Please log in again.');
    }

    if (!decoded?.userId || decoded?.purpose !== '2fa') {
      throw badRequest('Invalid temporary token.');
    }

    const userId = String(decoded.userId);

    // Look up the challenge
    const challenge = await db.queryOne<{
      id: string;
      user_id: string;
      challenge_secret: string;
      status: string;
      remember_me: number;
      expires_at: string;
    }>(
      `SELECT * FROM mobile_auth_challenges WHERE id = ? AND status = 'pending'`,
      [input.challenge_id],
    );

    if (!challenge) {
      throw badRequest('Challenge not found or already used.');
    }

    // Verify the challenge belongs to this user
    if (challenge.user_id !== userId) {
      throw badRequest('Challenge does not match this user.');
    }

    // Check expiry
    const now = new Date();
    const expiresAt = new Date(challenge.expires_at);
    if (now > expiresAt) {
      await db.execute(
        `UPDATE mobile_auth_challenges SET status = 'expired' WHERE id = ?`,
        [challenge.id],
      );
      throw badRequest('Challenge has expired. Please start a new login.');
    }

    // Verify secret — timing-safe comparison
    const inputBuf = Buffer.from(input.secret, 'utf8');
    const storedBuf = Buffer.from(challenge.challenge_secret, 'utf8');
    if (inputBuf.length !== storedBuf.length || !crypto.timingSafeEqual(inputBuf, storedBuf)) {
      throw badRequest('Invalid QR code data.');
    }

    // ✅ Challenge verified — mark as completed
    await db.execute(
      `UPDATE mobile_auth_challenges SET status = 'completed' WHERE id = ?`,
      [challenge.id],
    );

    // Issue the real access token
    const rememberMe = Boolean(challenge.remember_me || decoded.rememberMe);
    const tokenExpiry = rememberMe ? '30d' : undefined;
    const token = signAccessToken({ userId }, tokenExpiry);

    // Set HTTP-only cookie for session persistence
    const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    setAuthCookie(req, res, token, cookieMaxAge);

    const frontendUser = await buildFrontendUser(userId);

    res.json({
      success: true,
      message: 'Mobile authentication successful.',
      data: {
        token,
        user: frontendUser,
      },
      accessToken: token,
      token,
      expiresIn: rememberMe ? '30d' : undefined,
      user: frontendUser,
    });
  } catch (err) {
    next(err);
  }
});