import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { db } from '../db/mysql.js';
import { getLimitsForTier, TierName } from '../config/tiers.js';

export const billingRouter = Router();

const TRIAL_TIER: TierName = 'starter';
const TRIAL_DAYS = 14;

/**
 * POST /api/billing/start-trial
 * Activate a 14-day Starter trial for the authenticated user.
 * One-time only — once has_used_trial is true, the endpoint returns 403.
 */
billingRouter.post('/start-trial', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;

    // 1. Check eligibility
    const user = await db.queryOne<{ plan_type: string; has_used_trial: number }>(
      'SELECT plan_type, has_used_trial FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    if (user.has_used_trial) {
      return res.status(403).json({
        success: false,
        error: 'You have already used your free trial.',
        upgrade_url: '/portal/settings',
      });
    }

    // Don't allow trial if already on a paid plan
    const paidTiers: TierName[] = ['starter', 'pro', 'advanced', 'enterprise'];
    if (paidTiers.includes(user.plan_type as TierName)) {
      return res.status(400).json({
        success: false,
        error: `You are already on the ${user.plan_type} plan.`,
      });
    }

    // 2. Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);

    // 3. Activate trial
    await db.execute(
      `UPDATE users 
       SET plan_type = ?, 
           has_used_trial = TRUE, 
           trial_expires_at = ? 
       WHERE id = ?`,
      [TRIAL_TIER, expiresAt.toISOString().slice(0, 19).replace('T', ' '), userId]
    );

    const tierLimits = getLimitsForTier(TRIAL_TIER);

    console.log(`[Billing] Trial activated for user ${userId} → ${TRIAL_TIER} until ${expiresAt.toISOString()}`);

    return res.json({
      success: true,
      message: `Your 14-day ${tierLimits.name} trial is now active!`,
      trial: {
        tier: TRIAL_TIER,
        tierName: tierLimits.name,
        expiresAt: expiresAt.toISOString(),
        daysRemaining: TRIAL_DAYS,
        limits: {
          maxSites: tierLimits.maxSites,
          maxWidgets: tierLimits.maxWidgets,
          maxActionsPerMonth: tierLimits.maxActionsPerMonth,
          maxKnowledgePages: tierLimits.maxKnowledgePages,
          allowedSiteType: tierLimits.allowedSiteType,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/billing/trial-status
 * Return current trial status for the authenticated user.
 */
billingRouter.get('/trial-status', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const user = await db.queryOne<{
      plan_type: string;
      has_used_trial: number;
      trial_expires_at: string | null;
    }>(
      'SELECT plan_type, has_used_trial, trial_expires_at FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const now = new Date();
    const expiresAt = user.trial_expires_at ? new Date(user.trial_expires_at) : null;
    const isOnTrial = !!expiresAt && expiresAt > now;
    const daysRemaining = isOnTrial
      ? Math.ceil((expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      success: true,
      trial: {
        hasUsedTrial: !!user.has_used_trial,
        isOnTrial,
        tier: user.plan_type,
        expiresAt: expiresAt?.toISOString() || null,
        daysRemaining,
        canStartTrial: !user.has_used_trial && user.plan_type === 'free',
      },
    });
  } catch (err) {
    next(err);
  }
});
