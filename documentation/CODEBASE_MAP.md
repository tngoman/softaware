# SoftAware Platform — Codebase Map

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Platform Overview

SoftAware is a single-tenant SaaS platform providing business management, AI assistants, invoicing, accounting, and software update distribution. Built as a monorepo with a Node.js/Express backend and React frontend, backed by MySQL.

| Metric | Value |
|--------|-------|
| **Total source files** | 235 (127 backend, 108 frontend) |
| **Total lines of code** | ~60,800 (32,663 backend, 28,141 frontend) |
| **Backend route files** | 64 |
| **Backend services** | 25 |
| **Backend middleware** | 8 |
| **Frontend pages** | ~43 |
| **Frontend components** | 31 |
| **Database tables** | 36 |
| **API base URL** | `https://api.softaware.net.za` |
| **Frontend URL** | `https://softaware.net.za` |

---

## 2. Technology Stack

### Backend (`/var/opt/backend`)

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 18+ |
| Language | TypeScript | 5.6 |
| Framework | Express | 4.19 |
| Database | MySQL | 8.x |
| DB Driver | mysql2/promise | 3.11 |
| Auth | JWT (jsonwebtoken) | 9.x |
| Validation | Zod | 3.23 |
| AI/LLM | Ollama, GLM-4, OpenRouter, AWS Bedrock, OpenAI | — |
| Embeddings | SQLite-vec (vector store) | 0.1.7 |
| Push Notifications | Firebase Admin SDK | 13.7 |
| PDF Generation | Puppeteer | 24.x |
| Web Scraping | Cheerio | 1.2 |
| MCP Server | @modelcontextprotocol/sdk | 1.25 |
| SSH/SFTP | ssh2, ssh2-sftp-client | — |
| 2FA | OTPAuth | 9.5 |
| Process Manager | PM2 | 6.x |
| Dev Runner | tsx (watch mode) | 4.19 |

### Frontend (`/var/opt/frontend`)

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 4.9 |
| Framework | React | 18.2 |
| Build | Create React App (react-scripts) | 5.0 |
| Routing | React Router DOM | 6.20 |
| State | Zustand | 4.4 |
| HTTP Client | Axios | 1.6 |
| Styling | Tailwind CSS | 3.3 |
| Icons | Lucide React, Heroicons | — |
| Tables | TanStack React Table | 8.21 |
| Forms | React Hook Form | 7.48 |
| Alerts | SweetAlert2, React Hot Toast | — |
| PDF Export | html2pdf.js | 0.12 |
| Push | Firebase (client SDK) | 12.10 |
| Date Handling | date-fns | 2.30 |

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                         │
│  Browser (React SPA)  │  Mobile (FCM Push)  │  API Keys (External)     │
└───────────┬───────────┴──────────┬──────────┴────────────┬─────────────┘
            │                      │                       │
            ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     REVERSE PROXY (Apache)                              │
│  softaware.net.za → /var/opt/frontend/build                            │
│  api.softaware.net.za → localhost:8787                                  │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS SERVER (:8787)                               │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  Helmet   │  │  CORS    │  │  Morgan  │  │ JSON 10MB│               │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    MIDDLEWARE CHAIN                              │   │
│  │  requireAuth → requireAdmin → deductCredits                    │   │
│  │  requireApiKey → statusCheck → usageTracking                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    API ROUTER (64 route files)                   │   │
│  │  Mounted at both / and /api for dual-access                     │   │
│  │                                                                  │   │
│  │  /auth       /dashboard    /contacts     /invoices               │   │
│  │  /users      /roles        /permissions  /quotations             │   │
│  │  /accounting /payments     /ai           /assistants             │   │
│  │  /v1/sites   /updates/*    /mcp          /admin/*                │   │
│  │  /credits    /subscriptions /settings    /notifications          │   │
│  │  ... (64 route files total)                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SERVICES (25 files)                           │   │
│  │  firebaseService │ crawlerService │ embeddingService            │   │
│  │  siteBuilderService │ pdfGenerator │ payment                    │   │
│  │  ingestionWorker │ vectorStore │ glmService │ ai/*              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐                            │
│  │  Error Handler    │  │  HTTP Errors     │                            │
│  │  (errorHandler.ts)│  │  (httpErrors.ts) │                            │
│  └──────────────────┘  └──────────────────┘                            │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│   MySQL 8.x      │  │   SQLite-vec     │  │   External Services      │
│   36 tables      │  │   Vector Store   │  │                          │
│   (mysql2/pool)  │  │   (embeddings)   │  │  Ollama (localhost:11434)│
│                  │  │                  │  │  GLM-4 API (z.ai)       │
│  sys_* (system)  │  └──────────────────┘  │  OpenRouter API          │
│  tb_* (business) │                        │  AWS Bedrock             │
└──────────────────┘                        │  Firebase (push/auth)    │
                                            │  SMTP (email)            │
┌──────────────────┐                        │  Puppeteer (PDF)         │
│ Ingestion Worker │                        └──────────────────────────┘
│ (child_process)  │
│ - Web scraping   │
│ - Embeddings     │
│ - Cheerio DOM    │
│ - Isolated heap  │
└──────────────────┘
```

---

## 4. Directory Structure

### Backend (`/var/opt/backend/src/`)

```
src/
├── index.ts                 # Entry point — starts Express, spawns ingestion worker
├── app.ts                   # Express app factory — middleware + all 64 route mounts
├── config/
│   ├── env.ts               # Zod-validated environment schema (100+ vars)
│   ├── credits.ts           # Credit cost configuration per request type
│   └── personaTemplates.ts  # AI persona/prompt templates
├── db/
│   ├── mysql.ts             # Connection pool, db helper (query/insert/execute/transaction), types
│   ├── prisma.ts            # Prisma client (legacy/alternative)
│   ├── businessTypes.ts     # Business entity TypeScript types
│   ├── updatesTypes.ts      # Updates system TypeScript types
│   └── migrations/          # SQL migration scripts
├── lib/
│   └── prisma.ts            # Prisma singleton
├── middleware/
│   ├── auth.ts              # JWT verification, requireAuth, signAccessToken
│   ├── apiKey.ts            # X-API-Key header validation
│   ├── credits.ts           # Credit deduction after successful response
│   ├── errorHandler.ts      # Global Express error handler
│   ├── requireAdmin.ts      # Admin role enforcement
│   ├── statusCheck.ts       # Account/assistant/widget suspension check
│   ├── team.ts              # ⚠️ DEAD CODE: Team membership resolution (unused since v1.1.0)
│   └── usageTracking.ts     # Message/usage limit enforcement per tier
├── routes/                  # 64 route files (see Module Map below)
├── services/
│   ├── ai/                  # AI provider abstraction layer
│   │   ├── AIProvider.ts         # Abstract base class
│   │   ├── AIProviderManager.ts  # Provider registry & routing
│   │   ├── GLMProvider.ts        # GLM-4 implementation
│   │   └── OllamaProvider.ts     # Ollama implementation
│   ├── firebaseService.ts       # FCM push notifications
│   ├── crawlerService.ts        # Web page scraping (Cheerio + Puppeteer)
│   ├── embeddingService.ts      # Text → vector embeddings
│   ├── vectorStore.ts           # SQLite-vec similarity search
│   ├── ingestionWorker.ts       # Queue → child process bridge
│   ├── ingestionWorkerProcess.ts # Isolated child process for heavy ingestion
│   ├── ingestionAIRouter.ts     # AI-powered content cleaning
│   ├── knowledgeCategorizer.ts  # Auto-categorize ingested content
│   ├── leadCaptureService.ts    # Lead capture from widget chats
│   ├── widgetService.ts         # Widget chat session management
│   ├── siteBuilderService.ts    # AI website generation
│   ├── ftpDeploymentService.ts  # FTP/SFTP site deployment
│   ├── glmService.ts            # GLM API wrapper
│   ├── openRouterVision.ts      # Vision model via OpenRouter
│   ├── documentService.ts       # Document parsing (PDF, DOCX)
│   ├── payment.ts               # Payment processing (PayFast, Yoco)
│   ├── subscription.ts          # Subscription lifecycle management
│   ├── credits.ts               # Credit balance operations
│   ├── codeAgent.ts             # AI code agent service
│   ├── actionRouter.ts          # Software task action dispatch
│   ├── sshService.ts            # SSH/SFTP remote operations
│   ├── enterpriseEndpoints.ts   # Dynamic enterprise webhook handler
│   └── payloadNormalizer.ts     # Normalize incoming payloads
├── utils/
│   ├── httpErrors.ts        # HttpError class (400/401/403/404)
│   ├── pdfGenerator.ts      # Puppeteer-based PDF generation
│   └── cryptoUtils.ts       # Encryption/decryption for vault
├── mcp/
│   ├── server.ts            # MCP server (stdio + SSE transport)
│   ├── index.ts             # MCP tool registration
│   ├── sse-transport.ts     # SSE transport adapter
│   ├── code-agent.ts        # MCP code agent tools
│   └── emailService.ts      # MCP email tool
└── scripts/
    └── seed.ts              # Database seeding
```

### Frontend (`/var/opt/frontend/src/`)

```
src/
├── index.tsx               # React entry point
├── index.css               # Global styles (Tailwind imports)
├── App.tsx                 # Root component — routing, auth guards, layout
├── config/
│   ├── app.ts              # App configuration constants
│   └── firebase.ts         # Firebase client initialization
├── services/
│   ├── api.ts              # Axios instance, interceptors, API helper functions
│   └── pushNotifications.ts # Firebase push notification client
├── store/
│   └── index.ts            # Zustand global state store
├── hooks/
│   ├── useAuth.ts           # Authentication state & actions
│   ├── usePermissions.ts    # RBAC permission checks
│   ├── useModules.ts        # Feature module toggles
│   ├── useAppSettings.ts    # App branding/settings
│   ├── useSoftware.ts       # Software management state
│   ├── useTasks.ts          # Task management state
│   └── useUpdateChecker.ts  # Auto-update polling
├── models/
│   ├── AuthModel.ts         # Auth types (User, LoginPayload, etc.)
│   ├── ContactModel.ts      # Contact entity types
│   ├── InvoiceModel.ts      # Invoice/line item types
│   ├── QuotationModel.ts    # Quotation types
│   ├── TransactionModel.ts  # Accounting transaction types
│   ├── NotificationModel.ts # Notification types
│   ├── CredentialModel.ts   # Credential vault types
│   ├── AppSettingsModel.ts  # Branding/settings types
│   ├── SystemModels.ts      # User/role/permission types
│   ├── OtherModels.ts       # Misc shared types
│   └── index.ts             # Barrel export
├── types/
│   └── index.ts             # Global type definitions
├── utils/
│   └── formatters.ts        # Number/date/currency formatters
├── components/
│   ├── Layout/
│   │   ├── Layout.tsx        # Main app layout (sidebar, header, content)
│   │   └── PortalLayout.tsx  # AI portal layout variant
│   ├── UI/                   # 13 reusable UI components
│   │   ├── Button.tsx, Card.tsx, Input.tsx, Select.tsx, Textarea.tsx
│   │   ├── DataTable.tsx, BackButton.tsx, CustomDatePicker.tsx
│   │   ├── EmailModal.tsx, PaymentModal.tsx, PricingModal.tsx
│   │   └── ItemPickerModal.tsx
│   ├── Notifications/
│   │   └── NotificationDropdown.tsx
│   ├── Invoices/
│   │   ├── InvoiceDetails.tsx
│   │   └── PaymentStatusBadge.tsx
│   ├── Quotations/
│   │   └── QuotationStatusBadge.tsx
│   ├── ExpenseCategories/
│   │   └── ExpenseCategoryManager.tsx
│   ├── Updates/
│   │   └── UpdateBanner.tsx
│   ├── User/
│   │   └── UserAccountMenu.tsx
│   ├── ProtectedRoute.tsx    # Auth guard HOC
│   ├── AdminRoute.tsx        # Admin-only route guard
│   ├── PermissionRoute.tsx   # Permission-based route guard
│   ├── PermissionSync.tsx    # Sync permissions on login
│   ├── Can.tsx               # Conditional render by permission
│   └── KnowledgeHealthScore.tsx
├── pages/
│   ├── Login.tsx, ForgotPassword.tsx
│   ├── Dashboard.tsx
│   ├── Contacts.tsx, ContactDetails.tsx
│   ├── Invoices.tsx, CreateInvoice.tsx
│   ├── Quotations.tsx, CreateQuotation.tsx
│   ├── Transactions.tsx, AddExpense.tsx, AddIncome.tsx
│   ├── FinancialDashboard.tsx, ProfitAndLoss.tsx, BalanceSheet.tsx
│   ├── Statement.tsx, TransactionListing.tsx, VatReports.tsx
│   ├── Categories.tsx
│   ├── Pricing.tsx
│   ├── Settings.tsx, AccountSettings.tsx, Profile.tsx
│   ├── Notifications.tsx
│   ├── Credentials.tsx, CreateCredential.tsx
│   ├── SoftwareManagement.tsx, GroupsPage.tsx, TasksPage.tsx
│   ├── Updates.tsx, UpdatesAdmin.tsx
│   ├── DatabaseManager.tsx
│   ├── admin/
│   │   └── Dashboard.tsx
│   ├── portal/
│   │   ├── Dashboard.tsx, ChatInterface.tsx
│   │   ├── AssistantsPage.tsx, CreateAssistant.tsx
│   │   ├── SitesPage.tsx, Settings.tsx
│   │   └── index.ts
│   ├── public/
│   │   ├── LandingPage.tsx, LoginPage.tsx, RegisterPage.tsx
│   │   ├── AuthPage.tsx, ActivatePage.tsx
│   │   └── index.ts
│   └── system/
│       ├── Users.tsx, Roles.tsx, Permissions.tsx
│       └── SystemSettings.tsx
```

---

## 5. Module Map

### Core Modules (🔴 HIGH)

| Module | Backend Routes | Frontend Pages | DB Tables | Documentation |
|--------|---------------|----------------|-----------|---------------|
| **Authentication** | auth.ts, twoFactor.ts | Login.tsx, ForgotPassword.tsx | sys_users, sys_password_resets | [README](Authentication/README.md) |
| **Dashboard** | dashboard.ts, adminDashboard.ts | Dashboard.tsx, admin/Dashboard.tsx | — (aggregates) | [README](Dashboard/README.md) |
| **Users** | systemUsers.ts, profile.ts | system/Users.tsx, Profile.tsx, AccountSettings.tsx | sys_users, sys_user_roles | [README](Users/README.md) |
| **Roles** | systemRoles.ts, systemPermissions.ts | system/Roles.tsx, system/Permissions.tsx | sys_roles, sys_permissions, sys_role_permissions | [README](Roles/README.md) |
| **Notifications** | notifications.ts, fcmTokens.ts | Notifications.tsx, NotificationDropdown.tsx | sys_notifications, sys_notification_preferences, sys_notification_queue, sys_notification_templates | [README](Notifications/README.md) |

### Business Modules (🟡 MED)

| Module | Backend Routes | Frontend Pages | DB Tables | Documentation |
|--------|---------------|----------------|-----------|---------------|
| **Contacts** | contacts.ts, contactFormRouter.ts | Contacts.tsx, ContactDetails.tsx | tb_contacts | [README](Contacts/README.md) |
| **Invoices** | invoices.ts | Invoices.tsx, CreateInvoice.tsx | tb_invoices, tb_invoice_items | [README](Invoices/README.md) |
| **Quotations** | quotations.ts | Quotations.tsx, CreateQuotation.tsx | tb_quotations, tb_quote_items | [README](Quotations/README.md) |
| **Payments** | payments.ts | PaymentModal.tsx | tb_payments | [README](Payments/README.md) |
| **Accounting** | accounting.ts, expenseCategories.ts, categories.ts | Transactions.tsx, AddExpense.tsx, AddIncome.tsx, Categories.tsx | tb_transactions, tb_ledger, tb_accounts, tb_categories, tb_expense_categories | [README](Accounting/README.md) |
| **FinancialReports** | financialReports.ts, vatReports.ts, reports.ts | FinancialDashboard.tsx, ProfitAndLoss.tsx, BalanceSheet.tsx, VatReports.tsx, TransactionListing.tsx, Statement.tsx | — (reads from tb_transactions, tb_ledger) | [README](FinancialReports/README.md) |
| **Subscription** | subscription.ts, subscriptionTiers.ts, pricing.ts, credits.ts, adminCredits.ts | Pricing.tsx | tb_pricing, subscription_plans, subscriptions, credit_balances, credit_transactions, credit_packages | [README](Subscription/README.md) |
| **Cases** | cases.ts, adminCases.ts | CasesList.tsx, CaseDetailView.tsx, CasesDashboard.tsx | cases, case_comments, case_activity | [README](Cases/README.md) |

### Platform Modules (🟡 MED)

| Module | Backend Routes | Frontend Pages | DB Tables | Documentation |
|--------|---------------|----------------|-----------|---------------|
| **AI** | ai.ts, aiConfig.ts, codeWriter.ts, codeImplementation.ts, glm.ts | portal/ChatInterface.tsx | ai_model_config | [README](AI/README.md) |
| **Assistants** | assistants.ts, assistantIngest.ts, widgetChat.ts, widgetIngest.ts, publicLeadAssistant.ts | portal/AssistantsPage.tsx, portal/CreateAssistant.tsx | assistants, widget_clients, knowledge_pages | [README](Assistants/README.md) |
| **SiteBuilder** | siteBuilder.ts | portal/SitesPage.tsx | — | [README](SiteBuilder/README.md) |
| **Software** | softawareTasks.ts, groups.ts | SoftwareManagement.tsx, GroupsPage.tsx, TasksPage.tsx | tb_groups | [README](Software/README.md) |
| **Updates** | updSoftware.ts, updUpdates.ts, updClients.ts, updFiles.ts, updModules.ts, updHeartbeat.ts, updMisc.ts | Updates.tsx, UpdatesAdmin.tsx | sys_installed_updates, tb_installed_updates | [README](Updates/README.md) |
| **Database** | databaseManager.ts | DatabaseManager.tsx | — (meta-queries) | [README](Database/README.md) |

### System Modules (🟢 LOW)

| Module | Backend Routes | Frontend Pages | DB Tables | Documentation |
|--------|---------------|----------------|-----------|---------------|
| **Settings** | settings.ts, appSettings.ts, adminConfig.ts | Settings.tsx, system/SystemSettings.tsx | sys_settings, tb_settings, tb_settings_backup, tb_tax_rates | [README](Settings/README.md) |
| **Credentials** | vault.ts, systemCredentials.ts | Credentials.tsx, CreateCredential.tsx | sys_credentials, vault_credentials | [README](Credentials/README.md) |
| **Teams** | teams.ts | — | teams, team_members, team_invites | [README](Teams/README.md) |
| **Files** | files.ts | — | — | [README](Files/README.md) |
| **ApiKeys** | apiKeys.ts | — | api_keys | [README](ApiKeys/README.md) |
| **Sync** | sync.ts | — | — | [README](Sync/README.md) |
| **MCP** | mcp.ts (+ src/mcp/*) | — | — | [README](MCP/README.md) |
| **Admin** | admin.ts, adminClientManager.ts, activation.ts | — | activation_keys, device_activations | [README](Admin/README.md) |

### Crosscutting

| Module | Source Files | Documentation |
|--------|-------------|---------------|
| **Frontend** | Layout.tsx, UI/*, store/*, hooks/*, api.ts | [README](Crosscutting/Frontend/README.md) |
| **Infrastructure** | mysql.ts, middleware/*, env.ts, errorHandler.ts | [README](Crosscutting/Infrastructure/README.md) |
| **Services** | firebaseService.ts, pdfGenerator.ts, crawlerService.ts, payment.ts | [README](Crosscutting/Services/README.md) |

---

## 6. Database Schema Overview

**36 tables** organized in two naming conventions:

| Prefix | Purpose | Tables |
|--------|---------|--------|
| `sys_` | System/platform tables | sys_users, sys_roles, sys_permissions, sys_role_permissions, sys_user_roles, sys_credentials, sys_settings, sys_notifications, sys_notification_preferences, sys_notification_queue, sys_notification_templates, sys_audit_logs, sys_password_resets, sys_migrations, sys_installed_updates |
| `tb_` | Business/tenant tables | tb_contacts, tb_invoices, tb_invoice_items, tb_quotations, tb_quote_items, tb_transactions, tb_ledger, tb_accounts, tb_payments, tb_categories, tb_expense_categories, tb_groups, tb_pricing, tb_settings, tb_settings_backup, tb_tax_rates, tb_migrations, tb_installed_updates |
| (none) | Shared/cross-cutting | teams, team_members, team_invites, api_keys, activation_keys, device_activations, vault_credentials, credit_balances, credit_transactions, credit_packages, ai_model_config, subscription_plans, subscriptions, cases, case_comments, case_activity |

---

## 7. Authentication & Authorization Flow

```
┌──────────────┐     POST /auth/login      ┌──────────────┐
│   Client     │ ─────────────────────────▶ │  auth.ts     │
│   (React)    │                            │              │
│              │ ◀───── JWT + user data ─── │  bcrypt +    │
│              │                            │  jsonwebtoken│
└──────┬───────┘                            └──────────────┘
       │
       │  Authorization: Bearer <jwt>
       ▼
┌──────────────┐     requireAuth()          ┌──────────────┐
│  API Request │ ─────────────────────────▶ │ middleware/   │
│              │                            │ auth.ts      │
│              │     req.userId set         │              │
│              │ ◀───────────────────────── │ jwt.verify() │
└──────┬───────┘                            └──────────────┘
       │
       ▼
┌──────────────┐     RBAC check             ┌──────────────┐
│  Route       │ ─────────────────────────▶ │ user_roles + │
│  Handler     │                            │ roles        │
└──────────────┘                            └──────────────┘
```

**Middleware chain options:**
- `requireAuth` → JWT token verification, sets `req.userId`
- `requireAdmin` → Checks for admin/super_admin role via `user_roles` + `roles` tables
- `requireApiKey` → X-API-Key header validation (for external integrations)
- `checkAccountStatus` → Blocks suspended/demo-expired accounts
- `checkAssistantStatus` → Blocks suspended assistants
- `checkWidgetStatus` → Blocks suspended widget clients
- `deductCreditsMiddleware` → Post-response credit deduction
- `trackUsage` → Message limit enforcement per subscription tier

---

## 8. Key Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Express server port | 8787 |
| `DATABASE_URL` | MySQL connection string | — (required) |
| `JWT_SECRET` | Token signing key | — (required, min 16 chars) |
| `JWT_EXPIRES_IN` | Token TTL | 1h |
| `OLLAMA_BASE_URL` | Local LLM endpoint | http://127.0.0.1:11434 |
| `OLLAMA_MODEL` | Default code model | qwen2.5-coder:7b |
| `ASSISTANT_OLLAMA_MODEL` | Chat assistant model | deepseek-coder-v2:16b |
| `GLM` | GLM-4 API key | — |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `FIREBASE_PROJECT_ID` | FCM push project | — |
| `SMTP_HOST` | Email server | — |
| `MCP_ENABLED` | MCP server toggle | true |
| `DEFAULT_AI_PROVIDER` | glm or ollama | ollama |

---

## 9. Deployment

| Component | Method | Location |
|-----------|--------|----------|
| Backend | PM2 (ecosystem.config.cjs) | /var/opt/backend |
| Frontend | Static build served by Apache | /var/opt/frontend/build |
| Database | MySQL 8.x | localhost:3306 |
| LLM | Ollama (systemd service) | localhost:11434 |
| Ingestion Worker | fork() child process | Auto-spawned by backend |
| MCP Server | Standalone (tsx src/mcp/server.ts) | /var/opt/backend |

---

## 10. Documentation Index

| # | Module | Priority | Status |
|---|--------|----------|--------|
| — | [CODEBASE_MAP.md](CODEBASE_MAP.md) | 🔴 | ✅ Complete |
| 1 | [Crosscutting/Infrastructure](Crosscutting/Infrastructure/README.md) | 🔴 | 🔄 In Progress |
| 2 | [Authentication](Authentication/README.md) | 🔴 | ⬜ Not Started |
| 3 | [Users](Users/README.md) | 🔴 | ⬜ Not Started |
| 4 | [Roles](Roles/README.md) | 🔴 | ⬜ Not Started |
| 5 | [Dashboard](Dashboard/README.md) | 🔴 | ⬜ Not Started |
| 6 | [Notifications](Notifications/README.md) | 🔴 | ⬜ Not Started |
| 7 | [Contacts](Contacts/README.md) | 🟡 | ⬜ Not Started |
| 8 | [Invoices](Invoices/README.md) | 🟡 | ⬜ Not Started |
| 9 | [Quotations](Quotations/README.md) | 🟡 | ⬜ Not Started |
| 10 | [Payments](Payments/README.md) | 🟡 | ⬜ Not Started |
| 11 | [Accounting](Accounting/README.md) | 🟡 | ⬜ Not Started |
| 12 | [FinancialReports](FinancialReports/README.md) | 🟡 | ⬜ Not Started |
| 13 | [Subscription](Subscription/README.md) | 🟡 | ⬜ Not Started |
| 14 | [AI](AI/README.md) | 🟡 | ⬜ Not Started |
| 15 | [Assistants](Assistants/README.md) | 🟡 | ⬜ Not Started |
| 16 | [SiteBuilder](SiteBuilder/README.md) | 🟡 | ⬜ Not Started |
| 17 | [Software](Software/README.md) | 🟡 | ⬜ Not Started |
| 18 | [Updates](Updates/README.md) | 🟡 | ⬜ Not Started |
| 19 | [Database](Database/README.md) | 🟡 | ⬜ Not Started |
| 20 | [Cases](Cases/README.md) | 🟡 | ✅ Complete |
| 21 | [Settings](Settings/README.md) | 🟢 | ⬜ Not Started |
| 22 | [Credentials](Credentials/README.md) | 🟢 | ⬜ Not Started |
| 23 | [Teams](Teams/README.md) | 🟢 | ⬜ Not Started |
| 24 | [Files](Files/README.md) | 🟢 | ⬜ Not Started |
| 25 | [ApiKeys](ApiKeys/README.md) | 🟢 | ⬜ Not Started |
| 26 | [Sync](Sync/README.md) | 🟢 | ⬜ Not Started |
| 27 | [MCP](MCP/README.md) | 🟢 | ⬜ Not Started |
| 28 | [Admin](Admin/README.md) | 🟢 | ⬜ Not Started |
| 29 | [Crosscutting/Frontend](Crosscutting/Frontend/README.md) | 🟢 | ⬜ Not Started |
| 30 | [Crosscutting/Services](Crosscutting/Services/README.md) | 🟢 | ⬜ Not Started |

---

*This is the top-level architectural reference for the SoftAware platform. Each module folder contains its own 6-file documentation set (README, FILES, FIELDS, ROUTES, PATTERNS, CHANGES).*
