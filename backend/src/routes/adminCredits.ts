import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db, generateId, toMySQLDate, type credit_packages, type credit_balances, type credit_transactions, type Team } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { REQUEST_PRICING, REQUEST_TYPES } from '../config/credits.js';
import type { RequestType } from '../config/credits.js';

export const adminCreditsRouter = Router();

adminCreditsRouter.use(requireAuth, requireAdmin);

// ============================================
// Credit Package Management
// ============================================

const CreatePackageSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  credits: z.number().int().positive(),
  price: z.number().int().positive(),
  bonusCredits: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
});

const UpdatePackageSchema = CreatePackageSchema.partial();

adminCreditsRouter.get('/packages', async (req, res, next) => {
  try {
    const packages = await db.query<credit_packages>('SELECT * FROM credit_packages ORDER BY createdAt DESC');

    res.json({
      success: true,
      packages: packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        credits: pkg.credits,
        bonusCredits: pkg.bonusCredits,
        totalCredits: pkg.credits + pkg.bonusCredits,
        price: pkg.price,
        formattedPrice: `R${(pkg.price / 100).toFixed(2)}`,
        discountPercent: pkg.credits > 0
          ? Math.round((1 - pkg.price / (pkg.credits + pkg.bonusCredits)) * 100)
          : 0,
        featured: pkg.featured,
        isActive: pkg.isActive,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

adminCreditsRouter.post('/packages', async (req, res, next) => {
  try {
    const data = CreatePackageSchema.parse(req.body);
    const pkgId = generateId();
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO credit_packages (id, name, description, credits, price, bonusCredits, isActive, featured, displayOrder, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pkgId, data.name, data.description ?? null, data.credits, data.price, data.bonusCredits, true, data.featured, 0, now, now]
    );

    const creditPackage = await db.queryOne<credit_packages>('SELECT * FROM credit_packages WHERE id = ?', [pkgId]);

    res.status(201).json({
      success: true,
      message: 'Credit package created successfully',
      package: {
        id: creditPackage!.id,
        name: creditPackage!.name,
        description: creditPackage!.description,
        credits: creditPackage!.credits,
        bonusCredits: creditPackage!.bonusCredits,
        totalCredits: creditPackage!.credits + creditPackage!.bonusCredits,
        price: creditPackage!.price,
        formattedPrice: `R${(creditPackage!.price / 100).toFixed(2)}`,
        featured: creditPackage!.featured,
        isActive: creditPackage!.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminCreditsRouter.put('/packages/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const data = UpdatePackageSchema.parse(req.body);
    const now = toMySQLDate(new Date());

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.credits !== undefined) { updates.push('credits = ?'); values.push(data.credits); }
    if (data.price !== undefined) { updates.push('price = ?'); values.push(data.price); }
    if (data.bonusCredits !== undefined) { updates.push('bonusCredits = ?'); values.push(data.bonusCredits); }
    if (data.featured !== undefined) { updates.push('featured = ?'); values.push(data.featured); }

    if (updates.length > 0) {
      updates.push('updatedAt = ?');
      values.push(now);
      values.push(id);
      await db.execute(`UPDATE credit_packages SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const creditPackage = await db.queryOne<credit_packages>('SELECT * FROM credit_packages WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Credit package updated successfully',
      package: {
        id: creditPackage!.id,
        name: creditPackage!.name,
        description: creditPackage!.description,
        credits: creditPackage!.credits,
        bonusCredits: creditPackage!.bonusCredits,
        totalCredits: creditPackage!.credits + creditPackage!.bonusCredits,
        price: creditPackage!.price,
        formattedPrice: `R${(creditPackage!.price / 100).toFixed(2)}`,
        featured: creditPackage!.featured,
        isActive: creditPackage!.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminCreditsRouter.delete('/packages/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    await db.execute('UPDATE credit_packages SET isActive = ? WHERE id = ?', [false, id]);
    res.json({ success: true, message: 'Credit package deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

adminCreditsRouter.post('/packages/seed', async (req, res, next) => {
  try {
    const { seedCreditPackages } = await import('../services/credits.js');
    await seedCreditPackages();
    res.json({ success: true, message: 'Default credit packages seeded successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Pricing Configuration
// ============================================

adminCreditsRouter.get('/pricing', async (req, res, next) => {
  try {
    const pricing = REQUEST_TYPES.map((type) => ({
      type,
      baseCost: REQUEST_PRICING[type as RequestType].baseCost,
      perTokenCost: REQUEST_PRICING[type as RequestType].perTokenCost,
      perMultiplier: REQUEST_PRICING[type as RequestType].perMultiplier,
      description: {
        TEXT_CHAT: 'Full AI chat with token-based pricing',
        TEXT_SIMPLE: 'Simple text requests',
        AI_BROKER: 'Minimal processing fee for external provider proxying',
        CODE_AGENT_EXECUTE: 'Code agent execution with file editing',
        FILE_OPERATION: 'File read/write operations',
        MCP_TOOL: 'MCP tool calls',
      }[type as RequestType] || '',
      formattedBaseCost: `R${(REQUEST_PRICING[type as RequestType].baseCost / 100).toFixed(4)}`,
    }));

    res.json({
      success: true,
      pricing,
      note: 'Pricing is currently configured in code. Database-driven pricing coming soon.',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Credit Balance Management
// ============================================

adminCreditsRouter.get('/balances', async (req, res, next) => {
  try {
    const balances = await db.query<credit_balances & { teamId: string; teamName: string; teamCreatedAt: Date }>(
      `SELECT cb.*, t.id as teamId, t.name as teamName, t.createdAt as teamCreatedAt
       FROM credit_balances cb
       JOIN teams t ON cb.teamId = t.id
       ORDER BY cb.updatedAt DESC`
    );

    res.json({
      success: true,
      balances: balances.map((balance) => ({
        id: balance.id,
        teamId: balance.teamId,
        team: { id: balance.teamId, name: balance.teamName, createdAt: balance.teamCreatedAt },
        balance: balance.balance,
        formattedBalance: `R${(balance.balance / 100).toFixed(2)}`,
        totalPurchased: balance.totalPurchased,
        totalUsed: balance.totalUsed,
        lowBalanceThreshold: balance.lowBalanceThreshold,
        lowBalanceAlertSent: balance.lowBalanceAlertSent,
        updatedAt: balance.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

adminCreditsRouter.get('/balances/:teamId', async (req, res, next) => {
  try {
    const teamId = z.string().uuid().parse(req.params.teamId);

    const balance = await db.queryOne<credit_balances & { teamName: string; teamCreatedAt: Date }>(
      `SELECT cb.*, t.name as teamName, t.createdAt as teamCreatedAt
       FROM credit_balances cb
       JOIN teams t ON cb.teamId = t.id
       WHERE cb.teamId = ?`,
      [teamId]
    );

    if (!balance) {
      res.status(404).json({ success: false, error: 'Credit balance not found for team' });
      return;
    }

    res.json({
      success: true,
      balance: {
        id: balance.id,
        teamId: balance.teamId,
        team: { id: balance.teamId, name: balance.teamName, createdAt: balance.teamCreatedAt },
        balance: balance.balance,
        formattedBalance: `R${(balance.balance / 100).toFixed(2)}`,
        totalPurchased: balance.totalPurchased,
        totalUsed: balance.totalUsed,
        lowBalanceThreshold: balance.lowBalanceThreshold,
        lowBalanceAlertSent: balance.lowBalanceAlertSent,
        updatedAt: balance.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

const AdjustCreditsSchema = z.object({
  amount: z.number().int(),
  description: z.string().min(1).max(200),
  type: z.enum(['ADJUSTMENT', 'BONUS', 'REFUND']).default('ADJUSTMENT'),
});

adminCreditsRouter.post('/balances/:teamId/adjust', async (req, res, next) => {
  try {
    const teamId = z.string().uuid().parse(req.params.teamId);
    const { amount, description, type } = AdjustCreditsSchema.parse(req.body);

    const { addCredits } = await import('../services/credits.js');
    const balance = await addCredits(teamId, amount, type, { description: `[Admin] ${description}` });

    res.json({
      success: true,
      message: `Successfully ${amount > 0 ? 'added' : 'deducted'} ${Math.abs(amount)} credits`,
      balance,
    });
  } catch (error) {
    next(error);
  }
});

adminCreditsRouter.get('/transactions', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await db.query<credit_transactions & { teamId: string; teamName: string }>(
      `SELECT ct.*, cb.teamId, t.name as teamName
       FROM credit_transactions ct
       JOIN credit_balances cb ON ct.creditBalanceId = cb.id
       JOIN teams t ON cb.teamId = t.id
       ORDER BY ct.createdAt DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countResult] = await db.query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM credit_transactions');
    const total = countResult?.cnt || 0;

    res.json({
      success: true,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        team: { id: tx.teamId, name: tx.teamName },
        type: tx.type,
        amount: tx.amount,
        formattedAmount: `R${(Math.abs(tx.amount) / 100).toFixed(2)}`,
        balanceAfter: tx.balanceAfter,
        formattedBalance: `R${(tx.balanceAfter / 100).toFixed(2)}`,
        requestType: tx.requestType,
        description: tx.description,
        paymentProvider: tx.paymentProvider,
        externalPaymentId: tx.externalPaymentId,
        createdAt: tx.createdAt,
      })),
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    next(error);
  }
});

adminCreditsRouter.get('/balances/:teamId/transactions', async (req, res, next) => {
  try {
    const teamId = z.string().uuid().parse(req.params.teamId);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await db.query<credit_transactions & { teamName: string }>(
      `SELECT ct.*, t.name as teamName
       FROM credit_transactions ct
       JOIN credit_balances cb ON ct.creditBalanceId = cb.id
       JOIN teams t ON cb.teamId = t.id
       WHERE cb.teamId = ?
       ORDER BY ct.createdAt DESC
       LIMIT ? OFFSET ?`,
      [teamId, limit, offset]
    );

    const [countResult] = await db.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM credit_transactions ct
       JOIN credit_balances cb ON ct.creditBalanceId = cb.id
       WHERE cb.teamId = ?`,
      [teamId]
    );
    const total = countResult?.cnt || 0;

    res.json({
      success: true,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        team: { id: teamId, name: tx.teamName },
        type: tx.type,
        amount: tx.amount,
        formattedAmount: `R${(Math.abs(tx.amount) / 100).toFixed(2)}`,
        balanceAfter: tx.balanceAfter,
        formattedBalance: `R${(tx.balanceAfter / 100).toFixed(2)}`,
        requestType: tx.requestType,
        description: tx.description,
        paymentProvider: tx.paymentProvider,
        externalPaymentId: tx.externalPaymentId,
        createdAt: tx.createdAt,
      })),
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    next(error);
  }
});
