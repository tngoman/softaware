import { db, generateId, toMySQLDate, type credit_balances, type credit_transactions, type credit_packages, type team_members } from '../db/mysql.js';
import {
  calculateCreditCost,
  LOW_BALANCE_THRESHOLDS,
  SIGNUP_BONUS_CREDITS,
} from '../config/credits.js';
import type { RequestType } from '../config/credits.js';

export type CreditTransactionType = 'BONUS' | 'USAGE' | 'PURCHASE' | 'REFUND' | 'ADJUSTMENT';
export type PaymentProvider = 'PAYFAST' | 'YOCO' | 'MANUAL';

export interface CreditBalanceInfo {
  id: string;
  teamId: string;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lowBalanceThreshold: number;
  lowBalanceAlertSent: boolean;
  formattedBalance: string;
}

export interface TransactionInfo {
  id: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  requestType?: RequestType;
  description?: string;
  createdAt: Date;
  metadata?: any;
}

/**
 * Get or create credit balance for a team
 */
export async function getTeamCreditBalance(
  teamId: string,
  createIfMissing = true
): Promise<CreditBalanceInfo | null> {
  let balance = await db.queryOne<credit_balances>(
    'SELECT * FROM credit_balances WHERE teamId = ?',
    [teamId]
  );

  // Create balance if it doesn't exist
  if (!balance && createIfMissing) {
    const balanceId = generateId();
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO credit_balances (id, teamId, balance, totalPurchased, totalUsed, lowBalanceThreshold, lowBalanceAlertSent, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [balanceId, teamId, SIGNUP_BONUS_CREDITS, SIGNUP_BONUS_CREDITS, 0, LOW_BALANCE_THRESHOLDS.WARNING, false, now, now]
    );

    // Log the signup bonus transaction
    const txId = generateId();
    await db.execute(
      `INSERT INTO credit_transactions (id, creditBalanceId, type, amount, description, balanceAfter, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [txId, balanceId, 'BONUS', SIGNUP_BONUS_CREDITS, 'Signup bonus credits', SIGNUP_BONUS_CREDITS, now]
    );

    balance = await db.queryOne<credit_balances>('SELECT * FROM credit_balances WHERE id = ?', [balanceId]);
  }

  if (!balance) return null;

  return {
    id: balance.id,
    teamId: balance.teamId,
    balance: balance.balance,
    totalPurchased: balance.totalPurchased,
    totalUsed: balance.totalUsed,
    lowBalanceThreshold: balance.lowBalanceThreshold,
    lowBalanceAlertSent: balance.lowBalanceAlertSent,
    formattedBalance: `R${(balance.balance / 100).toFixed(2)}`,
  };
}

/**
 * Deduct credits for a request
 * Throws an error if insufficient credits
 */
export async function deductCredits(
  teamId: string,
  requestType: RequestType,
  metadata?: {
    tokens?: number;
    complexityMultiplier?: number;
    requestId?: string;
    userId?: string;
    [key: string]: any;
  }
): Promise<CreditBalanceInfo> {
  const balance = await getTeamCreditBalance(teamId);

  if (!balance) {
    throw new Error('Credit balance not found for team');
  }

  // Calculate cost
  const cost = calculateCreditCost(requestType, metadata);

  // Check sufficient balance
  if (balance.balance < cost) {
    throw new Error(
      `Insufficient credits. Required: ${cost} (${formatCurrency(cost)}), Available: ${balance.balance} (${formatCurrency(balance.balance)}). Please top up.`
    );
  }

  const now = toMySQLDate(new Date());
  const newBalance = balance.balance - cost;
  const newTotalUsed = balance.totalUsed + cost;

  // Update balance
  await db.execute(
    `UPDATE credit_balances SET balance = ?, totalUsed = ?, updatedAt = ?, 
     lowBalanceAlertSent = CASE WHEN ? > ? AND ? <= ? THEN FALSE ELSE lowBalanceAlertSent END
     WHERE teamId = ?`,
    [newBalance, newTotalUsed, now, balance.balance, LOW_BALANCE_THRESHOLDS.WARNING, newBalance, LOW_BALANCE_THRESHOLDS.WARNING, teamId]
  );

  // Log transaction
  const txId = generateId();
  await db.execute(
    `INSERT INTO credit_transactions (id, creditBalanceId, type, amount, requestType, requestMetadata, description, balanceAfter, createdAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [txId, balance.id, 'USAGE', -cost, requestType, JSON.stringify(metadata || {}), `${requestType} request`, newBalance, now]
  );

  // Check if we need to send low balance alert
  await checkLowBalance(teamId, newBalance);

  return {
    id: balance.id,
    teamId: balance.teamId,
    balance: newBalance,
    totalPurchased: balance.totalPurchased,
    totalUsed: newTotalUsed,
    lowBalanceThreshold: balance.lowBalanceThreshold,
    lowBalanceAlertSent: balance.lowBalanceAlertSent,
    formattedBalance: `R${(newBalance / 100).toFixed(2)}`,
  };
}

/**
 * Add credits (purchase, bonus, refund)
 */
export async function addCredits(
  teamId: string,
  amount: number,
  type: CreditTransactionType,
  options?: {
    description?: string;
    paymentProvider?: PaymentProvider;
    externalPaymentId?: string;
    metadata?: any;
  }
): Promise<CreditBalanceInfo> {
  const balance = await getTeamCreditBalance(teamId);

  if (!balance) {
    throw new Error('Credit balance not found for team');
  }

  const now = toMySQLDate(new Date());
  const newBalance = balance.balance + amount;
  const newTotalPurchased = balance.totalPurchased + amount;

  // Update balance
  await db.execute(
    'UPDATE credit_balances SET balance = ?, totalPurchased = ?, updatedAt = ? WHERE teamId = ?',
    [newBalance, newTotalPurchased, now, teamId]
  );

  // Log transaction
  const txId = generateId();
  await db.execute(
    `INSERT INTO credit_transactions (id, creditBalanceId, type, amount, description, paymentProvider, externalPaymentId, requestMetadata, balanceAfter, createdAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      txId,
      balance.id,
      type,
      amount,
      options?.description || `${type} credits`,
      options?.paymentProvider || null,
      options?.externalPaymentId || null,
      JSON.stringify(options?.metadata || null),
      newBalance,
      now
    ]
  );

  return {
    id: balance.id,
    teamId: balance.teamId,
    balance: newBalance,
    totalPurchased: newTotalPurchased,
    totalUsed: balance.totalUsed,
    lowBalanceThreshold: balance.lowBalanceThreshold,
    lowBalanceAlertSent: balance.lowBalanceAlertSent,
    formattedBalance: `R${(newBalance / 100).toFixed(2)}`,
  };
}

/**
 * Get transaction history for a team
 */
export async function getTransactionHistory(
  teamId: string,
  options?: {
    limit?: number;
    offset?: number;
    type?: CreditTransactionType;
    requestType?: RequestType;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{ transactions: TransactionInfo[]; total: number }> {
  const balance = await db.queryOne<credit_balances>('SELECT * FROM credit_balances WHERE teamId = ?', [teamId]);

  if (!balance) {
    return { transactions: [], total: 0 };
  }

  const conditions: string[] = ['creditBalanceId = ?'];
  const params: any[] = [balance.id];

  if (options?.type) {
    conditions.push('type = ?');
    params.push(options.type);
  }
  if (options?.requestType) {
    conditions.push('requestType = ?');
    params.push(options.requestType);
  }
  if (options?.startDate) {
    conditions.push('createdAt >= ?');
    params.push(toMySQLDate(options.startDate));
  }
  if (options?.endDate) {
    conditions.push('createdAt <= ?');
    params.push(toMySQLDate(options.endDate));
  }

  const whereClause = conditions.join(' AND ');
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const transactions = await db.query<credit_transactions>(
    `SELECT * FROM credit_transactions WHERE ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countResult] = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM credit_transactions WHERE ${whereClause}`,
    params
  );
  const total = countResult?.cnt || 0;

  return {
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type as CreditTransactionType,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      requestType: t.requestType as RequestType | undefined,
      description: t.description ?? undefined,
      createdAt: new Date(t.createdAt),
      metadata: t.requestMetadata,
    })),
    total,
  };
}

/**
 * Get usage statistics for a team
 */
export async function getUsageStatistics(
  teamId: string,
  days: number = 30
): Promise<{
  totalCreditsUsed: number;
  totalRequests: number;
  usageByType: Record<RequestType, number>;
  dailyUsage: Array<{ date: string; credits: number; requests: number }>;
}> {
  const balance = await db.queryOne<credit_balances>('SELECT * FROM credit_balances WHERE teamId = ?', [teamId]);

  if (!balance) {
    return {
      totalCreditsUsed: 0,
      totalRequests: 0,
      usageByType: {} as Record<RequestType, number>,
      dailyUsage: [],
    };
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const transactions = await db.query<credit_transactions>(
    'SELECT * FROM credit_transactions WHERE creditBalanceId = ? AND type = ? AND createdAt >= ?',
    [balance.id, 'USAGE', toMySQLDate(startDate)]
  );

  const usageByType: Record<string, number> = {};
  const dailyUsageMap = new Map<string, { credits: number; requests: number }>();

  let totalCreditsUsed = 0;

  for (const tx of transactions) {
    if (tx.amount < 0) {
      totalCreditsUsed += Math.abs(tx.amount);

      if (tx.requestType) {
        usageByType[tx.requestType] = (usageByType[tx.requestType] || 0) + Math.abs(tx.amount);
      }

      const createdAt = new Date(tx.createdAt);
      const dateKey = createdAt.toISOString().split('T')[0];
      const dayData = dailyUsageMap.get(dateKey) || { credits: 0, requests: 0 };
      dayData.credits += Math.abs(tx.amount);
      dayData.requests += 1;
      dailyUsageMap.set(dateKey, dayData);
    }
  }

  const dailyUsage = Array.from(dailyUsageMap.entries())
    .map(([date, data]) => ({
      date,
      credits: data.credits,
      requests: data.requests,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalCreditsUsed,
    totalRequests: transactions.length,
    usageByType: usageByType as Record<RequestType, number>,
    dailyUsage,
  };
}

/**
 * Check if balance is low and trigger alert if needed
 */
async function checkLowBalance(teamId: string, balance: number): Promise<void> {
  const creditBalance = await db.queryOne<credit_balances>('SELECT * FROM credit_balances WHERE teamId = ?', [teamId]);

  if (!creditBalance) return;

  let shouldAlert = false;
  let threshold = 0;

  if (balance <= LOW_BALANCE_THRESHOLDS.CRITICAL && !creditBalance.lowBalanceAlertSent) {
    shouldAlert = true;
    threshold = LOW_BALANCE_THRESHOLDS.CRITICAL;
  } else if (balance <= LOW_BALANCE_THRESHOLDS.WARNING && !creditBalance.lowBalanceAlertSent) {
    shouldAlert = true;
    threshold = LOW_BALANCE_THRESHOLDS.WARNING;
  }

  if (shouldAlert) {
    await db.execute('UPDATE credit_balances SET lowBalanceAlertSent = ? WHERE teamId = ?', [true, teamId]);
    console.log(`[Credits] Low balance alert for team ${teamId}: ${formatCurrency(balance)} remaining`);
  }
}

/**
 * Get available credit packages
 */
export async function getCreditPackages(): Promise<credit_packages[]> {
  return db.query<credit_packages>(
    'SELECT * FROM credit_packages WHERE isActive = ? ORDER BY featured DESC, displayOrder ASC',
    [true]
  );
}

/**
 * Get a specific credit package
 */
export async function getCreditPackage(id: string): Promise<credit_packages | null> {
  return db.queryOne<credit_packages>('SELECT * FROM credit_packages WHERE id = ?', [id]);
}

/**
 * Format credits as currency
 */
function formatCurrency(credits: number): string {
  return `R${(credits / 100).toFixed(2)}`;
}

/**
 * Seed default credit packages
 */
export async function seedCreditPackages() {
  const packages = [
    { id: 'starter', name: 'Starter', description: 'Perfect for trying out the service', credits: 1000, price: 1000, bonusCredits: 0, featured: false, displayOrder: 1 },
    { id: 'standard', name: 'Standard', description: 'Best value for regular users', credits: 5000, price: 4750, bonusCredits: 250, featured: true, displayOrder: 2 },
    { id: 'professional', name: 'Professional', description: 'For power users and teams', credits: 10000, price: 9000, bonusCredits: 1000, featured: false, displayOrder: 3 },
    { id: 'business', name: 'Business', description: 'Maximum value for businesses', credits: 25000, price: 21250, bonusCredits: 3750, featured: true, displayOrder: 4 },
    { id: 'enterprise', name: 'Enterprise', description: 'For large scale operations', credits: 100000, price: 75000, bonusCredits: 25000, featured: false, displayOrder: 5 },
  ];

  const now = toMySQLDate(new Date());

  for (const pkg of packages) {
    const existing = await db.queryOne<credit_packages>('SELECT id FROM credit_packages WHERE id = ?', [pkg.id]);
    
    if (existing) {
      await db.execute(
        `UPDATE credit_packages SET name = ?, description = ?, credits = ?, price = ?, bonusCredits = ?, featured = ?, displayOrder = ?, updatedAt = ? WHERE id = ?`,
        [pkg.name, pkg.description, pkg.credits, pkg.price, pkg.bonusCredits, pkg.featured, pkg.displayOrder, now, pkg.id]
      );
    } else {
      await db.execute(
        `INSERT INTO credit_packages (id, name, description, credits, price, bonusCredits, isActive, featured, displayOrder, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pkg.id, pkg.name, pkg.description, pkg.credits, pkg.price, pkg.bonusCredits, true, pkg.featured, pkg.displayOrder, now, now]
      );
    }
  }

  console.log('Credit packages seeded successfully');
}
