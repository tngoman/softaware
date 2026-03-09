# SoftAware Documentation Plan

**Version:** 1.0.0  
**Last Updated:** 2026-03-02  
**Author:** tngoman

---

## 1. Overview

This document outlines the plan to create comprehensive, structured documentation for the SoftAware platform at `/var/opt/documentation/`. The documentation follows the same pattern established in the Silulumanzi project (`www/code/silulumanzi/documents`).

### Goals

- One folder per business module
- Standard 6-file set per module (README, FILES, FIELDS, ROUTES, PATTERNS, CHANGES)
- Machine-readable and human-readable (consumable by AI agents and developers)
- Embedded source code excerpts, not just descriptions
- Security auditing built into every document
- Cross-referenced between modules

---

## 2. Target Location

```
/var/opt/documentation/
```

---

## 3. Standard File Set (Per Module)

Every documented module gets exactly **6 files**:

| File | Purpose |
|------|---------|
| **README.md** | Module overview — purpose, architecture, user guide, workflows, features, integration points, security, troubleshooting |
| **FILES.md** | File inventory — every source file with path, line count, class/function structure, methods, code excerpts |
| **FIELDS.md** | Database schema — tables, columns, types, constraints, relationships, example data, known issues |
| **ROUTES.md** | API endpoints — HTTP method, path, auth, request/response examples, query params, error responses |
| **PATTERNS.md** | Architecture patterns & anti-patterns — design patterns, code examples, benefits/drawbacks, refactoring notes |
| **CHANGES.md** | Changelog — version history, known issues with severity/status, migration notes, effort estimates |

### File Templates

#### README.md Sections
1. Module Overview (Purpose, Business Value, Key Statistics)
2. Architecture (component diagram, descriptions)
3. User Guide (step-by-step workflows)
4. Business Workflows (flowcharts/sequences)
5. Key Features
6. Integration Points
7. Security Model
8. Troubleshooting
9. Related Documentation (cross-links)

#### FILES.md Sections
1. Overview (total files, total LOC, directory tree)
2. Backend Files (per file: location, LOC, purpose, dependencies, methods with params/returns/code/DB queries)
3. Frontend Files (same per-file format)

#### FIELDS.md Sections
1. Overview (table count, setting count)
2. Core Tables (per table: purpose, field table with Type/Constraints/Description, indexes, relationships, business rules, example SQL, known issues)
3. Table Creation SQL

#### ROUTES.md Sections
1. Overview (total endpoints, base URL, auth)
2. Endpoint Directory (summary table)
3. Endpoints (per endpoint: purpose, auth, params, curl example, response JSON, error responses, DB queries, business logic)

#### PATTERNS.md Sections
1. Overview
2. Architectural Patterns (Context, Implementation code, Benefits ✅, Drawbacks ❌)
3. Anti-Patterns Found (description, current code, impact, recommended fix)

#### CHANGES.md Sections
1. Overview
2. Version History (status, release notes, limitations, migration notes)
3. Known Issues (Severity 🔴🟡✅, Status, File:line, Description, Impact, Recommended Fix, Effort)

### Header Block (All Files)

```markdown
# {Module Name} Module - {File Purpose}

**Version:** 1.0.0  
**Last Updated:** YYYY-MM-DD

---
```

---

## 4. Module List

Based on the SoftAware codebase, the following **27 modules** will be documented:

### Core Modules

| # | Folder Name | Description | Backend Routes | Frontend Pages | Priority |
|---|-------------|-------------|----------------|----------------|----------|
| 1 | `Authentication/` | Login, register, JWT, 2FA, password reset | auth.ts, twoFactor.ts | Login.tsx, ForgotPassword.tsx | 🔴 HIGH |
| 2 | `Dashboard/` | Main dashboard, admin dashboard | dashboard.ts, adminDashboard.ts | Dashboard.tsx, admin/Dashboard.tsx | 🔴 HIGH |
| 3 | `Users/` | User management, profiles | systemUsers.ts, profile.ts | system/Users.tsx, Profile.tsx, AccountSettings.tsx | 🔴 HIGH |
| 4 | `Roles/` | Roles and permissions | systemRoles.ts, systemPermissions.ts | system/Roles.tsx, system/Permissions.tsx | 🔴 HIGH |
| 5 | `Notifications/` | In-app notifications, FCM push | notifications.ts, fcmTokens.ts | Notifications.tsx, NotificationDropdown.tsx | 🔴 HIGH |

### Business Modules

| # | Folder Name | Description | Backend Routes | Frontend Pages | Priority |
|---|-------------|-------------|----------------|----------------|----------|
| 6 | `Contacts/` | Contact management, details | contacts.ts, contactFormRouter.ts | Contacts.tsx, ContactDetails.tsx | 🟡 MED |
| 7 | `Invoices/` | Invoice creation, management | invoices.ts | Invoices.tsx, CreateInvoice.tsx | 🟡 MED |
| 8 | `Quotations/` | Quotation creation, management | quotations.ts | Quotations.tsx, CreateQuotation.tsx | 🟡 MED |
| 9 | `Payments/` | Payment processing, records | payments.ts | PaymentModal.tsx | 🟡 MED |
| 10 | `Accounting/` | Transactions, expenses, income | accounting.ts, expenseCategories.ts, categories.ts | Transactions.tsx, AddExpense.tsx, AddIncome.tsx, Categories.tsx | 🟡 MED |
| 11 | `FinancialReports/` | P&L, balance sheet, VAT, statements | financialReports.ts, vatReports.ts, reports.ts | FinancialDashboard.tsx, ProfitAndLoss.tsx, BalanceSheet.tsx, Statement.tsx, VatReports.tsx, TransactionListing.tsx | 🟡 MED |
| 12 | `Subscription/` | Plans, tiers, pricing | subscription.ts, subscriptionTiers.ts, pricing.ts, credits.ts, adminCredits.ts | Pricing.tsx | 🟡 MED |

### Platform Modules

| # | Folder Name | Description | Backend Routes | Frontend Pages | Priority |
|---|-------------|-------------|----------------|----------------|----------|
| 13 | `AI/` | AI chat, config, code writer, GLM | ai.ts, aiConfig.ts, codeWriter.ts, codeImplementation.ts, glm.ts | portal/ChatInterface.tsx | 🟡 MED |
| 14 | `Assistants/` | Lead assistants, ingestion, widget | assistants.ts, assistantIngest.ts, widgetChat.ts, widgetIngest.ts, publicLeadAssistant.ts | portal/AssistantsPage.tsx, portal/CreateAssistant.tsx | 🟡 MED |
| 15 | `SiteBuilder/` | AI website builder | siteBuilder.ts | portal/SitesPage.tsx | 🟡 MED |
| 16 | `Software/` | Software management, groups | softawareTasks.ts, groups.ts | SoftwareManagement.tsx, GroupsPage.tsx, TasksPage.tsx | 🟡 MED |
| 17 | `Updates/` | Software update distribution | updSoftware.ts, updUpdates.ts, updClients.ts, updFiles.ts, updModules.ts, updHeartbeat.ts, updMisc.ts | Updates.tsx, UpdatesAdmin.tsx | 🟡 MED |
| 18 | `Database/` | Database manager | databaseManager.ts | DatabaseManager.tsx | 🟡 MED |

### System Modules

| # | Folder Name | Description | Backend Routes | Frontend Pages | Priority |
|---|-------------|-------------|----------------|----------------|----------|
| 19 | `Settings/` | App settings, system settings, branding | settings.ts, appSettings.ts, adminConfig.ts | Settings.tsx, system/SystemSettings.tsx | 🟢 LOW |
| 20 | `Credentials/` | Credential vault, system credentials | vault.ts, systemCredentials.ts | Credentials.tsx, CreateCredential.tsx | 🟢 LOW |
| 21 | `Teams/` | Team management | teams.ts | — | 🟢 LOW |
| 22 | `Files/` | File uploads, management | files.ts | — | 🟢 LOW |
| 23 | `ApiKeys/` | API key management | apiKeys.ts | — | 🟢 LOW |
| 24 | `Sync/` | Data synchronization | sync.ts | — | 🟢 LOW |
| 25 | `MCP/` | Model Context Protocol server | mcp.ts (+ src/mcp/*) | — | 🟢 LOW |
| 26 | `Admin/` | Admin client manager, activation | admin.ts, adminClientManager.ts, activation.ts | — | 🟢 LOW |

### Crosscutting

| # | Folder Name | Description | Source Files | Priority |
|---|-------------|-------------|--------------|----------|
| 27 | `Crosscutting/` | Shared infrastructure spanning modules | — | 🟢 LOW |
|    | ↳ `Frontend/` | Layout, UI components, state, hooks, API service | Layout.tsx, UI/*, store/*, hooks/*, api.ts | |
|    | ↳ `Infrastructure/` | Database, middleware, env config, error handling | mysql.ts, auth middleware, env.ts, errorHandler.ts | |
|    | ↳ `Services/` | Firebase, email, PDF, payments, crawling | firebaseService.ts, actionRouter.ts, pdfGenerator.ts, crawlerService.ts | |

---

## 5. Target Directory Structure

```
/var/opt/documentation/
├── CODEBASE_MAP.md
├── Authentication/
│   ├── README.md
│   ├── FILES.md
│   ├── FIELDS.md
│   ├── ROUTES.md
│   ├── PATTERNS.md
│   └── CHANGES.md
├── Dashboard/
│   ├── README.md
│   ├── FILES.md
│   ├── FIELDS.md
│   ├── ROUTES.md
│   ├── PATTERNS.md
│   └── CHANGES.md
├── Users/
│   └── (6-file set)
├── Roles/
│   └── (6-file set)
├── Notifications/
│   └── (6-file set)
├── Contacts/
│   └── (6-file set)
├── Invoices/
│   └── (6-file set)
├── Quotations/
│   └── (6-file set)
├── Payments/
│   └── (6-file set)
├── Accounting/
│   └── (6-file set)
├── FinancialReports/
│   └── (6-file set)
├── Subscription/
│   └── (6-file set)
├── AI/
│   └── (6-file set)
├── Assistants/
│   └── (6-file set)
├── SiteBuilder/
│   └── (6-file set)
├── Software/
│   └── (6-file set)
├── Updates/
│   └── (6-file set)
├── Database/
│   └── (6-file set)
├── Settings/
│   └── (6-file set)
├── Credentials/
│   └── (6-file set)
├── Teams/
│   └── (6-file set)
├── Files/
│   └── (6-file set)
├── ApiKeys/
│   └── (6-file set)
├── Sync/
│   └── (6-file set)
├── MCP/
│   └── (6-file set)
├── Admin/
│   └── (6-file set)
└── Crosscutting/
    ├── Frontend/
    │   └── (5-file set, no ROUTES)
    ├── Infrastructure/
    │   └── (5-file set, no ROUTES)
    └── Services/
        └── (5-file set, no ROUTES)
```

**Total:** 1 CODEBASE_MAP + 26 module folders × 6 files + 3 crosscutting sub-folders × 5 files = **172 documentation files**

---

## 6. Execution Order

### Phase 1 — Foundation (Do First)
1. Create `CODEBASE_MAP.md` — top-level architectural reference
2. Create `Crosscutting/Infrastructure/` — database, middleware, config (needed by all others)

### Phase 2 — Core Modules (🔴 HIGH Priority)
3. `Authentication/` — login, JWT, 2FA, FCM token registration
4. `Users/` — user CRUD, profiles, account settings
5. `Roles/` — roles, permissions, access control
6. `Dashboard/` — main + admin dashboards
7. `Notifications/` — in-app + push notifications

### Phase 3 — Business Modules (🟡 MED Priority)
8. `Contacts/`
9. `Invoices/`
10. `Quotations/`
11. `Payments/`
12. `Accounting/`
13. `FinancialReports/`
14. `Subscription/`

### Phase 4 — Platform Modules (🟡 MED Priority)
15. `AI/`
16. `Assistants/`
17. `SiteBuilder/`
18. `Software/`
19. `Updates/`
20. `Database/`

### Phase 5 — System & Crosscutting (🟢 LOW Priority)
21. `Settings/`
22. `Credentials/`
23. `Teams/`
24. `Files/`
25. `ApiKeys/`
26. `Sync/`
27. `MCP/`
28. `Admin/`
29. `Crosscutting/Frontend/`
30. `Crosscutting/Services/`

---

## 7. Conventions

| Convention | Rule |
|------------|------|
| **Folder names** | PascalCase matching business module |
| **File names** | ALL_CAPS.md (README, FILES, FIELDS, ROUTES, PATTERNS, CHANGES) |
| **Code blocks** | Always include language tag: ```typescript, ```sql, ```tsx, ```bash |
| **Line counts** | Include exact LOC for every file, class, and component |
| **Diagrams** | ASCII art with box-drawing characters (┌─────┐, │, └─────┘) |
| **Severity markers** | 🔴 CRITICAL, 🟡 WARNING, ✅ OK/Done |
| **Cross-references** | Relative markdown links: `[Users](../Users/README.md)` |
| **Security issues** | Flag with 🔴, include exploit scenario, provide fix code |
| **Version header** | Every file starts with module name, version, last updated date |
| **Tables** | Use for endpoint directories, field schemas, permission matrices |

---

## 8. Source File Mapping

Quick reference mapping backend route files → documentation modules:

| Documentation Module | Backend Route Files | Services | Frontend Pages |
|----------------------|---------------------|----------|----------------|
| Authentication | auth.ts, twoFactor.ts | firebaseService.ts | Login.tsx, ForgotPassword.tsx |
| Dashboard | dashboard.ts, adminDashboard.ts | — | Dashboard.tsx, admin/Dashboard.tsx |
| Users | systemUsers.ts, profile.ts | — | system/Users.tsx, Profile.tsx, AccountSettings.tsx |
| Roles | systemRoles.ts, systemPermissions.ts | — | system/Roles.tsx, system/Permissions.tsx |
| Notifications | notifications.ts, fcmTokens.ts | firebaseService.ts | Notifications.tsx, NotificationDropdown.tsx |
| Contacts | contacts.ts, contactFormRouter.ts | — | Contacts.tsx, ContactDetails.tsx |
| Invoices | invoices.ts | pdfGenerator.ts | Invoices.tsx, CreateInvoice.tsx |
| Quotations | quotations.ts | pdfGenerator.ts | Quotations.tsx, CreateQuotation.tsx |
| Payments | payments.ts | payment.ts | PaymentModal.tsx |
| Accounting | accounting.ts, expenseCategories.ts, categories.ts | — | Transactions.tsx, AddExpense.tsx, AddIncome.tsx |
| FinancialReports | financialReports.ts, vatReports.ts, reports.ts | — | FinancialDashboard.tsx, ProfitAndLoss.tsx, BalanceSheet.tsx, VatReports.tsx |
| Subscription | subscription.ts, subscriptionTiers.ts, pricing.ts, credits.ts, adminCredits.ts | subscription.ts, credits.ts | Pricing.tsx |
| AI | ai.ts, aiConfig.ts, codeWriter.ts, codeImplementation.ts, glm.ts | glmService.ts, ai/* | portal/ChatInterface.tsx |
| Assistants | assistants.ts, assistantIngest.ts, widgetChat.ts, widgetIngest.ts, publicLeadAssistant.ts | ingestionWorker.ts, embeddingService.ts, crawlerService.ts, knowledgeCategorizer.ts | portal/AssistantsPage.tsx, portal/CreateAssistant.tsx |
| SiteBuilder | siteBuilder.ts | siteBuilderService.ts, ftpDeploymentService.ts | portal/SitesPage.tsx |
| Software | softawareTasks.ts, groups.ts | actionRouter.ts | SoftwareManagement.tsx, GroupsPage.tsx, TasksPage.tsx |
| Updates | updSoftware.ts, updUpdates.ts, updClients.ts, updFiles.ts, updModules.ts, updHeartbeat.ts, updMisc.ts | — | Updates.tsx, UpdatesAdmin.tsx |
| Database | databaseManager.ts | — | DatabaseManager.tsx |
| Settings | settings.ts, appSettings.ts, adminConfig.ts | — | Settings.tsx, system/SystemSettings.tsx |
| Credentials | vault.ts, systemCredentials.ts | cryptoUtils.ts | Credentials.tsx, CreateCredential.tsx |
| Teams | teams.ts | — | — |
| Files | files.ts | documentService.ts, openRouterVision.ts | — |
| ApiKeys | apiKeys.ts | — | — |
| Sync | sync.ts | — | — |
| MCP | mcp.ts | src/mcp/* | — |
| Admin | admin.ts, adminClientManager.ts, activation.ts | — | — |

---

## 9. Estimated Effort

| Phase | Modules | Files | Estimated Time |
|-------|---------|-------|----------------|
| Phase 1 — Foundation | 2 | 12 | 2-3 hours |
| Phase 2 — Core | 5 | 30 | 5-8 hours |
| Phase 3 — Business | 7 | 42 | 7-10 hours |
| Phase 4 — Platform | 6 | 36 | 6-9 hours |
| Phase 5 — System | 10 | 52 | 5-7 hours |
| **Total** | **30** | **172** | **25-37 hours** |

---

## 10. Getting Started

To begin documentation, run:

```bash
# Create the documentation directory structure
mkdir -p /var/opt/documentation

# Phase 1: Start with CODEBASE_MAP.md
# Then proceed module-by-module following the execution order above
```

Each module is documented by:
1. Reading all source files mapped to the module
2. Querying the database for table schemas
3. Testing API endpoints for request/response examples
4. Writing the 6-file set following the templates above

---

*This plan is a living document. Update as modules are added or restructured.*
