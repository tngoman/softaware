import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
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
import { creditsRouter } from './routes/credits.js';
import { aiConfigRouter } from './routes/aiConfig.js';
import { adminCreditsRouter } from './routes/adminCredits.js';
import { adminConfigRouter } from './routes/adminConfig.js';
import { adminDashboardRouter } from './routes/adminDashboard.js';
import { codeImplementationRouter } from './routes/codeImplementation.js';
import { codeWriterRouter } from './routes/codeWriter.js';
import { gitRouter } from './routes/git.js';
import { chatRouter } from './routes/chat.js';
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
import { contactsRouter } from './routes/contacts.js';
import { quotationsRouter } from './routes/quotations.js';
import { invoicesRouter } from './routes/invoices.js';
import { accountingRouter } from './routes/accounting.js';
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
import groupsRouter from './routes/groups.js';
import databaseManagerRouter from './routes/databaseManager.js';
import { twoFactorRouter } from './routes/twoFactor.js';
import { fcmTokensRouter } from './routes/fcmTokens.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // Simple CORS - allow all origins for API
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Software-Token');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));

  // Serve generated PDFs / static assets
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicPath = path.join(__dirname, '..', 'public');
  app.use('/public', express.static(publicPath));
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

  apiRouter.use('/auth', authRouter);
  apiRouter.use('/auth/2fa', twoFactorRouter);
  apiRouter.use('/agents', agentsRouter);
  apiRouter.use('/teams', teamsRouter);
  apiRouter.use('/vault', vaultRouter);
  apiRouter.use('/activation', activationRouter);
  apiRouter.use('/sync', syncRouter);
  apiRouter.use('/admin', adminRouter);
  apiRouter.use('/admin/credits', adminCreditsRouter);
  apiRouter.use('/admin/config', adminConfigRouter);
  apiRouter.use('/admin/dashboard', adminDashboardRouter);
  apiRouter.use('/admin/clients', adminClientManagerRouter);
  apiRouter.use('/subscriptions', subscriptionRouter);
  apiRouter.use('/mcp', mcpRouter);
  apiRouter.use('/files', filesRouter);
  apiRouter.use('/ai', aiRouter);
  apiRouter.use('/glm', glmRouter);
  apiRouter.use('/api-keys', apiKeysRouter);
  apiRouter.use('/credits', creditsRouter);
  apiRouter.use('/ai-config', aiConfigRouter);
  apiRouter.use('/code-implementation', codeImplementationRouter);
  apiRouter.use('/code/git', gitRouter);
  apiRouter.use('/code', codeWriterRouter);
  apiRouter.use('/public/leads', publicLeadAssistantRouter);
  apiRouter.use('/assistants', checkAssistantStatus, assistantsRouter);
  apiRouter.use('/assistants/:assistantId/ingest', checkAssistantStatus, assistantIngestRouter);
  apiRouter.use('/dashboard', dashboardRouter);
  apiRouter.use('/silulumanzi', chatRouter);
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

  // ── Updates system ────────────────────────────────────────────
  apiRouter.use('/updates/software', updSoftwareRouter);
  apiRouter.use('/updates/updates', updUpdatesRouter);
  apiRouter.use('/updates', updFilesRouter);           // /updates/upload & /updates/download
  apiRouter.use('/updates/heartbeat', updHeartbeatRouter);
  apiRouter.use('/updates/clients', updClientsRouter);
  apiRouter.use('/updates/modules', updModulesRouter);
  apiRouter.use('/updates', updMiscRouter);            // /updates/info, /dashboard, /api_status, etc.

  // ── Business API (contacts, invoicing, quotations, accounting) ──
  apiRouter.use('/contacts', contactsRouter);
  apiRouter.use('/quotations', quotationsRouter);
  apiRouter.use('/invoices', invoicesRouter);
  apiRouter.use('/accounting', accountingRouter);
  apiRouter.use('/app-settings', appSettingsRouter);
  apiRouter.use('/notifications', notificationsRouter);
  apiRouter.use('/pricing', pricingRouter);
  apiRouter.use('/categories', categoriesRouter);
  apiRouter.use('/payments', paymentsRouter);
  apiRouter.use('/financial-reports', financialReportsRouter);
  apiRouter.use('/expense-categories', expenseCategoriesRouter);
  apiRouter.use('/reports', reportsRouter);
  apiRouter.use('/settings', settingsRouter);
  apiRouter.use('/vat-reports', vatReportsRouter);
  apiRouter.use('/users', systemUsersRouter);
  apiRouter.use('/roles', rolesRouter);
  apiRouter.use('/permissions', permissionsRouter);
  apiRouter.use('/credentials', credentialsRouter);
  apiRouter.use('/groups', groupsRouter);
  apiRouter.use('/database', databaseManagerRouter);
  apiRouter.use('/fcm-tokens', fcmTokensRouter);

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

  return app;
}
