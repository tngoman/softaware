# Mobile App — Cases Feature Wiring Guide

> **Created:** March 2026  
> **Purpose:** Step-by-step guide for wiring the Cases (issue tracking) module into the React Native mobile app.  
> **Audience:** Mobile developer(s)  
> **Pre-requisite reading:** `opt/documentation/Cases/` (full backend docs), `opt/documentation/Mobile/APP_WIRING_AND_STATUS.md` (current app state)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Scope — What to Build vs Exclude](#2-scope)
3. [What Already Exists (Reuse These)](#3-what-already-exists)
4. [New Files to Create](#4-new-files-to-create)
5. [Files to Modify](#5-files-to-modify)
6. [TypeScript Types](#6-typescript-types)
7. [API Service — `api/cases.ts`](#7-api-service)
8. [Push Notifications](#8-push-notifications)
9. [Navigation Changes](#9-navigation-changes)
10. [Screens](#10-screens)
11. [Reusable Components](#11-reusable-components)
12. [Floating Report Button](#12-floating-report-button)
13. [Offline & Caching](#13-offline--caching)
14. [API Reference (Quick)](#14-api-reference)
15. [Field Mapping Gotchas](#15-field-mapping-gotchas)
16. [Implementation Checklist](#16-implementation-checklist)

---

## 1. Overview

The backend has 15 REST endpoints for case management — 6 user-facing (`/cases`) and 9 admin-only (`/admin/cases`). The web frontend has 4 pages: case list, detail, admin management, and admin analytics dashboard. The mobile app needs user-facing case screens and lightweight staff case management.

**What Cases does:**
- Users report bugs / issues with optional page context (URL, error message, stack trace)
- AI-powered component analysis on creation via `caseAnalyzer`
- Case lifecycle: `open` → `in_progress` → `resolved` → `closed` (also `waiting`, `wont_fix`)
- Comment threads — public (visible to reporter) and internal (staff-only)
- Activity audit trail for every state change
- User satisfaction ratings on resolved cases (1–5 stars)
- Notifications to admins on creation, to reporters on updates, to assignees on assignment
- Admin analytics, health monitoring, bulk operations (web-only — excluded from mobile)

**What the mobile app already has that Cases plugs into:**
- `api/client.ts` — HTTP client with JWT auto-attach (cases endpoints use the same auth)
- `AuthContext` — `user`, `isStaff`, `isAdmin`, `hasPermission()` for conditional UI
- `notifications.ts` — FCM push handler, already handles foreground + deep-linking
- `notificationNavigation.ts` — Maps notification types to nav routes
- `useCachedFetch` hook — Cache-first data fetch with AsyncStorage + TTL
- Full UI component library (AppCard, Badge, FormControls, StateViews, Avatar, etc.)
- SweetAlert2-style confirmations via `react-native-toast-message` and `Alert.alert()`

---

## 2. Scope — What to Build vs Exclude

Per the mobile app's design principle: **admin consoles, dashboards, and bulk operations are excluded from mobile.** Cases should focus on user-facing features and lightweight staff case management.

### ✅ Build for Mobile

| Feature | Route(s) | Who |
|---------|----------|-----|
| Report a new issue | `POST /cases` | All users |
| View my cases | `GET /cases` | All users |
| View case detail + comments + activity | `GET /cases/:id` | Reporter or staff |
| Update case (status, severity, assignment) | `PATCH /cases/:id` | Reporter or staff |
| Add comment (public or internal) | `POST /cases/:id/comments` | Reporter or staff |
| Rate resolved case | `POST /cases/:id/rate` | Reporter only |
| Staff: view all cases | `GET /admin/cases` | Staff/admin |
| Staff: delete a case | `DELETE /admin/cases/:id` | Admin only |

### ❌ Exclude from Mobile

| Feature | Why |
|---------|-----|
| Analytics dashboard (`GET /admin/cases/analytics`) | Admin console — use web |
| Health monitoring (`GET /admin/cases/health`, `POST .../run-checks`) | Ops console — use web |
| Team performance (`GET /admin/cases/team-performance`) | Admin report — use web |
| Bulk assign (`POST /admin/cases/bulk-assign`) | Bulk ops — use web |
| Bulk status update (`POST /admin/cases/bulk-update-status`) | Bulk ops — use web |
| Bulk delete (`POST /admin/cases/bulk-delete`) | Bulk ops — use web |

**Effort estimate:** ~1,400–1,800 LOC across 6–8 new files + 3–4 modified files.

---

## 3. What Already Exists (Reuse These)

### HTTP Client
```
src/api/client.ts
```
Singleton with JWT auto-attach. User routes are under `/cases`, staff routes under `/admin/cases`. Same auth pattern as all other API modules.

### Auth Context
```
src/contexts/AuthContext.tsx
```
Provides `user`, `isStaff`, `isAdmin` for conditional rendering (e.g., show internal comment toggle for staff, show "All Cases" tab for admins, show delete action for admins).

### Push Notifications
```
src/services/notifications.ts
src/services/chatNotificationHandler.ts
src/services/notificationNavigation.ts
```
The backend sends push notifications via `notificationService` for case events: `case_created`, `case_updated`, `case_assigned`, `case_comment`. These need handlers in the notification navigation.

### Cached Fetch Hook
```
src/hooks/useCachedFetch.ts
```
Cache-first with AsyncStorage + configurable TTL. Use for case lists. Returns `{ data, loading, error, refresh }`.

### UI Components
```
src/components/ui/AppCard.tsx          — card containers for case items
src/components/ui/Badge.tsx            — severity/status badges (9 color variants)
src/components/ui/FormControls.tsx     — AppTextInput, AppButton (5 variants, 3 sizes, loading)
src/components/ui/StateViews.tsx       — LoadingView, EmptyView, ErrorBanner
src/components/ui/GradientHeader.tsx   — screen header with gradient
src/components/ui/PaginatedList.tsx    — paginated FlatList with pull-to-refresh + load-more
src/components/ui/Avatar.tsx           — user avatars for comments/activity
```

### Theme
```
src/theme/index.ts
```
Full design token system with colors, spacing, typography. Map the web Tailwind colors to theme tokens:
- Status: blue (open), yellow (in_progress), purple (waiting), green (resolved), gray (closed/wont_fix)
- Severity: green (low), yellow (medium), orange (high), red (critical)

---

## 4. New Files to Create

| # | File | Purpose | Est. LOC |
|---|------|---------|----------|
| 1 | `src/api/cases.ts` | API service — 10 methods matching user + staff endpoints | ~130 |
| 2 | `src/types/cases.ts` | TypeScript interfaces for cases, comments, activity | ~100 |
| 3 | `src/screens/cases/CasesListScreen.tsx` | List view — my cases + staff "all cases" tab | ~400 |
| 4 | `src/screens/cases/CaseDetailScreen.tsx` | Detail view — info, comments, activity, rating | ~500 |
| 5 | `src/screens/cases/ReportCaseScreen.tsx` | Report form — title, description, severity, category | ~350 |
| 6 | `src/components/ui/CaseCard.tsx` | Reusable card for case list items | ~120 |
| 7 | `src/constants/caseConfig.ts` | Status/severity/category color + label configs | ~60 |

**Total new: ~1,660 LOC across 7 files**

---

## 5. Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `src/services/notificationNavigation.ts` | Map `case_created`, `case_updated`, `case_assigned`, `case_comment` → screen navigation |
| 2 | `src/navigation/FeatureStacks.tsx` | Add `CasesStack` with 3 screens, mount in AdminTabNavigator + PortalTabNavigator |
| 3 | `src/navigation/types.ts` | Add param types for new screens |
| 4 | `src/navigation/DrawerContent.tsx` | Add "Cases" / "Report Issue" menu items |
| 5 | `src/contexts/AppContext.tsx` | *(Optional)* Add `openCaseCount` for badge on nav tab |

---

## 6. TypeScript Types

Create `src/types/cases.ts`:

```typescript
// ─── Enums / Unions ────────────────────────────────────────

export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CaseStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed' | 'wont_fix';
export type CaseCategory = 'bug' | 'performance' | 'ui_issue' | 'data_issue' | 'security' | 'feature_request' | 'other';
export type CaseSource = 'user_report' | 'auto_detected' | 'health_monitor' | 'ai_analysis';

// ─── Core Interfaces ───────────────────────────────────────

export interface Case {
  id: string;                      // UUID
  case_number: string;             // "CASE-43391133"
  title: string;
  description: string | null;
  category: CaseCategory;
  severity: CaseSeverity;
  status: CaseStatus;
  source: CaseSource;
  component_name?: string;
  page_url?: string;               // ⚠️ Mapped from DB `url` by backend
  page_path?: string;
  error_message?: string;
  error_stack?: string;
  tags?: string[];
  resolution?: string;
  user_rating?: number;            // ⚠️ Mapped from DB `rating` by backend
  user_feedback?: string;          // ⚠️ Mapped from DB `rating_comment` by backend
  reported_by: string;
  assigned_to?: string;
  created_at: string;              // ISO 8601
  updated_at: string;
  resolved_at?: string;
  reporter_name?: string;
  reporter_email?: string;
  assignee_name?: string;
  assignee_email?: string;
  ai_analysis?: Record<string, any> | null;
  metadata?: Record<string, any>;
  browser_info?: Record<string, any>;
}

export interface CaseComment {
  id: string;
  case_id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  attachments: string[];
  user_name: string;
  created_at: string;
  updated_at: string;
}

export interface CaseActivity {
  id: string;
  case_id: string;
  user_id: string;
  action: 'created' | 'status_changed' | 'severity_changed' | 'assigned' | 'commented' | 'rated';
  old_value: string | null;
  new_value: string | null;
  user_name: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// ─── Payloads ──────────────────────────────────────────────

export interface CreateCasePayload {
  title: string;                   // 5–255 chars
  description?: string;
  category?: CaseCategory;         // default: 'other'
  severity?: CaseSeverity;         // default: 'medium'
  url?: string;                    // URL where issue occurred
  page_path?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface UpdateCasePayload {
  title?: string;
  description?: string;
  severity?: CaseSeverity;
  status?: CaseStatus;
  assigned_to?: string;            // UUID
  resolution?: string;
  tags?: string[];
}

export interface AddCommentPayload {
  comment: string;
  is_internal?: boolean;           // default: false
  // Attachments handled separately via FormData
}

// ─── Response Wrappers ─────────────────────────────────────

export interface CaseDetailResponse {
  case: Case;
  comments: CaseComment[];
  activity: CaseActivity[];
}

export interface AdminCaseListResponse {
  cases: Case[];
  stats: {
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    critical: number;
    auto_detected: number;
    avg_rating: number | null;
  };
}
```

---

## 7. API Service

Create `src/api/cases.ts`. Follow the same pattern as existing API modules.

```typescript
import client from './client';
import {
  Case,
  CreateCasePayload,
  UpdateCasePayload,
  CaseDetailResponse,
  AdminCaseListResponse,
} from '../types/cases';

const casesApi = {

  // ─── User-Facing Routes (/cases) ──────────────────────────

  /** Create a new case (any authenticated user). */
  create: async (payload: CreateCasePayload): Promise<Case> => {
    const res = await client.post('/cases', payload);
    return res.data.case;
  },

  /** List current user's own cases, optionally filtered by status. */
  getMyCases: async (params?: { status?: string }): Promise<Case[]> => {
    const query = params?.status ? `?status=${params.status}` : '';
    const res = await client.get(`/cases${query}`);
    return res.data.cases;
  },

  /** Get case detail with comments and activity. */
  getDetail: async (id: string): Promise<CaseDetailResponse> => {
    const res = await client.get(`/cases/${id}`);
    return {
      case: res.data.case,
      comments: res.data.comments,
      activity: res.data.activity,
    };
  },

  /** Update a case (reporter or admin). */
  update: async (id: string, payload: UpdateCasePayload): Promise<Case> => {
    const res = await client.patch(`/cases/${id}`, payload);
    return res.data.case;
  },

  /** Add a comment. For file attachments, use FormData. */
  addComment: async (
    id: string,
    comment: string,
    isInternal: boolean = false,
    attachmentUri?: string,
  ): Promise<any> => {
    if (attachmentUri) {
      // Use FormData for file upload
      const formData = new FormData();
      formData.append('comment', comment);
      formData.append('is_internal', String(isInternal));
      formData.append('file', {
        uri: attachmentUri,
        type: 'application/octet-stream',
        name: attachmentUri.split('/').pop() || 'attachment',
      } as any);
      const res = await client.post(`/cases/${id}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.comment;
    }
    // Text-only comment
    const res = await client.post(`/cases/${id}/comments`, {
      comment,
      is_internal: isInternal,
    });
    return res.data.comment;
  },

  /** Rate a resolved case (reporter only, 1–5 stars). */
  rate: async (id: string, rating: number, ratingComment?: string): Promise<void> => {
    await client.post(`/cases/${id}/rate`, {
      rating,
      rating_comment: ratingComment,
    });
  },

  // ─── Staff/Admin Routes (/admin/cases) ────────────────────

  /** List all cases with optional filters (admin only). */
  adminGetAll: async (params?: {
    status?: string;
    severity?: string;
    assigned_to?: string;
    search?: string;
  }): Promise<AdminCaseListResponse> => {
    const query = new URLSearchParams();
    if (params?.status)      query.set('status', params.status);
    if (params?.severity)    query.set('severity', params.severity);
    if (params?.assigned_to) query.set('assigned_to', params.assigned_to);
    if (params?.search)      query.set('search', params.search);
    const qs = query.toString();
    const res = await client.get(`/admin/cases${qs ? `?${qs}` : ''}`);
    return { cases: res.data.cases, stats: res.data.stats };
  },

  /** Delete a single case (admin only). */
  adminDelete: async (id: string): Promise<void> => {
    await client.delete(`/admin/cases/${id}`);
  },
};

export default casesApi;
```

---

## 8. Push Notifications

The backend sends notifications via `notificationService` for case events. These arrive as FCM pushes with a `type` field in the data payload.

### Notification Types

| Backend Event | Push `data.type` (likely) | Who Receives | When |
|---------------|--------------------------|-------------|------|
| Case created | `case_created` | All admins | User reports a new issue |
| Status changed | `case_updated` | Reporter | Admin changes status |
| Case assigned | `case_assigned` | Assignee | Admin assigns case to staff |
| Comment added | `case_comment` | Reporter | Staff adds a non-internal comment |

> **Note:** The exact `data.type` values depend on how `notificationService` formats them. Check the backend `notificationService.ts` for the actual payload shapes. The patterns above match the web frontend's notification handling.

### Changes to `notificationNavigation.ts`

```typescript
case 'case_created':
case 'case_updated':
case 'case_assigned':
case 'case_comment':
  // data.case_id should be in the push payload
  navigation.navigate('CasesTab', {
    screen: 'CaseDetail',
    params: { caseId: data.case_id },
  });
  break;
```

### Foreground Handling

Add to the existing FCM foreground handler (or `chatNotificationHandler.ts` if cases are handled there):

```typescript
if (['case_created', 'case_updated', 'case_assigned', 'case_comment'].includes(data.type)) {
  Toast.show({
    type: 'info',
    text1: notification.title,
    text2: notification.body,
    onPress: () => {
      navigationRef.navigate('CasesTab', {
        screen: 'CaseDetail',
        params: { caseId: data.case_id },
      });
    },
  });
  return;
}
```

---

## 9. Navigation Changes

### `src/navigation/types.ts` — Add param types

```typescript
// New stack:
export type CasesStackParamList = {
  CasesList: undefined;
  CaseDetail: { caseId: string };
  ReportCase: undefined;
};
```

### `src/navigation/FeatureStacks.tsx` — Add CasesStack

```typescript
const CasesStack = createNativeStackNavigator<CasesStackParamList>();

export function CasesStackNavigator() {
  return (
    <CasesStack.Navigator>
      <CasesStack.Screen
        name="CasesList"
        component={CasesListScreen}
        options={{ title: 'Cases' }}
      />
      <CasesStack.Screen
        name="CaseDetail"
        component={CaseDetailScreen}
        options={{ title: 'Case Details' }}
      />
      <CasesStack.Screen
        name="ReportCase"
        component={ReportCaseScreen}
        options={{ title: 'Report an Issue' }}
      />
    </CasesStack.Navigator>
  );
}
```

### Tab Navigator Integration

Cases should be accessible from both Staff and Portal tab navigators. Two options:

**Option A — Dedicated Tab (Recommended for Staff):**
```typescript
// In AdminTabNavigator:
<Tab.Screen
  name="CasesTab"
  component={CasesStackNavigator}
  options={{
    tabBarLabel: 'Cases',
    tabBarIcon: ({ color }) => <BugAntIcon color={color} size={24} />,
  }}
/>
```

**Option B — Via Dashboard (for Portal users):**
Add a "Report Issue" card on PortalDashboardScreen that navigates to `ReportCase`, and a "My Cases" card that navigates to `CasesList`.

### Navigation Flow

```
Staff Flow:
  CasesTab (bottom tab)
    → CasesList (with "My Cases" / "All Cases" tabs for staff)
       → Tap card → CaseDetail
       → FAB "+" → ReportCase
          → Submit → navigates back to CasesList

Portal User Flow:
  PortalDashboard → "Report Issue" card → ReportCase
  PortalDashboard → "My Cases" card → CasesList
    → Tap card → CaseDetail
```

### Drawer Menu

In `DrawerContent.tsx`, add a "Cases" menu item for staff and a "Report Issue" item for portal users.

---

## 10. Screens

### 10.1 `CasesListScreen` (~400 LOC)

**Entry points:** Cases tab (staff), PortalDashboard card (portal users), notification deep-link.

**Layout:**
```
┌─────────────────────────────┐
│  GradientHeader             │
│  "Cases"               [+]  │
├─────────────────────────────┤
│  [My Cases] [All Cases]     │  ← "All Cases" only visible to staff
├─────────────────────────────┤
│  Filters (collapsible):     │
│  Status: [All ▾]            │
│  Severity: [All ▾]          │
│  Search: [____________]     │  ← Only for "All Cases" tab (admin endpoint)
├─────────────────────────────┤
│  Stats banner (All Cases):  │
│  4 total · 0 open · 4 done │  ← From admin response stats
├─────────────────────────────┤
│  ┌─ CaseCard ─────────────┐ │
│  │ 🔴 CASE-43391133       │ │
│  │ Login button not working│ │
│  │ 🐛 Bug · High · Open   │ │
│  │ Reported 2 days ago     │ │
│  └────────────────────────┘ │
│  ┌─ CaseCard ─────────────┐ │
│  │ 🟢 CASE-43391134       │ │
│  │ Slow page load          │ │
│  │ ⚡ Performance · Med ·  │ │
│  │   Resolved ✓            │ │
│  └────────────────────────┘ │
│         ...                  │
├─────────────────────────────┤
│  EmptyView if no cases      │
│  "No cases found"           │
└─────────────────────────────┘
```

**Data fetching — dual mode:**
```typescript
const { isStaff } = useAuth();
const [tab, setTab] = useState<'mine' | 'all'>('mine');

// My Cases tab — user endpoint
const myCases = useCachedFetch<Case[]>(
  `cases-mine-${statusFilter}`,
  () => casesApi.getMyCases({ status: statusFilter || undefined }),
  { enabled: tab === 'mine', ttl: 2 * 60_000 }
);

// All Cases tab — admin endpoint (staff only)
const allCases = useCachedFetch<AdminCaseListResponse>(
  `cases-all-${statusFilter}-${severityFilter}-${search}`,
  () => casesApi.adminGetAll({
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
    search: search || undefined,
  }),
  { enabled: tab === 'all' && isStaff, ttl: 2 * 60_000 }
);
```

**Filter dropdowns:** Use `Picker` or a custom bottom-sheet select for status and severity filters.

**Status filter options:** `All`, `Open`, `In Progress`, `Waiting`, `Resolved`, `Closed`, `Won't Fix`

**Severity filter options:** `All`, `Low`, `Medium`, `High`, `Critical`

---

### 10.2 `CaseDetailScreen` (~500 LOC)

**Entry point:** Tap a card on CasesListScreen, notification deep-link.

**Params:** `{ caseId: string }`

**Layout:**
```
┌─────────────────────────────┐
│  GradientHeader             │
│  "CASE-43391133"    [···]   │  ← Menu: Edit Status, Assign, Delete (admin)
├─────────────────────────────┤
│  Status: 🔵 Open            │  ← Tappable for staff → status picker
│  Severity: 🔴 High          │  ← Tappable for staff → severity picker
│  Category: 🐛 Bug           │
│                              │
│  📝 Login button not working │
│  "When clicking the login    │
│   button on the homepage..." │
│                              │
│  👤 Reported by Admin        │
│  🗓 2 days ago               │
│  📍 /login                   │  ← page_path if present
│  🔧 Assigned to: John       │  ← or "Unassigned"
├─────────────────────────────┤
│  Resolution (if resolved):   │
│  "Fixed the click handler    │
│   binding..."                │
├─────────────────────────────┤
│  Tabs: [Comments] [Activity] │
├─────────────────────────────┤
│  Comments tab:               │
│  ┌──────────────────────┐   │
│  │ 👤 Admin · 1h ago    │   │
│  │ "I can reproduce this"│   │
│  │ 🔒 Internal          │   │  ← Only visible to staff
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │ 👤 John · 30m ago    │   │
│  │ "Working on it now"  │   │
│  └──────────────────────┘   │
│                              │
│  ┌─ Add Comment ──────────┐ │
│  │ [________________]     │ │
│  │ ☐ Internal (staff)  [↑]│ │  ← Internal toggle only for staff
│  └────────────────────────┘ │
├─────────────────────────────┤
│  Activity tab:               │
│  ● Created by Admin · 2d    │
│  ● Status: open → in_prog   │
│  ● Assigned to John · 1d    │
│  ● Comment by John · 30m    │
├─────────────────────────────┤
│  Rating (if resolved +       │
│          user is reporter):  │
│  ⭐⭐⭐⭐☆  Rate this fix    │
│  [Optional feedback______]  │
│  [Submit Rating]             │
│                              │
│  (if already rated):         │
│  ⭐⭐⭐⭐⭐  "Great fix!"    │
└─────────────────────────────┘
```

**Data fetching:**
```typescript
const [detail, setDetail] = useState<CaseDetailResponse | null>(null);
const [loading, setLoading] = useState(true);

const fetchDetail = async () => {
  try {
    const data = await casesApi.getDetail(caseId);
    setDetail(data);
  } catch (err: any) {
    if (err?.response?.status === 403) {
      Toast.show({ type: 'error', text1: 'Access denied' });
      navigation.goBack();
    }
  } finally {
    setLoading(false);
  }
};
```

**Status update (staff):**
```typescript
const handleStatusChange = async (newStatus: CaseStatus) => {
  try {
    const payload: UpdateCasePayload = { status: newStatus };
    // If resolving, prompt for resolution text
    if (newStatus === 'resolved' || newStatus === 'closed') {
      // Show a TextInput modal for resolution description
      payload.resolution = resolutionText;
    }
    await casesApi.update(caseId, payload);
    Toast.show({ type: 'success', text1: `Status updated to ${newStatus}` });
    fetchDetail(); // refresh
  } catch (err) {
    Toast.show({ type: 'error', text1: 'Failed to update status' });
  }
};
```

**Add comment:**
```typescript
const handleAddComment = async () => {
  if (!newComment.trim()) return;
  setSubmitting(true);
  try {
    await casesApi.addComment(caseId, newComment, isInternal);
    setNewComment('');
    fetchDetail(); // refresh comments
    Toast.show({ type: 'success', text1: 'Comment added' });
  } catch (err) {
    Toast.show({ type: 'error', text1: 'Failed to add comment' });
  } finally {
    setSubmitting(false);
  }
};
```

**Rate case (reporter only, resolved cases):**
```typescript
const canRate = detail.case.reported_by === user?.id
  && ['resolved', 'closed'].includes(detail.case.status)
  && !detail.case.user_rating;

const handleRate = async () => {
  try {
    await casesApi.rate(caseId, rating, feedback || undefined);
    Toast.show({ type: 'success', text1: 'Thank you for your feedback!' });
    fetchDetail();
  } catch (err) {
    Toast.show({ type: 'error', text1: 'Failed to submit rating' });
  }
};
```

**Star rating component:** Build a simple row of 5 `TouchableOpacity` stars:
```typescript
{[1, 2, 3, 4, 5].map((star) => (
  <TouchableOpacity key={star} onPress={() => setRating(star)}>
    <Text style={{ fontSize: 28, color: star <= (hoverRating || rating) ? '#f59e0b' : '#d1d5db' }}>
      ★
    </Text>
  </TouchableOpacity>
))}
```

**Delete (admin only):**
```typescript
const handleDelete = () => {
  Alert.alert('Delete Case', `Delete ${detail.case.case_number}? This cannot be undone.`, [
    { text: 'Cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try {
        await casesApi.adminDelete(caseId);
        Toast.show({ type: 'success', text1: 'Case deleted' });
        navigation.goBack();
      } catch (err) {
        Toast.show({ type: 'error', text1: 'Failed to delete case' });
      }
    }},
  ]);
};
```

---

### 10.3 `ReportCaseScreen` (~350 LOC)

**Entry points:** FAB on CasesListScreen, "Report Issue" card on PortalDashboard, floating button (see Section 12).

**Layout:**
```
┌─────────────────────────────┐
│  GradientHeader             │
│  "Report an Issue"          │
├─────────────────────────────┤
│  Title *      [____________]│  ← min 5 chars
│                              │
│  Description  [____________]│  ← multi-line TextInput
│               [            ]│
│               [____________]│
│                              │
│  Category     [Bug       ▾] │  ← Picker
│  Severity     [Medium    ▾] │  ← Picker
│                              │
│  Where did this happen?      │
│  URL          [____________]│  ← Optional
│  Page Path    [____________]│  ← Optional, auto-fill if from deep-link
│                              │
│  Error Details (optional)    │
│  Error Message [___________]│
│                              │
│  Tags         [login, auth ]│  ← Comma-separated or chip input
│                              │
│  [Report Issue]              │  ← AppButton primary
└─────────────────────────────┘
```

**Category picker options:**
| Value | Label | Icon |
|-------|-------|------|
| `bug` | Bug | 🐛 |
| `performance` | Performance | ⚡ |
| `ui_issue` | UI Issue | 🎨 |
| `data_issue` | Data Issue | 🛡️ |
| `security` | Security | 🔒 |
| `feature_request` | Feature Request | 💡 |
| `other` | Other | 🏷️ |

**Severity picker options:**
| Value | Label | Color |
|-------|-------|-------|
| `low` | Low | Green |
| `medium` | Medium (default) | Yellow |
| `high` | High | Orange |
| `critical` | Critical | Red |

**Submit:**
```typescript
const handleSubmit = async () => {
  if (title.trim().length < 5) {
    Toast.show({ type: 'error', text1: 'Title must be at least 5 characters' });
    return;
  }
  setSaving(true);
  try {
    const payload: CreateCasePayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      severity,
      url: url.trim() || undefined,
      page_path: pagePath.trim() || undefined,
      error_message: errorMessage.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
    const created = await casesApi.create(payload);
    Toast.show({ type: 'success', text1: `Case ${created.case_number} created` });
    navigation.goBack();
  } catch (err: any) {
    const msg = err?.response?.data?.error || 'Failed to create case';
    Alert.alert('Error', msg);
  } finally {
    setSaving(false);
  }
};
```

---

## 11. Reusable Components

### `CaseCard` (~120 LOC)

Renders a single case in a list. Used in `CasesListScreen`.

```typescript
interface CaseCardProps {
  caseItem: Case;
  onPress: () => void;
}
```

**Visual elements:**
- Case number (muted, monospace)
- Title (bold, 2-line truncation)
- Category icon + label
- Severity badge (color-coded dot + text)
- Status badge (color-coded pill)
- Relative time: `"2 days ago"` or `"3h ago"`
- Assignee name (if present): `"→ John"`
- Rating stars (if resolved + rated)

### `caseConfig.ts` (~60 LOC)

Shared config constants to avoid duplication across screens:

```typescript
export const STATUS_CONFIG: Record<CaseStatus, { label: string; color: string; bgColor: string }> = {
  open:        { label: 'Open',        color: '#1d4ed8', bgColor: '#dbeafe' },
  in_progress: { label: 'In Progress', color: '#a16207', bgColor: '#fef3c7' },
  waiting:     { label: 'Waiting',     color: '#7e22ce', bgColor: '#f3e8ff' },
  resolved:    { label: 'Resolved',    color: '#15803d', bgColor: '#dcfce7' },
  closed:      { label: 'Closed',      color: '#4b5563', bgColor: '#f3f4f6' },
  wont_fix:    { label: "Won't Fix",   color: '#4b5563', bgColor: '#f3f4f6' },
};

export const SEVERITY_CONFIG: Record<CaseSeverity, { label: string; color: string; dotColor: string }> = {
  low:      { label: 'Low',      color: '#15803d', dotColor: '#22c55e' },
  medium:   { label: 'Medium',   color: '#a16207', dotColor: '#eab308' },
  high:     { label: 'High',     color: '#c2410c', dotColor: '#f97316' },
  critical: { label: 'Critical', color: '#b91c1c', dotColor: '#ef4444' },
};

export const CATEGORY_CONFIG: Record<CaseCategory, { label: string; icon: string }> = {
  bug:             { label: 'Bug',             icon: '🐛' },
  performance:     { label: 'Performance',     icon: '⚡' },
  ui_issue:        { label: 'UI Issue',        icon: '🎨' },
  data_issue:      { label: 'Data Issue',      icon: '🛡️' },
  security:        { label: 'Security',        icon: '🔒' },
  feature_request: { label: 'Feature Request', icon: '💡' },
  other:           { label: 'Other',           icon: '🏷️' },
};
```

### Formatting Helpers

```typescript
/** Relative time: "2d ago", "3h ago", "just now" */
export const timeAgo = (isoString: string): string => {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
};

/** Activity action to human-readable string */
export const formatAction = (activity: CaseActivity): string => {
  switch (activity.action) {
    case 'created': return `${activity.user_name} created this case`;
    case 'status_changed': return `${activity.user_name} changed status: ${activity.old_value} → ${activity.new_value}`;
    case 'severity_changed': return `${activity.user_name} changed severity: ${activity.old_value} → ${activity.new_value}`;
    case 'assigned': return `${activity.user_name} assigned to ${activity.new_value}`;
    case 'commented': return `${activity.user_name} commented`;
    case 'rated': return `${activity.user_name} rated ${activity.new_value}★`;
    default: return `${activity.user_name} performed ${activity.action}`;
  }
};
```

---

## 12. Floating Report Button

The web frontend has a floating "Report Issue" button that appears on every page. On mobile, implement this as:

### Option A — FAB on CasesListScreen (Recommended)
A `+` button in the header or a floating action button at the bottom-right that navigates to `ReportCase`. Simple, consistent with the task list FAB pattern.

### Option B — Global Floating Button (Advanced)
If reporting from any screen is important, add a `FloatingReportButton` component to the root navigator:

```typescript
// In AppNavigator, overlay a FAB:
<View style={StyleSheet.absoluteFill} pointerEvents="box-none">
  <FloatingReportButton onPress={() => navigationRef.navigate('CasesTab', { screen: 'ReportCase' })} />
</View>
```

This adds complexity. Start with Option A and add Option B later if users request it.

---

## 13. Offline & Caching

### Read caching (via `useCachedFetch`)
- Cache case lists in AsyncStorage with a 2-minute TTL
- Key patterns: `cases-mine`, `cases-mine-open`, `cases-all-critical`
- On pull-to-refresh → call `refresh()` to bust cache

### Write operations
- **Report case:** Show loading state on submit button. No offline queue — user expects immediate case number.
- **Add comment:** Show loading state. No offline queue — comments should be visible immediately.
- **Rate case:** Show loading state. One-time action, no queue needed.
- **Status update:** Show loading state. Critical for audit trail — don't queue.

### Cache cleanup
- Invalidate `cases-mine-*` and `cases-all-*` caches after creating, updating, or deleting a case
- No automatic cache eviction needed — TTL handles staleness

---

## 14. API Reference (Quick)

All endpoints require `Authorization: Bearer <jwt>`.  
Base URL: `https://api.softaware.net.za`

### User Routes (`/cases`)

| # | Method | Path | Body | Response |
|---|--------|------|------|----------|
| 1 | `POST` | `/cases` | `CreateCasePayload` | `{ success, case: Case }` |
| 2 | `GET` | `/cases?status=open` | — | `{ success, cases: Case[] }` |
| 3 | `GET` | `/cases/:id` | — | `{ success, case, comments[], activity[] }` |
| 4 | `PATCH` | `/cases/:id` | `UpdateCasePayload` | `{ success, case: Case }` |
| 5 | `POST` | `/cases/:id/comments` | `{ comment, is_internal? }` or FormData | `{ success, comment }` |
| 6 | `POST` | `/cases/:id/rate` | `{ rating: 1-5, rating_comment? }` | `{ success, message }` |

### Admin Routes (`/admin/cases`) — Staff Only

| # | Method | Path | Body | Response |
|---|--------|------|------|----------|
| 7 | `GET` | `/admin/cases?status=&severity=&search=` | — | `{ success, cases[], stats }` |
| 8 | `DELETE` | `/admin/cases/:id` | — | `{ success }` |

### Status Values

| Value | Label | When to Use |
|-------|-------|-------------|
| `open` | Open | New case, not yet being worked on |
| `in_progress` | In Progress | Staff is investigating/working |
| `waiting` | Waiting | Waiting for reporter info or external dependency |
| `resolved` | Resolved | Fix applied, pending reporter verification |
| `closed` | Closed | Confirmed resolved or no action needed |
| `wont_fix` | Won't Fix | Intentional — not going to be fixed |

### Error Shapes

```json
// Validation error (400)
{ "success": false, "error": "Validation failed", "details": [...] }

// Access denied (403)
{ "success": false, "error": "Access denied" }

// Not found (404)
{ "success": false, "error": "Case not found" }

// Server error (500)
{ "success": false, "error": "Failed to create case" }
```

---

## 15. Field Mapping Gotchas

The backend's `mapCaseRow()` function renames several DB columns before sending them in the API response. The mobile app will receive the **mapped** names, not the DB column names.

| What You Receive (API) | What's in the DB | Notes |
|------------------------|-----------------|-------|
| `page_url` | `url` | Renamed by `mapCaseRow()` |
| `user_rating` | `rating` | Renamed by `mapCaseRow()` |
| `user_feedback` | `rating_comment` | Renamed by `mapCaseRow()` |
| `source` | Derived from `type` | `user_reported` → `user_report`, `monitoring` → `health_monitor` |
| `category` | `category` | Defaults to `'other'` if NULL |
| `ai_analysis` | `ai_analysis` (JSON) | Already parsed by backend |
| `metadata` | `metadata` (JSON) | Already parsed, defaults to `{}` |
| `tags` | `tags` (JSON) | Already parsed, defaults to `[]` |
| `browser_info` | `browser_info` (JSON) | Already parsed, defaults to `{}` |
| `reporter_name` | `COALESCE(u.name, u.email)` | Falls back to email if name is NULL |

**Rule:** Always use the API response field names in your TypeScript types, never the raw DB column names.

### Comment Attachments
The `POST /cases/:id/comments` endpoint uses `multer` for file uploads. When sending with an attachment:
- Use `FormData` (not JSON body)
- The `is_internal` field arrives at the server as a **string** (multer behavior) — the backend's Zod schema uses `z.preprocess()` to coerce `"true"` → `true`
- Send `is_internal` as the string `"true"` or `"false"` in FormData

---

## 16. Implementation Checklist

### Phase 1 — Core (MVP)

- [ ] Create `src/types/cases.ts` — interfaces and types
- [ ] Create `src/api/cases.ts` — 10 API methods (6 user + 2 admin)
- [ ] Create `src/constants/caseConfig.ts` — status/severity/category configs + helpers
- [ ] Add navigation types to `src/navigation/types.ts`
- [ ] Add `CasesStack` to `src/navigation/FeatureStacks.tsx`
- [ ] Add Cases tab to `AdminTabNavigator` (staff) or PortalDashboard cards (portal users)
- [ ] Create `src/components/ui/CaseCard.tsx` — list card component
- [ ] Create `src/screens/cases/CasesListScreen.tsx` — "My Cases" list with filters
- [ ] Create `src/screens/cases/ReportCaseScreen.tsx` — report form
- [ ] Create `src/screens/cases/CaseDetailScreen.tsx` — detail with comments + activity

### Phase 2 — Staff Features

- [ ] Add "All Cases" tab to CasesListScreen (uses `casesApi.adminGetAll()`)
- [ ] Add status update action on CaseDetailScreen (staff only)
- [ ] Add severity update action on CaseDetailScreen (staff only)
- [ ] Add assignment action on CaseDetailScreen (staff only, needs user picker)
- [ ] Add internal comment toggle (staff only)
- [ ] Add delete action (admin only, with confirmation)

### Phase 3 — Ratings & Notifications

- [ ] Add star rating section on CaseDetailScreen (reporter only, resolved cases)
- [ ] Extend `notificationNavigation.ts` for case notification types
- [ ] Add foreground push handling for case events
- [ ] Add "Cases" item to drawer menu in `DrawerContent.tsx`
- [ ] Add pull-to-refresh on CasesListScreen

### Phase 4 — Polish

- [ ] Add `useCachedFetch` caching for case lists (2-min TTL)
- [ ] Add stats banner on "All Cases" tab (from admin response `stats`)
- [ ] Add comment file attachments (camera/gallery/document picker → FormData)
- [ ] Add search on "All Cases" tab (debounced text input)
- [ ] Empty states, loading skeletons, error handling edge cases
- [ ] *(Optional)* Open case count badge on Cases tab icon

### Testing Checkpoints

- [ ] Report a case from mobile → verify it appears on web admin panel
- [ ] Add a comment from mobile → verify it appears on web detail view
- [ ] Admin updates status on web → verify push notification arrives on mobile
- [ ] Tap push notification → deep-links to correct CaseDetailScreen
- [ ] Rate a resolved case from mobile → verify rating shows on web
- [ ] Staff views "All Cases" on mobile → same data as web admin list
- [ ] Delete a case from mobile (admin) → verify it's gone on web
- [ ] Internal comment from staff → verify it's NOT visible to reporter on mobile

---

## Appendix: Mapping Web → Mobile

| Web Component | Mobile Equivalent | Notes |
|-------------|-----------------|-------|
| `CasesList.tsx` (DataTable) | `CasesListScreen` (FlatList + CaseCard) | DataTable → FlatList with card layout |
| `CaseDetailView.tsx` | `CaseDetailScreen` | Same structure: info, comments, activity, rating |
| Floating "Report Issue" button | FAB on CasesListScreen or header "+" | Global FAB is optional (Phase 4) |
| `AdminCaseManagement.tsx` | "All Cases" tab on CasesListScreen | Only the case list portion — health dashboard excluded |
| `CasesDashboard.tsx` | ❌ Not built | Admin analytics — use web only |
| `CaseModel.ts` (18 methods) | `casesApi` (10 methods) | Subset — excludes bulk ops, analytics, health, team perf |
| SweetAlert2 confirmations | `Alert.alert()` | React Native equivalent |
| TanStack React Table | `FlatList` + custom cards | No complex table needed on mobile |
| `react-hot-toast` | `react-native-toast-message` | Already used throughout the app |
| `<Can permission="...">` | `isStaff` / `isAdmin` from AuthContext | Simpler role checks — backend enforces real permissions |
