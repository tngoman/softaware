lected# UI to Frontend Feature Matrix

Date: March 1, 2026

Purpose: File-level migration mapping from /var/opt/ui to /var/opt/frontend.

Legend:
- P0 = mandatory first-wave
- P1 = second-wave
- P2 = third-wave

---

## A) Public Section

| Source File | Source Route(s) | Feature | Target Route | Priority | Notes |
|---|---|---|---|---|---|
| /var/opt/ui/src/pages/public/LandingPage.tsx | / | Marketing landing, pricing view, lead assistant entry | / | P2 | Rebuild with frontend design tokens and shared components |
| /var/opt/ui/src/pages/public/LoginPage.tsx | /login | Role-aware login | /login | P0 | Harmonize with existing target auth stack |
| /var/opt/ui/src/pages/public/RegisterPage.tsx | /register | Registration and confirmation state | /register | P2 | Align payload to backend /auth/register contract |
| /var/opt/ui/src/pages/public/ActivatePage.tsx | /activate | Email activation token flow | /activate | P2 | Align with backend activation endpoint contract |

---

## B) Client Portal Section

| Source File | Source Route(s) | Feature | Target Route | Priority | Notes |
|---|---|---|---|---|---|
| /var/opt/ui/src/pages/portal/ClientPortal.tsx | /portal | Portal entry wrapper | /portal | P1 | Keep as route alias to portal dashboard |
| /var/opt/ui/src/pages/portal/Dashboard.tsx | /portal | Portal dashboard, metrics, quick actions | /portal | P1 | Use target portal layout and model classes |
| /var/opt/ui/src/pages/portal/AssistantsPage.tsx | /portal/assistants | Assistants listing, embed modal, test chat | /portal/assistants | P1 | Replace direct fetch with model methods |
| /var/opt/ui/src/pages/portal/CreateAssistant.tsx | /portal/create-assistant, /portal/assistants/:assistantId/edit | Assistant create/edit wizard + ingest | /portal/assistants/new, /portal/assistants/:assistantId/edit | P1 | Endpoint alignment needed for assistant update route |
| /var/opt/ui/src/pages/portal/ChatInterface.tsx | /chat/:assistantId | Public assistant chat UI | /chat/:assistantId | P1 | Keep streaming UI behavior |
| /var/opt/ui/src/pages/portal/CreditsPage.tsx | /portal/credits | Self-service credits, purchase, history | /portal/credits | P1 | Backend auth contract mismatch on /credits/balance needs resolution |
| /var/opt/ui/src/pages/portal/AIModelSettings.tsx | /portal/ai-models | AI provider/model configuration | /portal/ai-models | P1 | Replace MUI controls with design-system inputs/selects |
| /var/opt/ui/src/pages/portal/Settings.tsx | /portal/settings | User/notification/security/billing settings view | /portal/settings | P1 | Migrate to target layout + cards |
| /var/opt/ui/src/pages/portal/SiteBuilderDashboard.tsx | /portal/site-builder | Site list and lifecycle actions | /portal/site-builder | P1 | Keep /v1/sites integration |
| /var/opt/ui/src/pages/portal/SiteBuilderEditor.tsx | /portal/site-builder/edit/:siteId | Site editor, uploads, FTP deploy | /portal/site-builder/:siteId and /portal/site-builder/new | P1 | Maintain multi-step workflow |
| /var/opt/ui/src/pages/portal/CreateLandingWithAI.tsx | /portal/create-landing-with-ai | Landing + AI setup wizard | /portal/create-landing-with-ai | P2 | Can be merged with site-builder onboarding |
| /var/opt/ui/src/pages/portal/components/Sidebar.tsx | internal | Portal navigation shell | PortalLayout | P1 | Recreate in target with design tokens |
| /var/opt/ui/src/pages/portal/components/TopActionBar.tsx | internal | Usage counters and upgrade CTA | PortalLayout header | P1 | Ensure metric hooks in model layer |
| /var/opt/ui/src/pages/portal/components/QuickActions.tsx | internal | Quick create actions | Portal dashboard section | P1 | Reusable quick-action tiles |
| /var/opt/ui/src/pages/portal/components/ActiveAssets.tsx | internal | Assistant status list + embed/chat modals | Portal dashboard section | P1 | Split modal pieces into reusable components |

---

## C) Admin Section (single admin surface)

| Source File | Source Route(s) | Feature | Target Route | Priority | Notes |
|---|---|---|---|---|---|
| /var/opt/ui/src/pages/Dashboard.tsx | /admin/dashboard | Admin KPI and overview | /admin/dashboard | P0 | Must be first admin page migrated |
| /var/opt/ui/src/pages/Clients.tsx | /admin/workspaces | Workspace listing + filters | /admin/workspaces | P0 | Use DataTable + server filters |
| /var/opt/ui/src/pages/ClientDetail.tsx | /admin/workspaces/:deviceId | Workspace detail and agents | /admin/workspaces/:deviceId | P0 | Preserve copy ID and endpoint inventory UX |
| /var/opt/ui/src/pages/admin/ActivationKeys.tsx | /admin/activation-keys | Activation key CRUD | /admin/activation-keys | P0 | Keep generate/revoke workflow |
| /var/opt/ui/src/pages/admin/SubscriptionPlanManagement.tsx | /admin/subscriptions | Plan CRUD and feature matrix | /admin/subscriptions | P0 | Backend subscription plan CRUD endpoints required |
| /var/opt/ui/src/pages/admin/Credits.tsx | /admin/credits | Team balances and adjustments | /admin/credits | P0 | Depends on /admin/credits APIs |
| /var/opt/ui/src/pages/admin/CreditPackages.tsx | /admin/packages | Credit package CRUD | /admin/packages | P0 | Depends on /admin/credits/packages |
| /var/opt/ui/src/pages/admin/Pricing.tsx | /admin/pricing | Request cost rules | /admin/pricing | P0 | Depends on /admin/credits/pricing |
| /var/opt/ui/src/pages/admin/Configuration.tsx | /admin/config | Payment/AI/system configuration | /admin/config | P0 | Depends on /admin/config/* |
| /var/opt/ui/src/components/AdminLayout.tsx | /admin/* shell | Admin nav and layout | /admin/* layout | P0 | Becomes canonical admin shell in target |

---

## D) Existing Target Admin Surfaces to Merge Under /admin/*

These already exist in /var/opt/frontend and must be placed under admin namespace:

| Existing Target File | Current Route | New Route |
|---|---|---|
| /var/opt/frontend/src/pages/system/Users.tsx | /system/users (and /users legacy) | /admin/system/users |
| /var/opt/frontend/src/pages/system/Roles.tsx | /system/roles (and /roles legacy) | /admin/system/roles |
| /var/opt/frontend/src/pages/system/Permissions.tsx | /system/permissions (and /permissions legacy) | /admin/system/permissions |
| /var/opt/frontend/src/pages/system/SystemSettings.tsx | /system/settings (and /system-settings legacy) | /admin/system/settings |
| /var/opt/frontend/src/pages/Updates.tsx | /system/updates | /admin/system/updates |
| /var/opt/frontend/src/pages/Credentials.tsx | /credentials | /admin/credentials |

---

## E) API Contract Notes for Migration

1. Token key mismatch:
- source uses softaware_token
- target uses jwt_token

2. Assistant update endpoint mismatch:
- source UI calls PUT /assistants/:assistantId
- backend route currently exposes PUT /assistants/:assistantId/update

3. Portal credits auth mismatch:
- source expects bearer token experience
- backend /credits/balance and /credits/transactions currently use X-API-Key middleware

4. Subscription plan admin CRUD API:
- source UI has full admin plan management screen
- backend currently lacks explicit /admin/subscription-plans CRUD route set

---

## F) Migration Completion Definition

Matrix is considered complete when:
1. Every row above has a working target route/page.
2. All admin rows are only accessible under /admin/*.
3. Existing admin-like routes outside /admin/* redirect to admin namespace.
4. API mismatches in section E are resolved or adapter-mapped.
