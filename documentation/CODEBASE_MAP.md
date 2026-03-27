# SoftAware Platform — Codebase Map

**Version:** 2.2.0  
**Last Updated:** 2026-03-14

---

## 1. Platform Overview

SoftAware is a single-tenant SaaS platform providing business management, AI assistants, invoicing, accounting, staff chat, enterprise webhooks, and software update distribution. Built as a monorepo with a Node.js/Express backend and React frontend, backed by MySQL with SQLite-vec for vector search.

| Metric | Value |
|--------|-------|
| **Total source files** | 392 (194 backend, 198 frontend) |
| **Total lines of code** | ~136,600 (65,500 backend, 71,100 frontend) |
| **Backend route files** | 82 |
| **Backend services** | 40 (+ 4 AI providers) |
| **Backend middleware** | 11 |
| **Frontend pages** | ~89 |
| **Frontend components** | 46 |
| **Database tables** | ~66 |
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
| External DB | MSSQL (mssql) | 12.2 |
| Auth | JWT (jsonwebtoken) | 9.x |
| Validation | Zod | 3.23 |
| AI/LLM | Ollama, GLM-4, OpenRouter, AWS Bedrock, OpenAI | — |
| Embeddings | SQLite-vec (vector store) | 0.1.7 |
| Real-time | Socket.IO | 4.8 |
| Push Notifications | Firebase Admin SDK | 13.7 |
| PDF Generation | Puppeteer | 24.x |
| Web Scraping | Cheerio | 1.2 |
| Email (IMAP) | ImapFlow + Mailparser | 1.2 / 3.9 |
| Email (SMTP) | Nodemailer | 7.x |
| SMS | SMSPortal (via Axios) | — |
| MCP Server | @modelcontextprotocol/sdk | 1.25 |
| SSH/SFTP | ssh2, ssh2-sftp-client | — |
| 2FA | OTPAuth + QRCode | 9.5 / 1.5 |
| Document Parse | pdf-parse, Mammoth (DOCX), xlsx | — |
| Process Manager | PM2 | 6.x |
| Dev Runner | tsx (watch mode) | 4.19 |
| Testing | Vitest | 4.x |

### Frontend (`/var/opt/frontend`)

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 4.9 |
| Framework | React | 18.2 |
| Build | Create React App (react-app-rewired) | 5.0 |
| Routing | React Router DOM | 6.20 |
| State | Zustand | 4.4 |
| HTTP Client | Axios | 1.6 |
| Real-time | Socket.IO Client | 4.8 |
| Styling | Tailwind CSS | 3.3 |
| Icons | Lucide React, Heroicons | — |
| Tables | TanStack React Table | 8.21 |
| Forms | React Hook Form | 7.48 |
| Charts | Recharts | 3.7 |
| Rich Text | React Quill | 2.0 |
| Markdown | React Markdown + remark-gfm | 9.1 |
| Drawing | Excalidraw | 0.18 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | 6.3 / 10.0 |
| Alerts | SweetAlert2, React Hot Toast | — |
| PDF Export | html2pdf.js | 0.12 |
| Push | Firebase (client SDK) | 12.10 |
| Date Handling | date-fns, react-datepicker | 2.30 / 8.8 |
| Sanitization | DOMPurify | 3.3 |

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                         │
│  Browser (React SPA)  │  Mobile (FCM Push)  │  API Keys (External)     │
│  Widget Embeds        │  Enterprise Webhooks │  MCP (stdio/SSE)         │
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
│  │  Helmet   │  │  CORS    │  │  Morgan  │  │ JSON 20MB│               │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    MIDDLEWARE CHAIN                              │   │
│  │  apiErrorTracker → requireAuth → requireAdmin                  │   │
│  │  requireApiKey → requireDeveloper → statusCheck                │   │
│  │  usageTracking → auditLogger → packages                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                 SOCKET.IO SERVER (same port)                     │   │
│  │  Staff Chat │ Team Chat │ WebRTC Signaling │ Presence           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    API ROUTER (82 route files)                   │   │
│  │  Mounted at both / and /api for dual-access                     │   │
│  │                                                                  │   │
│  │  /auth         /dashboard      /contacts       /invoices         │   │
│  │  /users        /roles          /permissions    /quotations       │   │
│  │  /accounting   /payments       /ai             /assistants       │   │
│  │  /v1/sites     /updates/*      /mcp            /admin/*          │   │
│  │  /subscriptions /settings      /notifications                    │   │
│  │  /v1/webhook   /v1/client-api  /v1/mobile      /staff-chat       │   │
│  │  /team-chats   /webmail        /planning       /bugs             │   │
│  │  /packages     /email          /sms            /agents           │   │
│  │  /code/git                                                       │   │
│  │  ... (82 route files total)                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SERVICES (44 files)                           │   │
│  │  firebaseService │ crawlerService │ embeddingService            │   │
│  │  siteBuilderService │ pdfGenerator │ packages                   │   │
│  │  ingestionWorker │ vectorStore │ glmService │ ai/*              │   │
│  │  chatSocket │ teamChatSocket │ healthMonitor │ webmailService   │   │
│  │  mobileAIProcessor │ mobileActionExecutor │ mobileTools        │   │
│  │  emailService │ smsService │ enterpriseEndpoints                │   │
│  │  clientApiGateway │ caseAnalyzer │ linkPreview                  │   │
│  │  mediaProcessor │ siteBuilderTemplate │ credentialVault         │   │
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
│   ~66 tables     │  │   Vector Store   │  │                          │
│   (mysql2/pool)  │  │   (embeddings)   │  │  Ollama (localhost:11434)│
│                  │  │                  │  │  GLM-4 API (z.ai)       │
│  sys_* (system)  │  │  SQLite (enter-  │  │  OpenRouter API          │
│  tb_* (business) │  │  prise_endpoints)│  │  OpenAI API              │
│  (unprefixed)    │  └──────────────────┘  │  AWS Bedrock             │
└──────────────────┘                        │  Firebase (push/auth)    │
                                            │  SMTP (email)            │
┌──────────────────┐                        │  IMAP (webmail)          │
│ Ingestion Worker │                        │  SMSPortal (SMS)         │
│ (child_process)  │                        │  Puppeteer (PDF)         │
│ - Web scraping   │                        │  MSSQL (remote DB mgmt)  │
│ - Embeddings     │                        └──────────────────────────┘
│ - Cheerio DOM    │
│ - Isolated heap  │
└──────────────────┘
```

---

## 4. Directory Structure

### Backend (`/var/opt/backend/src/`)

```
src/
├── index.ts                 # Entry point — starts Express + Socket.IO, spawns ingestion worker
├── app.ts                   # Express app factory — middleware + all 83 route mounts
├── config/
│   ├── env.ts               # Zod-validated environment schema (100+ vars)
│   ├── tiers.ts             # Canonical tier definitions (Free/Starter/Pro/Advanced/Enterprise) — single source of truth for pricing & limits
│   └── personaTemplates.ts  # AI persona/prompt templates
├── db/
│   ├── mysql.ts             # Connection pool, db helper (query/insert/execute/transaction), types
│   ├── prisma.ts            # Prisma client (legacy/alternative)
│   ├── auditLog.ts          # Audit log DB helpers
│   ├── businessTypes.ts     # Business entity TypeScript types
│   ├── updatesTypes.ts      # Updates system TypeScript types
│   └── migrations/          # SQL migration scripts
├── lib/
│   └── prisma.ts            # Prisma singleton
├── middleware/
│   ├── auth.ts              # JWT verification, requireAuth, signAccessToken
│   ├── apiKey.ts            # X-API-Key header validation
│   ├── apiErrorTracker.ts   # Track API error rates for health monitoring
│   ├── auditLogger.ts       # Admin action audit trail
│   ├── errorHandler.ts      # Global Express error handler
│   ├── packages.ts          # Contact-scoped package/credit enforcement (includes inline pricing)
│   ├── requireAdmin.ts      # Admin role enforcement
│   ├── requireDeveloper.ts  # Developer role enforcement
│   ├── statusCheck.ts       # Account/assistant/widget suspension check
│   ├── team.ts              # ⚠️ DEAD CODE: Team membership resolution (unused)
│   └── usageTracking.ts     # Message/usage limit enforcement per tier
├── routes/                  # 84 route files (see Module Map below)
├── services/
│   ├── ai/                       # AI provider abstraction layer
│   │   ├── AIProvider.ts              # Abstract base class
│   │   ├── AIProviderManager.ts       # Provider registry & routing
│   │   ├── GLMProvider.ts             # GLM-4 implementation
│   │   └── OllamaProvider.ts          # Ollama implementation
│   ├── actionRouter.ts               # Software task action dispatch
│   ├── assistantAIRouter.ts           # AI routing for assistant chat
│   ├── caseAnalyzer.ts               # AI-powered case component analysis
│   ├── chatSocket.ts                  # Socket.IO staff chat handler
│   ├── clientApiGateway.ts            # Client API proxy service
│   ├── codeAgent.ts                   # AI code agent service
│   ├── crawlerService.ts              # Web page scraping (Cheerio + Puppeteer)
│   ├── credentialVault.ts             # Vault encryption/decryption
│   ├── documentService.ts             # Document parsing (PDF, DOCX, XLSX)
│   ├── emailService.ts                # SMTP email dispatch
│   ├── embeddingService.ts            # Text → vector embeddings
│   ├── enterpriseEndpoints.ts         # Dynamic enterprise webhook handler
│   ├── firebaseService.ts             # FCM push notifications
│   ├── ftpDeploymentService.ts        # FTP/SFTP site deployment
│   ├── glmService.ts                  # GLM API wrapper
│   ├── healthMonitor.ts               # System health checks & auto-case creation
│   ├── ingestionAIRouter.ts           # AI-powered content cleaning
│   ├── ingestionWorker.ts             # Queue → child process bridge
│   ├── ingestionWorkerProcess.ts      # Isolated child process for heavy ingestion
│   ├── knowledgeCategorizer.ts        # Auto-categorize ingested content
│   ├── leadCaptureService.ts          # Lead capture from widget chats
│   ├── linkPreview.ts                 # URL link preview metadata
│   ├── mediaProcessor.ts             # Image/media processing for chat
│   ├── mobileAIProcessor.ts          # Mobile AI intent processing
│   ├── mobileActionExecutor.ts       # Mobile action execution engine
│   ├── mobileTools.ts                # Mobile tool definitions
│   ├── notificationService.ts        # Notification dispatch service
│   ├── openRouterVision.ts           # Vision model via OpenRouter
│   ├── packages.ts                   # Package billing operations
│   ├── payloadNormalizer.ts           # Normalize incoming payloads
│   ├── siteBuilderService.ts         # AI website generation
│   ├── siteBuilderTemplate.ts        # Site builder HTML templates
│   ├── smsService.ts                 # SMS dispatch via SMSPortal
│   ├── sshService.ts                 # SSH/SFTP remote operations
│   ├── subscription.ts               # Subscription lifecycle management
│   ├── taskSyncService.ts            # External task synchronization
│   ├── teamChatSocket.ts             # Socket.IO team chat handler
│   ├── vectorStore.ts                # SQLite-vec similarity search
│   ├── webmailService.ts             # IMAP webmail service
│   └── widgetService.ts              # Widget chat session management
├── utils/
│   ├── analyticsLogger.ts      # AI analytics event logging
│   ├── cryptoUtils.ts          # AES-256-GCM encryption for vault
│   ├── httpErrors.ts           # HttpError class (400/401/403/404)
│   ├── pdfGenerator.ts         # Puppeteer-based PDF generation
│   └── stripMarkdown.ts        # Strip markdown formatting
├── mcp/
│   ├── server.ts            # MCP server (stdio + SSE transport)
│   ├── index.ts             # MCP tool registration
│   ├── sse-transport.ts     # SSE transport adapter
│   ├── code-agent.ts        # MCP code agent tools
│   └── emailService.ts      # MCP email tool
├── migrations/
│   └── 027_seed_client_api_configs.ts  # Client API config seeding migration
└── scripts/
    ├── run_migration_018.ts       # Migration runner 018
    ├── run_migration_019.ts       # Migration runner 019
    ├── run_migration_020.ts       # Migration runner 020
    ├── run-migration-021.ts       # Migration runner 021
    ├── run-migration-023.ts       # Migration runner 023
    ├── run_migration_024.ts       # Migration runner 024
    ├── run_migration_025.ts       # Migration runner 025
    ├── run_migration_026.ts       # Migration runner 026
    ├── seedSilulumanzi.ts         # Silulumanzi data seeding
    └── test-task-sync.ts          # Task sync integration test
```

### Frontend (`/var/opt/frontend/src/`)

```
src/
├── index.tsx               # React entry point
├── index.css               # Global styles (Tailwind imports)
├── App.tsx                 # Root component — routing, auth guards, layout
├── setupProxy.js           # Dev proxy configuration
├── config/
│   ├── app.ts              # App configuration constants
│   └── firebase.ts         # Firebase client initialization
├── services/
│   ├── api.ts              # Axios instance, interceptors, API helper functions
│   ├── chatCache.ts        # Chat message local caching
│   ├── chatOfflineQueue.ts # Offline message queueing
│   ├── groupsSocket.ts     # Groups/team chat Socket.IO client
│   ├── pushNotifications.ts # Firebase push notification client
│   ├── staffChatSocket.ts  # Staff chat Socket.IO client
│   ├── teamChatSocket.ts   # Team chat Socket.IO client
│   └── webrtcService.ts    # WebRTC peer connection management
├── store/
│   └── index.ts            # Zustand global state store
├── hooks/
│   ├── useAuth.ts           # Authentication state & actions
│   ├── usePermissions.ts    # RBAC permission checks
│   ├── useModules.ts        # Feature module toggles
│   ├── useAppSettings.ts    # App branding/settings
│   ├── useLocalTasks.ts     # Local task management
│   ├── useSoftware.ts       # Software management state
│   ├── useTasks.ts          # Task management state
│   ├── useTheme.ts          # Dark/light theme switching
│   └── useUpdateChecker.ts  # Auto-update polling
├── models/
│   ├── AdminAIModels.ts     # Admin AI configuration types
│   ├── AdminAuditLogModel.ts # Audit log types
│   ├── AppSettingsModel.ts  # Branding/settings types
│   ├── AuthModel.ts         # Auth types (User, LoginPayload, etc.)
│   ├── BugsModel.ts         # Bug tracking types
│   ├── CaseModel.ts         # Case management types
│   ├── ContactModel.ts      # Contact entity types
│   ├── CredentialModel.ts   # Credential vault types
│   ├── InvoiceModel.ts      # Invoice/line item types
│   ├── LocalTasksModel.ts   # Local task sync types
│   ├── NotificationModel.ts # Notification types
│   ├── OtherModels.ts       # Misc shared types
│   ├── PlanningModel.ts     # Sprint/planning types
│   ├── QuotationModel.ts    # Quotation types
│   ├── StaffChatModel.ts    # Staff chat types
│   ├── SystemModels.ts      # User/role/permission types
│   ├── TeamChatModel.ts     # Team chat types
│   ├── TransactionModel.ts  # Accounting transaction types
│   ├── WebmailModel.ts      # Webmail types
│   └── index.ts             # Barrel export
├── types/
│   ├── cases.ts             # Case type definitions
│   ├── updates.ts           # Updates type definitions
│   └── index.ts             # Global type definitions
├── utils/
│   ├── formatters.ts        # Number/date/currency formatters
│   ├── notify.ts            # Toast notification helper
│   ├── ringtone.ts          # Call ringtone audio management
│   ├── softwareAuth.ts      # Software token auth utilities
│   ├── totp.ts              # TOTP 2FA client utilities
│   └── workflowPermissions.ts # Workflow permission checks
├── components/
│   ├── Layout/
│   │   ├── Layout.tsx             # Main app layout (sidebar, header, content)
│   │   └── PortalLayout.tsx       # AI portal layout variant
│   ├── UI/                        # 14 reusable UI components
│   │   ├── BackButton.tsx, Button.tsx, Card.tsx, Input.tsx
│   │   ├── Select.tsx, Textarea.tsx, CustomDatePicker.tsx
│   │   ├── DataTable.tsx, ThemeToggle.tsx
│   │   ├── EmailModal.tsx, PaymentModal.tsx, PricingModal.tsx
│   │   └── ItemPickerModal.tsx, index.ts
│   ├── CallProvider/
│   │   └── GlobalCallProvider.tsx # WebRTC call state management
│   ├── Cases/
│   │   └── CaseReportHandle.tsx   # Case report printing handle
│   ├── Notifications/
│   │   └── NotificationDropdown.tsx
│   ├── Invoices/
│   │   ├── InvoiceDetails.tsx
│   │   └── PaymentStatusBadge.tsx
│   ├── Quotations/
│   │   └── QuotationStatusBadge.tsx
│   ├── ExpenseCategories/
│   │   └── ExpenseCategoryManager.tsx
│   ├── Tasks/                     # 7 task components
│   │   ├── ColorLabelPicker.tsx, KanbanBoard.tsx, PriorityBadge.tsx
│   │   ├── TagInput.tsx, TaskCard.tsx, TaskStatsBar.tsx
│   │   └── TaskToolbar.tsx
│   ├── Updates/
│   │   └── UpdateBanner.tsx
│   ├── User/
│   │   └── UserAccountMenu.tsx
│   ├── DeveloperRoute.tsx    # Developer-only route guard
│   ├── ExcalidrawDrawer.tsx  # Excalidraw whiteboard integration
│   ├── KnowledgeHealthBadge.tsx # Assistant health badge
│   ├── KnowledgeHealthScore.tsx # Assistant health score display
│   ├── MobileAuthQR.tsx      # Mobile auth QR code
│   ├── PinSetup.tsx          # 4-digit PIN quick-auth setup/manage
│   ├── RichTextEditor.tsx    # Rich text editor (React Quill)
│   ├── TaskAttachmentsInline.tsx # Inline task attachment viewer
│   ├── TaskImageLightbox.tsx # Task image zoom/lightbox
│   ├── TwoFactorSetup.tsx    # 2FA configuration component
│   ├── ProtectedRoute.tsx    # Auth guard HOC
│   ├── AdminRoute.tsx        # Admin-only route guard
│   ├── PermissionRoute.tsx   # Permission-based route guard
│   ├── PermissionSync.tsx    # Sync permissions on login
│   └── Can.tsx               # Conditional render by permission
├── pages/
│   ├── auth/
│   │   ├── Login.tsx, ForgotPassword.tsx
│   ├── general/
│   │   ├── Dashboard.tsx, Settings.tsx, Profile.tsx, AccountSettings.tsx
│   │   ├── Notifications.tsx, Pricing.tsx, Categories.tsx
│   │   ├── Credentials.tsx, CreateCredential.tsx
│   │   ├── SoftwareManagement.tsx, GroupsPage.tsx, TasksPage.tsx
│   │   ├── Updates.tsx, UpdatesAdmin.tsx
│   │   ├── DatabaseManager.tsx, Bugs.tsx, BugsPage.tsx
│   │   ├── ChatPage.tsx, ClientMonitor.tsx, ErrorReports.tsx
│   │   ├── PlanningPage.tsx
│   │   ├── CaseList.tsx, CasesList.tsx, CaseDetail.tsx, CaseDetailView.tsx
│   │   ├── chat/                      # Staff chat sub-pages (20 files)
│   │   │   ├── AudioPlayer.tsx, CallHistoryPanel.tsx, CallOverlay.tsx
│   │   │   ├── ChatDialogs.tsx, ChatHeader.tsx, ChatSidebar.tsx
│   │   │   ├── EmojiPicker.tsx, ForwardDialog.tsx, GifPicker.tsx
│   │   │   ├── GlobalSearchPanel.tsx, ImageLightbox.tsx
│   │   │   ├── IncomingCallModal.tsx, MessageInput.tsx, MessageList.tsx
│   │   │   ├── ScheduleCallDialog.tsx, ScheduledCallsPanel.tsx
│   │   │   ├── StarredMessagesPanel.tsx, VoiceRecorder.tsx
│   │   │   └── chatHelpers.ts, index.ts
│   │   └── groups/                    # Team/group chat sub-pages
│   │       ├── ChatHeader.tsx, ChatSidebar.tsx
│   │       ├── MessageInput.tsx, MessageList.tsx
│   │       └── chatTypes.ts, index.ts
│   ├── contacts/
│   │   ├── Contacts.tsx, ContactDetails.tsx
│   ├── finance/
│   │   ├── Invoices.tsx, CreateInvoice.tsx
│   │   ├── Quotations.tsx, CreateQuotation.tsx
│   │   ├── Transactions.tsx, AddExpense.tsx, AddIncome.tsx
│   │   ├── FinancialDashboard.tsx, ProfitAndLoss.tsx, BalanceSheet.tsx
│   │   ├── Statement.tsx, TransactionListing.tsx, VatReports.tsx
│   ├── cases/
│   │   └── CasesDashboard.tsx
│   ├── admin/
│   │   ├── Dashboard.tsx, ClientManager.tsx
│   │   ├── AdminAIOverview.tsx, AIPackages.tsx
│   │   ├── AdminCaseManagement.tsx, AuditLog.tsx
│   │   ├── EnterpriseEndpoints.tsx, Webmail.tsx
│   ├── portal/
│   │   ├── Dashboard.tsx, ChatInterface.tsx
│   │   ├── AssistantsPage.tsx, CreateAssistant.tsx
│   │   ├── SitesPage.tsx, SiteBuilderEditor.tsx
│   │   ├── Settings.tsx
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
| **Authentication** | auth.ts, twoFactor.ts | auth/Login.tsx, auth/ForgotPassword.tsx, PinSetup.tsx | users, user_sessions, user_pins, mobile_auth_challenges, webauthn_credentials | [README](Authentication/README.md) |
| **Dashboard** | dashboard.ts, adminDashboard.ts | general/Dashboard.tsx, admin/Dashboard.tsx | — (aggregates) | [README](Dashboard/README.md) |
| **Users** | systemUsers.ts, profile.ts | system/Users.tsx, general/Profile.tsx, general/AccountSettings.tsx | users, user_sessions, staff_software_tokens | [README](Users/README.md) |
| **Roles** | systemRoles.ts, systemPermissions.ts | system/Roles.tsx, system/Permissions.tsx | roles, permissions, role_permissions, user_roles | [README](Roles/README.md) |
| **Notifications** | notifications.ts, fcmTokens.ts | general/Notifications.tsx, NotificationDropdown.tsx | notifications, notification_preferences, notification_queue, notification_templates | [README](Notifications/README.md) |

### Business Modules (🟡 MED)

| Module | Backend Routes | Frontend Pages | DB Tables | Documentation |
|--------|---------------|----------------|-----------|---------------|
| **Contacts** | contacts.ts, contactFormRouter.ts | contacts/Contacts.tsx, contacts/ContactDetails.tsx | contacts, contact_groups, contact_documentation, contact_packages, form_submissions, user_contact_link | [README](Contacts/README.md) |
| **Invoices** | invoices.ts | finance/Invoices.tsx, finance/CreateInvoice.tsx | invoices, invoice_items | [README](Invoices/README.md) |
| **Quotations** | quotations.ts | finance/Quotations.tsx, finance/CreateQuotation.tsx | quotations, quote_items | [README](Quotations/README.md) |
| **Payments** | payments.ts | PaymentModal.tsx | payments | [README](Payments/README.md) |
| **Accounting** | accounting.ts, expenseCategories.ts, categories.ts, transactions.ts | finance/Transactions.tsx, finance/AddExpense.tsx, finance/AddIncome.tsx, general/Categories.tsx | transactions, ledger, accounts, categories, expense_categories, tax_rates | [README](Accounting/README.md) |
| **FinancialReports** | financialReports.ts, vatReports.ts, reports.ts | finance/FinancialDashboard.tsx, finance/ProfitAndLoss.tsx, finance/BalanceSheet.tsx, finance/VatReports.tsx, finance/TransactionListing.tsx, finance/Statement.tsx | — (reads from transactions, ledger) | [README](FinancialReports/README.md) |
| **Packages** | packages.ts, adminPackages.ts, pricing.ts | general/Pricing.tsx, admin/AIPackages.tsx | packages, contact_packages, package_transactions | [README](Packages/README.md) |
| **~~Subscription~~** | ~~subscription.ts, subscriptionTiers.ts~~ | — | ~~subscription_tier_limits~~ | ⚠️ **LEGACY** (superseded by Packages + `config/tiers.ts`; routes retained for backward compat. Stripe removed — 410 stub. Yoco is the sole active gateway via `routes/yoco.ts`) |
| **Cases** | cases.ts, adminCases.ts | general/CasesList.tsx, general/CaseDetailView.tsx, cases/CasesDashboard.tsx, admin/AdminCaseManagement.tsx | cases, case_comments, case_activity | [README](Cases/README.md) |

### Platform Modules (🟡 MED)

| Module | Backend Routes | Frontend Pages | DB Tables | Documentation |
|--------|---------------|----------------|-----------|---------------|
| **AI / AI Gateway** | ai.ts, aiConfig.ts, glm.ts, codeWriter.ts, codeImplementation.ts, agents.ts, git.ts | portal/ChatInterface.tsx, admin/AdminAIOverview.tsx | ai_analytics_logs | [README](AIGateway/README.md) |
| **Assistants** | assistants.ts, assistantIngest.ts, widgetChat.ts, widgetIngest.ts, publicLeadAssistant.ts, myAssistant.ts, staffAssistant.ts | portal/AssistantsPage.tsx, portal/CreateAssistant.tsx | assistants, widget_clients, knowledge_chunks, document_embeddings, document_metadata, crawl_queue, widget_leads_captured, widget_usage_logs | [README](Assistants/README.md) |
| **Widgets** | widgetChat.ts, widgetIngest.ts | — (embeddable widget) | widget_clients, widget_leads_captured, widget_usage_logs | [README](Widgets/README.md) |
| **Chat (Staff)** | staffChat.ts | general/ChatPage.tsx, general/chat/* (20 files) | conversations, conversation_members, messages, message_reactions, message_status, deleted_messages, starred_messages, user_presence, call_sessions, call_participants, scheduled_calls, scheduled_call_participants | [README](Chat/README.md) |
| **Chat (Team)** | teamChat.ts | general/groups/* (6 files) | — (uses same chat tables) | [README](Chat/README.md) |
| **Enterprise** | enterpriseWebhook.ts, adminEnterpriseEndpoints.ts, clientApiGateway.ts, adminClientApiConfigs.ts, mobileIntent.ts, myAssistant.ts, staffAssistant.ts | admin/EnterpriseEndpoints.tsx, MobileAuthQR.tsx | enterprise_endpoints (SQLite), endpoint_requests, client_api_configs, client_api_logs, mobile_conversations, mobile_messages, mobile_auth_challenges | [README](Enterprise/README.md) |
| **SiteBuilder** | siteBuilder.ts | portal/SitesPage.tsx, portal/SiteBuilderEditor.tsx | generated_sites, site_deployments | [README](SiteBuilder/README.md) |
| **Webmail** | webmail.ts | admin/Webmail.tsx | user_mailboxes, email_log | [README](Webmail/README.md) |
| **Email & SMS** | email.ts, sms.ts | — | email_log, sms_log | [README](Notifications/README.md) |
| **Planning** | planning.ts | general/PlanningPage.tsx | calendar_events, calendar_event_attendees | [README](Scheduling/README.md) |
| **Software** | softawareTasks.ts, localTasks.ts | general/SoftwareManagement.tsx, general/TasksPage.tsx | local_tasks, task_sources, task_sync_log | [README](Software/README.md) |
| **Tasks** | softawareTasks.ts, localTasks.ts | general/TasksPage.tsx, Tasks/* (7 components) | local_tasks, task_sources, task_sync_log | [README](Tasks/README.md) |
| **Bugs** | bugs.ts | general/Bugs.tsx, general/BugsPage.tsx | bugs, bug_comments, bug_attachments | [README](Bugs/README.md) |
| **Updates** | updSoftware.ts, updUpdates.ts, updClients.ts, updFiles.ts, updModules.ts, updHeartbeat.ts, updMisc.ts, updErrorReport.ts | general/Updates.tsx, general/UpdatesAdmin.tsx, general/ErrorReports.tsx | — (external update DB) | [README](Updates/README.md) |
| **Database** | databaseManager.ts | general/DatabaseManager.tsx | — (meta-queries) | [README](DatabaseManagement/README.md) |
| **External Groups** | — | general/GroupsPage.tsx | — (reads from external) | [README](ExternalGroups/README.md) |

### System Modules (🟢 LOW)

| Module | Backend Routes | Frontend Pages | DB Tables | Documentation |
|--------|---------------|----------------|-----------|---------------|
| **Settings** | settings.ts, appSettings.ts, adminConfig.ts | general/Settings.tsx, system/SystemSettings.tsx | app_settings, pricing | [README](Settings/README.md) |
| **Credentials** | vault.ts, systemCredentials.ts | general/Credentials.tsx, general/CreateCredential.tsx | vault_credentials | [README](Credentials/README.md) |
| **~~Teams~~** | ~~teams.ts~~ | — | ~~teams, team_members, team_invites~~ | ⚠️ Deprecated (→ Packages) |
| **Files** | files.ts | — | — | [README](Files/README.md) |
| **ApiKeys** | apiKeys.ts | — | api_keys | [README](ApiKeys/README.md) |
| **~~MCP~~** | ~~mcp.ts (+ src/mcp/*)~~ | — | — | ⚠️ Deprecated |
| **Admin** | admin.ts, adminClientManager.ts, activation.ts, adminAuditLog.ts, sync.ts | admin/ClientManager.tsx, admin/AuditLog.tsx | activation_keys, device_activations, admin_audit_log, client_agents | [README](Admin/README.md) |

### Crosscutting

| Module | Source Files | Documentation |
|--------|-------------|---------------|
| **Frontend** | Layout.tsx, UI/*, store/*, hooks/*, services/*, models/* | [README](Crosscutting/Frontend/README.md) |
| **Infrastructure** | mysql.ts, middleware/*, env.ts, errorHandler.ts, healthMonitor.ts | [README](Crosscutting/Infrastructure/README.md) |
| **Services** | firebaseService.ts, pdfGenerator.ts, crawlerService.ts, emailService.ts, smsService.ts, webmailService.ts, chatSocket.ts, teamChatSocket.ts | [README](Services/README.md) |

---

## 6. Database Schema Overview

**~66 tables** across three naming conventions plus SQLite databases:

| Prefix | Purpose | Tables |
|--------|---------|--------|
| `sys_` | System/platform tables (legacy prefix — being phased out) | sys_settings |
| `tb_` | Business/tenant tables (legacy prefix — being phased out) | tb_contacts, tb_invoices, tb_payments, tb_transactions, tb_expense_categories |
| (none) | Active schema (unprefixed) | accounts, admin_audit_log, ai_analytics_logs, app_settings, bugs, bug_comments, bug_attachments, calendar_events, calendar_event_attendees, call_participants, call_sessions, categories, client_api_configs, client_api_logs, contacts, contact_documentation, contact_groups, contact_packages, conversations, conversation_members, crawl_queue, deleted_messages, document_embeddings, document_metadata, email_log, endpoint_requests, expense_categories, form_submissions, generated_sites, invoices, invoice_items, knowledge_chunks, lead_captures, ledger, local_tasks, messages, message_reactions, message_status, mobile_auth_challenges, mobile_conversations, mobile_messages, package_transactions, packages, payments, pricing, quotations, quote_items, scheduled_calls, scheduled_call_participants, site_deployments, sms_log, staff_software_tokens, starred_messages, subscription_tier_limits, task_sources, task_sync_log, tax_rates, transactions, user_contact_link, user_mailboxes, user_pins, user_presence, user_sessions, webauthn_credentials, widget_clients, widget_leads_captured, widget_usage_logs |
| SQLite | Separate SQLite databases | enterprise_endpoints.db (enterprise webhook configs), vector store DBs (embeddings) |

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
- `requireDeveloper` → Checks for developer role
- `requireApiKey` → X-API-Key header validation (for external integrations)
- `checkAccountStatus` → Blocks suspended/demo-expired accounts
- `checkAssistantStatus` → Blocks suspended assistants
- `checkWidgetStatus` → Blocks suspended widget clients
- `trackUsage` → Message limit enforcement per subscription tier
- `auditLogger` → Records admin actions to audit log
- `apiErrorTracker` → Tracks error rates for health monitoring
- `packages` → Contact-scoped package credit enforcement

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
| `OPENAI_API_KEY` | OpenAI API key | — |
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
| Socket.IO | Attached to Express HTTP server | Same port as backend (:8787) |
| MCP Server | Standalone (tsx src/mcp/server.ts) | /var/opt/backend |

---

## 10. Documentation Index

| # | Module | Priority | Status |
|---|--------|----------|--------|
| — | [CODEBASE_MAP.md](CODEBASE_MAP.md) | 🔴 | ✅ Complete |
| — | [Wiring](Wiring/README.md) | 🔴 | ✅ Complete |
| 1 | [Crosscutting/Infrastructure](Crosscutting/Infrastructure/README.md) | 🔴 | ⚠️ Superseded by Wiring |
| 2 | [Authentication](Authentication/README.md) | 🔴 | ✅ Complete |
| 3 | [Users](Users/README.md) | 🔴 | ✅ Complete |
| 4 | [Roles](Roles/README.md) | 🔴 | ✅ Complete |
| 5 | [Dashboard](Dashboard/README.md) | 🔴 | ✅ Complete |
| 6 | [Notifications](Notifications/README.md) | 🔴 | ✅ Complete |
| 7 | [Contacts](Contacts/README.md) | 🟡 | ✅ Complete |
| 8 | [Invoices](Invoices/README.md) | 🟡 | ✅ Complete |
| 9 | [Quotations](Quotations/README.md) | 🟡 | ✅ Complete |
| 10 | [Payments](Payments/README.md) | 🟡 | ✅ Complete |
| 11 | [Accounting](Accounting/README.md) | 🟡 | ✅ Complete |
| 12 | [FinancialReports](FinancialReports/README.md) | 🟡 | ✅ Complete |
| 13 | [Packages](Packages/README.md) | 🟡 | ✅ Complete |
| 14 | ~~[Subscription](Subscription/README.md)~~ | 🟡 | ⚠️ **Legacy** (superseded by Packages + `config/tiers.ts`; Stripe removed, Yoco active) |
| 15 | [AI Gateway](AIGateway/README.md) | 🟡 | ✅ Complete |
| 16 | [Assistants](Assistants/README.md) | 🟡 | ✅ Complete |
| 17 | [Widgets](Widgets/README.md) | 🟡 | ✅ Complete |
| 18 | [Chat (Staff)](Chat/README.md) | 🟡 | ✅ Complete |
| 19 | [Enterprise](Enterprise/README.md) | 🟡 | ✅ Complete |
| 20 | [Webhooks](Webhooks/README.md) | 🟡 | ✅ Complete |
| 21 | [SiteBuilder](SiteBuilder/README.md) | 🟡 | ✅ Complete |
| 22 | [Tasks](Tasks/README.md) | 🟡 | ✅ Complete |
| 23 | [Bugs](Bugs/README.md) | 🟡 | ✅ Complete |
| 24 | [Cases](Cases/README.md) | 🟡 | ✅ Complete |
| 25 | [Updates](Updates/README.md) | 🟡 | ✅ Complete |
| 26 | [Database](Database/README.md) | 🟡 | ✅ Complete |
| 27 | [DatabaseManagement](DatabaseManagement/README.md) | 🟡 | ✅ Complete |
| 28 | [ExternalGroups](ExternalGroups/README.md) | 🟡 | ✅ Complete |
| 29 | [Scheduling](Scheduling/README.md) | 🟡 | ✅ Complete |
| 30 | [Webmail](Webmail/README.md) | 🟡 | ✅ Complete |
| 31 | [Services](Services/README.md) | 🟡 | ✅ Complete |
| 32 | [Settings](Settings/README.md) | 🟢 | ✅ Complete |
| 33 | [Credentials](Credentials/README.md) | 🟢 | ✅ Complete |
| 34 | [Files](Files/README.md) | 🟢 | ✅ Complete |
| 35 | [ApiKeys](ApiKeys/README.md) | 🟢 | ✅ Complete |
| 36 | [Admin](Admin/README.md) | 🟢 | ✅ Complete |
| 37 | [Pricing](Pricing/README.md) | 🟢 | ✅ Complete |
| 38 | [Crosscutting/Frontend](Crosscutting/Frontend/README.md) | 🟢 | ✅ Complete |
| — | ~~[Teams](Teams/README.md)~~ | 🟢 | ⚠️ Deprecated (→ Packages) |
| — | ~~[MCP](MCP/README.md)~~ | 🟢 | ⚠️ Deprecated |

**Documentation Progress:** 37/38 active modules documented (97%) + Wiring (core platform infrastructure)

---

*This is the top-level architectural reference for the SoftAware platform. Each module folder contains its own documentation set (README, and optionally FILES, FIELDS, ROUTES, PATTERNS, CHANGES). The Wiring documentation covers the platform's core infrastructure (server bootstrap, middleware chain, DB layer, health monitoring, frontend app shell) and supersedes the earlier Crosscutting/Infrastructure docs.*
