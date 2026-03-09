# Frontend Toast Notification System

**Version:** 1.0.0  
**Last Updated:** 2026-03-07

## Purpose

Provides a **single, centralized toast notification utility** for all transient user feedback across the frontend application. Built on `react-hot-toast`, exposed via `src/utils/notify.ts`. SweetAlert2 is reserved exclusively for **confirmation dialogs** requiring explicit user decisions (delete, discard, destructive actions).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  App.tsx                                                 │
│  └── <Toaster position="top-right" duration={3000} />   │
│       ▲                                                  │
│       │  react-hot-toast renders here                    │
│       │                                                  │
│  ┌────┴────────────────────────┐                         │
│  │  src/utils/notify.ts        │                         │
│  │  ┌────────────────────────┐ │                         │
│  │  │ notify.success(msg)    │ │  ← green ✓   (3s)      │
│  │  │ notify.error(msg)      │ │  ← red ✗     (4s)      │
│  │  │ notify.warning(msg)    │ │  ← orange ⚠️  (4s)      │
│  │  │ notify.info(msg)       │ │  ← blue ℹ️    (3.5s)    │
│  │  │ notify.promise(p,msgs) │ │  ← loading → result    │
│  │  └────────────────────────┘ │                         │
│  └─────────────────────────────┘                         │
│       ▲                                                  │
│       │  import { notify } from '../../utils/notify';    │
│       │                                                  │
│  Every page / component / dialog                         │
└─────────────────────────────────────────────────────────┘
```

## Key Files

| File | Role |
|------|------|
| `src/utils/notify.ts` | Centralized notification utility wrapping `react-hot-toast` |
| `src/App.tsx` | Renders `<Toaster>` provider (single instance, top-right, 3s default) |

## Notification Methods

### `notify.success(message: string)`
Green check-mark toast. Duration: **3 seconds**.

**Use for:** Saved, created, updated, completed, connected, imported, synced operations.

```typescript
notify.success('Settings saved');
notify.success('Task created');
notify.success(`Connected to ${conn.name}`);
```

### `notify.error(message: string)`
Red cross toast. Duration: **4 seconds**.

**Use for:** API errors, load failures, validation failures, unexpected errors.

```typescript
notify.error('Failed to load data');
notify.error(err.response?.data?.error || 'Connection failed');
notify.error('Task name is required');
```

### `notify.warning(message: string)`
Orange ⚠️ toast with amber border. Duration: **4 seconds**.

**Use for:** Soft warnings, cancelled actions, approaching limits, schedule alerts.

```typescript
notify.warning('❌ A scheduled call was cancelled');
notify.warning(`⏰ "${title}" starts in 15 minutes`);
```

### `notify.info(message: string)`
Blue ℹ️ toast with blue border. Duration: **3.5 seconds**.

**Use for:** Neutral information, status updates, hints.

```typescript
notify.info('📞 Call was not answered');
notify.info('📤 Message queued — will send when online');
notify.info('📭 No calendar invitations found');
```

### `notify.promise(promise, messages)`
Shows loading → success/error toast automatically.

```typescript
notify.promise(saveSettings(), {
  loading: 'Saving…',
  success: 'Settings saved',
  error: 'Could not save settings',
});
```

## Rules & Conventions

### ✅ DO

1. **Always import from `notify`:**
   ```typescript
   import { notify } from '../../utils/notify';   // adjust depth
   ```

2. **Use `notify.success()` / `notify.error()` for all feedback** — never call `toast()` directly.

3. **Use `notify.info()` for informational toasts** that previously used bare `toast('message', { icon: '...' })`.

4. **Prefix emoji in the message string** when you want a custom icon:
   ```typescript
   notify.info('📞 Call was not answered');    // emoji in message text
   ```

5. **Use `notify.warning()` for cancellations and time-sensitive alerts.**

6. **Use `notify.promise()` for async operations** where a loading spinner helps UX.

### ❌ DO NOT

1. **Never `import toast from 'react-hot-toast'`** in any page or component. Only `notify.ts` imports it directly.

2. **Never use SweetAlert2 (`Swal.fire`) for simple feedback.** Swal is reserved for:
   - Delete confirmations
   - Discard confirmations
   - Destructive action gates (e.g., "Are you sure?")
   - Input prompts (e.g., "Enter a name for this query")

3. **Never customize toast duration, position, or style per-call.** The `notify` utility provides consistent defaults. If a new toast variant is needed, add it to `notify.ts`.

4. **Never use `toast.success()` or `toast.error()` directly** — these bypass the centralized utility.

## Migration Reference

The following files were migrated from raw `toast` calls to `notify` (2026-03-07):

| File | Calls Migrated | Notes |
|------|---------------|-------|
| `pages/general/ChatPage.tsx` | 5 | Bare `toast()` → `notify.info()` / `notify.warning()` |
| `pages/general/DatabaseManager.tsx` | 12 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/GroupsPage.tsx` | 1 | Bare `toast()` → `notify.info()` |
| `pages/general/PlanningPage.tsx` | 22 | Mix of `toast.success/error()` and bare `toast()` |
| `pages/general/TasksPage.tsx` | 35 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/ErrorReports.tsx` | 2 | `toast.error()` → `notify.error()` |
| `components/PermissionSync.tsx` | 5 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/chat/ScheduledCallsPanel.tsx` | 4 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/chat/MessageInput.tsx` | 2 | `toast.error()` → `notify.error()` |
| `pages/general/chat/ChatHeader.tsx` | 2 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/chat/ChatSidebar.tsx` | 2 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/chat/ScheduleCallDialog.tsx` | 7 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/chat/ForwardDialog.tsx` | 2 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/chat/ChatDialogs.tsx` | 13 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/chat/StarredMessagesPanel.tsx` | 3 | `toast.success/error()` → `notify.success/error()` |
| `pages/general/groups/MessageInput.tsx` | 1 | `toast.error()` → `notify.error()` |

**Total: 118 toast calls migrated across 16 files.**

## Notification Types Summary

| Scenario | Method | Example |
|----------|--------|---------|
| CRUD success | `notify.success()` | "Task created", "Settings saved" |
| API / load error | `notify.error()` | "Failed to load data", "Connection failed" |
| Validation error | `notify.error()` | "Task name is required" |
| Cancellation | `notify.warning()` | "A scheduled call was cancelled" |
| Time-sensitive alert | `notify.warning()` | "Meeting starts in 15 minutes" |
| Informational | `notify.info()` | "Message queued", "No results found" |
| Delete confirmation | `Swal.fire()` | "Are you sure you want to delete?" |
| Destructive action | `Swal.fire()` | "Discard unsaved changes?" |
| Input prompt | `Swal.fire()` | "Enter a name for this query" |

## Extending the System

To add a new toast variant (e.g., a persistent "undo" toast):

1. Add the method to `src/utils/notify.ts`
2. Export it in the `notify` object
3. Update this documentation
4. All consumers automatically get access via `import { notify }`
