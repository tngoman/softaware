import type { Pool } from 'mysql2/promise';

/**
 * Migration 031 — Trial Engine Columns
 *
 * Adds trial-related columns to the `users` table to support
 * the 14-day Starter trial described in Pricing.md.
 *
 * Columns:
 *   has_used_trial   BOOLEAN  — permanently flags if user has ever used a trial (abuse prevention)
 *   trial_expires_at DATETIME — when the current trial ends (NULL = not on trial)
 *   plan_type        VARCHAR  — ensures the column exists (may already exist from earlier manual ALTER)
 */
export async function up(pool: Pool): Promise<void> {
  const conn = await pool.getConnection();
  try {
    // Ensure plan_type exists (idempotent — may already be present)
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'plan_type'`
    );
    if ((cols as any[]).length === 0) {
      await conn.execute(
        `ALTER TABLE users ADD COLUMN plan_type VARCHAR(20) NOT NULL DEFAULT 'free'`
      );
      console.log('[Migration 031] Added users.plan_type');
    }

    // Add has_used_trial (idempotent)
    const [trialCols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'has_used_trial'`
    );
    if ((trialCols as any[]).length === 0) {
      await conn.execute(
        `ALTER TABLE users ADD COLUMN has_used_trial BOOLEAN NOT NULL DEFAULT FALSE`
      );
      console.log('[Migration 031] Added users.has_used_trial');
    }

    // Add trial_expires_at (idempotent)
    const [expCols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'trial_expires_at'`
    );
    if ((expCols as any[]).length === 0) {
      await conn.execute(
        `ALTER TABLE users ADD COLUMN trial_expires_at DATETIME NULL DEFAULT NULL`
      );
      console.log('[Migration 031] Added users.trial_expires_at');
    }

    // Index for the cron sweep (find expired trials efficiently)
    try {
      await conn.execute(
        `CREATE INDEX idx_users_trial_expiry ON users (trial_expires_at) WHERE trial_expires_at IS NOT NULL`
      );
    } catch {
      // MySQL doesn't support partial indexes — fall back to regular index
      try {
        await conn.execute(
          `CREATE INDEX idx_users_trial_expiry ON users (trial_expires_at)`
        );
      } catch {
        // Index may already exist
      }
    }

    console.log('[Migration 031] Trial columns migration complete');
  } finally {
    conn.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  await pool.execute('ALTER TABLE users DROP COLUMN IF EXISTS trial_expires_at');
  await pool.execute('ALTER TABLE users DROP COLUMN IF EXISTS has_used_trial');
}
