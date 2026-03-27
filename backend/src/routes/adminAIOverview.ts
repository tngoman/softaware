import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { db } from '../db/mysql.js';
import { env } from '../config/env.js';
import { getSecret } from '../services/credentialVault.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export const adminAIOverviewRouter = Router();

adminAIOverviewRouter.use(requireAuth, requireAdmin);

/* ─────────────────────────────────────────────────────────────
 *  Helper: Open the SQLite analytics DB (read-only)
 * ───────────────────────────────────────────────────────────── */
const VECTORS_DB = path.resolve('/var/opt/backend/data/vectors.db');

function openAnalyticsDb(): Database.Database | null {
  try {
    if (!fs.existsSync(VECTORS_DB)) return null;
    const sqlDb = new Database(VECTORS_DB, { readonly: true });
    sqlDb.pragma('busy_timeout = 3000');
    return sqlDb;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
 *  GET /admin/ai-overview
 *
 *  One-stop comprehensive AI overview returning all available
 *  AI usage data: provider stats, credits, balances, telemetry,
 *  spending estimates, model breakdown, etc.
 * ───────────────────────────────────────────────────────────── */
adminAIOverviewRouter.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    // ══════════════════════════════════════════════════════════
    //  1. ASSISTANTS & INFRASTRUCTURE
    // ══════════════════════════════════════════════════════════

    const assistantStats = await db.queryOne<any>(`
      SELECT
        COUNT(*)                                                           AS total,
        SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END)            AS active,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END)            AS suspended,
        SUM(CASE WHEN status = 'demo_expired' THEN 1 ELSE 0 END)         AS demoExpired,
        SUM(CASE WHEN tier = 'paid' THEN 1 ELSE 0 END)                   AS paid,
        SUM(CASE WHEN tier = 'free' THEN 1 ELSE 0 END)                   AS free
      FROM assistants
    `);

    const widgetStats = await db.queryOne<any>(`
      SELECT
        COUNT(*)                                                           AS total,
        SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END)            AS active,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END)            AS suspended
      FROM widget_clients
    `);

    const apiKeyCount = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM api_keys');
    const aiConfigCount = await db.queryOne<any>('SELECT COUNT(*) AS cnt FROM ai_model_config');

    // ══════════════════════════════════════════════════════════
    //  2. CREDIT SYSTEM — PACKAGES (contact/package-scoped)
    // ══════════════════════════════════════════════════════════

    const packageCredits: any = { totalUsed: 0, totalPurchased: 0, totalAllocated: 0, totalBonus: 0, totalAdjusted: 0, totalRefunded: 0, usageTransactions: 0, totalTransactions: 0 };

    const packageBalances: any = { totalBalance: 0, totalUsed: 0, subscriptionCount: 0 };

    const packageUsageByType: any[] = [];

    const packageDailyUsage: any[] = [];

    const subscriptionBreakdown: any[] = [];

    const packagePopularity: any[] = [];

    const topConsumers: any[] = [];

    // ══════════════════════════════════════════════════════════
    //  4. TELEMETRY — SQLite analytics logs
    // ══════════════════════════════════════════════════════════

    let telemetry: any = {
      totalLogs: 0,
      byProvider: [],
      byModel: [],
      bySource: [],
      avgDurationMs: 0,
      dailyVolume: [],
      recentErrors: [],
    };

    const analyticsDb = openAnalyticsDb();
    if (analyticsDb) {
      try {
        // Total log count
        const totalRow = analyticsDb.prepare('SELECT COUNT(*) AS cnt FROM ai_analytics_logs').get() as any;
        telemetry.totalLogs = totalRow?.cnt || 0;

        // By provider
        telemetry.byProvider = analyticsDb.prepare(`
          SELECT provider, COUNT(*) AS cnt,
                 ROUND(AVG(duration_ms), 0) AS avgMs
          FROM ai_analytics_logs
          WHERE provider IS NOT NULL
          GROUP BY provider
          ORDER BY cnt DESC
        `).all();

        // By model
        telemetry.byModel = analyticsDb.prepare(`
          SELECT model, provider, COUNT(*) AS cnt,
                 ROUND(AVG(duration_ms), 0) AS avgMs
          FROM ai_analytics_logs
          WHERE model IS NOT NULL
          GROUP BY model, provider
          ORDER BY cnt DESC
          LIMIT 20
        `).all();

        // By source
        telemetry.bySource = analyticsDb.prepare(`
          SELECT source, COUNT(*) AS cnt
          FROM ai_analytics_logs
          GROUP BY source
          ORDER BY cnt DESC
        `).all();

        // Average duration
        const avgRow = analyticsDb.prepare(
          'SELECT ROUND(AVG(duration_ms), 0) AS avgMs FROM ai_analytics_logs WHERE duration_ms IS NOT NULL'
        ).get() as any;
        telemetry.avgDurationMs = avgRow?.avgMs || 0;

        // Daily volume last 30 days
        telemetry.dailyVolume = analyticsDb.prepare(`
          SELECT DATE(created_at) AS day,
                 COUNT(*) AS requests,
                 ROUND(AVG(duration_ms), 0) AS avgMs
          FROM ai_analytics_logs
          WHERE created_at >= DATE('now', '-30 days')
          GROUP BY DATE(created_at)
          ORDER BY day ASC
        `).all();

        // Provider breakdown last 7 days (for trend)
        telemetry.providerTrend = analyticsDb.prepare(`
          SELECT DATE(created_at) AS day, provider, COUNT(*) AS cnt
          FROM ai_analytics_logs
          WHERE created_at >= DATE('now', '-7 days') AND provider IS NOT NULL
          GROUP BY DATE(created_at), provider
          ORDER BY day ASC
        `).all();

        analyticsDb.close();
      } catch (err) {
        console.error('[AI Overview] SQLite telemetry read error:', (err as Error).message);
        if (analyticsDb) try { analyticsDb.close(); } catch {}
      }
    }

    // ══════════════════════════════════════════════════════════
    //  5. CLOUD PROVIDER STATUS (live checks)
    // ══════════════════════════════════════════════════════════

    // OpenRouter — check /auth/key for balance & rate limits
    let openRouterStatus: any = null;
    let orKey: string | null = null;
    try { orKey = await getSecret('OPENROUTER') || null; } catch { orKey = null; }
    if (orKey) {
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { 'Authorization': `Bearer ${orKey}` },
          signal: AbortSignal.timeout(5000),
        });
        if (orRes.ok) {
          const orData = await orRes.json() as any;
          openRouterStatus = {
            connected: true,
            label: orData.data?.label || 'Unknown',
            credits: orData.data?.limit != null ? orData.data.limit : null,
            creditsUsed: orData.data?.usage != null ? orData.data.usage : null,
            creditsRemaining: (orData.data?.limit != null && orData.data?.usage != null)
              ? orData.data.limit - orData.data.usage
              : null,
            rateLimit: orData.data?.rate_limit || null,
            isFreeTier: orData.data?.is_free_tier ?? null,
          };
        } else {
          openRouterStatus = { connected: false, error: `HTTP ${orRes.status}` };
        }
      } catch (err: any) {
        openRouterStatus = { connected: false, error: err.message || 'Timeout' };
      }
    }

    // GLM / ZhipuAI — basic connectivity check
    let glmStatus: any = null;
    const glmKey = env.GLM || env.ANTHROPIC_AUTH_TOKEN;
    if (glmKey) {
      glmStatus = {
        configured: true,
        apiKeyPreview: '***' + glmKey.slice(-4),
        model: env.GLM_MODEL,
        visionModel: env.GLM_VISION_MODEL,
        baseUrl: env.ANTHROPIC_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      };
    } else {
      glmStatus = { configured: false };
    }

    // OpenAI — check connectivity via /v1/models
    let openAIStatus: any = null;
    let oaiKey: string | null = null;
    try { oaiKey = await getSecret('OpenAI', env.OPENAI || env.OPENAI_API_KEY) || null; } catch { oaiKey = null; }
    if (oaiKey) {
      try {
        const oaiRes = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${oaiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        if (oaiRes.ok) {
          const oaiData = await oaiRes.json() as any;
          const models = (oaiData.data || []).map((m: any) => m.id).sort();
          openAIStatus = {
            connected: true,
            apiKeyPreview: '***' + oaiKey.slice(-4),
            models,
            totalModels: models.length,
          };
        } else {
          openAIStatus = { connected: false, error: `HTTP ${oaiRes.status}` };
        }
      } catch (err: any) {
        openAIStatus = { connected: false, error: err.message || 'Timeout' };
      }
    }

    // Ollama — list running models and their status
    let ollamaStatus: any = null;
    try {
      // Get loaded models
      const psRes = await fetch(`${env.OLLAMA_BASE_URL}/api/ps`, {
        signal: AbortSignal.timeout(3000),
      });
      let runningModels: any[] = [];
      if (psRes.ok) {
        const psData = await psRes.json() as any;
        runningModels = (psData.models || []).map((m: any) => ({
          name: m.name,
          size: m.size,
          sizeVram: m.size_vram,
          digest: m.digest?.substring(0, 12),
          expiresAt: m.expires_at,
        }));
      }

      // Get installed models
      const tagsRes = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      let installedModels: any[] = [];
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json() as any;
        installedModels = (tagsData.models || []).map((m: any) => ({
          name: m.name,
          size: m.size,
          modifiedAt: m.modified_at,
          digest: m.digest?.substring(0, 12),
          parameterSize: m.details?.parameter_size,
          quantization: m.details?.quantization_level,
          family: m.details?.family,
        }));
      }

      ollamaStatus = {
        connected: true,
        baseUrl: env.OLLAMA_BASE_URL,
        runningModels,
        installedModels,
        totalModels: installedModels.length,
        loadedModels: runningModels.length,
      };
    } catch (err: any) {
      ollamaStatus = { connected: false, error: err.message || 'Connection failed' };
    }

    // ══════════════════════════════════════════════════════════
    //  6. ENTERPRISE ENDPOINTS
    // ══════════════════════════════════════════════════════════

    // Enterprise endpoints from SQLite
    let enterpriseStats: any = { total: 0, active: 0, paused: 0, disabled: 0, totalRequests: 0, endpoints: [] };
    const ENTERPRISE_DB = path.resolve('/var/opt/backend/data/enterprise_endpoints.db');
    if (fs.existsSync(ENTERPRISE_DB)) {
      let epDb: Database.Database | null = null;
      try {
        epDb = new Database(ENTERPRISE_DB, { readonly: true });
        epDb.pragma('busy_timeout = 3000');

        const epStats = epDb.prepare(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused,
            SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) AS disabled,
            COALESCE(SUM(total_requests), 0) AS totalRequests
          FROM enterprise_endpoints
        `).get() as any;

        if (epStats) {
          enterpriseStats = {
            total: epStats.total || 0,
            active: epStats.active || 0,
            paused: epStats.paused || 0,
            disabled: epStats.disabled || 0,
            totalRequests: epStats.totalRequests || 0,
          };
        }

        // Top endpoints by request count
        enterpriseStats.endpoints = epDb.prepare(`
          SELECT id, client_name, status, llm_provider, llm_model, total_requests, last_request_at
          FROM enterprise_endpoints
          ORDER BY total_requests DESC
          LIMIT 10
        `).all();

        epDb.close();
      } catch (err) {
        if (epDb) try { epDb.close(); } catch {}
      }
    }

    // ══════════════════════════════════════════════════════════
    //  6b. CLIENT API GATEWAY CONFIGS
    // ══════════════════════════════════════════════════════════

    let clientApiGatewayStats: any = { total: 0, active: 0, paused: 0, disabled: 0, totalRequests: 0, configs: [] };
    if (fs.existsSync(ENTERPRISE_DB)) {
      let gwDb: Database.Database | null = null;
      try {
        gwDb = new Database(ENTERPRISE_DB, { readonly: true });
        gwDb.pragma('busy_timeout = 3000');

        // Check if table exists first
        const tableExists = gwDb.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='client_api_configs'"
        ).get();

        if (tableExists) {
          const gwStats = gwDb.prepare(`
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused,
              SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) AS disabled,
              COALESCE(SUM(total_requests), 0) AS totalRequests
            FROM client_api_configs
          `).get() as any;

          if (gwStats) {
            clientApiGatewayStats = {
              total: gwStats.total || 0,
              active: gwStats.active || 0,
              paused: gwStats.paused || 0,
              disabled: gwStats.disabled || 0,
              totalRequests: gwStats.totalRequests || 0,
            };
          }

          // Top configs by request count
          clientApiGatewayStats.configs = gwDb.prepare(`
            SELECT id, client_id, client_name, status, auth_type, target_base_url,
                   total_requests, last_request_at, created_at
            FROM client_api_configs
            ORDER BY total_requests DESC
            LIMIT 10
          `).all();
        }

        gwDb.close();
      } catch (err) {
        if (gwDb) try { gwDb.close(); } catch {}
      }
    }

    // ══════════════════════════════════════════════════════════
    //  7. MODEL CONFIGURATION (env-based routing)
    // ══════════════════════════════════════════════════════════

    const modelConfig = {
      // Primary cascade
      primaryModel: env.GLM_MODEL || 'glm-4-plus',
      primaryProvider: 'GLM (ZhipuAI)',
      // OpenRouter fallback
      openRouterFallback: env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-4o-mini',
      openRouterAssistant: env.ASSISTANT_OPENROUTER_MODEL || 'google/gemma-3-4b-it:free',
      // Ollama models
      assistantOllama: env.ASSISTANT_OLLAMA_MODEL || 'qwen2.5:1.5b-instruct',
      toolsOllama: env.TOOLS_OLLAMA_MODEL || 'qwen2.5:3b-instruct',
      siteBuilderOllama: env.SITE_BUILDER_OLLAMA_MODEL || 'qwen2.5:7b-instruct',
      // Vision
      visionOpenRouter: env.VISION_OPENROUTER_MODEL || 'openai/gpt-4o',
      visionOpenRouterFallback: env.VISION_OPENROUTER_FALLBACK || 'google/gemini-2.0-flash-001',
      visionOllama: env.VISION_OLLAMA_MODEL || 'qwen2.5vl:7b',
      // Ingestion
      ingestionOpenRouter: env.INGESTION_OPENROUTER_MODEL || 'google/gemma-3-4b-it:free',
      ingestionOllama: env.INGESTION_OLLAMA_MODEL || 'qwen2.5:1.5b-instruct',
      // Site builder cloud
      siteBuilderGLM: env.SITE_BUILDER_GLM_MODEL || 'claude-sonnet-4-20250514',
      siteBuilderOpenRouter: env.SITE_BUILDER_OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    };

    // ══════════════════════════════════════════════════════════
    //  8. SPENDING ESTIMATES
    // ══════════════════════════════════════════════════════════

    // Credits → Rands (1 credit = R0.01)
    const totalCreditsUsedPackages = Number(packageCredits?.totalUsed || 0);
    const totalRevenueRands = totalCreditsUsedPackages / 100; // 100 credits = R1.00
    const totalPurchasedRands = Number(packageCredits?.totalPurchased || 0) / 100;

    // OpenRouter estimated spend (from their API)
    const openRouterSpend = openRouterStatus?.creditsUsed != null
      ? Number(openRouterStatus.creditsUsed)
      : null;

    // OpenAI — try billing API for current-month spend
    let openAISpendUSD: number | null = null;
    if (oaiKey) {
      try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startTs = Math.floor(startOfMonth.getTime() / 1000);
        const endTs = Math.floor(now.getTime() / 1000);
        const costRes = await fetch(
          `https://api.openai.com/v1/organization/costs?start_time=${startTs}&end_time=${endTs}`,
          { headers: { 'Authorization': `Bearer ${oaiKey}` }, signal: AbortSignal.timeout(5000) },
        );
        if (costRes.ok) {
          const costData = await costRes.json() as any;
          // Each bucket in data.results[] has amount.value in cents
          openAISpendUSD = ((costData.data || []) as any[]).reduce((sum: number, bucket: any) => {
            return sum + ((bucket.results || []) as any[]).reduce(
              (s: number, r: any) => s + (r.amount?.value || 0), 0,
            );
          }, 0) / 100; // cents → dollars
        }
      } catch { /* billing endpoint may not be available with this key */ }
    }

    // Telemetry-based provider request counts
    const openAITel = (telemetry.byProvider as any[]).find(
      (p: any) => p.provider?.toLowerCase() === 'openai',
    );
    const ollamaTel = (telemetry.byProvider as any[]).find(
      (p: any) => p.provider?.toLowerCase() === 'ollama',
    );
    const glmTel = (telemetry.byProvider as any[]).find(
      (p: any) => p.provider?.toLowerCase() === 'glm',
    );

    // Ollama aggregate model size (bytes)
    const ollamaTotalSize = (ollamaStatus?.installedModels || [])
      .reduce((sum: number, m: any) => sum + (m.size || 0), 0);

    const spending = {
      totalCreditsUsed: totalCreditsUsedPackages,
      totalCreditsUsedRands: totalRevenueRands,
      totalCreditsPurchased: Number(packageCredits?.totalPurchased || 0),
      totalCreditsPurchasedRands: totalPurchasedRands,
      totalCreditsBalance: Number(packageBalances?.totalBalance || 0),
      totalCreditsBalanceRands: Number(packageBalances?.totalBalance || 0) / 100,
      openRouterSpendUSD: openRouterSpend,
      openRouterLimitUSD: openRouterStatus?.credits ?? null,
      openRouterRemainingUSD: openRouterStatus?.creditsRemaining ?? null,
      profitMarginRands: totalRevenueRands - (openRouterSpend ? openRouterSpend * 18.5 : 0), // rough USD→ZAR
      // OpenAI
      openAISpendUSD,
      openAIRequests: openAITel?.cnt || 0,
      openAIAvgMs: openAITel?.avgMs || 0,
      // GLM (free cloud)
      glmRequests: glmTel?.cnt || 0,
      glmAvgMs: glmTel?.avgMs || 0,
      // Ollama (local)
      ollamaRequests: ollamaTel?.cnt || 0,
      ollamaAvgMs: ollamaTel?.avgMs || 0,
      ollamaLoadedModels: ollamaStatus?.loadedModels || 0,
      ollamaInstalledModels: ollamaStatus?.totalModels || 0,
      ollamaTotalSize,
    };

    // ══════════════════════════════════════════════════════════
    //  9. SYSTEM HEALTH
    // ══════════════════════════════════════════════════════════

    const upSince = process.uptime();
    const days = Math.floor(upSince / 86400);
    const hrs  = Math.floor((upSince % 86400) / 3600);
    const mins = Math.floor((upSince % 3600) / 60);
    const uptimeStr = days > 0
      ? `${days}d ${hrs}h ${mins}m`
      : hrs > 0
        ? `${hrs}h ${mins}m`
        : `${mins}m`;

    // ──────────────────────────────────────────────────────────
    //  BUILD RESPONSE
    // ──────────────────────────────────────────────────────────

    res.json({
      success: true,
      data: {
        // Infrastructure
        assistants: {
          total: Number(assistantStats?.total || 0),
          active: Number(assistantStats?.active || 0),
          suspended: Number(assistantStats?.suspended || 0),
          demoExpired: Number(assistantStats?.demoExpired || 0),
          paid: Number(assistantStats?.paid || 0),
          free: Number(assistantStats?.free || 0),
        },
        widgets: {
          total: Number(widgetStats?.total || 0),
          active: Number(widgetStats?.active || 0),
          suspended: Number(widgetStats?.suspended || 0),
        },
        apiKeys: Number(apiKeyCount?.cnt || 0),
        aiConfigurations: Number(aiConfigCount?.cnt || 0),

        // Credits — packages
        packageCredits: {
          totalUsed: totalCreditsUsedPackages,
          totalPurchased: Number(packageCredits?.totalPurchased || 0),
          totalAllocated: Number(packageCredits?.totalAllocated || 0),
          totalBonus: Number(packageCredits?.totalBonus || 0),
          totalAdjusted: Number(packageCredits?.totalAdjusted || 0),
          totalRefunded: Number(packageCredits?.totalRefunded || 0),
          usageTransactions: Number(packageCredits?.usageTransactions || 0),
          totalTransactions: Number(packageCredits?.totalTransactions || 0),
          totalBalance: Number(packageBalances?.totalBalance || 0),
          totalUsedLifetime: Number(packageBalances?.totalUsed || 0),
          activeSubscriptions: Number(packageBalances?.subscriptionCount || 0),
          usageByType: packageUsageByType.map((r: any) => ({
            type: r.request_type,
            count: Number(r.cnt),
            credits: Number(r.totalCredits),
          })),
          dailyUsage: packageDailyUsage.map((r: any) => ({
            day: r.day,
            requests: Number(r.requests),
            creditsUsed: Number(r.creditsUsed),
          })),
        },

        subscriptionBreakdown: subscriptionBreakdown.map((r: any) => ({
          status: r.status,
          count: Number(r.cnt),
        })),

        packagePopularity: packagePopularity.map((r: any) => ({
          name: r.name,
          slug: r.slug,
          subscribers: Number(r.subscribers),
          totalCreditsUsed: Number(r.totalCreditsUsed),
        })),

        topConsumers: topConsumers.map((r: any) => ({
          contactId: r.contact_id,
          name: r.name,
          packageName: r.package_name,
          creditsUsed: Number(r.credits_used || 0),
          creditsBalance: Number(r.credits_balance || 0),
          status: r.status,
        })),

        // Spending
        spending,

        // Telemetry
        telemetry,

        // Cloud providers
        providers: {
          openRouter: openRouterStatus,
          openAI: openAIStatus,
          glm: glmStatus,
          ollama: ollamaStatus,
        },

        // Enterprise
        enterprise: enterpriseStats,

        // Client API Gateway
        clientApiGateway: clientApiGatewayStats,

        // Model configuration
        modelConfig,

        // System
        system: {
          uptime: uptimeStr,
          nodeVersion: process.version,
          memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          platform: process.platform,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────────
 *  GET /admin/ai-overview/assistant-logs/:assistantId
 *
 *  Fetch sanitized chat logs for a specific assistant from the
 *  SQLite analytics DB. Returns both 'assistant' and 'widget'
 *  source logs that match the given assistant ID.
 * ───────────────────────────────────────────────────────────── */
adminAIOverviewRouter.get('/assistant-logs/:assistantId', async (req: AuthRequest, res: Response) => {
  try {
    const { assistantId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const analyticsDb = openAnalyticsDb();
    if (!analyticsDb) {
      return res.json({ success: true, data: [], pagination: { total: 0, limit, offset, hasMore: false } });
    }

    try {
      const countRow = analyticsDb.prepare(
        'SELECT COUNT(*) AS total FROM ai_analytics_logs WHERE client_id = ?'
      ).get(assistantId) as any;
      const total = countRow?.total || 0;

      const logs = analyticsDb.prepare(`
        SELECT id, client_id, source, sanitized_prompt, sanitized_response,
               model, provider, duration_ms, created_at
        FROM ai_analytics_logs
        WHERE client_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(assistantId, limit, offset);

      analyticsDb.close();

      return res.json({
        success: true,
        data: logs,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      });
    } catch (err) {
      analyticsDb.close();
      throw err;
    }
  } catch (err) {
    console.error('[AI Overview] Assistant logs error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load assistant logs' });
  }
});
