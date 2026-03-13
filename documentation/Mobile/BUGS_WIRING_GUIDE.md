# Mobile App — Bugs Feature Wiring Guide

> **Created:** March 2026  
> **Purpose:** Step-by-step guide for wiring the Bugs (bug tracking) module into the React Native mobile app.  
> **Audience:** Mobile developer(s)  
> **Pre-requisite reading:** `opt/documentation/Bugs/` (full backend docs), `opt/documentation/Mobile/MOBILE_APP_REFERENCE.md` (app architecture)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Scope — What to Build vs Exclude](#2-scope)
3. [What Already Exists (Reuse These)](#3-what-already-exists)
4. [New Files to Create](#4-new-files-to-create)
5. [Files to Modify](#5-files-to-modify)
6. [TypeScript Types](#6-typescript-types)
7. [API Service — `api/bugs.ts`](#7-api-service)
8. [Push Notifications](#8-push-notifications)
9. [Navigation Changes](#9-navigation-changes)
10. [Screens](#10-screens)
11. [Reusable Components](#11-reusable-components)
12. [Offline & Caching](#12-offline--caching)
13. [API Reference (Quick)](#13-api-reference)
14. [Field Mapping & Gotchas](#14-field-mapping--gotchas)
15. [Implementation Checklist](#15-implementation-checklist)

---

## 1. Overview

The backend has 16 REST endpoints for bug tracking — all under `/bugs`. The web frontend is a single-file page (`Bugs.tsx`, ~1,477 LOC) with embedded components for list, detail, workflow, comments, attachments, and task association. The mobile app needs staff-facing bug management plus a lightweight portal user bug reporting flow.

**What Bugs does:**
- Staff/admins triage, assign, and track bugs through a 3-phase workflow: Intake → QA → Development
- External reporters can submit bugs without authentication (optional JWT)
- 6-status lifecycle: `open` → `in-progress` → `pending-qa` → `resolved` → `closed` (plus `reopened`)
- 4 severity levels: critical, high, medium, low
- Comment system — user comments + system-generated workflow/status comments
- File attachments — images, logs, screenshots (up to 10 files, 20MB each)
- Bidirectional task linking — link bugs to tasks, convert bugs ↔ tasks
- Dual-channel notifications: in-app + push (admins on create, participants on status/comment/workflow)
- Email notifications: branded HTML to reporter (if email-shaped name) and admins
- Software association — bugs linked to specific software products

**How Bugs differs from Cases:**
- Cases use UUID IDs and `{ success, data }` envelope → Bugs use **numeric auto-increment IDs** and `{ status: 1, data }` envelope
- Cases have `PATCH` for updates → Bugs use **`PUT`** for updates
- Cases have AI analysis, star ratings, activity log → Bugs have **workflow phases, task conversion, file attachments**
- Cases have user + admin route separation → Bugs have a **single route namespace** (`/bugs`) with optional auth
- Cases filter internal comments client-side → Bugs have the same `is_internal` flag on comments

---

## 2. Scope — What to Build vs Exclude

### ✅ Build for Mobile

| Feature | Route(s) | Who |
|---------|----------|-----|
| Report a new bug | `POST /bugs` | All users (optional auth) |
| View bug list | `GET /bugs` | Staff/admin |
| View bug statistics | `GET /bugs/stats` | Staff/admin |
| View bug detail + comments + attachments | `GET /bugs/:id` | Staff/admin |
| Update bug (status, severity, assignment) | `PUT /bugs/:id` | Staff/admin |
| Add comment | `POST /bugs/:id/comments` | Staff/admin |
| Upload attachments | `POST /bugs/:id/attachments` | Staff/admin |
| Download/view attachment | `GET /bugs/:id/attachments/:attId/download` | All |
| Advance workflow phase | `PUT /bugs/:id/workflow` | Staff/admin |
| Assign bug | `PUT /bugs/:id/assign` | Staff/admin |
| Delete bug | `DELETE /bugs/:id` | Admin only |

### ❌ Exclude from Mobile

| Feature | Why |
|---------|-----|
| Link/unlink task (`PUT /:id/link-task`) | Complex task picker — use web |
| Convert bug → task (`POST /:id/convert-to-task`) | Task system integration — use web |
| Convert task → bug (`POST /from-task/:taskId`) | Task system integration — use web |
| Delete comment (`DELETE /:id/comments/:commentId`) | Low priority, use web |
| Delete attachment (`DELETE /:id/attachments/:attId`) | Low priority, use web |

**Effort estimate:** ~1,600–2,000 LOC across 7–9 new files + 4–5 modified files.

---

## 3. What Already Exists (Reuse These)

### HTTP Client
```
src/api/client.ts
```
Singleton with JWT auto-attach. All bug endpoints are under `/bugs`. The API client auto-unwraps the response, but **note:** bugs use a different envelope (`{ status: 1, data }`) than some other modules. See §14 for details.

### Auth Context
```
src/contexts/AuthContext.tsx
```
Provides `user`, `isStaff`, `isAdmin`, `isAdminOrStaff`, `hasPermission()`. Use for:
- Showing the Bugs tab only to staff/admin
- Showing delete action only to admins
- Pre-filling `reporter_name` and `created_by` from user profile
- Filtering internal comments for non-staff users

### Push Notifications
```
src/services/notifications.ts
src/services/notificationNavigation.ts
src/services/notificationChannels.ts
```
Backend sends push notifications for bug events. Notification types need to be wired into the navigation handler.

### Cached Fetch Hook
```
src/hooks/useCachedFetch.ts
```
Cache-first with AsyncStorage + configurable TTL. Use for bug list and stats. Returns `{ data, loading, error, refresh }`.

### UI Components
```
src/components/ui/AppCard.tsx          — card containers
src/components/ui/Badge.tsx            — status/severity badges
src/components/ui/FormControls.tsx     — AppTextInput, AppButton
src/components/ui/StateViews.tsx       — LoadingView, EmptyView, ErrorBanner
src/components/ui/GradientHeader.tsx   — screen header with gradient
src/components/ui/PaginatedList.tsx    — FlatList with pull-to-refresh + load-more
src/components/ui/Avatar.tsx           — user avatars for comment authors
src/components/ui/AttachmentPicker.tsx — bottom sheet for camera/gallery/document
src/components/ui/ImageLightbox.tsx    — full-screen image viewing
```

### Theme
```
src/theme/index.ts
```
Map web Tailwind colors to theme tokens:
- **Status:** Blue (open), Amber (in-progress), Indigo (pending-qa), Emerald (resolved), Gray (closed), Purple (reopened)
- **Severity:** Red (critical), Orange (high), Yellow (medium), Green (low)
- **Phases:** Blue (intake), Amber (QA), Green (development)

### Existing Similar Patterns
The **Cases** module (`screens/cases/`) follows a very similar pattern — list + detail + report screens with comments. Use it as your implementation reference for screen layout, navigation flow, and state management.

---

## 4. New Files to Create

| # | File | Purpose | Est. LOC |
|---|------|---------|----------|
| 1 | `src/types/bugs.ts` | TypeScript interfaces for bugs, comments, attachments | ~120 |
| 2 | `src/api/bugs.ts` | API service — 13 methods matching endpoints | ~180 |
| 3 | `src/constants/bugConfig.ts` | Status/severity/phase color + label configs | ~80 |
| 4 | `src/screens/bugs/BugsListScreen.tsx` | List view with filters, stats banner, FAB | ~450 |
| 5 | `src/screens/bugs/BugDetailScreen.tsx` | Detail view — info, comments, attachments, workflow | ~550 |
| 6 | `src/screens/bugs/ReportBugScreen.tsx` | Report form — title, description, severity, software | ~350 |
| 7 | `src/components/ui/BugCard.tsx` | Reusable card for bug list items | ~130 |

**Total new: ~1,860 LOC across 7 files**

---

## 5. Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `src/api/index.ts` | Re-export `bugsApi` |
| 2 | `src/services/notificationNavigation.ts` | Map `bug_created`, `bug_assigned`, `bug_updated`, `bug_resolved`, `bug_comment`, `bug_workflow` → screen navigation |
| 3 | `src/services/notificationChannels.ts` | Add `bugs` channel for Android |
| 4 | `src/navigation/types.ts` | Add `BugsStackParamList` with 3 screen params |
| 5 | `src/navigation/FeatureStacks.tsx` | Add `BugsStackNavigator` with 3 screens |
| 6 | `src/navigation/AdminTabNavigator.tsx` | Add Bugs tab (staff/admin only) |
| 7 | `src/components/navigation/DrawerContent.tsx` | Add "Bugs" drawer item |

---

## 6. TypeScript Types

Create `src/types/bugs.ts`:

```typescript
// ─── Enums / Unions ────────────────────────────────────────

export type BugStatus = 'open' | 'in-progress' | 'pending-qa' | 'resolved' | 'closed' | 'reopened';
export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BugPhase = 'intake' | 'qa' | 'development';
export type CommentType = 'comment' | 'workflow_change' | 'status_change' | 'resolution';

// ─── Core Interfaces ───────────────────────────────────────

export interface Bug {
  id: number;                       // ⚠️ Numeric auto-increment, NOT UUID
  title: string;
  description: string | null;
  current_behaviour: string | null;
  expected_behaviour: string | null;
  reporter_name: string;

  // Software association
  software_id: number | null;
  software_name: string | null;

  // Status & workflow
  status: BugStatus;
  severity: BugSeverity;
  workflow_phase: BugPhase;

  // Assignment
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by: string | null;         // UUID from JWT (null if unauthenticated)
  created_by_name: string | null;

  // Task association (display only on mobile)
  linked_task_id: number | null;
  converted_from_task: 0 | 1;
  converted_to_task: number | null;

  // Resolution
  resolution_notes: string | null;
  resolved_at: string | null;        // ISO 8601
  resolved_by: string | null;

  // Timestamps
  created_at: string;                // ISO 8601
  updated_at: string;

  // Computed fields (from list query)
  comment_count?: number;
  attachment_count?: number;
  last_comment?: string | null;
}

export interface BugComment {
  id: number;
  bug_id: number;
  author_name: string;
  author_id: string | null;
  content: string;
  is_internal: 0 | 1;                // ⚠️ MySQL tinyint, not boolean
  comment_type: CommentType;
  created_at: string;
  updated_at: string;
}

export interface BugAttachment {
  id: number;
  bug_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_path: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Linked Task (populated on detail endpoint) ────────────

export interface LinkedTask {
  id: number;
  title: string;
  status: string;
  workflow_phase: string;
  external_id: string;
}

// ─── Payloads ──────────────────────────────────────────────

export interface CreateBugPayload {
  title: string;                     // Required
  reporter_name: string;             // Required
  description?: string;
  current_behaviour?: string;
  expected_behaviour?: string;
  software_id?: number;
  software_name?: string;
  severity?: BugSeverity;            // Default: 'medium'
  assigned_to?: number;
  assigned_to_name?: string;
  created_by_name?: string;
}

export interface UpdateBugPayload {
  title?: string;
  description?: string;
  current_behaviour?: string;
  expected_behaviour?: string;
  reporter_name?: string;
  software_id?: number;
  software_name?: string;
  status?: BugStatus;
  severity?: BugSeverity;
  assigned_to?: number;
  assigned_to_name?: string;
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by?: string;
}

export interface AddCommentPayload {
  content: string;                   // Required
  author_name: string;               // Required
  is_internal?: boolean;             // Default: false
  comment_type?: CommentType;        // Default: 'comment'
}

// ─── Response Shapes ───────────────────────────────────────

export interface BugListResponse {
  bugs: Bug[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    has_next: boolean;
  };
}

export interface BugDetailResponse {
  bug: Bug & {
    comments: BugComment[];
    attachments: BugAttachment[];
    linked_task: LinkedTask | null;
  };
}

export interface BugStatsResponse {
  total: number;
  by_status: Record<string, number>;
  by_severity: Record<string, number>;
  by_phase: Record<string, number>;
  by_software: Record<string, number>;
}
```

---

## 7. API Service

Create `src/api/bugs.ts`. Follow the same pattern as `casesApi` and other API modules.

```typescript
import api from './client';
import type {
  Bug,
  BugListResponse,
  BugDetailResponse,
  BugStatsResponse,
  CreateBugPayload,
  UpdateBugPayload,
  AddCommentPayload,
  BugComment,
  BugAttachment,
} from '../types/bugs';

export const bugsApi = {

  // ─── List & Stats ────────────────────────────────────────

  /**
   * List bugs (paginated, filterable).
   * ⚠️ Response envelope is { status: 1, data: { bugs, pagination } }
   *    The API client unwraps `data`, so you get { bugs, pagination }.
   */
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    severity?: string;
    workflow_phase?: string;
    software_id?: number;
    assigned_to?: number;
    search?: string;
  }): Promise<BugListResponse> => {
    const query = new URLSearchParams();
    if (params?.page)           query.set('page', String(params.page));
    if (params?.limit)          query.set('limit', String(params.limit));
    if (params?.status)         query.set('status', params.status);
    if (params?.severity)       query.set('severity', params.severity);
    if (params?.workflow_phase) query.set('workflow_phase', params.workflow_phase);
    if (params?.software_id)    query.set('software_id', String(params.software_id));
    if (params?.assigned_to)    query.set('assigned_to', String(params.assigned_to));
    if (params?.search)         query.set('search', params.search);
    const qs = query.toString();
    const res = await api.get<any>(`/bugs${qs ? `?${qs}` : ''}`);
    return { bugs: res.bugs, pagination: res.pagination };
  },

  /** Bug statistics — counts by status, severity, phase, software. */
  stats: async (): Promise<BugStatsResponse> => {
    const res = await api.get<any>('/bugs/stats');
    return res;
  },

  // ─── CRUD ────────────────────────────────────────────────

  /** Get single bug with comments, attachments, and linked task. */
  getById: async (id: number): Promise<BugDetailResponse> => {
    const res = await api.get<any>(`/bugs/${id}`);
    return { bug: res.bug };
  },

  /** Create a new bug. Returns the created bug object. */
  create: async (payload: CreateBugPayload): Promise<Bug> => {
    const res = await api.post<any>('/bugs', payload);
    return res.bug;
  },

  /** Update a bug (partial update via PUT). */
  update: async (id: number, payload: UpdateBugPayload): Promise<Bug> => {
    const res = await api.put<any>(`/bugs/${id}`, payload);
    return res.bug;
  },

  /** Delete a bug (admin only). CASCADE deletes comments + attachments. */
  delete: async (id: number): Promise<void> => {
    await api.del(`/bugs/${id}`);
  },

  // ─── Comments ────────────────────────────────────────────

  /** Add a comment to a bug. */
  addComment: async (bugId: number, payload: AddCommentPayload): Promise<BugComment> => {
    const res = await api.post<any>(`/bugs/${bugId}/comments`, payload);
    return res.comment;
  },

  // ─── Attachments ─────────────────────────────────────────

  /**
   * Upload attachments to a bug.
   * Uses FormData — pass an array of file URIs.
   */
  uploadAttachments: async (
    bugId: number,
    fileUris: string[],
    uploadedBy?: string,
  ): Promise<BugAttachment[]> => {
    const formData = new FormData();
    for (const uri of fileUris) {
      const filename = uri.split('/').pop() || 'file';
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', pdf: 'application/pdf', txt: 'text/plain',
      };
      formData.append('files', {
        uri,
        type: mimeMap[ext] || 'application/octet-stream',
        name: filename,
      } as any);
    }
    if (uploadedBy) formData.append('uploaded_by', uploadedBy);
    const res = await api.upload<any>(`/bugs/${bugId}/attachments`, formData);
    return res.attachments;
  },

  /**
   * Get the download URL for an attachment.
   * ⚠️ This endpoint is PUBLIC — no auth required.
   */
  getAttachmentUrl: (bugId: number, attachmentId: number): string => {
    return `https://api.softaware.net.za/bugs/${bugId}/attachments/${attachmentId}/download`;
  },

  // ─── Workflow ────────────────────────────────────────────

  /** Advance workflow phase. Does NOT change status (since v1.3.0). */
  updateWorkflow: async (
    bugId: number,
    phase: 'intake' | 'qa' | 'development',
    userName?: string,
  ): Promise<Bug> => {
    const res = await api.put<any>(`/bugs/${bugId}/workflow`, {
      workflow_phase: phase,
      user_name: userName,
    });
    return res.bug;
  },

  // ─── Assignment ──────────────────────────────────────────

  /** Assign or unassign a bug. Pass null to unassign. */
  assign: async (
    bugId: number,
    assignedTo: number | null,
    assignedToName: string | null,
    userName?: string,
  ): Promise<Bug> => {
    const res = await api.put<any>(`/bugs/${bugId}/assign`, {
      assigned_to: assignedTo,
      assigned_to_name: assignedToName,
      user_name: userName,
    });
    return res.bug;
  },
};
```

Then re-export from `src/api/index.ts`:

```typescript
export { bugsApi } from './bugs';
```

---

## 8. Push Notifications

The backend sends push notifications via `notificationService` for bug events. These arrive as FCM pushes with a `type` field in the data payload.

### Notification Types

| Backend Event | Push `data.type` | Who Receives | When |
|---------------|-----------------|-------------|------|
| Bug created | `bug_created` | All admins | Reporter submits a new bug |
| Bug assigned | `bug_assigned` | Assignee | Admin assigns bug to staff |
| Status changed | `bug_updated` | `created_by` + `assigned_to` | Status changed (not resolved) |
| Bug resolved | `bug_resolved` | `created_by` | Status changed to resolved/closed |
| Comment added | `bug_comment` | `created_by` + `assigned_to` | Non-internal user comment |
| Workflow changed | `bug_workflow` | `created_by` + `assigned_to` | Phase transition |

**Payload shape** (all bug notifications include):
```json
{
  "type": "bug_created",
  "bugId": "42",
  "title": "New Critical Bug: Login page crashes",
  "body": "john@example.com reported a bug in Client Portal",
  "action_url": "/bugs",
  "link": "/bugs"
}
```

> **⚠️ Note:** `bugId` is a **string** in the push payload (all FCM data values are strings). Parse to number when navigating: `Number(data.bugId)`.

### Changes to `notificationNavigation.ts`

Add to the `resolveNotificationRoute()` switch:

```typescript
case 'bug_created':
case 'bug_assigned':
case 'bug_updated':
case 'bug_resolved':
case 'bug_comment':
case 'bug_workflow':
  return {
    tab: 'BugsTab',
    stack: 'BugsStack',
    screen: data.bugId ? 'BugDetail' : 'BugsList',
    params: data.bugId ? { bugId: Number(data.bugId) } : undefined,
  };
```

### Foreground Handling

In the foreground push handler (same pattern as Cases):

```typescript
const BUG_TYPES = ['bug_created', 'bug_assigned', 'bug_updated', 'bug_resolved', 'bug_comment', 'bug_workflow'];

if (BUG_TYPES.includes(data.type)) {
  Toast.show({
    type: data.type === 'bug_resolved' ? 'success' : 'info',
    text1: notification.title,
    text2: notification.body,
    onPress: () => {
      navigationRef.navigate('BugsTab', {
        screen: 'BugDetail',
        params: { bugId: Number(data.bugId) },
      });
    },
  });
  return;
}
```

### Android Notification Channel

Add to `notificationChannels.ts`:

```typescript
// In getChannelForType():
case 'bug_created':
case 'bug_assigned':
case 'bug_updated':
case 'bug_resolved':
case 'bug_comment':
case 'bug_workflow':
  return 'bugs';

// In createChannels():
{
  id: 'bugs',
  name: 'Bug Reports',
  description: 'Bug tracking notifications',
  importance: 4,  // HIGH
}
```

---

## 9. Navigation Changes

### `src/navigation/types.ts` — Add param types

```typescript
export type BugsStackParamList = {
  BugsList: undefined;
  BugDetail: { bugId: number };
  ReportBug: undefined;
};
```

### `src/navigation/FeatureStacks.tsx` — Add BugsStack

```typescript
import { BugsListScreen } from '../screens/bugs/BugsListScreen';
import { BugDetailScreen } from '../screens/bugs/BugDetailScreen';
import { ReportBugScreen } from '../screens/bugs/ReportBugScreen';

const BugsStack = createNativeStackNavigator<BugsStackParamList>();

export function BugsStackNavigator() {
  return (
    <BugsStack.Navigator screenOptions={{ headerShown: false }}>
      <BugsStack.Screen name="BugsList" component={BugsListScreen} />
      <BugsStack.Screen name="BugDetail" component={BugDetailScreen} />
      <BugsStack.Screen name="ReportBug" component={ReportBugScreen} />
    </BugsStack.Navigator>
  );
}
```

### `AdminTabNavigator.tsx` — Add Bugs Tab

Add a Bugs tab for staff/admin users. Position it after Tasks (or Cases):

```typescript
<Tab.Screen
  name="BugsTab"
  component={BugsStackNavigator}
  options={{
    tabBarLabel: 'Bugs',
    tabBarIcon: ({ color, size }) => (
      <MaterialCommunityIcons name="bug-outline" color={color} size={size} />
    ),
  }}
/>
```

> **Icon:** Use `bug-outline` from MaterialCommunityIcons. Check [materialdesignicons.com](https://materialdesignicons.com) — search "bug".

### Portal Users

Portal users should **not** see the full Bugs tab. Instead, add a "Report a Bug" card on the PortalDashboard screen that navigates directly to `ReportBug`:

```typescript
navigation.navigate('BugsTab', { screen: 'ReportBug' });
```

### Navigation Flow

```
Staff/Admin Flow:
  BugsTab (bottom tab)
    → BugsList (with filters, stats, severity-sorted)
       → Tap card → BugDetail (comments, attachments, workflow)
       → FAB "+" → ReportBug
          → Submit → navigates back to BugsList

Portal User Flow:
  PortalDashboard → "Report a Bug" card → ReportBug
    → Submit → navigates back or shows success toast

Deep Link (push notification):
  FCM push → resolveNotificationRoute() → BugsTab → BugDetail({ bugId })
```

### Deep Linking

Add to `App.tsx` linking config:

```typescript
BugsTab: {
  screens: {
    BugsList: 'bugs',
    BugDetail: 'bugs/:bugId',
    ReportBug: 'bugs/report',
  },
},
```

---

## 10. Screens

### 10.1 `BugsListScreen` (~450 LOC)

**Entry points:** Bugs tab (staff), notification deep-link.

**Layout:**
```
┌──────────────────────────────────┐
│  GradientHeader                  │
│  "Bugs"                     [+]  │
├──────────────────────────────────┤
│  Stats Banner:                   │
│  42 total · 15 open · 3 critical│
├──────────────────────────────────┤
│  Filters (horizontal scroll):   │
│  [All ▾ Status] [All ▾ Severity]│
│  [All ▾ Phase]  [🔍 Search...]  │
├──────────────────────────────────┤
│  ┌─ BugCard ──────────────────┐ │
│  │ 🔴 #42                     │ │
│  │ Login page crashes on mobile│ │
│  │ Critical · Intake · Open   │ │
│  │ 3 💬 · 1 📎 · 2 days ago  │ │
│  │ Reporter: john@example.com │ │
│  │ → Assigned to: Jane Smith  │ │
│  └────────────────────────────┘ │
│  ┌─ BugCard ──────────────────┐ │
│  │ 🟡 #43                     │ │
│  │ Slow page load on dashboard │ │
│  │ Medium · Development ·      │ │
│  │   In Progress               │ │
│  │ 0 💬 · 0 📎 · 5 hours ago │ │
│  └────────────────────────────┘ │
│         ...                      │
│  [Load more...]                  │
├──────────────────────────────────┤
│  EmptyView if no bugs            │
│  "No bugs found"                 │
└──────────────────────────────────┘
```

**Data fetching:**

```typescript
const [page, setPage] = useState(1);
const [statusFilter, setStatusFilter] = useState<string>('');
const [severityFilter, setSeverityFilter] = useState<string>('');
const [phaseFilter, setPhaseFilter] = useState<string>('');
const [search, setSearch] = useState('');

// Bug list — paginated
const fetchBugs = useCallback(() => {
  return bugsApi.list({
    page,
    limit: 30,
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
    workflow_phase: phaseFilter || undefined,
    search: search || undefined,
  });
}, [page, statusFilter, severityFilter, phaseFilter, search]);

const { data, loading, error, refresh } = useCachedFetch<BugListResponse>(
  `bugs-list-${statusFilter}-${severityFilter}-${phaseFilter}-${search}-p${page}`,
  fetchBugs,
  { ttl: 2 * 60_000 }
);

// Stats — separate call
const { data: stats } = useCachedFetch<BugStatsResponse>(
  'bugs-stats',
  bugsApi.stats,
  { ttl: 5 * 60_000 }
);
```

**Default phase filter (match web behaviour):**

```typescript
const { user } = useAuth();

// Set default phase filter based on user role (same logic as web)
const getDefaultPhase = (): string => {
  const role = user?.role?.slug || user?.role_name || '';
  switch (role.toLowerCase()) {
    case 'developer':      return 'development';
    case 'qa_specialist':  return 'qa';       // maps to 'quality_review' on web, 'qa' API value
    case 'client_manager': return 'intake';
    default:               return '';           // '' = all
  }
};

const [phaseFilter, setPhaseFilter] = useState<string>(getDefaultPhase);
```

**Filter dropdowns:**

```typescript
const STATUS_OPTIONS = [
  { label: 'All Statuses', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Pending QA', value: 'pending-qa' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
  { label: 'Reopened', value: 'reopened' },
];

const SEVERITY_OPTIONS = [
  { label: 'All Severities', value: '' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const PHASE_OPTIONS = [
  { label: 'All Phases', value: '' },
  { label: 'Intake', value: 'intake' },
  { label: 'QA', value: 'qa' },
  { label: 'Development', value: 'development' },
];
```

**Stats banner:**

Show a row of stat pills above the list using data from `bugsApi.stats()`:

```typescript
<View style={styles.statsBanner}>
  <StatPill label="Total" value={stats?.total} />
  <StatPill label="Open" value={stats?.by_status?.open} color={Semantic.info} />
  <StatPill label="Active" value={stats?.by_status?.['in-progress']} color={Semantic.warning} />
  <StatPill label="Critical" value={stats?.by_severity?.critical} color={Semantic.error} />
  <StatPill label="Resolved" value={stats?.by_status?.resolved} color={Semantic.success} />
</View>
```

**Sorting note:** The backend already sorts by severity (critical first) then `created_at DESC`. No client-side sorting needed.

---

### 10.2 `BugDetailScreen` (~550 LOC)

**Entry points:** Tap on BugCard, push notification deep-link.

**Route params:** `{ bugId: number }`

**Layout:**
```
┌──────────────────────────────────┐
│  GradientHeader                  │
│  "Bug #42"             [⋮ Menu]  │
├──────────────────────────────────┤
│  Severity Badge: 🔴 Critical    │
│  Title: Login page crashes...    │
│  Status: [Open ▾]  Phase: [Intake ▾]│
│  Software: Client Portal        │
│  Reporter: john@example.com     │
│  Assigned: Jane Smith            │
│  Created: 2 days ago             │
├──────────────────────────────────┤
│  [Details] [Comments] [Attach.]  │  ← Segmented tabs
├──────────────────────────────────┤
│                                  │
│  ── Details Tab ──               │
│  Description: ...                │
│  Current Behaviour: ...          │
│  Expected Behaviour: ...         │
│  Resolution Notes: ...           │
│                                  │
│  ── Comments Tab ──              │
│  ┌─ Comment ─────────────────┐  │
│  │ 🤖 System · 2 days ago    │  │
│  │ Bug reported and entered  │  │
│  │ Intake phase.             │  │
│  └───────────────────────────┘  │
│  ┌─ Comment ─────────────────┐  │
│  │ 👤 Jane Smith · 1 day ago │  │
│  │ I can reproduce this on   │  │
│  │ Chrome too.               │  │
│  └───────────────────────────┘  │
│  [Type a comment...] [Send]     │
│                                  │
│  ── Attachments Tab ──           │
│  ┌─ Image grid ──────────────┐  │
│  │ [thumb1] [thumb2] [thumb3]│  │
│  └───────────────────────────┘  │
│  ┌─ File ────────────────────┐  │
│  │ 📄 log.txt · 12 KB  [⬇]  │  │
│  └───────────────────────────┘  │
│  [+ Upload Attachment]           │
│                                  │
│  ── Task Link (if present) ──   │
│  📋 Linked: Task #200 - ...    │
│  🔄 Converted to task           │
├──────────────────────────────────┤
│  [Workflow ▾] [Assign ▾] [🗑]  │  ← Staff action bar
└──────────────────────────────────┘
```

**Data fetching:**

```typescript
const { bugId } = route.params;
const [bug, setBug] = useState<BugDetailResponse['bug'] | null>(null);
const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'attachments'>('details');

const loadBug = useCallback(async () => {
  setLoading(true);
  try {
    const res = await bugsApi.getById(bugId);
    setBug(res.bug);
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Failed to load bug');
  } finally {
    setLoading(false);
  }
}, [bugId]);

useEffect(() => { loadBug(); }, [loadBug]);
```

**Workflow phase picker (bottom sheet or ActionSheet):**

```typescript
const handleWorkflowChange = async (newPhase: BugPhase) => {
  try {
    await bugsApi.updateWorkflow(bugId, newPhase, userName);
    Toast.show({ type: 'success', text1: `Phase changed to ${newPhase}` });
    loadBug();  // Refresh
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Failed to update phase');
  }
};
```

> **⚠️ Important:** Workflow phase change does NOT update bug status (since v1.3.0). Status and phase are independent. Show them as two separate controls.

**Status change (inline dropdown or ActionSheet):**

```typescript
const handleStatusChange = async (newStatus: BugStatus) => {
  try {
    const payload: UpdateBugPayload = { status: newStatus };
    // If resolving, prompt for resolution notes
    if (newStatus === 'resolved') {
      payload.resolved_at = new Date().toISOString();
      payload.resolved_by = userName;
      // Optionally prompt for resolution_notes via Alert.prompt or modal
    }
    await bugsApi.update(bugId, payload);
    Toast.show({ type: 'success', text1: `Status changed to ${newStatus}` });
    loadBug();
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Failed to update status');
  }
};
```

**Comment input:**

```typescript
const [commentText, setCommentText] = useState('');
const [isInternal, setIsInternal] = useState(false);
const [sendingComment, setSendingComment] = useState(false);

const handleAddComment = async () => {
  if (!commentText.trim()) return;
  setSendingComment(true);
  try {
    await bugsApi.addComment(bugId, {
      content: commentText.trim(),
      author_name: userName,
      is_internal: isInternal,
    });
    setCommentText('');
    loadBug();  // Refresh to show new comment
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Failed to add comment');
  } finally {
    setSendingComment(false);
  }
};
```

**Comment display — filter system vs user comments:**

```typescript
const userComments = bug.comments.filter(c => c.comment_type === 'comment');
const allComments = bug.comments; // Include system comments for full timeline

// Optionally add a toggle: "Show system comments"
// Staff can see is_internal=1 comments; non-staff should filter them out:
const visibleComments = isAdminOrStaff
  ? allComments
  : allComments.filter(c => !c.is_internal);
```

**Attachment viewer:**

```typescript
// Images — show thumbnails, tap for lightbox
const images = bug.attachments.filter(a => a.mime_type.startsWith('image/'));
const files = bug.attachments.filter(a => !a.mime_type.startsWith('image/'));

// Attachment URLs are PUBLIC (no auth needed):
const imageUrl = bugsApi.getAttachmentUrl(bugId, attachment.id);
// Use directly in <Image source={{ uri: imageUrl }} />

// File download:
import { downloadFile } from '../../utils/fileDownload';
const handleDownload = (att: BugAttachment) => {
  downloadFile(bugsApi.getAttachmentUrl(bugId, att.id), att.original_name);
};
```

> **⚠️ Note:** Unlike Cases attachments, bug attachment downloads are **public** — no Bearer token or blob URL workaround needed. Use the URL directly for `<Image>` sources and file downloads.

**Attachment upload (from attachments tab):**

```typescript
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';

const handleUploadAttachment = async () => {
  // Use AttachmentPicker component or ActionSheet to pick camera/gallery/document
  const result = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10 });
  if (result.assets) {
    const uris = result.assets.map(a => a.uri!).filter(Boolean);
    try {
      await bugsApi.uploadAttachments(bugId, uris, userName);
      Toast.show({ type: 'success', text1: 'Attachments uploaded' });
      loadBug();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Upload failed');
    }
  }
};
```

**Overflow menu (header `⋮`):**

```typescript
const menuItems = [
  { label: 'Refresh', onPress: loadBug },
  ...(isAdminOrStaff ? [
    { label: 'Assign', onPress: showAssignSheet },
    { label: 'Change Phase', onPress: showWorkflowSheet },
  ] : []),
  ...(isAdmin ? [
    { label: 'Delete Bug', onPress: confirmDelete, destructive: true },
  ] : []),
];
```

---

### 10.3 `ReportBugScreen` (~350 LOC)

**Entry points:** FAB on BugsListScreen, PortalDashboard "Report a Bug" card.

**Layout:**
```
┌──────────────────────────────────┐
│  GradientHeader                  │
│  "Report a Bug"         [Cancel] │
├──────────────────────────────────┤
│                                  │
│  Title *                         │
│  [______________________________]│
│                                  │
│  Description                     │
│  [______________________________]│
│  [                              ]│
│  [______________________________]│
│                                  │
│  Current Behaviour               │
│  [______________________________]│
│                                  │
│  Expected Behaviour              │
│  [______________________________]│
│                                  │
│  Severity                        │
│  [Medium ▾]                      │
│                                  │
│  Software                        │
│  [Select software ▾]            │
│                                  │
│  [    Submit Bug Report    ]     │
│                                  │
└──────────────────────────────────┘
```

**Pre-filled fields:**

```typescript
const { user } = useAuth();
const userName = user
  ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
  : '';

// Pre-fill reporter from logged-in user
const [form, setForm] = useState<CreateBugPayload>({
  title: '',
  reporter_name: userName,
  description: '',
  current_behaviour: '',
  expected_behaviour: '',
  severity: 'medium',
  software_id: undefined,
  software_name: undefined,
  created_by_name: userName,
});
```

**Software dropdown:**

Fetch available software via the existing `softwareApi`:

```typescript
import { softwareApi } from '../../api';

const [softwareList, setSoftwareList] = useState<Array<{ id: number; name: string }>>([]);

useEffect(() => {
  softwareApi.list().then(setSoftwareList).catch(() => {});
}, []);
```

**Submit handler:**

```typescript
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async () => {
  if (!form.title.trim()) {
    Alert.alert('Required', 'Title is required');
    return;
  }
  if (!form.reporter_name.trim()) {
    Alert.alert('Required', 'Reporter name is required');
    return;
  }
  setSubmitting(true);
  try {
    const bug = await bugsApi.create(form);
    Toast.show({ type: 'success', text1: `Bug #${bug.id} reported` });
    navigation.goBack();
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Failed to report bug');
  } finally {
    setSubmitting(false);
  }
};
```

**Severity picker (chips or dropdown):**

```typescript
const SEVERITY_OPTIONS: Array<{ value: BugSeverity; label: string; color: string }> = [
  { value: 'low',      label: 'Low',      color: Semantic.success.text },
  { value: 'medium',   label: 'Medium',   color: Semantic.warning.text },
  { value: 'high',     label: 'High',     color: '#EA580C' },  // Orange
  { value: 'critical', label: 'Critical', color: Semantic.error.text },
];
```

---

## 11. Reusable Components

### `BugCard` (~130 LOC)

Create `src/components/ui/BugCard.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Gray, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '../../theme';
import { Bug } from '../../types/bugs';
import { getBugSeverityConfig, getBugStatusConfig, getBugPhaseConfig } from '../../constants/bugConfig';
import { formatRelativeDate } from '../../utils/formatting';

interface BugCardProps {
  bug: Bug;
  onPress: () => void;
}

export function BugCard({ bug, onPress }: BugCardProps) {
  const severity = getBugSeverityConfig(bug.severity);
  const status = getBugStatusConfig(bug.status);
  const phase = getBugPhaseConfig(bug.workflow_phase);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.card, { borderLeftColor: severity.color, borderLeftWidth: 4 }]}
    >
      {/* Header row: severity badge + bug ID */}
      <View style={styles.headerRow}>
        <View style={[styles.severityBadge, { backgroundColor: severity.bg }]}>
          <Text style={[styles.severityText, { color: severity.text }]}>
            {severity.label}
          </Text>
        </View>
        <Text style={styles.bugId}>#{bug.id}</Text>
        {bug.converted_to_task && (
          <View style={styles.convertedBadge}>
            <Text style={styles.convertedText}>→ Task</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>{bug.title}</Text>

      {/* Meta row: phase + status */}
      <View style={styles.metaRow}>
        <View style={[styles.phaseBadge, { backgroundColor: phase.bg }]}>
          <MaterialCommunityIcons name={phase.icon} size={12} color={phase.text} />
          <Text style={[styles.phaseText, { color: phase.text }]}>{phase.label}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>

      {/* Footer row: comments, attachments, date, reporter */}
      <View style={styles.footerRow}>
        {(bug.comment_count || 0) > 0 && (
          <View style={styles.countBadge}>
            <MaterialCommunityIcons name="comment-outline" size={12} color={Gray[400]} />
            <Text style={styles.countText}>{bug.comment_count}</Text>
          </View>
        )}
        {(bug.attachment_count || 0) > 0 && (
          <View style={styles.countBadge}>
            <MaterialCommunityIcons name="paperclip" size={12} color={Gray[400]} />
            <Text style={styles.countText}>{bug.attachment_count}</Text>
          </View>
        )}
        <Text style={styles.dateText}>{formatRelativeDate(bug.created_at)}</Text>
      </View>

      {/* Reporter + assignee */}
      <Text style={styles.reporterText} numberOfLines={1}>
        {bug.reporter_name}
        {bug.assigned_to_name ? ` → ${bug.assigned_to_name}` : ''}
      </Text>
    </TouchableOpacity>
  );
}
```

### `bugConfig.ts` (~80 LOC)

Create `src/constants/bugConfig.ts`:

```typescript
import { Semantic, Primary, Gray } from '../theme';
import type { BugStatus, BugSeverity, BugPhase } from '../types/bugs';

interface ConfigItem {
  label: string;
  color: string;     // Border/accent color
  bg: string;        // Background
  text: string;      // Text color
  icon?: string;     // MaterialCommunityIcons name
}

// ─── Severity ──────────────────────────────────────────────

const SEVERITY_CONFIG: Record<BugSeverity, ConfigItem> = {
  critical: { label: 'Critical', color: '#EF4444', bg: '#FEE2E2', text: '#991B1B' },
  high:     { label: 'High',     color: '#F97316', bg: '#FFEDD5', text: '#9A3412' },
  medium:   { label: 'Medium',   color: '#EAB308', bg: '#FEF9C3', text: '#854D0E' },
  low:      { label: 'Low',      color: '#22C55E', bg: '#DCFCE7', text: '#166534' },
};

export function getBugSeverityConfig(severity: string): ConfigItem {
  return SEVERITY_CONFIG[severity as BugSeverity] || SEVERITY_CONFIG.medium;
}

// ─── Status ────────────────────────────────────────────────

const STATUS_CONFIG: Record<BugStatus, ConfigItem> = {
  'open':        { label: 'Open',        color: '#3B82F6', bg: '#DBEAFE', text: '#1E40AF' },
  'in-progress': { label: 'In Progress', color: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
  'pending-qa':  { label: 'Pending QA',  color: '#6366F1', bg: '#E0E7FF', text: '#3730A3' },
  'resolved':    { label: 'Resolved',    color: '#10B981', bg: '#D1FAE5', text: '#065F46' },
  'closed':      { label: 'Closed',      color: '#6B7280', bg: '#F3F4F6', text: '#374151' },
  'reopened':    { label: 'Reopened',     color: '#8B5CF6', bg: '#EDE9FE', text: '#5B21B6' },
};

export function getBugStatusConfig(status: string): ConfigItem {
  return STATUS_CONFIG[status as BugStatus] || STATUS_CONFIG.open;
}

// ─── Workflow Phase ────────────────────────────────────────

const PHASE_CONFIG: Record<BugPhase, ConfigItem> = {
  intake:      { label: 'Intake',      color: '#3B82F6', bg: '#DBEAFE', text: '#1E40AF', icon: 'inbox-arrow-down' },
  qa:          { label: 'QA',          color: '#F59E0B', bg: '#FEF3C7', text: '#92400E', icon: 'shield-check-outline' },
  development: { label: 'Development', color: '#10B981', bg: '#D1FAE5', text: '#065F46', icon: 'code-braces' },
};

export function getBugPhaseConfig(phase: string): ConfigItem {
  return PHASE_CONFIG[phase as BugPhase] || PHASE_CONFIG.intake;
}

// ─── Comment Type Icons ────────────────────────────────────

export const COMMENT_TYPE_ICON: Record<string, string> = {
  comment:         'comment-text-outline',
  workflow_change: 'swap-horizontal',
  status_change:   'sync',
  resolution:      'check-circle-outline',
};
```

---

## 12. Offline & Caching

### Read Caching (via `useCachedFetch`)

| Cache Key Pattern | TTL | Endpoint |
|---|---|---|
| `bugs-list-{status}-{severity}-{phase}-{search}-p{page}` | 2 min | `GET /bugs` |
| `bugs-stats` | 5 min | `GET /bugs/stats` |
| `bugs-detail-{id}` | 1 min | `GET /bugs/:id` |

### Write Operations

| Operation | Approach | Why |
|---|---|---|
| Report bug | Show loading on submit button. No offline queue. | User expects immediate bug ID |
| Add comment | Show loading. No offline queue. | Must be visible immediately |
| Status change | Show loading. Refresh detail on success. | Critical for audit trail |
| Workflow change | Show loading. Refresh detail on success. | Logged as system comment |
| Upload attachment | Show upload progress. No offline queue. | Large files need server storage |

### Cache Invalidation

After any write operation (create, update, comment, attachment upload), invalidate:
- `bugs-list-*` — all list caches
- `bugs-stats` — stats may have changed
- `bugs-detail-{id}` — the specific bug detail cache

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

async function invalidateBugCaches(bugId?: number): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const bugKeys = keys.filter(k => k.startsWith('bugs-list-') || k === 'bugs-stats');
  if (bugId) bugKeys.push(`bugs-detail-${bugId}`);
  if (bugKeys.length) await AsyncStorage.multiRemove(bugKeys);
}
```

---

## 13. API Reference (Quick)

All endpoints are under `https://api.softaware.net.za/bugs`.  
Auth: Optional JWT (`Authorization: Bearer <token>`). If present, `req.userId` is set.  
Envelope: `{ status: 1, message: "...", data: { ... } }`

### Bug CRUD

| # | Method | Path | Body | Response Data |
|---|--------|------|------|---------------|
| 1 | `GET` | `/bugs?status=&severity=&workflow_phase=&search=&page=&limit=` | — | `{ bugs[], pagination }` |
| 2 | `GET` | `/bugs/stats` | — | `{ total, by_status, by_severity, by_phase, by_software }` |
| 3 | `GET` | `/bugs/:id` | — | `{ bug: { ...fields, comments[], attachments[], linked_task? } }` |
| 4 | `POST` | `/bugs` | `CreateBugPayload` | `{ bug }` |
| 5 | `PUT` | `/bugs/:id` | `UpdateBugPayload` | `{ bug }` |
| 6 | `DELETE` | `/bugs/:id` | — | `{ message }` |

### Comments

| # | Method | Path | Body | Response Data |
|---|--------|------|------|---------------|
| 7 | `POST` | `/bugs/:id/comments` | `{ content, author_name, is_internal?, comment_type? }` | `{ comment }` |

### Attachments

| # | Method | Path | Body | Response Data |
|---|--------|------|------|---------------|
| 8 | `POST` | `/bugs/:id/attachments` | `FormData` (files + uploaded_by) | `{ attachments[] }` |
| 9 | `GET` | `/bugs/:id/attachments/:attId/download` | — | Binary file (no auth) |

### Workflow & Assignment

| # | Method | Path | Body | Response Data |
|---|--------|------|------|---------------|
| 10 | `PUT` | `/bugs/:id/workflow` | `{ workflow_phase, user_name? }` | `{ bug }` |
| 11 | `PUT` | `/bugs/:id/assign` | `{ assigned_to, assigned_to_name, user_name? }` | `{ bug }` |

### Status Values

| Value | Label | Color |
|-------|-------|-------|
| `open` | Open | Blue |
| `in-progress` | In Progress | Amber |
| `pending-qa` | Pending QA | Indigo |
| `resolved` | Resolved | Emerald |
| `closed` | Closed | Gray |
| `reopened` | Reopened | Purple |

### Severity Values

| Value | Label | Color |
|-------|-------|-------|
| `critical` | Critical | Red |
| `high` | High | Orange |
| `medium` | Medium | Yellow |
| `low` | Low | Green |

### Phase Values

| Value | Label | Effect on Status |
|-------|-------|------------------|
| `intake` | Intake | None (since v1.3.0) |
| `qa` | QA | None |
| `development` | Development | None |

### Error Shapes

```json
// Validation (400)
{ "status": 0, "message": "title and reporter_name are required" }

// Not found (404)
{ "status": 0, "message": "Bug not found" }

// Conflict (409 — already converted)
{ "status": 0, "message": "Bug already converted to a task", "data": { "task_id": 200 } }

// Server error (500)
{ "status": 0, "message": "<error.message>" }
```

---

## 14. Field Mapping & Gotchas

### Response Envelope Difference

⚠️ **Bugs use `{ status: 1, data }` NOT `{ success: true, data }`.**

The API client auto-unwraps responses, so you typically receive the `data` object directly. However, if you're handling raw responses or error checking, check for `status === 1` not `success === true`.

### Bug IDs Are Numbers

Unlike Cases (UUID strings), bug IDs are **numeric auto-increment integers**. Push notification payloads send them as **strings** (FCM limitation). Always parse: `Number(data.bugId)`.

### `is_internal` Is a MySQL Tinyint

The `is_internal` field on comments is `0` or `1`, **not** `true`/`false`. When sending, the backend accepts both (`boolean` or `0/1`). When receiving, always compare against `0`/`1`:

```typescript
// ✅ Correct
const isInternal = comment.is_internal === 1;

// ❌ Wrong — may fail
const isInternal = comment.is_internal === true;
```

### `converted_from_task` Is Also Tinyint

Same as above — `0` or `1`, not boolean.

### Comment Types

Not all comments are user-entered. The `comment_type` field tells you what generated it:

| `comment_type` | Source | Display Guidance |
|----------------|--------|------------------|
| `comment` | User-entered | Show with author avatar + name |
| `workflow_change` | System auto-generated | Show as system event (gray, no avatar) |
| `status_change` | System auto-generated | Show as system event |
| `resolution` | System auto-generated | Show as system event (green accent) |

Render system comments differently from user comments — smaller text, muted colors, system icon.

### Attachment URLs Are Public

The download endpoint `GET /bugs/:id/attachments/:attId/download` requires **no authentication**. You can use the URL directly as an `<Image>` source or for file downloads without any token/blob URL workaround.

### HTML in Description Fields

The `description`, `current_behaviour`, and `expected_behaviour` fields may contain HTML (from the web's rich text editor). On mobile, either:
- Strip HTML tags and show plain text: `text.replace(/<[^>]*>/g, '')`
- Use a `WebView` for rich rendering (heavier)
- Use a lightweight HTML renderer like `react-native-render-html` if already installed

### Software Dropdown Data

The software list comes from a separate endpoint (`GET /software` via `softwareApi`). This is the same endpoint used by the Tasks module. Cache it — the list changes rarely.

### Pagination

The list endpoint returns a `pagination` object:
```json
{ "page": 1, "limit": 50, "total": 42, "pages": 1, "has_next": false }
```
Use `has_next` to control the "Load more" button or infinite scroll trigger.

---

## 15. Implementation Checklist

### Phase 1 — Core (MVP)

- [ ] Create `src/types/bugs.ts` — interfaces and union types
- [ ] Create `src/api/bugs.ts` — 11 API methods
- [ ] Re-export from `src/api/index.ts`
- [ ] Create `src/constants/bugConfig.ts` — severity/status/phase configs
- [ ] Add `BugsStackParamList` to `src/navigation/types.ts`
- [ ] Add `BugsStackNavigator` to `src/navigation/FeatureStacks.tsx`
- [ ] Add Bugs tab to `AdminTabNavigator` (staff/admin only)
- [ ] Create `src/components/ui/BugCard.tsx` — list card component
- [ ] Create `src/screens/bugs/BugsListScreen.tsx` — list with filters + stats banner
- [ ] Create `src/screens/bugs/ReportBugScreen.tsx` — report form with severity + software picker
- [ ] Create `src/screens/bugs/BugDetailScreen.tsx` — detail with tabbed content

### Phase 2 — Staff Actions

- [ ] Add status change action on BugDetailScreen (staff only, ActionSheet)
- [ ] Add workflow phase change action on BugDetailScreen (staff only, ActionSheet)
- [ ] Add assignment action on BugDetailScreen (staff only, needs user picker)
- [ ] Add internal comment toggle (staff only, switch on comment input)
- [ ] Add delete action (admin only, with `Alert.alert` confirmation)
- [ ] Add overflow menu (⋮) on BugDetailScreen header

### Phase 3 — Attachments

- [ ] Show image thumbnails in attachment tab (direct URL, tap for lightbox)
- [ ] Show file list in attachment tab (name, size, download button)
- [ ] Upload attachments — integrate `AttachmentPicker` or `launchImageLibrary`
- [ ] File download via `fileDownload` utility
- [ ] Image lightbox via `ImageLightbox` or `ImageViewerModal`

### Phase 4 — Notifications & Polish

- [ ] Map 6 bug notification types in `notificationNavigation.ts`
- [ ] Add `bugs` channel to `notificationChannels.ts`
- [ ] Add foreground push handling for bug events (toast + navigate)
- [ ] Add deep linking config in `App.tsx`
- [ ] Add "Bugs" item to drawer menu in `DrawerContent.tsx`
- [ ] Add "Report a Bug" card on PortalDashboard (portal users)
- [ ] Add `useCachedFetch` caching for list + stats (TTL: 2 min / 5 min)
- [ ] Cache invalidation after write operations
- [ ] Role-based default phase filter on list screen
- [ ] Pull-to-refresh on list and detail screens
- [ ] Empty states, loading skeletons, error banners
- [ ] Infinite scroll / "Load more" pagination

### Testing Checkpoints

- [ ] Report a bug from mobile → verify it appears on web Bugs page
- [ ] Add a comment from mobile → verify it appears on web detail dialog
- [ ] Change status from mobile → verify push notification to creator
- [ ] Change workflow phase from mobile → verify status is NOT changed
- [ ] Upload attachment from mobile → verify it shows on web detail
- [ ] Tap push notification → deep-links to correct BugDetailScreen
- [ ] Staff sees all bugs on list → portal user only sees ReportBug
- [ ] Internal comment from staff → NOT visible to non-staff user
- [ ] Delete bug from mobile (admin) → verify it's gone on web
- [ ] Image attachment → tap thumbnail → lightbox opens
- [ ] File attachment → tap download → file saved on device
- [ ] Filter by severity "critical" → only critical bugs shown
- [ ] Filter by phase "development" → only development bugs shown
- [ ] Stats banner → numbers match web stats bar

---

## Appendix A: Mapping Web → Mobile

| Web Component | Mobile Equivalent | Notes |
|-------------|-----------------|-------|
| `BugsPage` (main component) | `BugsListScreen` | FlatList with BugCard instead of `<table>` |
| `BugTableRow` | `BugCard` | Card layout instead of table row |
| `BugStatsBar` | Stats banner (horizontal pills) | Same data from `/bugs/stats` |
| `BugDetailDialog` | `BugDetailScreen` | Full screen instead of modal dialog |
| `BugFormDialog` | `ReportBugScreen` | Full screen form |
| `WorkflowDialog` | ActionSheet/BottomSheet | Phase picker |
| `StatusSelect` | ActionSheet/BottomSheet | Status picker |
| `AttachmentImage` (blob URL) | Direct `<Image>` URL | No auth needed for downloads |
| `AttachmentFile` (blob URL) | Direct download | No auth needed |
| `LinkTaskDialog` | ❌ Not built | Use web |
| SweetAlert2 confirmations | `Alert.alert()` | React Native equivalent |
| `react-hot-toast` / `notify` | `Toast.show()` | Already used throughout app |
| `<select>` dropdowns | ActionSheet or BottomSheet | Native-feeling pickers |
| Phase filter (role-based) | Same logic in `useState` | Read user role, map to default phase |

---

## Appendix B: Related Documentation

| Document | Path | What It Covers |
|---------|------|---------------|
| Bugs full backend docs | `opt/documentation/Bugs/` | All 6 files: README, ROUTES, FIELDS, FILES, PATTERNS, CHANGES |
| Bugs API routes | `opt/documentation/Bugs/ROUTES.md` | Complete endpoint reference with curl examples |
| Bugs DB schema | `opt/documentation/Bugs/FIELDS.md` | Full table DDL + column details |
| Mobile app reference | `opt/documentation/Mobile/MOBILE_APP_REFERENCE.md` | App architecture, conventions, how-to guide |
| Cases wiring guide | `opt/documentation/Mobile/CASES_WIRING_GUIDE.md` | Similar module — use as implementation reference |
| App wiring status | `opt/documentation/Mobile/APP_WIRING_AND_STATUS.md` | Full app feature map |
