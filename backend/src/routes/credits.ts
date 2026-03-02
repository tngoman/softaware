import { Router } from 'express';
import { z } from 'zod';
import { db, type team_members, type credit_packages } from '../db/mysql.js';
import {
  getTeamCreditBalance,
  addCredits,
  getTransactionHistory,
  getUsageStatistics,
  getCreditPackages,
  getCreditPackage,
} from '../services/credits.js';
import { createPayment } from '../services/payment.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireApiKey, ApiKeyRequest } from '../middleware/apiKey.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { REQUEST_TYPES } from '../config/credits.js';
import type { CreditTransactionType } from '../services/credits.js';
import type { RequestType } from '../config/credits.js';

export const creditsRouter = Router();

// Validation schemas
const TopUpSchema = z.object({
  packageId: z.string().optional(),
  amount: z.number().int().positive().optional(),
  paymentProvider: z.enum(['PAYFAST', 'YOCO', 'MANUAL']).optional(),
  paymentReference: z.string().optional(),
});

const PurchaseCreditsSchema = z.object({
  packageId: z.string(),
  paymentMethod: z.enum(['PAYFAST', 'YOCO', 'MANUAL']),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const TransactionHistorySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  type: z.enum(['BONUS', 'USAGE', 'PURCHASE']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================
// Public Endpoints
// ============================================

creditsRouter.get('/packages', async (req, res, next) => {
  try {
    const packages = await getCreditPackages();

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
      })),
    });
  } catch (error) {
    next(error);
  }
});

creditsRouter.get('/packages/:id', async (req, res, next) => {
  try {
    const pkg = await getCreditPackage(req.params.id);

    if (!pkg) {
      return res.status(404).json({ success: false, error: 'Package not found' });
    }

    res.json({
      success: true,
      package: {
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
      },
    });
  } catch (error) {
    next(error);
  }
});

creditsRouter.get('/pricing', async (req, res, next) => {
  try {
    const { calculateCreditCost, REQUEST_PRICING } = await import('../config/credits.js');

    const pricing = REQUEST_TYPES.map((type) => ({
      type,
      baseCost: REQUEST_PRICING[type as RequestType].baseCost,
      perTokenCost: REQUEST_PRICING[type as RequestType].perTokenCost,
      description: {
        TEXT_CHAT: 'Full AI chat with token-based pricing',
        TEXT_SIMPLE: 'Simple text requests',
        AI_BROKER: 'Minimal processing fee for external provider proxying',
        CODE_AGENT_EXECUTE: 'Code agent execution with file editing',
        FILE_OPERATION: 'File read/write operations',
        MCP_TOOL: 'MCP tool calls',
      }[type as RequestType] || '',
    }));

    res.json({ success: true, pricing });
  } catch (error) {
    next(error);
  }
});

// ============================================
// API Key Protected Endpoints (for desktop apps)
// ============================================

async function getTeamIdFromApiKey(req: any): Promise<string | undefined> {
  const apiKey = req.apiKey;
  if (!apiKey) return undefined;

  const membership = await db.queryOne<team_members>(
    'SELECT * FROM team_members WHERE userId = ? LIMIT 1',
    [apiKey.userId]
  );

  return membership?.teamId;
}

creditsRouter.get('/balance', requireApiKey, async (req: ApiKeyRequest, res, next) => {
  try {
    const teamId = await getTeamIdFromApiKey(req);
    
    if (!teamId) {
      return res.status(404).json({ 
        success: false, 
        error: 'No team found for user. Please create a team first.' 
      });
    }
    
    const balance = await getTeamCreditBalance(teamId);

    if (!balance) {
      return res.status(404).json({ success: false, error: 'Credit balance not found' });
    }

    res.json({ success: true, balance });
  } catch (error) {
    next(error);
  }
});

creditsRouter.post('/purchase', requireApiKey, async (req: ApiKeyRequest, res, next) => {
  try {
    const teamId = await getTeamIdFromApiKey(req);
    
    if (!teamId) {
      return res.status(404).json({ 
        success: false, 
        error: 'No team found for user. Please create a team first.' 
      });
    }
    
    const { packageId, paymentMethod, returnUrl, cancelUrl } = PurchaseCreditsSchema.parse(req.body);

    const pkg = await getCreditPackage(packageId);
    if (!pkg) {
      return res.status(404).json({ success: false, error: 'Credit package not found' });
    }

    const paymentResult = await createPayment({
      teamId,
      packageId,
      provider: paymentMethod as any,
      returnUrl,
      cancelUrl,
    });

    if (!paymentResult.success) {
      return res.status(400).json({ success: false, error: paymentResult.error || 'Failed to create payment' });
    }

    const totalCredits = pkg.credits + pkg.bonusCredits;

    res.json({
      success: true,
      message: 'Payment created successfully',
      package: {
        id: pkg.id,
        name: pkg.name,
        credits: totalCredits,
        price: pkg.price,
        formattedPrice: `R${(pkg.price / 100).toFixed(2)}`,
      },
      paymentUrl: paymentResult.paymentUrl,
      paymentId: paymentResult.paymentId,
    });
  } catch (error) {
    next(error);
  }
});

creditsRouter.get('/transactions', requireApiKey, async (req: ApiKeyRequest, res, next) => {
  try {
    const teamId = await getTeamIdFromApiKey(req);
    
    if (!teamId) {
      return res.status(404).json({ 
        success: false, 
        error: 'No team found for user. Please create a team first.' 
      });
    }
    
    const { limit, offset, type, startDate, endDate } = TransactionHistorySchema.parse(req.query);

    const { transactions, total } = await getTransactionHistory(teamId, {
      limit,
      offset,
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.json({
      success: true,
      transactions: transactions.map((tx) => ({
        ...tx,
        formattedAmount: tx.amount >= 0 ? `+${tx.amount}` : tx.amount,
        formattedBalance: `R${(tx.balanceAfter / 100).toFixed(2)}`,
      })),
      pagination: {
        total,
        limit: limit || 50,
        offset: offset || 0,
        hasMore: (offset || 0) + (limit || 50) < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

creditsRouter.get('/usage', requireApiKey, async (req: ApiKeyRequest, res, next) => {
  try {
    const teamId = await getTeamIdFromApiKey(req);
    
    if (!teamId) {
      return res.status(404).json({ 
        success: false, 
        error: 'No team found for user. Please create a team first.' 
      });
    }
    
    const days = req.query.days ? parseInt(req.query.days as string) : 30;

    const stats = await getUsageStatistics(teamId, days);

    res.json({
      success: true,
      stats: {
        ...stats,
        totalFormatted: `R${(stats.totalCreditsUsed / 100).toFixed(2)}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Admin Only Endpoints (JWT + Admin Role Required)
// ============================================

async function getUserTeamId(userId: string): Promise<string> {
  const membership = await db.queryOne<team_members>(
    'SELECT * FROM team_members WHERE userId = ? LIMIT 1',
    [userId]
  );

  if (!membership) {
    throw new Error('No team found for user. Please create a team first.');
  }

  return membership.teamId;
}

creditsRouter.post('/topup', requireAuth, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const teamId = await getUserTeamId(userId);
    const { packageId, amount, paymentProvider, paymentReference } = TopUpSchema.parse(req.body);

    let creditsToAdd = 0;
    let description = 'Manual top-up';

    if (packageId) {
      const pkg = await getCreditPackage(packageId);
      if (!pkg) {
        return res.status(404).json({ success: false, error: 'Credit package not found' });
      }
      creditsToAdd = pkg.credits + pkg.bonusCredits;
      description = `Purchased ${pkg.name} package`;
    } else if (amount) {
      creditsToAdd = amount;
      description = `Manual credit top-up of ${amount} credits`;
    } else {
      return res.status(400).json({ success: false, error: 'Either packageId or amount must be provided' });
    }

    const balance = await addCredits(teamId, creditsToAdd, 'PURCHASE', {
      description,
      paymentProvider: (paymentProvider as any) || 'MANUAL',
      externalPaymentId: paymentReference,
    });

    res.json({
      success: true,
      message: `Successfully added ${creditsToAdd} credits to your account`,
      balance,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Webhook Endpoints (No Authentication)
// ============================================

creditsRouter.post('/webhook/payfast', async (req, res, next) => {
  try {
    const { processPaymentCallback } = await import('../services/payment.js');
    const result = await processPaymentCallback('PAYFAST', req.body);

    if (result.success) {
      res.status(200).send('OK');
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    next(error);
  }
});

creditsRouter.post('/webhook/yoco', async (req, res, next) => {
  try {
    const { processPaymentCallback, verifyYocoWebhookSignature } = await import('../services/payment.js');
    const signature = req.headers['x-yoco-signature'] as string;

    if (signature) {
      const isValid = verifyYocoWebhookSignature(req.body, signature);
      if (!isValid) {
        console.error('[Yoco Webhook] Invalid signature, rejecting request');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const result = await processPaymentCallback('YOCO', req.body, signature);

    if (result.success) {
      res.status(200).send('OK');
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('[Yoco Webhook] Processing error:', error);
    next(error);
  }
});
