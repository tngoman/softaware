import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { db, type team_members } from '../db/mysql.js';
import { getUserUsageCounts } from '../middleware/tierGuard.js';
import { requireActivePackageForUser, getActivePackageForUser } from '../services/packageResolver.js';
import { getLimitsForTier, type TierName } from '../config/tiers.js';
import { getConfigsByContactId, type ClientApiConfig } from '../services/clientApiGateway.js';

export const dashboardRouter = Router();

/* ─────────────────────────────────────────────────────────────
 *  GET /api/dashboard/products
 *  Returns which products the user has access to, plus summary
 *  data for each. The frontend uses this to decide what to show.
 * ───────────────────────────────────────────────────────────── */
dashboardRouter.get('/products', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Resolve contact_id
    const userRow = await db.queryOne<{ contact_id: number | null }>(
      'SELECT contact_id FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    const contactId = userRow?.contact_id ?? null;

    // ── Detect AI Assistant / Website product ───────────────
    const assistantCount = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM assistants WHERE userId = ?',
      [userId],
    );
    const siteCount = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM generated_sites WHERE user_id = ?',
      [userId],
    );

    // ── Detect API Gateway product ──────────────────────────
    let gatewayConfigs: ClientApiConfig[] = [];
    if (contactId) {
      try {
        gatewayConfigs = getConfigsByContactId(contactId);
      } catch { /* gateway DB might not exist yet */ }
    }

    // ── Resolve package ─────────────────────────────────────
    let packageInfo: { slug: string; name: string; status: string; tier: string } | null = null;
    try {
      const pkg = await getActivePackageForUser(userId);
      if (pkg) {
        packageInfo = {
          slug: pkg.packageSlug,
          name: pkg.packageName,
          status: pkg.packageStatus,
          tier: pkg.packageSlug,
        };
      }
    } catch { /* no package */ }

    // ── Build gateway summaries ─────────────────────────────
    const gateways = gatewayConfigs.map((gc) => {
      let tools: string[] = [];
      if (gc.allowed_actions) {
        try { tools = JSON.parse(gc.allowed_actions); } catch { /* */ }
      }
      return {
        client_id: gc.client_id,
        client_name: gc.client_name,
        status: gc.status,
        target_base_url: gc.target_base_url,
        auth_type: gc.auth_type,
        tools_count: tools.length,
        tools,
        rate_limit_rpm: gc.rate_limit_rpm,
        total_requests: gc.total_requests,
        last_request_at: gc.last_request_at,
        created_at: gc.created_at,
      };
    });

    const hasGatewayProduct = gateways.length > 0;
    const hasSites = (siteCount?.cnt ?? 0) > 0;

    // A user with gateway configs but NO sites is a gateway-only client.
    // Their assistants belong to the gateway context (not the website/widget product).
    // ai_assistant is true only if they have sites, or if they have no gateway either.
    const products = {
      ai_assistant: hasSites || !hasGatewayProduct,
      api_gateway: hasGatewayProduct,
    };

    return res.json({
      success: true,
      products,
      package: packageInfo,
      gateway_summary: hasGatewayProduct ? {
        total_gateways: gateways.length,
        gateways,
      } : null,
      assistant_summary: {
        assistant_count: assistantCount?.cnt ?? 0,
        site_count: siteCount?.cnt ?? 0,
      },
    });
  } catch (err) {
    console.error('[Dashboard] products error:', err);
    return res.json({
      success: true,
      products: { ai_assistant: true, api_gateway: false },
      package: null,
      gateway_summary: null,
      assistant_summary: { assistant_count: 0, site_count: 0 },
    });
  }
});

/**
 * GET /api/dashboard/limits
 * Returns current usage counts vs tier limits for the authenticated user.
 * Used by the frontend to gate creation buttons.
 *
 * Falls back to users.plan_type + real DB counts if the legacy
 * contact_packages link is missing.
 */
dashboardRouter.get('/limits', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const usage = await getUserUsageCounts(userId);
    return res.json({ success: true, ...usage });
  } catch (err: any) {
    // Likely PACKAGE_LINK_REQUIRED — fall back to users.plan_type
    const userId = req.userId!;
    try {
      const user = await db.queryOne<{ plan_type?: string }>(
        'SELECT plan_type FROM users WHERE id = ?', [userId]
      );
      const tierName = (user?.plan_type || 'free') as TierName;
      const limits = getLimitsForTier(tierName);

      // Real counts
      const sitesRow = await db.queryOne<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM generated_sites WHERE user_id = ?', [userId]
      );
      const assistantsRow = await db.queryOne<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM assistants WHERE userId = ?', [userId]
      );

      return res.json({
        success: true,
        tier: tierName,
        sites: { used: sitesRow?.cnt ?? 0, limit: limits.maxSites },
        assistants: { used: assistantsRow?.cnt ?? 0, limit: limits.maxWidgets },
        knowledgePages: { used: 0, limit: limits.maxKnowledgePages },
        collections: { used: 0, limit: limits.maxCollectionsPerSite },
      });
    } catch (fallbackErr) {
      console.error('[Dashboard] limits fallback error:', fallbackErr);
      return res.json({
        success: true,
        tier: 'free',
        sites: { used: 0, limit: 1 },
        assistants: { used: 0, limit: 1 },
        knowledgePages: { used: 0, limit: 50 },
        collections: { used: 0, limit: 1 },
      });
    }
  }
});

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

    const pkg = await requireActivePackageForUser(userId);
    const userRow = await db.queryOne<{ has_used_trial: number; trial_expires_at: string | null }>(
      'SELECT has_used_trial, trial_expires_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const planType = pkg.packageSlug;
    const tierLimits = pkg.limits;

    const tier = planType;
    const messageLimitMonthly = tierLimits.maxActionsPerMonth;
    const pageLimit = tierLimits.maxKnowledgePages;
    const assistantLimit = tierLimits.maxWidgets;

    // Count assistants for this user
    const assistantCount = await db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM assistants WHERE userId = ? OR userId IS NULL',
      [userId]
    );
    console.log('[Dashboard] Assistant count result:', assistantCount);

    // Count total indexed pages across all user's assistants
    const assistantIds = await db.query<{ id: string }>(
      'SELECT id FROM assistants WHERE userId = ? OR userId IS NULL',
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

    // Count actual chat messages from the user's widget clients this billing cycle
    let messagesThisCycle = 0;
    const widgetClients = await db.query<{ id: string; billing_cycle_start: string | null }>(
      'SELECT id, billing_cycle_start FROM widget_clients WHERE user_id = ?',
      [userId]
    );
    if (widgetClients.length > 0) {
      const clientIds = widgetClients.map(c => c.id);
      // Use the earliest billing cycle start, or default to 30 days ago
      const cycleStart = widgetClients
        .map(c => c.billing_cycle_start)
        .filter(Boolean)
        .sort()[0] || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const msgCount = await db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM chat_messages 
         WHERE client_id IN (${clientIds.map(() => '?').join(',')})
         AND role = 'user'
         AND created_at >= ?`,
        [...clientIds, cycleStart]
      );
      messagesThisCycle = Math.min(msgCount?.count || 0, messageLimitMonthly);
    }

    // Compute trial status — covers two trial mechanisms:
    //   1. Self-service 14-day starter trial (users.trial_expires_at)
    //   2. Admin-assigned package trial (contact_packages.status='TRIAL', trial_ends_at)
    const now = new Date();
    const selfTrialExpiresAt = userRow?.trial_expires_at ? new Date(userRow.trial_expires_at) : null;

    // For admin-assigned package trials (Pro TRIAL, etc.), read contact_packages.trial_ends_at
    let packageTrialEndsAt: Date | null = null;
    if (pkg.packageStatus === 'TRIAL' && pkg.contactPackageId) {
      try {
        const cpRow = await db.queryOne<{ trial_ends_at: string | null }>(
          'SELECT trial_ends_at FROM contact_packages WHERE id = ? LIMIT 1',
          [pkg.contactPackageId],
        );
        if (cpRow?.trial_ends_at) packageTrialEndsAt = new Date(cpRow.trial_ends_at);
      } catch { /* non-fatal */ }
    }

    // Prefer self-service trial date if present; fall back to package trial date
    const trialExpiresAt = selfTrialExpiresAt || packageTrialEndsAt;
    // isOnTrial: either there's an unexpired date, OR the package itself is TRIAL (no end date set yet)
    const isOnTrial = (!!trialExpiresAt && trialExpiresAt > now) || (pkg.packageStatus === 'TRIAL' && !trialExpiresAt);
    const trialDaysRemaining = trialExpiresAt && trialExpiresAt > now
      ? Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

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
      tier: tier.toLowerCase(),
      trial: {
        hasUsedTrial: !!userRow?.has_used_trial,
        isOnTrial,
        expiresAt: trialExpiresAt?.toISOString() || null,
        daysRemaining: trialDaysRemaining,
        canStartTrial: !userRow?.has_used_trial && planType === 'free',
        packageName: pkg.packageName,
      },
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
      `SELECT COUNT(*) AS total_count, SUM(CASE WHEN active = 2 THEN 1 ELSE 0 END) AS accepted_count
       FROM quotations
       WHERE active >= 0 ${quoDateFilter}`,
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
       WHERE q.active >= 0
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
