import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { agentsRouter } from './routes/agents.js';
import { teamsRouter } from './routes/teams.js';
import { vaultRouter } from './routes/vault.js';
import { activationRouter } from './routes/activation.js';
import { syncRouter } from './routes/sync.js';
import { adminRouter } from './routes/admin.js';
import { subscriptionRouter } from './routes/subscription.js';
import { adminClientManagerRouter } from './routes/adminClientManager.js';
import { checkAssistantStatus, checkWidgetStatus } from './middleware/statusCheck.js';
import { mcpRouter } from './routes/mcp.js';
import { filesRouter } from './routes/files.js';
import { glmRouter } from './routes/glm.js';
import { aiRouter } from './routes/ai.js';
import { apiKeysRouter } from './routes/apiKeys.js';
import { aiConfigRouter } from './routes/aiConfig.js';
import { adminConfigRouter } from './routes/adminConfig.js';
import { adminDashboardRouter } from './routes/adminDashboard.js';
import { adminAIOverviewRouter } from './routes/adminAIOverview.js';
import { adminPackagesRouter } from './routes/adminPackages.js';
import { packagesRouter } from './routes/packages.js';
import { codeImplementationRouter } from './routes/codeImplementation.js';
import { codeWriterRouter } from './routes/codeWriter.js';
import { gitRouter } from './routes/git.js';
import { assistantsRouter } from './routes/assistants.js';
import assistantIngestRouter from './routes/assistantIngest.js';
import { dashboardRouter } from './routes/dashboard.js';
import { publicLeadAssistantRouter } from './routes/publicLeadAssistant.js';
import widgetChatRouter from './routes/widgetChat.js';
import widgetIngestRouter from './routes/widgetIngest.js';
import siteBuilderRouter from './routes/siteBuilder.js';
import contactFormRouter from './routes/contactFormRouter.js';
import subscriptionTiersRouter from './routes/subscriptionTiers.js';
import { profileRouter } from './routes/profile.js';
import { updSoftwareRouter } from './routes/updSoftware.js';
import { updUpdatesRouter } from './routes/updUpdates.js';
import { updFilesRouter } from './routes/updFiles.js';
import { updHeartbeatRouter } from './routes/updHeartbeat.js';
import { updClientsRouter } from './routes/updClients.js';
import { updModulesRouter } from './routes/updModules.js';
import { updMiscRouter } from './routes/updMisc.js';
import { updErrorReportRouter } from './routes/updErrorReport.js';
import { contactsRouter } from './routes/contacts.js';
import { quotationsRouter } from './routes/quotations.js';
import { invoicesRouter } from './routes/invoices.js';
import { accountingRouter } from './routes/accounting.js';
import { transactionsRouter } from './routes/transactions.js';
import { appSettingsRouter } from './routes/appSettings.js';
import { notificationsRouter } from './routes/notifications.js';
import { pricingRouter } from './routes/pricing.js';
import { categoriesRouter } from './routes/categories.js';
import { paymentsRouter } from './routes/payments.js';
import { financialReportsRouter } from './routes/financialReports.js';
import { expenseCategoriesRouter } from './routes/expenseCategories.js';
import { reportsRouter } from './routes/reports.js';
import { settingsRouter } from './routes/settings.js';
import { vatReportsRouter } from './routes/vatReports.js';
import { systemUsersRouter } from './routes/systemUsers.js';
import { rolesRouter } from './routes/systemRoles.js';
import { permissionsRouter } from './routes/systemPermissions.js';
import { credentialsRouter } from './routes/systemCredentials.js';
import { softawareTasksRouter } from './routes/softawareTasks.js';
import { localTasksRouter } from './routes/localTasks.js';
import { bugsRouter } from './routes/bugs.js';
import databaseManagerRouter from './routes/databaseManager.js';
import { twoFactorRouter } from './routes/twoFactor.js';
import { fcmTokensRouter } from './routes/fcmTokens.js';
import enterpriseWebhookRouter from './routes/enterpriseWebhook.js';
import { adminEnterpriseEndpointsRouter } from './routes/adminEnterpriseEndpoints.js';
import clientApiGatewayRouter from './routes/clientApiGateway.js';
import { adminClientApiConfigsRouter } from './routes/adminClientApiConfigs.js';
import { casesRouter } from './routes/cases.js';
import { adminCasesRouter } from './routes/adminCases.js';
import { emailRouter } from './routes/email.js';
import { smsRouter } from './routes/sms.js';
import mobileIntentRouter from './routes/mobileIntent.js';
import staffAssistantRouter from './routes/staffAssistant.js';
import myAssistantRouter from './routes/myAssistant.js';
import { teamChatRouter } from './routes/teamChat.js';
import { staffChatRouter } from './routes/staffChat.js';
import { webmailRouter } from './routes/webmail.js';
import { planningRouter } from './routes/planning.js';
import { adminAuditLogRouter } from './routes/adminAuditLog.js';
import { startHealthMonitoring } from './services/healthMonitor.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiErrorTracker } from './middleware/apiErrorTracker.js';
import { auditLogger } from './middleware/auditLogger.js';

export function createApp() {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // CORS — support credentials (cookies) with dynamic origin
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Reflect the request origin so credentials (cookies) work.
    // For non-browser clients (no Origin header), fall back to '*'.
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Software-Token');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.use(cookieParser());
  app.use(express.json({ limit: '20mb' }));  // increased for base64 image attachments
  app.use(morgan('dev'));

  // Track API errors for health monitoring (must be before routes)
  app.use(apiErrorTracker);

  // Serve generated PDFs / static assets
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicPath = path.join(__dirname, '..', 'public');
  const uploadsPath = path.join(__dirname, '..', 'uploads');
  
  app.use('/public', express.static(publicPath));
  app.use('/uploads', express.static(uploadsPath));
  // Also serve /assets directly (frontend builds URLs like /assets/images/logo.png)
  app.use('/assets', express.static(path.join(publicPath, 'assets')));

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  // ── Core API router ──────────────────────────────────────────
  // All routes are registered on a sub-router and mounted at BOTH
  //   /     → for direct calls (api.softaware.net.za/admin/clients)
  //   /api  → for UI proxy calls  (/api/admin/clients → stripped to /admin/clients)
  // This eliminates the /api prefix mismatch once and for all.
  const apiRouter = express.Router();

  // Serve static assets (generated PDFs etc.) under /api/public too
  apiRouter.use('/public', express.static(publicPath));
  apiRouter.use('/uploads', express.static(uploadsPath));

  apiRouter.use('/auth', authRouter);
  apiRouter.use('/auth/2fa', twoFactorRouter);
  apiRouter.use('/agents', agentsRouter);
  apiRouter.use('/teams', teamsRouter);
  apiRouter.use('/vault', vaultRouter);
  apiRouter.use('/activation', activationRouter);
  apiRouter.use('/sync', syncRouter);
  apiRouter.use('/admin', auditLogger as any, adminRouter);
  apiRouter.use('/admin/audit-log', adminAuditLogRouter);
  apiRouter.use('/admin/config', auditLogger as any, adminConfigRouter);
  apiRouter.use('/admin/dashboard', auditLogger as any, adminDashboardRouter);
  apiRouter.use('/admin/ai-overview', auditLogger as any, adminAIOverviewRouter);
  apiRouter.use('/admin/packages', auditLogger as any, adminPackagesRouter);
  apiRouter.use('/admin/clients', auditLogger as any, adminClientManagerRouter);
  apiRouter.use('/admin/enterprise-endpoints', auditLogger as any, adminEnterpriseEndpointsRouter);
  apiRouter.use('/admin/client-api-configs', auditLogger as any, adminClientApiConfigsRouter);
  apiRouter.use('/admin/cases', auditLogger as any, adminCasesRouter);
  apiRouter.use('/subscriptions', subscriptionRouter);
  apiRouter.use('/cases', casesRouter);
  apiRouter.use('/mcp', mcpRouter);
  apiRouter.use('/files', filesRouter);
  apiRouter.use('/ai', aiRouter);
  apiRouter.use('/glm', glmRouter);
  apiRouter.use('/api-keys', apiKeysRouter);
  apiRouter.use('/packages', packagesRouter);
  apiRouter.use('/ai-config', aiConfigRouter);
  apiRouter.use('/code-implementation', codeImplementationRouter);
  apiRouter.use('/code/git', gitRouter);
  apiRouter.use('/code', codeWriterRouter);
  apiRouter.use('/public/leads', publicLeadAssistantRouter);
  apiRouter.use('/assistants', checkAssistantStatus, assistantsRouter);
  apiRouter.use('/assistants/:assistantId/ingest', checkAssistantStatus, assistantIngestRouter);
  apiRouter.use('/dashboard', dashboardRouter);
  apiRouter.use('/v1/webhook', enterpriseWebhookRouter); // Dynamic enterprise endpoints
  apiRouter.use('/v1/client-api', clientApiGatewayRouter); // Standardized client API proxy gateway
  apiRouter.use('/v1/mobile', mobileIntentRouter);       // Mobile AI assistant
  apiRouter.use('/v1/mobile/my-assistant', myAssistantRouter);    // Unified assistant CRUD (staff + clients)
  apiRouter.use('/v1/mobile/staff-assistant', staffAssistantRouter); // Legacy staff-only (deprecated)
  apiRouter.use('/v1', checkWidgetStatus, widgetChatRouter);
  apiRouter.use('/v1/ingest', checkWidgetStatus, widgetIngestRouter);
  apiRouter.use('/v1/sites', siteBuilderRouter);
  apiRouter.use('/v1', subscriptionTiersRouter); // Subscription tier management
  apiRouter.use('/v1/leads', contactFormRouter);
  apiRouter.use('/profile', profileRouter);

  // ── Softaware tasks (proxy to external software APIs) ────
  apiRouter.use('/softaware/tasks', softawareTasksRouter);
  apiRouter.use('/softaware/software', updSoftwareRouter);
  apiRouter.use('/softaware/modules', updModulesRouter);

  // ── Local tasks (synced from external sources) ────────────
  apiRouter.use('/local-tasks', localTasksRouter);

  // ── Bugs tracking ─────────────────────────────────────────
  apiRouter.use('/bugs', bugsRouter);

  // ── Updates system ────────────────────────────────────────────
  apiRouter.use('/updates/software', updSoftwareRouter);
  apiRouter.use('/updates/updates', updUpdatesRouter);
  apiRouter.use('/updates', updFilesRouter);           // /updates/upload & /updates/download
  apiRouter.use('/updates/heartbeat', updHeartbeatRouter);
  apiRouter.use('/updates/error-report', updErrorReportRouter);
  apiRouter.use('/updates/clients', updClientsRouter);
  apiRouter.use('/updates/modules', updModulesRouter);
  apiRouter.use('/updates', updMiscRouter);            // /updates/info, /dashboard, /api_status, etc.

  // ── Business API (contacts, invoicing, quotations, accounting) ──
  apiRouter.use('/contacts', contactsRouter);
  apiRouter.use('/quotations', quotationsRouter);
  apiRouter.use('/invoices', invoicesRouter);
  apiRouter.use('/transactions', transactionsRouter);  // VAT transactions - must be before accountingRouter
  apiRouter.use('/accounting', accountingRouter);
  apiRouter.use('/app-settings', appSettingsRouter);
  apiRouter.use('/notifications', notificationsRouter);
  apiRouter.use('/pricing', pricingRouter);
  apiRouter.use('/categories', categoriesRouter);
  apiRouter.use('/payments', paymentsRouter);
  apiRouter.use('/financial-reports', financialReportsRouter);
  apiRouter.use('/expense-categories', expenseCategoriesRouter);
  apiRouter.use('/reports', reportsRouter);
  apiRouter.use('/settings', auditLogger as any, settingsRouter);
  apiRouter.use('/vat-reports', vatReportsRouter);
  apiRouter.use('/users', auditLogger as any, systemUsersRouter);
  apiRouter.use('/roles', auditLogger as any, rolesRouter);
  apiRouter.use('/permissions', auditLogger as any, permissionsRouter);
  apiRouter.use('/credentials', auditLogger as any, credentialsRouter);
  apiRouter.use('/team-chats', teamChatRouter);
  apiRouter.use('/staff-chat', staffChatRouter);
  apiRouter.use('/database', auditLogger as any, databaseManagerRouter);
  apiRouter.use('/fcm-tokens', fcmTokensRouter);
  apiRouter.use('/email', auditLogger as any, emailRouter);
  apiRouter.use('/sms', auditLogger as any, smsRouter);
  apiRouter.use('/webmail', webmailRouter);
  apiRouter.use('/planning', planningRouter);

  // ── Aliases: frontend calls /accounts, /transactions, /ledger directly ──
  // Mount accountingRouter at root so /accounts, /transactions, /ledger work
  apiRouter.use('/', accountingRouter);

  // Mount at /api (UI proxy) and / (direct API calls) — order matters
  app.use('/api', apiRouter);
  app.use('/', apiRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', path: req.path });
  });

  app.use(errorHandler);

  // Start health monitoring for auto-case creation
  startHealthMonitoring();

  return app;
}
