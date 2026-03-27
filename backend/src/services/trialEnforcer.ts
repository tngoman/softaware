import { db } from '../db/mysql.js';
import { getLimitsForTier } from '../config/tiers.js';

/**
 * Trial Enforcer — Background cron that sweeps for expired trials
 * and downgrades users back to the free tier.
 *
 * Runs every hour. When a trial expires:
 *   1. Sets plan_type = 'free', clears trial_expires_at
 *   2. Freezes over-limit sites (oldest survives)
 *   3. Freezes over-limit widget_clients (oldest survives)
 *
 * has_used_trial remains TRUE forever (prevents re-activation).
 */

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function freezeOverLimitAssets(userId: string): Promise<void> {
  const freeLimits = getLimitsForTier('free');

  // ── Freeze sites ──────────────────────────────────────────────
  // Keep the oldest N sites active, lock the rest
  const sites = await db.query<{ id: number; status: string }>(
    `SELECT id, status FROM generated_sites 
     WHERE user_id = ? AND status != 'locked_tier_limit'
     ORDER BY created_at ASC`,
    [userId]
  );

  if (sites.length > freeLimits.maxSites) {
    const toFreeze = sites.slice(freeLimits.maxSites);
    for (const site of toFreeze) {
      await db.execute(
        `UPDATE generated_sites SET status = 'locked_tier_limit' WHERE id = ?`,
        [site.id]
      );
    }
    console.log(`[TrialEnforcer] Froze ${toFreeze.length} sites for user ${userId}`);
  }

  // ── Freeze widget clients ─────────────────────────────────────
  const widgets = await db.query<{ id: string; status: string }>(
    `SELECT id, status FROM widget_clients 
     WHERE user_id = ? AND status != 'suspended'
     ORDER BY created_at ASC`,
    [userId]
  );

  if (widgets.length > freeLimits.maxWidgets) {
    const toFreeze = widgets.slice(freeLimits.maxWidgets);
    for (const widget of toFreeze) {
      await db.execute(
        `UPDATE widget_clients SET status = 'suspended' WHERE id = ?`,
        [widget.id]
      );
    }
    console.log(`[TrialEnforcer] Suspended ${toFreeze.length} widgets for user ${userId}`);
  }
}

/**
 * Sweep expired TRIAL rows in contact_packages.
 * When current_period_end < NOW(), downgrade the contact_package status to EXPIRED.
 * This stops resolveContactPackage / getActivePackageForUser from matching them.
 */
async function sweepExpiredContactTrials(): Promise<void> {
  try {
    const expired = await db.query<{ id: number; contact_id: number; package_id: number }>(
      `SELECT id, contact_id, package_id
       FROM contact_packages
       WHERE status = 'TRIAL'
         AND current_period_end IS NOT NULL
         AND current_period_end < NOW()`,
      []
    );

    if (expired.length === 0) return;

    console.log(`[TrialEnforcer] Found ${expired.length} expired contact_package trial(s)`);

    for (const row of expired) {
      await db.execute(
        `UPDATE contact_packages
            SET status = 'EXPIRED', updated_at = NOW()
          WHERE id = ?`,
        [row.id]
      );
      console.log(`[TrialEnforcer] Expired contact_package ${row.id} (contact ${row.contact_id}, package ${row.package_id})`);
    }
  } catch (err) {
    console.error('[TrialEnforcer] Contact trial sweep error:', err);
  }
}

async function sweepExpiredTrials(): Promise<void> {
  try {
    // ── Phase 1: Contact-level trials (contact_packages) ──────────
    await sweepExpiredContactTrials();

    // ── Phase 2: User-level trials (users table) ──────────────────
    const expired = await db.query<{ id: string; plan_type: string }>(
      `SELECT id, plan_type FROM users 
       WHERE trial_expires_at IS NOT NULL 
       AND trial_expires_at < NOW()`,
      []
    );

    if (expired.length === 0) return;

    console.log(`[TrialEnforcer] Found ${expired.length} expired trial(s)`);

    for (const user of expired) {
      // Downgrade to free, clear the timer (has_used_trial stays TRUE)
      await db.execute(
        `UPDATE users 
         SET plan_type = 'free', 
             trial_expires_at = NULL 
         WHERE id = ?`,
        [user.id]
      );

      // Freeze any assets above free-tier limits
      await freezeOverLimitAssets(user.id);

      console.log(`[TrialEnforcer] Downgraded user ${user.id} from ${user.plan_type} → free`);
    }
  } catch (err) {
    console.error('[TrialEnforcer] Sweep error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the trial enforcer sweep (call once at server boot).
 * Runs immediately on start, then every hour.
 */
export function startTrialEnforcer(): void {
  if (intervalId) return; // Already running

  console.log('[TrialEnforcer] Starting hourly trial expiry sweep');

  // Run once immediately (catches anything that expired while the server was down)
  sweepExpiredTrials();

  // Then run every hour
  intervalId = setInterval(sweepExpiredTrials, SWEEP_INTERVAL_MS);
}

export function stopTrialEnforcer(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Export for testing
export { sweepExpiredTrials, freezeOverLimitAssets };
