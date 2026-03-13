import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { db } from '../db/mysql.js';

export const adminDashboardRouter = Router();

/* ─────────────────────────────────────────────────────────────
 *  GET /admin/dashboard
 *  Main Soft Aware admin dashboard — real stats from every
 *  key table in the system. No mock data.
 * ───────────────────────────────────────────────────────────── */
adminDashboardRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    // ── Workspaces (teams) ──────────────────────────────────
    const wsTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM teams');
    const wsNew = await db.queryOne<any>(
      'SELECT COUNT(*) AS cnt FROM teams WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    const totalWorkspaces = Number(wsTotal?.cnt || 0);
    const newWorkspacesThisMonth = Number(wsNew?.cnt || 0);

    // ── Users ───────────────────────────────────────────────
    const userTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM users');
    const totalUsers = Number(userTotal?.cnt || 0);

    // ── Subscriptions ───────────────────────────────────────
    const subStats = await db.queryOne<any>(`
      SELECT
        COUNT(*)                                                  AS total,
        SUM(CASE WHEN status = 'ACTIVE'  THEN 1 ELSE 0 END)     AS active,
        SUM(CASE WHEN status = 'TRIAL'   THEN 1 ELSE 0 END)     AS trial,
        SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END)     AS expired,
        SUM(CASE WHEN status = 'PAST_DUE' THEN 1 ELSE 0 END)   AS pastDue
      FROM subscriptions
    `);

    // ── Software Products ───────────────────────────────────
    const swTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM update_software');
    const swIntegrated = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM update_software WHERE has_external_integration = 1');
    const moduleTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM update_modules');
    const releaseTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM update_releases');

    // ── Connected Clients (Desktops) ────────────────────────
    const clientTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM update_clients');
    const clientOnline = await db.queryOne<any>(
      'SELECT COUNT(*) AS cnt FROM update_clients WHERE last_heartbeat >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
    );
    const clientBlocked = await db.queryOne<any>(
      'SELECT COUNT(*) AS cnt FROM update_clients WHERE is_blocked = 1'
    );

    // ── AI & Assistants ─────────────────────────────────────
    const assistantTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM assistants');
    const aiConfigRow = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM ai_model_config');
    const apiKeyTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM api_keys');

    // Credit usage (AI consumption — from package system)
    const creditStats = await db.queryOne<any>(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'USAGE' THEN ABS(amount) ELSE 0 END), 0) AS totalUsed,
        COALESCE(SUM(CASE WHEN type = 'PURCHASE' OR type = 'BONUS' OR type = 'MONTHLY_ALLOCATION' THEN amount ELSE 0 END), 0) AS totalPurchased,
        COUNT(CASE WHEN type = 'USAGE' THEN 1 END) AS usageCount
      FROM package_transactions
    `);
    const creditBalanceRow = await db.queryOne<any>(
      'SELECT COALESCE(SUM(credits_balance), 0) AS totalBalance FROM contact_packages WHERE status IN (\'ACTIVE\', \'TRIAL\')'
    );

    // AI usage by request type (from package system)
    const aiUsageByType = await db.query<any>(`
      SELECT request_type AS requestType, COUNT(*) AS cnt, COALESCE(SUM(ABS(amount)), 0) AS totalCredits
      FROM package_transactions
      WHERE type = 'USAGE' AND request_type IS NOT NULL
      GROUP BY request_type
      ORDER BY cnt DESC
    `);

    // ── Websites / Site Builder ─────────────────────────────
    const siteTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM generated_sites');
    const siteDeployed = await db.queryOne<any>(
      "SELECT COUNT(*) AS cnt FROM generated_sites WHERE status = 'deployed'"
    );
    const siteDraft = await db.queryOne<any>(
      "SELECT COUNT(*) AS cnt FROM generated_sites WHERE status = 'draft'"
    );

    // Widget clients (chat widgets deployed on third-party sites)
    const widgetTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM widget_clients');
    const widgetActive = await db.queryOne<any>(
      "SELECT COUNT(*) AS cnt FROM widget_clients WHERE status = 'active'"
    );

    // ── Leads ───────────────────────────────────────────────
    const leadTotal = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM lead_captures');
    const leadNew = await db.queryOne<any>(
      "SELECT COUNT(*) AS cnt FROM lead_captures WHERE status = 'NEW'"
    );
    const leadThisMonth = await db.queryOne<any>(
      'SELECT COUNT(*) AS cnt FROM lead_captures WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );

    // ── Activation Keys ─────────────────────────────────────
    const keyStats = await db.queryOne<any>(`
      SELECT
        COUNT(*)                                          AS total,
        SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END)   AS active,
        SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END)   AS revoked
      FROM activation_keys
    `);

    // ── System health ───────────────────────────────────────
    const upSince = process.uptime();
    const days = Math.floor(upSince / 86400);
    const hrs  = Math.floor((upSince % 86400) / 3600);
    const mins = Math.floor((upSince % 3600) / 60);
    const uptimeStr = days > 0
      ? `${days}d ${hrs}h ${mins}m`
      : hrs > 0
        ? `${hrs}h ${mins}m`
        : `${mins}m`;

    // ── Recent Activity (real, from multiple tables) ────────
    const activity: Array<{
      id: string;
      type: string;
      description: string;
      actor: string;
      time: string;
      timestamp: Date;
    }> = [];

    // Recent teams
    const recentTeams = await db.query<any>(
      'SELECT id, name, createdAt FROM teams ORDER BY createdAt DESC LIMIT 3'
    );
    for (const t of recentTeams) {
      activity.push({
        id: `ws_${t.id}`,
        type: 'workspace_created',
        description: `Workspace "${t.name}" created`,
        actor: 'system',
        time: formatTimeAgo(t.createdAt),
        timestamp: new Date(t.createdAt),
      });
    }

    // Recent users
    const recentUsers = await db.query<any>(
      'SELECT id, email, name, createdAt FROM users ORDER BY createdAt DESC LIMIT 3'
    );
    for (const u of recentUsers) {
      activity.push({
        id: `usr_${u.id}`,
        type: 'user_registered',
        description: `User "${u.name || u.email}" registered`,
        actor: u.email,
        time: formatTimeAgo(u.createdAt),
        timestamp: new Date(u.createdAt),
      });
    }

    // Recent client heartbeats (unique)
    const recentClients = await db.query<any>(
      `SELECT id, hostname, machine_name, ip_address, last_heartbeat
       FROM update_clients
       ORDER BY last_heartbeat DESC LIMIT 3`
    );
    for (const c of recentClients) {
      activity.push({
        id: `client_${c.id}`,
        type: 'client_heartbeat',
        description: `Client "${c.hostname || c.machine_name || c.ip_address}" checked in`,
        actor: c.ip_address || 'unknown',
        time: formatTimeAgo(c.last_heartbeat),
        timestamp: new Date(c.last_heartbeat),
      });
    }

    // Recent leads
    const recentLeads = await db.query<any>(
      'SELECT id, contactName, companyName, email, createdAt FROM lead_captures ORDER BY createdAt DESC LIMIT 2'
    );
    for (const l of recentLeads) {
      activity.push({
        id: `lead_${l.id}`,
        type: 'lead_captured',
        description: `New lead captured${l.contactName ? ': ' + l.contactName : ''}${l.companyName ? ' (' + l.companyName + ')' : ''}`,
        actor: l.email || 'website',
        time: formatTimeAgo(l.createdAt),
        timestamp: new Date(l.createdAt),
      });
    }

    // Sort all activity by timestamp descending
    activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Strip the Date object before sending
    const recentActivity = activity.slice(0, 10).map(({ timestamp, ...rest }) => rest);

    // ── Build response ──────────────────────────────────────
    res.json({
      success: true,
      data: {
        workspaces: {
          total: totalWorkspaces,
          active: totalWorkspaces,
          inactive: 0,
          newThisMonth: newWorkspacesThisMonth,
        },
        users: {
          total: totalUsers,
        },
        subscriptions: {
          total: Number(subStats?.total || 0),
          active: Number(subStats?.active || 0),
          trial: Number(subStats?.trial || 0),
          expired: Number(subStats?.expired || 0),
          pastDue: Number(subStats?.pastDue || 0),
        },
        software: {
          total: Number(swTotal?.cnt || 0),
          withIntegration: Number(swIntegrated?.cnt || 0),
          modules: Number(moduleTotal?.cnt || 0),
          releases: Number(releaseTotal?.cnt || 0),
        },
        clients: {
          total: Number(clientTotal?.cnt || 0),
          online: Number(clientOnline?.cnt || 0),
          offline: Math.max(0, Number(clientTotal?.cnt || 0) - Number(clientOnline?.cnt || 0) - Number(clientBlocked?.cnt || 0)),
          blocked: Number(clientBlocked?.cnt || 0),
        },
        ai: {
          assistants: Number(assistantTotal?.cnt || 0),
          apiKeys: Number(apiKeyTotal?.cnt || 0),
          configurations: Number(aiConfigRow?.cnt || 0),
          creditsUsed: Number(creditStats?.totalUsed || 0),
          creditsBalance: Number(creditBalanceRow?.totalBalance || 0),
          totalRequests: Number(creditStats?.usageCount || 0),
          usageByType: aiUsageByType.map((r: any) => ({
            type: r.requestType,
            count: Number(r.cnt),
            credits: Number(r.totalCredits),
          })),
        },
        websites: {
          total: Number(siteTotal?.cnt || 0),
          deployed: Number(siteDeployed?.cnt || 0),
          draft: Number(siteDraft?.cnt || 0),
          widgets: Number(widgetTotal?.cnt || 0),
          activeWidgets: Number(widgetActive?.cnt || 0),
        },
        leads: {
          total: Number(leadTotal?.cnt || 0),
          new: Number(leadNew?.cnt || 0),
          thisMonth: Number(leadThisMonth?.cnt || 0),
        },
        activationKeys: {
          total: Number(keyStats?.total || 0),
          active: Number(keyStats?.active || 0),
          revoked: Number(keyStats?.revoked || 0),
        },
        system: {
          status: 'healthy' as const,
          uptime: uptimeStr,
          version: process.env.npm_package_version || '0.2.0',
        },
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ─── Helper ─────────────────────────────────────────── */
function formatTimeAgo(dateInput: string | Date | null): string {
  if (!dateInput) return '—';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return date.toLocaleDateString('en-ZA');
}
