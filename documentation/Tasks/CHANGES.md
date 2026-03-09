# Tasks Module — Changelog & Known Issues

**Version:** 1.5.0  
**Last Updated:** 2026-03-04

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-04 | 1.5.0 | Billed/invoiced task filtering with toggle, dashboard exclusion |
| 2026-03-04 | 1.4.0 | Drawing fixes, comment positioning, task creation feedback, reorder feedback |
| 2026-03-04 | 1.3.0 | Dashboard integration, last comment display, internal comments, prominent comment UI |
| 2026-03-04 | 1.2.0 | Workflow management, task associations, rich text editor, date controls, push notifications, view-as role |
| 2026-03-03 | 1.0.0 | Initial documentation — per-software auth, Excalidraw integration, proxy architecture |

---

## 1.5 v1.5.0 — Billed Task Filtering

**Date:** 2026-03-04  
**Scope:** Hide billed/invoiced tasks from all views and dashboard counts with optional toggle

### Summary

Implemented comprehensive filtering system to automatically hide billed/invoiced tasks from active work views while maintaining ability to view them when needed:

**Feature — Billed/Invoiced Task Filtering:**
- All billed/invoiced tasks now hidden from task list and dashboard by default
- Added toggle button in TasksPage header to show/hide billed tasks
- Toggle displays "Show Billed" in normal state, "Showing Billed" with green highlight when active
- Toast feedback when toggling: "Now showing only billed/invoiced tasks" or "Now showing only unbilled tasks"
- Uses consistent billed detection logic: `task_bill_date && task_bill_date !== '0' && String(task_bill_date).length > 5`
- **Toggle behavior:** Shows ONLY billed tasks when active (mutually exclusive filter)
- **Filter bypass:** When showing billed tasks, status/type/phase/module filters are ignored (only search applies)
- Dashboard now excludes billed tasks from all counts:
  - Total task count
  - Active task count
  - Bug task list
  - Workflow phase counts
  - Role task counts
  - Recent tasks list
  - Status breakdown
  - Total unbilled hours calculation simplified (all tasks are unbilled)
- Prevents confusion between active billable work and completed billed/invoiced tasks
- Default behavior: billed tasks archived from view (business requirement)
- Explicit user action required to view billed tasks via toggle

### Changes — Backend

No backend changes in this version. All enhancements are frontend-only.

### Changes — Frontend

#### Modified: `src/pages/general/TasksPage.tsx` (2,241 LOC, +13 from v1.4)

| Change | Detail |
|--------|--------|
| Added `showBilled` state | Boolean filter state (default: `false`) to control billed task visibility |
| Modified `filteredTasks` memo | Mutually exclusive filter: shows ONLY billed when true, ONLY unbilled when false |
| Added billed detection logic | Checks `task_bill_date && task_bill_date !== '0' && String(task_bill_date).length > 5` |
| Filter bypass logic | When `showBilled` is true, ignores status/type/phase/module filters, only applies search |
| Added toggle button | Invoice icon button in header, green highlight when active |
| Added toast feedback | Success toast on toggle: "Now showing only billed/invoiced tasks" or "Now showing only unbilled tasks" |
| Button visual feedback | Normal state: "Show Billed", active state: "Showing Billed" with green background |
| Added tooltip | Button shows "Hide billed/invoiced tasks" or "Show billed/invoiced tasks" |
| Updated memo dependencies | Added `showBilled` to `filteredTasks` dependency array |

#### Modified: `src/pages/admin/Dashboard.tsx` (955 LOC, +27 from v1.4)

| Change | Detail |
|--------|--------|
| Added `unbilledTasks` filter | Filters all tasks at start of stats calculation to exclude billed |
| Updated total count | Uses `unbilledTasks.length` instead of `tasks.length` |
| Updated active tasks | Derived from `unbilledTasks` instead of `tasks` |
| Updated bug task list | Filters from `activeTasks` (already unbilled) |
| Updated role tasks | Uses unbilled active tasks |
| Updated phase tasks | Uses unbilled active tasks |
| Updated status breakdown | Iterates over `unbilledTasks` |
| Updated recent list | Sorts and slices from `unbilledTasks` |
| Simplified total hours | No longer needs billed check since all tasks are unbilled |
| Simplified completed count | Filters `unbilledTasks` by status instead of double-checking billed |

### File Statistics

| File | LOC Before | LOC After | Change |
|------|------------|-----------|--------|
| TasksPage.tsx | 2,228 | 2,241 | +13 |
| Dashboard.tsx | 928 | 955 | +27 |
| **Total** | 3,156 | 3,196 | +40 |

### Technical Notes

**Billed Task Detection:**
- Uses existing field: `task_bill_date`
- Detection formula: `task_bill_date && task_bill_date !== '0' && String(task_bill_date).length > 5`
- Also checks `task_billed` field in some contexts: `Number(task_billed) === 1`
- Applied consistently across both TasksPage and Dashboard
- Filter applied at memo level for optimal performance

**Dashboard Impact:**
- All stats derived from `unbilledTasks` array created at start of useMemo
- Single filter pass eliminates need for repeated billed checks
- Cleaner code with single source of truth
- Bug counts, phase counts, and workflow stats all exclude billed
- Total hours calculation simplified (no conditional logic needed)

**User Experience:**
- Default view shows only active unbilled work
- Reduces cognitive load by hiding completed billed tasks
- Toggle switches between two mutually exclusive views: unbilled OR billed (not both)
- When viewing billed tasks, other filters (status/type/phase/module) are ignored to show all billed work
- Search filter still applies in billed view to help locate specific billed tasks
- Toast feedback confirms which view is active
- Visual feedback (green highlight) clearly indicates when viewing billed tasks
- Consistent behavior across all views (task list, dashboard, all counts)

**Business Rationale:**
- Billed/invoiced tasks represent completed, paid work
- Showing them alongside active tasks causes confusion about billable hours
- Default hidden behavior aligns with accounting separation requirements
- Explicit toggle ensures intentional viewing of historical billed work

---

## 1.4 v1.4.0 — Drawing Fixes + UX Improvements

**Date:** 2026-03-04  
**Scope:** Excalidraw canvas sizing fix, comment section positioning, task creation feedback, action feedback improvements

### Summary

Fixed critical Excalidraw drawing functionality and enhanced user experience with better feedback and intuitive layout:

**Feature 1 — Excalidraw Drawing Fixes:**
- Fixed "Canvas exceeds max size" error by ensuring container has pixel dimensions before rendering
- Added `readyToRender` state with 2-frame RAF + 50ms timeout delay for layout settlement
- Fixed click propagation issue — clicks inside drawing UI no longer close the drawer
- Added `stopPropagation` for click, pointerDown, and mouseDown events on drawer overlay
- Hidden Library button via CSS (no official UIOptions prop exists in v0.18)
- Removed image tool from toolbar via `UIOptions.tools.image: false`
- Used `react-app-rewired build` to apply webpack override for roughjs ESM resolution
- Container uses `position: absolute; inset: 0` for explicit pixel dimensions

**Feature 2 — Comment Section UX:**
- Moved "Add Comment" section to bottom of task view modal
- Comment History now appears first (natural reading order)
- Add Comment section appears after history (action at bottom)
- Follows common UX patterns (GitHub, Slack, Discord, etc.)
- Maintains prominent blue styling for input section

**Feature 3 — Task Creation Feedback:**
- Toast confirmation: "Task created" when new task is saved
- Auto-opens newly created task in view modal after 300ms delay
- TaskDialog `onSaved` callback now accepts optional `createdTaskId` parameter
- Response from POST captures created task ID
- Main page finds and opens the new task after `loadTasks()` completes
- Edit operations continue to show "Task updated" toast without auto-open

**Feature 4 — Reorder Action Feedback:**
- Toast success: "Task reordered" on successful reorder
- Toast error: "Failed to reorder task" on failure
- Previous version silently failed with no user feedback

### Changes — Backend

No backend changes in this version. All enhancements are frontend-only.

### Changes — Frontend

#### Modified: `src/components/ExcalidrawDrawer.tsx` (219 LOC, +52 from v1.3)

| Change | Detail |
|--------|--------|
| Added `readyToRender` state | Boolean to control when Excalidraw component renders |
| Added `useEffect` for render delay | Two `requestAnimationFrame` + 50ms timeout ensures layout is settled |
| Added click event handlers | `onClick`, `onPointerDown`, `onMouseDown` with `stopPropagation()` on root div |
| Added CSS for library hiding | `<style>` tag with selectors for `.sidebar-trigger`, `.library-button`, `[aria-label="Library"]`, `.default-sidebar-trigger` |
| Disabled image tool | `UIOptions.tools.image: false` |
| Container structure change | Outer div: `flex: 1, position: relative, overflow: hidden, minHeight: 0, width: 100%` |
| Inner wrapper added | Conditional render based on `readyToRender`, wraps Excalidraw with `width/height: 100%` |
| Loading indicator | Shows "Loading drawing editor…" while `readyToRender` is false |

#### Modified: `src/pages/general/TasksPage.tsx` (2,228 LOC, +52 from v1.3)

| Change | Detail |
|--------|--------|
| Swapped comment sections | Comment History now renders before Add Comment section |
| Modified `TaskDialog` signature | `onSaved` parameter changed to `onSaved: (createdTaskId?: number) => void` |
| Capture created task ID | `response.data?.task?.id` extracted after POST request |
| Pass ID to callback | `onSaved(createdTaskId)` called with ID or undefined |
| Auto-open logic | Main page setTimeout with 300ms delay, finds new task, opens in view mode |
| Added reorder feedback | `toast.success('Task reordered')` and `toast.error('Failed to reorder task')` |
| Improved error handling | Changed `catch { /* silently fail */ }` to proper error toast |

### File Statistics

| File | LOC Before | LOC After | Change |
|------|------------|-----------|--------|
| ExcalidrawDrawer.tsx | 167 | 219 | +52 |
| TasksPage.tsx | 2,176 | 2,228 | +52 |

### Technical Notes

**Excalidraw Canvas Sizing:**
- Excalidraw's `bootstrapCanvas` reads container dimensions during initialization
- Without explicit pixel dimensions, reads 0×0 or absurdly large virtual sizes
- Browser layout engine needs time to compute `position: absolute; inset: 0` dimensions
- Solution: delay Excalidraw render until after 2 animation frames + 50ms
- This ensures the fixed overlay (`z-[60]`) has completed layout calculations

**Webpack Override for roughjs:**
- Excalidraw v0.18 depends on roughjs which uses extensionless ESM imports
- CRA's webpack 5 enforces `fullySpecified: true` for ESM packages
- `config-overrides.js` sets `fullySpecified: false` for `.mjs` files
- Must use `react-app-rewired build` instead of `react-scripts build`
- Without this, build fails with "Can't resolve 'roughjs/bin/rough'" error

**Library Button Hiding:**
- No official `UIOptions` prop exists to hide Library button in v0.18
- CSS is the only reliable method: target multiple selectors for resilience
- Scoped to `.excalidraw` to avoid affecting other components
- Uses `!important` to override Excalidraw's inline styles

**Task Creation Auto-Open:**
- 300ms delay allows `loadTasks()` to fetch and update task list
- Without delay, `tasks` array doesn't include newly created task yet
- `setTimeout` ensures task is available before searching by ID
- Only applies when `editingTask` is null (new task, not edit)

---

## 1.3 v1.3.0 — Dashboard Integration + Comment Enhancements

**Date:** 2026-03-04  
**Scope:** Dashboard task access, last comment display in task list, internal comment checkbox, prominent comment input section

### Summary

Enhanced user experience with quick task access from Dashboard and improved comment system visibility:

**Feature 1 — Dashboard Task Integration:**
- Clickable bugfix list in Dashboard "Active Bugs" card
- Workflow Pipeline phase popovers showing all tasks in selected phase
- Direct navigation to Tasks page with auto-opened task details (no confirmation dialog)
- Uses localStorage.openTaskId for seamless task opening
- Phase cards show task count and are only clickable when tasks exist

**Feature 2 — Last Comment Display:**
- Fetches last comment for each task when tasks are loaded
- Displays in gray workflow phase row below task card
- Shows up to 60 characters with "..." truncation
- HTML tags stripped from comment content
- Chat bubble icon indicates comment presence
- Only fetches for first 50 tasks (performance optimization)
- Asynchronous loading without blocking task display

**Feature 3 — Internal Comment System:**
- Checkbox below comment input: "Internal comment (not visible to clients)"
- Sends `is_internal: 1` flag when checked
- Amber "Internal" badge shown on internal comments in history
- Shield icon (ShieldCheckIcon) next to checkbox label
- State resets after posting comment

**Feature 4 — Prominent Comment Input Section:**
- Blue background box (bg-blue-50/dark:bg-blue-900/20) with 2px border
- "Add Comment" header with ChatBubbleLeftIcon
- Larger input field with enhanced focus states (blue-300 border, blue-500 focus)
- Bigger buttons: "Post Comment" instead of just "Post"
- Drawing button with larger icon (h-5 w-5)
- Separated from "Comment History" section below
- Dark mode support throughout

### Changes — Backend

No backend changes in this version. All enhancements are frontend-only.

### Changes — Frontend

#### Modified: `src/pages/admin/Dashboard.tsx` (~928 LOC)

| Change | Detail |
|--------|--------|
| Added state | `phasePopoverOpen`, `selectedPhase` for workflow phase popover |
| Modified `handleTaskClick()` | Now directly stores task ID and navigates without confirmation dialog |
| Added `handlePhaseClick()` | Opens popover with all tasks in selected phase |
| Added `phaseTasksForPopover` memo | Filters and sorts tasks for selected phase |
| Made bugfix items clickable | onClick calls `handleTaskClick(task)` |
| Made workflow phases clickable | onClick calls `handlePhaseClick(phase)` with cursor-pointer and hover effects |
| Added Phase Tasks Popover | Headless UI Dialog with task list, clicking task navigates to Tasks page |
| Removed task detail dialog | Eliminated intermediate confirmation step |
| Updated imports | Added Dialog, Transition, Fragment from @headlessui/react |

#### Modified: `src/pages/general/TasksPage.tsx` (~2,176 LOC)

| Change | Detail |
|--------|--------|
| Added `lastComments` state | Record<number, string> to store last comment for each task |
| Added comment fetch effect | Fetches last comments for first 50 tasks in parallel |
| Comment truncation | Strips HTML tags, limits to 60 chars with "..." |
| Modified workflow phase row | Now shows last comment below phase info with border-top separator |
| Added `isInternalComment` state | Boolean for internal comment checkbox |
| Modified `handlePostComment()` | Includes `is_internal` flag when checkbox checked, resets state after post |
| Enhanced comment input section | Blue background box with prominent styling and larger inputs |
| Added internal checkbox | Shield icon + "Internal comment (not visible to clients)" label |
| Separated comment history | "Comment History" header with distinct section below input |
| Dark mode support | Added dark mode classes throughout comment UI |

### File Statistics

| File | LOC Before | LOC After | Change |
|------|------------|-----------|--------|
| Dashboard.tsx | 606 | 928 | +322 |
| TasksPage.tsx | 2,136 | 2,176 | +40 |

### Dependencies

No new dependencies added. Uses existing:
- @headlessui/react (already installed for modals)
- @heroicons/react/24/outline (already installed)

---

## 1.2 v1.2.0 — Complete Workflow System + Notifications + Associations

**Date:** 2026-03-04  
**Scope:** Full workflow management, task associations, WYSIWYG editor, date/time pickers, attachment management, push notifications, user notification preferences, view-as role for staff

### Summary

Major enhancement of the Tasks module with five complete features and notification infrastructure:

**Feature 1 — Attachment Management:**
- Delete attachment button (trash icon) for each attachment
- Backend: none needed (deletes handled by external API)
- Frontend: UI controls in TaskDialog attachments tab and TaskDetailsDialog

**Feature 2 — Workflow Management (WorkflowDialog):**
- Complete workflow assignment system with role-based filtering
- Users filtered by phase-role mapping (intake→client_manager, QA→qa_specialist, dev→developer)
- Module assignment for QA→Development transition
- "Send back to intake" option for QA/triage phase
- Permission system (`canUserAssignTask`) blocks unauthorized assignments
- Permission error alerts when user can't assign from current phase
- Exclude admins from assignment user lists
- Exclude current user (assigner) from available assignees
- Internal comment field for workflow notes

**Feature 3 — Task Associations (TaskAssociationDialog):**
- 5 association types: blocker, duplicate, child, related, follow-up
- Searchable task picker with title/ID filtering
- Association notes field
- View existing associations with type badges and delete buttons
- Backend proxy routes: GET/POST/DELETE `/:id/associations`

**Feature 4 — Rich Text Editor + Date Controls:**
- Installed `react-quill@2.0.0` for WYSIWYG description editing
- Installed `react-datepicker@8.8.0` and `date-fns@2.30.0`
- Created `RichTextEditor.tsx` component (111 LOC)
- TaskDialog rewritten with 3-tab layout: General / Timing / Attachments
- General tab: Title, description (WYSIWYG), status, type, priority, severity, hours, attachments
- Timing tab: Start Date, Due Date, Completion Date (all DatePickers)
- Attachments tab: Full attachment management with upload, paste, preview, delete

**Feature 5 — Push Notifications:**
- Database: Added 3 columns to `users` table: `notifications_enabled`, `push_notifications_enabled`, `web_notifications_enabled`
- Backend `sendTaskAssignmentNotification()` in softawareTasks.ts PUT endpoint
- Looks up assigned user in local system, sends notification with task title and phase
- `createNotificationWithPush()` in firebaseService.ts respects user preferences
- Profile UI: Blue "Notification Preferences" card with 3 checkboxes (master, web, push)
- GET/PUT /profile endpoints return and accept notification preference fields

**Feature 6 — View-As Role (Staff Override):**
- Staff/admin users can select a role to experience the app as that role
- `getViewAsRole()` / `setViewAsRole()` in workflowPermissions.ts
- localStorage key: `softaware_view_as_role`
- `getEffectiveRole()` returns view-as role for staff, actual role otherwise
- Profile.tsx: Amber "Staff: View As Role" card with dropdown
- Active badge in profile header when view-as is active
- Permission system uses effective role (except admins bypass with direct `is_admin` check when no view-as active)

### Changes — Backend

#### Modified: `src/routes/softawareTasks.ts`

| Change | Detail |
|--------|--------|
| Added `sendTaskAssignmentNotification()` | Helper function to send notifications when tasks are assigned |
| Modified PUT / handler | After successful task update, checks if `assigned_to` changed and fires notification (fire & forget) |
| Notification content | "X assigned you: Task Title (phase)" with task_id and workflow_phase in data payload |
| Added association routes | GET/POST/DELETE `/:id/associations` — proxy to external API `/api/tasks/:id/associated` and `/api/tasks/:id/associate` |

#### Modified: `src/services/firebaseService.ts`

| Change | Detail |
|--------|--------|
| Enhanced `createNotificationWithPush()` | Now checks user notification preferences before sending |
| Master toggle | If `notifications_enabled = false`, skip all notifications |
| Web toggle | If `web_notifications_enabled = false`, skip in-app notification insert |
| Push toggle | If `push_notifications_enabled = false`, skip FCM push |
| Default values | All preferences default to `true` if user row doesn't have values |

#### Modified: `src/routes/profile.ts`

| Change | Detail |
|--------|--------|
| GET / handler | Added notification preference fields to SELECT and response: `notifications_enabled`, `push_notifications_enabled`, `web_notifications_enabled` |
| PUT / handler | UpdateProfileSchema now accepts 3 new boolean fields |
| PUT / handler | Updates user table with new preference values |
| Response | Returns updated preference values after save |

#### Database Migration: `users` table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `notifications_enabled` | BOOLEAN | TRUE | Master toggle for all notifications |
| `push_notifications_enabled` | BOOLEAN | TRUE | Enable/disable FCM push notifications |
| `web_notifications_enabled` | BOOLEAN | TRUE | Enable/disable web in-app notifications |

### Changes — Frontend

#### New File: `src/components/RichTextEditor.tsx` (111 LOC)

| Feature | Detail |
|---------|--------|
| WYSIWYG | react-quill with custom toolbar |
| Toolbar | Bold, Italic, Underline, Strike, Lists (ordered/unordered), Link, Clean |
| Image paste | Captures clipboard images and embeds as base64 |
| Height | 250px with scroll |
| Styling | Blue border on focus, gray border default |

#### New File: `src/utils/workflowPermissions.ts` (174 LOC)

| Function | Description |
|----------|-------------|
| `getViewAsRole()` | Reads `softaware_view_as_role` from localStorage |
| `setViewAsRole(roleSlug)` | Writes view-as role or clears if null |
| `getEffectiveRole(user)` | Returns view-as role for staff, actual role otherwise |
| `userHasRole(user, ...roles)` | Checks effective role against role list |
| `canUserAssignTask(user, task)` | Permission check: admins can always assign (unless view-as active), effective role must match PHASE_ROLE_MAP |
| `getRequiredRoleForPhase(phase)` | Returns role needed to assign from a phase |
| `getRoleLabel(role)` | Human-friendly role names |
| `isBackwardAssignment(fromPhase, toPhase)` | Checks if assignment goes backward in workflow |
| `getPermissionErrorMessage(user, task)` | Returns user-friendly error with view-as context |

**PHASE_ROLE_MAP:**
```typescript
{
  intake: 'client_manager',
  quality_review: 'qa_specialist',
  triage: 'qa_specialist',
  development: 'developer',
  verification: 'qa_specialist',
  resolution: 'qa_specialist',
}
```

#### Modified: `src/pages/TasksPage.tsx` (→ 2,110 LOC)

| Change | Detail |
|--------|--------|
| **Added 3 dialogs** | WorkflowDialog (170 LOC), TaskAssociationDialog (140 LOC), both embedded |
| **TaskDialog rewrite** | 3-tab layout with General/Timing/Attachments tabs |
| **RichTextEditor** | Replaced plain textarea for description field |
| **DatePicker** | 3 date fields with react-datepicker component |
| **Attachment delete** | Trash icon button for each attachment in TaskDialog and TaskDetailsDialog |
| **WorkflowDialog** | Role-based user filtering with `getUserRole()` helper that handles `roles` array from `/api/users` |
| **User fetch** | Changed from `/softaware/users` (non-existent) to `/users` (local Softaware users) |
| **Assign button** | Conditionally shown based on `canUserAssignTask(user, task)` |
| **Phase badge** | Shown instead of Assign button when user can't assign from current phase |
| **Association button** | "Link" button on cards and detail dialog to open TaskAssociationDialog |
| **Assign/Link handlers** | `handleAssign(task)`, `handleLink(task)` set state and open respective dialogs |

#### Modified: `src/pages/Profile.tsx` (→ 385 LOC)

| Change | Detail |
|--------|--------|
| **Added notification prefs** | Blue card with 3 checkboxes: master toggle, web notifications, push notifications |
| **Icons** | BellIcon, ComputerDesktopIcon, DevicePhoneMobileIcon |
| **View-As Role UI** | Amber card with dropdown (Client Manager / QA Specialist / Developer) for staff/admin only |
| **Active badge** | Shows amber "Viewing as X" badge in profile header when view-as role is active |
| **Form integration** | Notification preferences included in profile form submission |

### New Dependencies

| Package | Version | Purpose | Install Flags |
|---------|---------|---------|---------------|
| `react-quill` | 2.0.0 | WYSIWYG editor for task descriptions | — |
| `@types/react-quill` | 2.0.0 | TypeScript types for react-quill | —  |
| `react-datepicker` | 8.8.0 | Date picker components for start/due/completion dates | — |
| `@types/react-datepicker` | 8.8.0 | TypeScript types for react-datepicker | — |
| `date-fns` | 2.30.0 | Date formatting utilities | — |

### Files Changed

| File | Change Type | LOC | Summary |
|------|------------|-----|---------|
| `backend/src/routes/softawareTasks.ts` | Modified | ~320 | Task assignment notifications, association proxy routes |
| `backend/src/services/firebaseService.ts` | Modified | 235 | User preference checks in createNotificationWithPush |
| `backend/src/routes/profile.ts` | Modified | ~370 | GET/PUT notification preferences |
| `frontend/src/utils/workflowPermissions.ts` | **New** | 174 | Permission checks + view-as role |
| `frontend/src/components/RichTextEditor.tsx` | **New** | 111 | WYSIWYG editor component |
| `frontend/src/pages/TasksPage.tsx` | Modified | 2,110 | WorkflowDialog, TaskAssociationDialog, 3-tab TaskDialog, RichTextEditor, DatePickers, Assign/Link buttons |
| `frontend/src/pages/Profile.tsx` | Modified | 385 | Notification preferences UI, View-As Role dropdown |

### Verification

- ✅ Zero TypeScript errors across all modified/new files
- ✅ Backend compiled cleanly with `npm run build`
- ✅ Backend restarted via `pm2 restart 0`
- ✅ Database migration applied manually (3 notification preference columns added to `users` table)
- ✅ All workflow permission logic ported from desktop app
- ✅ Role filtering handles both `roles: []` array (from `/api/users`) and `role: {}` object (from auth)
- ⚠️ Frontend build NOT run (per user instruction: "do not build unless I say so")
- ⚠️ Runtime testing pending

---

## 1.0 v1.0.0 — Per-Software Auth + Excalidraw Drawing Integration

**Date:** 2026-03-03  
**Scope:** Backend softawareTasks.ts proxy router, frontend TasksPage.tsx rewiring, new ExcalidrawDrawer component, new softwareAuth utility

### Summary

Major rewiring of the Tasks module with two work streams:

**Work Stream A — Authentication Fix:**
- Fixed 500 error on `PUT /api/softaware/software` (backend expected `id` in body, frontend sent it as query param)
- Replaced global `software_token` localStorage key with per-software `software_token_{id}` pattern
- Added inline authentication flow with OTP support directly on TasksPage (no more navigating to Software Management edit modal)
- Filtered software dropdown to only show products with complete external integration configuration
- All task/comment requests now use per-software auth headers via `softwareAuthHeaders(softwareId)`

**Work Stream B — Excalidraw Integration:**
- Installed `@excalidraw/excalidraw@0.18.0`
- Created `ExcalidrawDrawer.tsx` — lazy-loaded, full-screen overlay for drawing
- Added backend `POST /:id/comments/with-attachment` route — two-step: create comment + upload base64 PNG
- Added "Draw" button in TaskDetailsDialog header and paperclip icon next to comment input
- Enhanced comment rendering with image support, clickable images, attachment display, and image lightbox
- Fixed Express route ordering: `with-attachment` registered before generic `/:id/comments` to prevent shadowing

### Changes — Backend

#### New File: `src/routes/softawareTasks.ts` (Rewired)

| Change | Detail |
|--------|--------|
| Added `POST /:id/comments/with-attachment` | Two-step: create comment → extract comment_id → upload base64 as FormData to external `/api/attachments/development/{taskId}` |
| Enhanced `POST /:id/comments` | Now supports both `{ comment }` (legacy) and explicit `{ content, is_internal, time_spent }` field shapes |
| Added `POST /authenticate` | Proxies to external `/api/auth_login` with OTP support (`otp`, `otpToken` fields) |
| Route ordering fix | `/:id/comments/with-attachment` registered BEFORE generic `/:id/comments` POST to prevent Express route shadowing |
| All routes use `requireAuth` | Internal JWT validation on every endpoint |

**Route registration order (critical):**

```
1. GET  /                              — list tasks
2. POST /                              — create task
3. PUT  /                              — update task
4. DELETE /:id                         — delete task
5. POST /reorder                       — reorder tasks
6. GET  /:id/comments                  — list comments
7. POST /:id/comments/with-attachment  — comment + attachment (BEFORE generic)
8. POST /:id/comments                  — post comment (AFTER with-attachment)
9. POST /authenticate                  — external API auth
```

#### Modified: `src/routes/updSoftware.ts`

| Change | Detail |
|--------|--------|
| PUT handler | Now accepts `id` from `req.query.id` OR `req.body.id` (fixes 500 error when frontend sends id as query param) |

### Changes — Frontend

#### New File: `src/utils/softwareAuth.ts` (32 LOC)

| Function | Description |
|----------|-------------|
| `getSoftwareToken(id)` | Reads `software_token_{id}` from localStorage |
| `setSoftwareToken(id, token)` | Writes per-software token |
| `removeSoftwareToken(id)` | Deletes per-software token |
| `hasSoftwareToken(id)` | Boolean check for token existence |
| `softwareAuthHeaders(id)` | Returns `{ 'X-Software-Token': token }` headers object |

#### New File: `src/components/ExcalidrawDrawer.tsx` (168 LOC)

| Feature | Detail |
|---------|--------|
| Lazy loading | `@excalidraw/excalidraw` loaded via dynamic `import()` only on first open |
| Export | PNG blob → base64 data URL + scene JSON |
| UI | Full-screen overlay (z-60), custom toolbar with "Save as Comment" button |
| Props | `open`, `onClose`, `onSave`, `initialData`, `taskTitle` |

#### Modified: `src/pages/TasksPage.tsx` (→ 1,008 LOC)

| Change | Detail |
|--------|--------|
| **Added imports** | `ExcalidrawDrawer`, `PaperClipIcon`, `hasSoftwareToken`, `setSoftwareToken`, `softwareAuthHeaders`, `ShieldCheckIcon`, `ShieldExclamationIcon` |
| **Filtered software dropdown** | `taskSoftware = softwareList.filter(sw => sw.has_external_integration && sw.external_username && sw.external_password && ...)` |
| **Inline auth flow** | New states: `authLoading`, `authStatus`, `authMessage`, `authOtp`, `authOtpToken`, `authOtpUserId`, `authVersion` |
| **Auth panel** | Replaces task list when not authenticated — shows shield icon, environment info, OTP input when needed |
| **Per-software headers** | All `api.get/post/put/delete` calls now pass `softwareAuthHeaders(selectedSoftware?.id)` |
| **TaskDetailsDialog: drawing** | New states: `drawingOpen`, `expandedImage`. New functions: `refetchComments()`, `handleDrawingSave()` |
| **TaskDetailsDialog: "Draw" button** | Added to header row (PaperClipIcon + "Draw") and comment input row (paperclip icon) |
| **Comment rendering** | Enhanced with `[&_img]` Tailwind classes, click-to-expand images, attachment thumbnails/links |
| **ExcalidrawDrawer portal** | Rendered inside TaskDetailsDialog |
| **Image lightbox** | z-70 overlay with click-to-close |
| **Software ✓ indicator** | `{hasSoftwareToken(sw.id) ? ' ✓' : ''}` in dropdown option text |

#### Modified: `src/pages/SoftwareManagement.tsx`

| Change | Detail |
|--------|--------|
| Token storage | Changed `localStorage.setItem('software_token', ...)` to `setSoftwareToken(software.id, ...)` |
| Token check | Changed global `isAuthenticated` boolean to per-software `hasSoftwareToken(sw.id)` |
| PUT fix | Changed from `api.put('/softaware/software?id=${software.id}', form)` to `api.put('/softaware/software', { ...form, id: software.id })` |

#### Modified: `src/hooks/useTasks.ts`

| Change | Detail |
|--------|--------|
| Added `softwareId` option | New field in `UseTasksOptions` interface |
| Per-software headers | Replaced `localStorage.getItem('software_token')` with `softwareAuthHeaders(softwareId)` |
| Callback deps | Added `softwareId` to `useCallback` dependency array |

### New Dependency

| Package | Version | Purpose | Install Flags |
|---------|---------|---------|---------------|
| `@excalidraw/excalidraw` | 0.18.0 | Drawing canvas for task comments | `--legacy-peer-deps` (React 18 compatibility) |

### Files Changed

| File | Change Type | LOC | Summary |
|------|------------|-----|---------|
| `backend/src/routes/softawareTasks.ts` | Modified | 285 | Added with-attachment route, authenticate endpoint, route ordering fix |
| `backend/src/routes/updSoftware.ts` | Modified | 188 | PUT accepts id from query or body |
| `frontend/src/utils/softwareAuth.ts` | **New** | 32 | Per-software token management |
| `frontend/src/components/ExcalidrawDrawer.tsx` | **New** | 168 | Lazy-loaded Excalidraw drawing overlay |
| `frontend/src/pages/TasksPage.tsx` | Modified | 1,008 | Inline auth, filtered dropdown, drawing integration, per-SW tokens |
| `frontend/src/pages/SoftwareManagement.tsx` | Modified | 698 | Per-software tokens, PUT body fix |
| `frontend/src/hooks/useTasks.ts` | Modified | 72 | softwareId option, per-SW headers |

### Verification

- ✅ Zero TypeScript errors across all modified/new files (confirmed via `get_errors`)
- ✅ Route ordering: `with-attachment` registered before generic `/:id/comments`
- ✅ Per-software tokens: each software uses `software_token_{id}` key in localStorage
- ✅ Excalidraw lazy-loads only when drawer opens
- ⚠️ Build NOT run (user instruction: "do not build unless I say so")
- ⚠️ Runtime testing pending (backend PM2 stopped)

---

## 2. Known Issues

### 2.1 🟡 WARNING — No External Token Expiration Handling

- **Status:** OPEN
- **Module Files:** `frontend/src/utils/softwareAuth.ts`, `frontend/src/pages/TasksPage.tsx`
- **Description:** External API tokens stored in localStorage never expire or get refreshed. If the external token expires, task requests will fail silently with 401 errors, but the UI will still show the user as "authenticated" (the ✓ checkmark remains in the dropdown).
- **Impact:** Users will see task loading errors without understanding they need to re-authenticate.
- **Recommended Fix:** Intercept 401 responses on task/comment requests, call `removeSoftwareToken(softwareId)`, increment `authVersion` to trigger re-render, and show "Session expired — please re-authenticate" message.
- **Effort:** LOW (~15 lines)

### 2.2 🟡 WARNING — Comments Typed as `any[]`

- **Status:** OPEN
- **Module File:** `frontend/src/pages/TasksPage.tsx` (TaskDetailsDialog)
- **Description:** No `Comment` interface exists. Comments are `any[]` throughout — field access (`c.user_name`, `c.comment_id`, `c.attachments`) has no compile-time safety.
- **Impact:** Typos in comment field names will not be caught until runtime.
- **Recommended Fix:** Define `Comment` and `Attachment` interfaces in `types/index.ts`.
- **Effort:** LOW (~20 lines)

### 2.3 🟡 WARNING — Base64 Drawing Payload Size

- **Status:** OPEN
- **Module Files:** `frontend/src/pages/TasksPage.tsx`, `backend/src/routes/softawareTasks.ts`
- **Description:** Excalidraw drawings are exported as base64 PNG and sent as a JSON string field in the request body. Detailed drawings can be 2-5MB base64, which may exceed Express's default JSON body limit (100KB-1MB depending on config).
- **Impact:** Large drawings may fail with 413 "Payload Too Large".
- **Recommended Fix:** Either (A) increase Express JSON body limit for the `with-attachment` route, or (B) send the image as multipart/form-data from the frontend instead of base64 in JSON.
- **Effort:** LOW (option A: ~3 lines) / MEDIUM (option B: ~30 lines)

### 2.4 🟡 WARNING — Credentials in GET /softaware/software Response

- **Status:** OPEN
- **Module File:** `backend/src/routes/updSoftware.ts`
- **Description:** `GET /softaware/software` returns `external_username` and `external_password` to the frontend. These are then stored in `localStorage.selectedTasksSoftware` as a JSON object.
- **Impact:** External API credentials visible in browser dev tools.
- **Recommended Fix:** Omit `external_password` from GET responses. Have the backend read credentials from DB during authentication instead of receiving them from the frontend.
- **Effort:** MEDIUM

### 2.5 🟡 WARNING — dangerouslySetInnerHTML on Comments

- **Status:** OPEN
- **Module File:** `frontend/src/pages/TasksPage.tsx` (TaskDetailsDialog comment rendering)
- **Description:** Comment content and task descriptions are rendered via `dangerouslySetInnerHTML`. If the external API returns unsanitized HTML, this is an XSS vector.
- **Impact:** Malicious comment content could execute JavaScript in the context of the Soft Aware app.
- **Recommended Fix:** Sanitize HTML content before rendering using `DOMPurify`:
  ```typescript
  import DOMPurify from 'dompurify';
  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.content || '') }}
  ```
- **Effort:** LOW (~5 lines + dependency)

### 2.6 🟢 INFO — TasksPage.tsx is 1,008 Lines

- **Status:** OPEN (tech debt)
- **Module File:** `frontend/src/pages/TasksPage.tsx`
- **Description:** Three components (`TasksPage`, `TaskDialog`, `TaskDetailsDialog`) are defined in a single file. The file is difficult to navigate and will continue growing.
- **Recommended Fix:** Extract `TaskDialog` and `TaskDetailsDialog` into separate files under `components/tasks/`.
- **Effort:** MEDIUM

### 2.7 🟢 INFO — No Task Data Caching

- **Status:** OPEN (by design)
- **Module Files:** `frontend/src/hooks/useTasks.ts`
- **Description:** Every software selection change or refresh triggers a full re-fetch of all tasks. No client-side caching (React Query, SWR, or custom cache).
- **Impact:** Slightly slower UX on software switching; unnecessary API load on frequent refreshes.
- **Recommended Fix:** Add React Query or SWR with a short TTL (30-60s) cache.
- **Effort:** MEDIUM

### 2.8 🟢 INFO — Excalidraw Scene JSON Not Stored

- **Status:** OPEN (partial implementation)
- **Module File:** `frontend/src/components/ExcalidrawDrawer.tsx`
- **Description:** The `sceneJson` is serialized during export but only stored in the comment's HTML content as an embedded `<img>` tag. There's no mechanism to re-open a saved drawing for editing. The `initialData` prop exists but is never used.
- **Recommended Fix:** Store `sceneJson` as a metadata field on the attachment or as a second file. Support re-opening drawings from saved scene data.
- **Effort:** HIGH

### 2.9 🟢 INFO — No Loading Progress for Excalidraw

- **Status:** OPEN
- **Module File:** `frontend/src/components/ExcalidrawDrawer.tsx`
- **Description:** When Excalidraw is lazy-loading (~2-3s on first open), only a plain "Loading drawing editor…" text is shown. No spinner or progress indicator.
- **Recommended Fix:** Add an `ArrowPathIcon` spinner animation during the loading phase.
- **Effort:** LOW (~5 lines)

---

## 3. Future Enhancements

| Enhancement | Priority | Effort | Description |
|-------------|----------|--------|-------------|
| External token refresh / expiry handling | 🔴 HIGH | LOW | Detect 401 on task requests, clear stale token, prompt re-auth |
| HTML sanitization (DOMPurify) | 🔴 HIGH | LOW | Sanitize comment and task HTML before `dangerouslySetInnerHTML` |
| Comment/Attachment TypeScript interfaces | 🟡 MEDIUM | LOW | Define proper types for compile-time safety |
| Exclude credentials from GET response | 🟡 MEDIUM | MEDIUM | Don't send external_password to frontend |
| Extract TaskDialog / TaskDetailsDialog | 🟡 MEDIUM | MEDIUM | Split 1,008-line file into 3 focused files |
| React Query / SWR caching | 🟡 MEDIUM | MEDIUM | Cache task lists with short TTL for faster UX |
| Multipart upload from frontend | 🟡 MEDIUM | MEDIUM | Avoid base64-in-JSON for drawings |
| Re-open saved drawings | 🟢 LOW | HIGH | Store Excalidraw scene JSON, support re-editing |
| Bulk task actions | 🟢 LOW | MEDIUM | Select multiple tasks for status change or deletion |
| Task search on external API | 🟢 LOW | LOW | Pass search query to external API instead of client-side filter |
| WebSocket for real-time updates | 🟢 LOW | HIGH | Live task updates when other users modify tasks |
| Loading spinner for Excalidraw | 🟢 LOW | LOW | Better UX during lazy load |
