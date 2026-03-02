import { db, generateId, toMySQLDate, type subscription_plans, type Subscription, type Invoice, type Team, type User } from '../db/mysql.js';

type SubscriptionTier = 'PERSONAL' | 'TEAM' | 'ENTERPRISE';
type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
type PaymentProvider = 'PAYFAST' | 'YOCO' | 'MANUAL';

// Pricing in ZAR cents
const PLAN_PRICING = {
  PERSONAL: { monthly: 25000, annually: 250000 },
  TEAM: { monthly: 150000, annually: 1500000 },
  ENTERPRISE: { monthly: 500000, annually: 5000000 },
} as const;

// Plan features
const PLAN_FEATURES = {
  PERSONAL: { maxUsers: 1, maxAgents: 3, maxDevices: 1, cloudSyncAllowed: false, vaultAllowed: false, prioritySupport: false, trialDays: 14 },
  TEAM: { maxUsers: 5, maxAgents: null, maxDevices: 5, cloudSyncAllowed: true, vaultAllowed: true, prioritySupport: false, trialDays: 14 },
  ENTERPRISE: { maxUsers: null, maxAgents: null, maxDevices: null, cloudSyncAllowed: true, vaultAllowed: true, prioritySupport: true, trialDays: 30 },
} as const;

export interface PlanFeatures {
  maxUsers: number;
  maxAgents: number | null;
  maxDevices: number;
  cloudSync: boolean;
  vault: boolean;
  prioritySupport: boolean;
}

export interface PlanInfo {
  id: string;
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnually: number | null;
  features: PlanFeatures;
  trialDays: number;
  isActive: boolean;
}

function toPlanInfo(plan: subscription_plans): PlanInfo {
  return {
    id: plan.id,
    tier: plan.tier as SubscriptionTier,
    name: plan.name,
    description: plan.description ?? '',
    priceMonthly: plan.priceMonthly,
    priceAnnually: plan.priceAnnually ?? null,
    features: {
      maxUsers: plan.maxUsers,
      maxAgents: plan.maxAgents ?? null,
      maxDevices: plan.maxDevices,
      cloudSync: plan.cloudSyncAllowed,
      vault: plan.vaultAllowed,
      prioritySupport: plan.prioritySupport,
    },
    trialDays: plan.trialDays,
    isActive: plan.isActive,
  };
}

export interface SubscriptionInfo {
  id: string;
  status: SubscriptionStatus;
  plan: PlanInfo;
  billingCycle: string;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;
}

/**
 * Get all active subscription plans
 */
export async function getPlans(): Promise<PlanInfo[]> {
  const plans = await db.query<subscription_plans>(
    'SELECT * FROM subscription_plans WHERE isActive = ? ORDER BY displayOrder ASC',
    [true]
  );
  return plans.map(toPlanInfo);
}

/**
 * Get a specific plan by tier
 */
export async function getPlanByTier(tier: SubscriptionTier): Promise<PlanInfo | null> {
  const plan = await db.queryOne<subscription_plans>(
    'SELECT * FROM subscription_plans WHERE tier = ?',
    [tier]
  );
  if (!plan) return null;
  return toPlanInfo(plan);
}

/**
 * Get subscription for a team
 */
export async function getTeamSubscription(teamId: string): Promise<SubscriptionInfo | null> {
  const subscription = await db.queryOne<Subscription>(
    'SELECT * FROM subscriptions WHERE teamId = ?',
    [teamId]
  );

  if (!subscription) return null;

  const plan = await db.queryOne<subscription_plans>('SELECT * FROM subscription_plans WHERE id = ?', [subscription.planId]);
  if (!plan) return null;

  return {
    id: subscription.id,
    status: subscription.status as SubscriptionStatus,
    plan: toPlanInfo(plan),
    billingCycle: subscription.billingCycle,
    trialEndsAt: subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null,
    currentPeriodStart: new Date(subscription.currentPeriodStart),
    currentPeriodEnd: new Date(subscription.currentPeriodEnd),
    cancelledAt: subscription.cancelledAt ? new Date(subscription.cancelledAt) : null,
  };
}

/**
 * Create a trial subscription for a new team
 */
export async function createTrialSubscription(
  teamId: string,
  tier: SubscriptionTier = 'PERSONAL'
): Promise<SubscriptionInfo> {
  const plan = await db.queryOne<subscription_plans>('SELECT * FROM subscription_plans WHERE tier = ?', [tier]);

  if (!plan) {
    throw new Error(`Plan not found for tier: ${tier}`);
  }

  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setDate(trialEndsAt.getDate() + plan.trialDays);

  const subId = generateId();
  const nowStr = toMySQLDate(now);
  const trialEndsStr = toMySQLDate(trialEndsAt);

  await db.execute(
    `INSERT INTO subscriptions (id, teamId, planId, status, billingCycle, trialEndsAt, currentPeriodStart, currentPeriodEnd, createdAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [subId, teamId, plan.id, 'TRIAL', 'monthly', trialEndsStr, nowStr, trialEndsStr, nowStr, nowStr]
  );

  return {
    id: subId,
    status: 'TRIAL',
    plan: toPlanInfo(plan),
    billingCycle: 'monthly',
    trialEndsAt,
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
    cancelledAt: null,
  };
}

/**
 * Upgrade or change subscription plan
 */
export async function changePlan(
  teamId: string,
  newTier: SubscriptionTier,
  billingCycle: 'monthly' | 'annually' = 'monthly'
): Promise<SubscriptionInfo> {
  const newPlan = await db.queryOne<subscription_plans>('SELECT * FROM subscription_plans WHERE tier = ?', [newTier]);

  if (!newPlan) {
    throw new Error(`Plan not found for tier: ${newTier}`);
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  const nowStr = toMySQLDate(now);
  const periodEndStr = toMySQLDate(periodEnd);

  const existing = await db.queryOne<Subscription>('SELECT id FROM subscriptions WHERE teamId = ?', [teamId]);

  if (existing) {
    await db.execute(
      `UPDATE subscriptions SET planId = ?, status = ?, billingCycle = ?, currentPeriodStart = ?, currentPeriodEnd = ?, trialEndsAt = NULL, updatedAt = ? WHERE teamId = ?`,
      [newPlan.id, 'ACTIVE', billingCycle, nowStr, periodEndStr, nowStr, teamId]
    );
  } else {
    const subId = generateId();
    await db.execute(
      `INSERT INTO subscriptions (id, teamId, planId, status, billingCycle, currentPeriodStart, currentPeriodEnd, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subId, teamId, newPlan.id, 'ACTIVE', billingCycle, nowStr, periodEndStr, nowStr, nowStr]
    );
  }

  const subscription = await db.queryOne<Subscription>('SELECT * FROM subscriptions WHERE teamId = ?', [teamId]);

  return {
    id: subscription!.id,
    status: 'ACTIVE',
    plan: toPlanInfo(newPlan),
    billingCycle,
    trialEndsAt: null,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    cancelledAt: null,
  };
}

/**
 * Cancel subscription (effective at end of billing period)
 */
export async function cancelSubscription(teamId: string): Promise<SubscriptionInfo> {
  const now = new Date();
  const nowStr = toMySQLDate(now);

  await db.execute(
    'UPDATE subscriptions SET status = ?, cancelledAt = ?, updatedAt = ? WHERE teamId = ?',
    ['CANCELLED', nowStr, nowStr, teamId]
  );

  const subscription = await db.queryOne<Subscription>('SELECT * FROM subscriptions WHERE teamId = ?', [teamId]);
  const plan = await db.queryOne<subscription_plans>('SELECT * FROM subscription_plans WHERE id = ?', [subscription!.planId]);

  return {
    id: subscription!.id,
    status: 'CANCELLED',
    plan: toPlanInfo(plan!),
    billingCycle: subscription!.billingCycle,
    trialEndsAt: subscription!.trialEndsAt ? new Date(subscription!.trialEndsAt) : null,
    currentPeriodStart: new Date(subscription!.currentPeriodStart),
    currentPeriodEnd: new Date(subscription!.currentPeriodEnd),
    cancelledAt: now,
  };
}

/**
 * Get invoices for a subscription
 */
export async function getInvoices(subscriptionId: string): Promise<Invoice[]> {
  return db.query<Invoice>(
    'SELECT * FROM billing_invoices WHERE subscriptionId = ? ORDER BY createdAt DESC',
    [subscriptionId]
  );
}

/**
 * Get all subscriptions with filtering
 */
export async function getAllSubscriptions(options?: {
  status?: SubscriptionStatus;
  tier?: SubscriptionTier;
  limit?: number;
  offset?: number;
}): Promise<{ subscriptions: any[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.status) {
    conditions.push('s.status = ?');
    params.push(options.status);
  }
  if (options?.tier) {
    conditions.push('p.tier = ?');
    params.push(options.tier);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const subscriptions = await db.query<any>(
    `SELECT s.*, p.tier, p.name as planName, t.id as teamId, t.name as teamName, u.id as ownerId, u.email as ownerEmail
     FROM subscriptions s
     JOIN subscription_plans p ON s.planId = p.id
     JOIN teams t ON s.teamId = t.id
     JOIN users u ON t.createdByUserId = u.id
     ${whereClause}
     ORDER BY s.createdAt DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countResult] = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM subscriptions s JOIN subscription_plans p ON s.planId = p.id ${whereClause}`,
    params
  );

  return {
    subscriptions: subscriptions.map((sub) => ({
      id: sub.id,
      status: sub.status,
      plan: { tier: sub.tier, name: sub.planName },
      billingCycle: sub.billingCycle,
      team: { id: sub.teamId, name: sub.teamName, createdByUser: { id: sub.ownerId, email: sub.ownerEmail } },
      currentPeriodEnd: new Date(sub.currentPeriodEnd),
      createdAt: new Date(sub.createdAt),
    })),
    total: countResult?.cnt || 0,
  };
}

/**
 * Seed default subscription plans
 */
export async function seedPlans(): Promise<void> {
  const plans = [
    { tier: 'PERSONAL', name: 'Personal', description: 'For individual developers', ...PLAN_PRICING.PERSONAL, ...PLAN_FEATURES.PERSONAL, displayOrder: 1 },
    { tier: 'TEAM', name: 'Team', description: 'For small teams', ...PLAN_PRICING.TEAM, ...PLAN_FEATURES.TEAM, displayOrder: 2 },
    { tier: 'ENTERPRISE', name: 'Enterprise', description: 'For large organizations', ...PLAN_PRICING.ENTERPRISE, ...PLAN_FEATURES.ENTERPRISE, displayOrder: 3 },
  ];

  const now = toMySQLDate(new Date());

  for (const plan of plans) {
    const existing = await db.queryOne<subscription_plans>('SELECT id FROM subscription_plans WHERE tier = ?', [plan.tier]);

    if (existing) {
      await db.execute(
        `UPDATE subscription_plans SET name = ?, description = ?, priceMonthly = ?, priceAnnually = ?, 
         maxUsers = ?, maxAgents = ?, maxDevices = ?, cloudSyncAllowed = ?, vaultAllowed = ?, prioritySupport = ?, 
         trialDays = ?, displayOrder = ?, updatedAt = ? WHERE tier = ?`,
        [plan.name, plan.description, plan.monthly, plan.annually, plan.maxUsers, plan.maxAgents, plan.maxDevices,
         plan.cloudSyncAllowed, plan.vaultAllowed, plan.prioritySupport, plan.trialDays, plan.displayOrder, now, plan.tier]
      );
    } else {
      const planId = generateId();
      await db.execute(
        `INSERT INTO subscription_plans (id, tier, name, description, priceMonthly, priceAnnually, maxUsers, maxAgents, maxDevices, 
         cloudSyncAllowed, vaultAllowed, prioritySupport, trialDays, isActive, displayOrder, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [planId, plan.tier, plan.name, plan.description, plan.monthly, plan.annually, plan.maxUsers, plan.maxAgents, plan.maxDevices,
         plan.cloudSyncAllowed, plan.vaultAllowed, plan.prioritySupport, plan.trialDays, true, plan.displayOrder, now, now]
      );
    }
  }

  console.log('Subscription plans seeded successfully');
}
