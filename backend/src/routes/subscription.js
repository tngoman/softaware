import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/mysql.js';
import { badRequest, notFound, forbidden } from '../utils/httpErrors.js';
import * as subscriptionService from '../services/subscription.js';
export const subscriptionRouter = Router();
/**
 * GET /api/subscriptions/plans
 * Get all available subscription plans (public)
 */
subscriptionRouter.get('/plans', async (req, res, next) => {
    try {
        const plans = await subscriptionService.getPlans();
        const formattedPlans = plans.map((plan) => ({
            ...plan,
            priceMonthlyDisplay: `R${(plan.priceMonthly / 100).toLocaleString()}`,
            priceAnnuallyDisplay: plan.priceAnnually
                ? `R${(plan.priceAnnually / 100).toLocaleString()}`
                : null,
            priceMonthlyFromAnnual: plan.priceAnnually
                ? `R${((plan.priceAnnually / 100) / 12).toFixed(0)}`
                : null,
        }));
        res.json({ plans: formattedPlans });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/subscriptions/current
 * Get current user's team subscription
 */
subscriptionRouter.get('/current', requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        const membership = await db.queryOne(`SELECT tm.*, t.name as teamName FROM team_members tm JOIN teams t ON tm.teamId = t.id WHERE tm.userId = ? LIMIT 1`, [userId]);
        if (!membership) {
            throw notFound('No team found for user');
        }
        const subscription = await subscriptionService.getTeamSubscription(membership.teamId);
        if (!subscription) {
            return res.json({
                subscription: null,
                status: 'NO_SUBSCRIPTION',
                team: { id: membership.teamId, name: membership.teamName },
            });
        }
        let effectiveStatus = subscription.status;
        if (subscription.status === 'TRIAL' && subscription.trialEndsAt) {
            if (new Date() > subscription.trialEndsAt) {
                effectiveStatus = 'EXPIRED';
            }
        }
        const priceMonthly = subscription.plan.priceMonthly / 100;
        const priceAnnually = subscription.plan.priceAnnually
            ? subscription.plan.priceAnnually / 100
            : null;
        res.json({
            subscription: {
                ...subscription,
                effectiveStatus,
                plan: {
                    ...subscription.plan,
                    priceMonthlyDisplay: `R${priceMonthly.toLocaleString()}`,
                    priceAnnuallyDisplay: priceAnnually ? `R${priceAnnually.toLocaleString()}` : null,
                },
            },
            team: { id: membership.teamId, name: membership.teamName },
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/subscriptions/start-trial
 */
const StartTrialSchema = z.object({
    tier: z.enum(['PERSONAL', 'TEAM', 'ENTERPRISE']).optional().default('PERSONAL'),
});
subscriptionRouter.post('/start-trial', requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        const input = StartTrialSchema.parse(req.body);
        const membership = await db.queryOne('SELECT * FROM team_members WHERE userId = ? LIMIT 1', [userId]);
        if (!membership) {
            throw notFound('No team found for user');
        }
        const existing = await subscriptionService.getTeamSubscription(membership.teamId);
        if (existing) {
            throw badRequest('Team already has an active subscription');
        }
        const subscription = await subscriptionService.createTrialSubscription(membership.teamId, input.tier);
        res.status(201).json({
            message: 'Trial started successfully',
            subscription,
            trialEndsAt: subscription.trialEndsAt,
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/subscriptions/change-plan
 */
const ChangePlanSchema = z.object({
    tier: z.enum(['PERSONAL', 'TEAM', 'ENTERPRISE']),
    billingCycle: z.enum(['monthly', 'annually']).optional().default('monthly'),
});
subscriptionRouter.post('/change-plan', requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        const input = ChangePlanSchema.parse(req.body);
        const membership = await db.queryOne('SELECT * FROM team_members WHERE userId = ? LIMIT 1', [userId]);
        if (!membership) {
            throw notFound('No team found for user');
        }
        if (membership.role !== 'ADMIN') {
            throw forbidden('Only team admins can change the subscription plan');
        }
        const subscription = await subscriptionService.changePlan(membership.teamId, input.tier, input.billingCycle);
        res.json({ message: 'Plan changed successfully', subscription });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/subscriptions/cancel
 */
subscriptionRouter.post('/cancel', requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        const membership = await db.queryOne('SELECT * FROM team_members WHERE userId = ? LIMIT 1', [userId]);
        if (!membership) {
            throw notFound('No team found for user');
        }
        if (membership.role !== 'ADMIN') {
            throw forbidden('Only team admins can cancel the subscription');
        }
        const subscription = await subscriptionService.cancelSubscription(membership.teamId);
        res.json({
            message: 'Subscription cancelled. Access will continue until end of billing period.',
            subscription,
            accessEndsAt: subscription.currentPeriodEnd,
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/subscriptions/invoices
 */
subscriptionRouter.get('/invoices', requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        const membership = await db.queryOne('SELECT * FROM team_members WHERE userId = ? LIMIT 1', [userId]);
        if (!membership) {
            throw notFound('No team found for user');
        }
        const subscription = await subscriptionService.getTeamSubscription(membership.teamId);
        if (!subscription) {
            return res.json({ invoices: [] });
        }
        const invoices = await subscriptionService.getInvoices(subscription.id);
        const formattedInvoices = invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            description: inv.description,
            subtotal: `R${(inv.subtotal / 100).toFixed(2)}`,
            vatAmount: `R${(inv.vatAmount / 100).toFixed(2)}`,
            total: `R${(inv.total / 100).toFixed(2)}`,
            periodStart: inv.periodStart,
            periodEnd: inv.periodEnd,
            dueDate: inv.dueDate,
            paidAt: inv.paidAt,
            status: inv.paidAt ? 'PAID' : new Date() > new Date(inv.dueDate) ? 'OVERDUE' : 'PENDING',
            pdfUrl: inv.pdfUrl,
        }));
        res.json({ invoices: formattedInvoices });
    }
    catch (err) {
        next(err);
    }
});
// ==================== Admin Routes ====================
subscriptionRouter.get('/admin/all', requireAuth, async (req, res, next) => {
    try {
        const userId = req.userId;
        const adminMembership = await db.queryOne('SELECT * FROM team_members WHERE userId = ? AND role = ? LIMIT 1', [userId, 'ADMIN']);
        if (!adminMembership) {
            throw forbidden('Admin access required');
        }
        const { status, tier, limit, offset } = req.query;
        const result = await subscriptionService.getAllSubscriptions({
            status: status,
            tier: tier,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
        res.json({
            subscriptions: result.subscriptions.map((sub) => ({
                id: sub.id,
                status: sub.status,
                plan: { tier: sub.plan.tier, name: sub.plan.name },
                billingCycle: sub.billingCycle,
                team: { id: sub.team.id, name: sub.team.name, owner: sub.team.createdByUser },
                currentPeriodEnd: sub.currentPeriodEnd,
                createdAt: sub.createdAt,
            })),
            total: result.total,
        });
    }
    catch (err) {
        next(err);
    }
});
subscriptionRouter.post('/admin/seed-plans', requireAuth, async (req, res, next) => {
    try {
        await subscriptionService.seedPlans();
        res.json({ message: 'Plans seeded successfully' });
    }
    catch (err) {
        next(err);
    }
});
