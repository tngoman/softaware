import { Router } from 'express';
import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { db, type User } from '../db/mysql.js';
import { requireAuth, AuthRequest, getAuth, signAccessToken } from '../middleware/auth.js';
import { badRequest } from '../utils/httpErrors.js';
import { env } from '../config/env.js';
import { buildFrontendUser } from './auth.js';

export const twoFactorRouter = Router();

// ─── Types ─────────────────────────────────────────────────────────
interface TwoFactorRow {
  id: number;
  user_id: string;
  secret: string;
  is_enabled: number;
  backup_codes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Generate 10 random backup codes */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase()); // e.g. "A3F1B2C8"
  }
  return codes;
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

// ─── GET /auth/2fa/status ──────────────────────────────────────────
// Check whether 2FA is enabled for the authenticated user
twoFactorRouter.get('/status', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const row = await db.queryOne<TwoFactorRow>(
      `SELECT is_enabled FROM user_two_factor WHERE user_id = ?`,
      [userId],
    );

    res.json({
      success: true,
      data: {
        is_enabled: row ? Boolean(row.is_enabled) : false,
        has_setup: !!row,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/setup ──────────────────────────────────────────
// Generate a TOTP secret and return the QR code for the authenticator app
// Does NOT enable 2FA — user must verify with /verify-setup first
twoFactorRouter.post('/setup', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);

    // Check if 2FA is already enabled
    const existing = await db.queryOne<TwoFactorRow>(
      `SELECT is_enabled FROM user_two_factor WHERE user_id = ?`,
      [userId],
    );
    if (existing?.is_enabled) {
      throw badRequest('Two-factor authentication is already enabled. Disable it first to reconfigure.');
    }

    // Get user email for the authenticator label
    const user = await db.queryOne<User>('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    // Generate TOTP secret
    const secret = new Secret();
    const secretBase32 = secret.base32;

    // Build TOTP and get otpauth URI
    const totp = createTOTP(secretBase32, user.email);
    const otpauthUrl = totp.toString();

    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store the secret (but NOT enabled yet — needs verification)
    if (existing) {
      await db.execute(
        `UPDATE user_two_factor SET secret = ?, is_enabled = 0, backup_codes = NULL, updated_at = NOW() WHERE user_id = ?`,
        [secretBase32, userId],
      );
    } else {
      await db.execute(
        `INSERT INTO user_two_factor (user_id, secret, is_enabled) VALUES (?, ?, 0)`,
        [userId, secretBase32],
      );
    }

    res.json({
      success: true,
      message: 'Scan the QR code with your authenticator app, then verify with a code.',
      data: {
        secret: secretBase32,        // Manual entry key (show to user as fallback)
        qr_code: qrCodeDataUrl,      // Base64 QR code image
        otpauth_url: otpauthUrl,     // For direct deep-linking on mobile
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/verify-setup ──────────────────────────────────
// Verify the TOTP code to confirm setup and enable 2FA
const VerifySetupSchema = z.object({
  code: z.string().length(6),
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

    // Get user email for TOTP label
    const user = await db.queryOne<User>('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    // Verify the TOTP code against the stored secret
    const totp = createTOTP(row.secret, user.email);
    const delta = totp.validate({ token: input.code, window: 1 });
    if (delta === null) throw badRequest('Invalid verification code. Please try again.');

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Enable 2FA and store hashed backup codes
    const hashedCodes = backupCodes.map((code) => ({
      code: crypto.createHash('sha256').update(code).digest('hex'),
      used: false,
    }));

    await db.execute(
      `UPDATE user_two_factor SET is_enabled = 1, backup_codes = ?, updated_at = NOW() WHERE user_id = ?`,
      [JSON.stringify(hashedCodes), userId],
    );

    res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully.',
      data: {
        backup_codes: backupCodes, // Show ONCE — user must save these
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/verify ────────────────────────────────────────
// Verify a TOTP code during login (called after login returns requires_2fa)
const VerifyLoginSchema = z.object({
  temp_token: z.string().min(1),
  code: z.string().min(1), // 6-digit TOTP or 8-char backup code
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

    // Get user email for TOTP label
    const user = await db.queryOne<User>('SELECT email FROM users WHERE id = ?', [userId]);
    if (!user) throw badRequest('User not found');

    let isValid = false;
    let usedBackupCode = false;

    // First try TOTP verification
    if (input.code.length === 6 && /^\d+$/.test(input.code)) {
      const totp = createTOTP(row.secret, user.email);
      const delta = totp.validate({ token: input.code, window: 1 });
      isValid = delta !== null;
    }

    // If TOTP failed, try backup code
    if (!isValid) {
      const codeHash = crypto.createHash('sha256').update(input.code.toUpperCase()).digest('hex');
      const backupCodes: Array<{ code: string; used: boolean }> = row.backup_codes
        ? JSON.parse(row.backup_codes)
        : [];

      const matchIdx = backupCodes.findIndex((bc) => bc.code === codeHash && !bc.used);
      if (matchIdx !== -1) {
        isValid = true;
        usedBackupCode = true;
        // Mark backup code as used
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
    // Carry forward the original login's rememberMe preference via temp token
    const tokenExpiry = decoded.rememberMe ? '30d' : undefined;
    const token = signAccessToken({ userId }, tokenExpiry);

    // Build the full frontend user shape
    const frontendUser = await buildFrontendUser(userId);

    // Count remaining backup codes
    const backupCodes: Array<{ code: string; used: boolean }> = row.backup_codes
      ? JSON.parse(row.backup_codes)
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
      // Legacy compat fields
      accessToken: token,
      token,
      expiresIn: decoded.rememberMe ? '30d' : undefined,
      user: frontendUser,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/2fa/disable ───────────────────────────────────────
// Disable 2FA (requires password confirmation)
const DisableSchema = z.object({
  password: z.string().min(1),
});

twoFactorRouter.post('/disable', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = DisableSchema.parse(req.body);

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
