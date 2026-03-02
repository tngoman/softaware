import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { db, type team_members } from '../db/mysql.js';

export const dashboardRouter = Router();

/**
 * GET /api/dashboard/metrics
 * Get dashboard metrics for authenticated user
 */
dashboardRouter.get('/metrics', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    console.log('[Dashboard] Fetching metrics for userId:', userId);

    // Get user's team
    const membership = await db.queryOne<team_members>(
      'SELECT teamId FROM team_members WHERE userId = ? LIMIT 1',
      [userId]
    );
    console.log('[Dashboard] Membership:', membership);

    if (!membership) {
      console.log('[Dashboard] No membership found, returning defaults');
      return res.json({
        messages: { used: 0, limit: 500 },
        pagesIndexed: { used: 0, limit: 50 },
        assistants: { count: 0, limit: 5 },
        tier: 'free'
      });
    }

    // Get subscription tier and limits
    const subscription = await db.queryOne<any>(
      `SELECT 
        s.status,
        sp.tier,
        sp.maxAgents,
        sp.maxUsers
      FROM subscriptions s
      JOIN subscription_plans sp ON s.planId = sp.id
      WHERE s.teamId = ? AND s.status IN ('TRIAL', 'ACTIVE')
      ORDER BY s.createdAt DESC
      LIMIT 1`,
      [membership.teamId]
    );

    const tier = subscription?.tier || 'FREE';
    // Defaults for free tier
    let messageLimitMonthly = 500;
    let pageLimit = 50;
    let assistantLimit = 5;

    // If subscription exists, use plan limits
    if (subscription) {
      assistantLimit = subscription.maxAgents || 5;
      // Scale page and message limits based on tier
      if (tier === 'TEAM') {
        messageLimitMonthly = 5000;
        pageLimit = 500;
      } else if (tier === 'ENTERPRISE') {
        messageLimitMonthly = 50000;
        pageLimit = 5000;
      }
    }

    // Count assistants for this user
    const assistantCount = await db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM assistants WHERE userId = ?',
      [userId]
    );
    console.log('[Dashboard] Assistant count result:', assistantCount);

    // Count total indexed pages across all user's assistants
    const assistantIds = await db.query<{ id: string }>(
      'SELECT id FROM assistants WHERE userId = ?',
      [userId]
    );

    let totalIndexedPages = 0;
    if (assistantIds.length > 0) {
      const ids = assistantIds.map(a => a.id);
      const pageCount = await db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM ingestion_jobs 
         WHERE assistant_id IN (${ids.map(() => '?').join(',')}) 
         AND status = 'completed'`,
        ids
      );
      totalIndexedPages = pageCount?.count || 0;
    }

    // For messages: since we don't have a message tracking table yet,
    // we'll count ingestion jobs as a proxy for activity
    // TODO: Add proper message tracking when chat functionality is implemented
    let messagesThisCycle = 0;
    if (assistantIds.length > 0) {
      const ids = assistantIds.map(a => a.id);
      // Count completed ingestion jobs as a rough proxy for usage
      const activityCount = await db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM ingestion_jobs 
         WHERE assistant_id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      // Estimate: each ingestion job represents some level of engagement
      messagesThisCycle = Math.min(activityCount?.count || 0, messageLimitMonthly);
    }

    res.json({
      messages: {
        used: messagesThisCycle,
        limit: messageLimitMonthly
      },
      pagesIndexed: {
        used: totalIndexedPages,
        limit: pageLimit
      },
      assistants: {
        count: assistantCount?.count || 0,
        limit: assistantLimit
      },
      tier: tier.toLowerCase()
    });

  } catch (err) {
    console.error('Dashboard metrics error:', err);
    // Return safe defaults on error
    res.json({
      messages: { used: 0, limit: 500 },
      pagesIndexed: { used: 0, limit: 50 },
      assistants: { count: 0, limit: 5 },
      tier: 'free'
    });
  }
});

/* ─────────────────────────────────────────────────────────────
 *  GET /api/dashboard/stats?period=month
 *  Billing dashboard stats for the frontend
 * ───────────────────────────────────────────────────────────── */
dashboardRouter.get('/stats', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const period = (req.query.period as string) || 'month';

    // Build date filter
    let dateFilter = '';
    const now = new Date();
    switch (period) {
      case 'today':
        dateFilter = `AND invoice_date = CURDATE()`;
        break;
      case 'week':
        dateFilter = `AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
        break;
      case 'month':
        dateFilter = `AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
        break;
      case 'quarter':
        dateFilter = `AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`;
        break;
      case 'year':
        dateFilter = `AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)`;
        break;
      case 'all':
      default:
        dateFilter = '';
        break;
    }

    // Same filter for transactions / payments (uses different date columns)
    const txDateFilter = dateFilter.replace(/invoice_date/g, 'transaction_date');
    const payDateFilter = dateFilter.replace(/invoice_date/g, 'payment_date');
    const quoDateFilter = dateFilter.replace(/invoice_date/g, 'quotation_date');

    // ── Revenue ────────────────────────────────────────
    const revenueRow = await db.queryOne<any>(
      `SELECT
         COALESCE(SUM(p.payment_amount), 0) AS collected,
         COALESCE(SUM(i.invoice_amount), 0) AS total_invoiced,
         COALESCE(SUM(i.invoice_amount) - SUM(COALESCE(ip.paid_total, 0)), 0) AS outstanding
       FROM invoices i
       LEFT JOIN (
         SELECT invoice_id, SUM(payment_amount) AS paid_total
         FROM payments GROUP BY invoice_id
       ) ip ON ip.invoice_id = i.id
       LEFT JOIN payments p ON p.invoice_id = i.id
       WHERE i.active = 1 ${dateFilter}`,
      []
    );

    const collected = Number(revenueRow?.collected || 0);
    const totalInvoiced = Number(revenueRow?.total_invoiced || 0);
    const outstanding = Number(revenueRow?.outstanding || 0);
    const collectionRate = totalInvoiced > 0 ? Math.round((collected / totalInvoiced) * 100) : 0;

    // ── Expenses (debit transactions in the ledger) ───
    const expenseRow = await db.queryOne<any>(
      `SELECT COALESCE(SUM(debit_amount), 0) AS expenses
       FROM transactions
       WHERE 1=1 ${txDateFilter}`,
      []
    );
    const expenses = Number(expenseRow?.expenses || 0);
    const profit = collected - expenses;
    const profitMargin = collected > 0 ? Math.round((profit / collected) * 100) : 0;

    // ── Invoice counts ────────────────────────────────
    const invCounts = await db.queryOne<any>(
      `SELECT
         COUNT(*) AS total_count,
         COALESCE(SUM(invoice_amount), 0) AS total_amount,
         SUM(CASE WHEN paid = 1 THEN 1 ELSE 0 END) AS paid_count,
         SUM(CASE WHEN paid = 0 THEN 1 ELSE 0 END) AS unpaid_count,
         0 AS partial_count
       FROM invoices
       WHERE active = 1 ${dateFilter}`,
      []
    );

    // ── Quotation counts ──────────────────────────────
    const quoCounts = await db.queryOne<any>(
      `SELECT COUNT(*) AS total_count, 0 AS accepted_count
       FROM quotations
       WHERE active = 1 ${quoDateFilter}`,
      []
    );

    // ── Customers ─────────────────────────────────────
    const custCounts = await db.queryOne<any>(
      `SELECT COUNT(*) AS customer_count, 0 AS supplier_count
       FROM contacts WHERE active = 1`,
      []
    );

    // ── Payments ──────────────────────────────────────
    const payCounts = await db.queryOne<any>(
      `SELECT
         COUNT(*) AS total_count,
         COALESCE(AVG(payment_amount), 0) AS average_amount
       FROM payments
       WHERE 1=1 ${payDateFilter}`,
      []
    );

    // ── Outstanding aging ─────────────────────────────
    const aging = await db.queryOne<any>(
      `SELECT
         COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) <= 0  THEN i.invoice_amount - COALESCE(ip.paid_total, 0) ELSE 0 END), 0) AS current_amt,
         COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN  1 AND 30 THEN i.invoice_amount - COALESCE(ip.paid_total, 0) ELSE 0 END), 0) AS days_30,
         COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) BETWEEN 31 AND 60 THEN i.invoice_amount - COALESCE(ip.paid_total, 0) ELSE 0 END), 0) AS days_60,
         COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), i.due_date) > 90          THEN i.invoice_amount - COALESCE(ip.paid_total, 0) ELSE 0 END), 0) AS days_90_plus,
         COALESCE(SUM(i.invoice_amount - COALESCE(ip.paid_total, 0)), 0) AS total
       FROM invoices i
       LEFT JOIN (
         SELECT invoice_id, SUM(payment_amount) AS paid_total
         FROM payments GROUP BY invoice_id
       ) ip ON ip.invoice_id = i.id
       WHERE i.active = 1 AND i.paid = 0`,
      []
    );

    // ── Recent invoices (last 5) ──────────────────────
    const recentInvoices = await db.query<any>(
      `SELECT
         i.id AS invoice_id,
         i.invoice_number,
         i.invoice_amount AS invoice_total,
         i.paid AS invoice_payment_status,
         i.invoice_date,
         c.company_name AS contact_name,
         COALESCE(ip.paid_total, 0) AS amount_paid,
         (i.invoice_amount - COALESCE(ip.paid_total, 0)) AS outstanding
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       LEFT JOIN (
         SELECT invoice_id, SUM(payment_amount) AS paid_total
         FROM payments GROUP BY invoice_id
       ) ip ON ip.invoice_id = i.id
       WHERE i.active = 1
       ORDER BY i.invoice_date DESC, i.id DESC
       LIMIT 5`,
      []
    );

    // ── Recent quotations (last 5) ────────────────────
    const recentQuotations = await db.query<any>(
      `SELECT
         q.id AS quotation_id,
         q.quotation_number,
         q.quotation_amount AS quotation_total,
         q.quotation_date,
         c.company_name AS contact_name
       FROM quotations q
       LEFT JOIN contacts c ON c.id = q.contact_id
       WHERE q.active = 1
       ORDER BY q.quotation_date DESC, q.id DESC
       LIMIT 5`,
      []
    );

    res.json({
      revenue: {
        collected,
        total_invoiced: totalInvoiced,
        outstanding,
        collection_rate: collectionRate,
      },
      profit: {
        profit,
        expenses,
        profit_margin: profitMargin,
      },
      invoices: {
        total_count: Number(invCounts?.total_count || 0),
        total_amount: Number(invCounts?.total_amount || 0),
        paid_count: Number(invCounts?.paid_count || 0),
        unpaid_count: Number(invCounts?.unpaid_count || 0),
        partial_count: Number(invCounts?.partial_count || 0),
      },
      quotations: {
        total_count: Number(quoCounts?.total_count || 0),
        accepted_count: Number(quoCounts?.accepted_count || 0),
      },
      customers: {
        customer_count: Number(custCounts?.customer_count || 0),
        supplier_count: Number(custCounts?.supplier_count || 0),
      },
      payments: {
        total_count: Number(payCounts?.total_count || 0),
        average_amount: Number(payCounts?.average_amount || 0),
      },
      outstanding: {
        current: Number(aging?.current_amt || 0),
        '30_days': Number(aging?.days_30 || 0),
        '60_days': Number(aging?.days_60 || 0),
        '90_plus_days': Number(aging?.days_90_plus || 0),
        total: Number(aging?.total || 0),
      },
      recent_invoices: recentInvoices,
      recent_quotations: recentQuotations,
    });
  } catch (err) {
    next(err);
  }
});
