# Webmail — Mobile App Wiring Guide

> **Purpose:** Everything the mobile developer needs to wire the Webmail feature into the React Native app.  
> **Scope:** User-facing mailbox management and email client. Admin domain config is excluded — the backend already handles server settings transparently.

---

## 1. Feature Overview

Users can:

1. **Manage mailbox accounts** — add, edit, delete, test connection, set default
2. **Browse IMAP folders** — Inbox, Sent, Drafts, Trash, custom folders with unread counts
3. **Read email** — full HTML/text view, attachments
4. **Compose & send** — recipients (to/cc/bcc), subject, HTML body, file attachments (up to 20 files, 25 MB each)
5. **Organise** — delete/trash, move between folders, flag/unflag, mark read/unread

---

## 2. API Service Module

Create **`src/api/webmail.ts`** following the existing service module pattern (`api/chat.ts`, `api/tasks.ts`).

```typescript
// src/api/webmail.ts
import client from './client';

// ── Account Management ────────────────────────────────

export const getAccounts = () =>
  client.get('/webmail/accounts');

export const createAccount = (data: CreateMailboxInput) =>
  client.post('/webmail/accounts', data);

export const updateAccount = (id: number, data: UpdateMailboxInput) =>
  client.put(`/webmail/accounts/${id}`, data);

export const deleteAccount = (id: number) =>
  client.delete(`/webmail/accounts/${id}`);

export const testAccount = (id: number) =>
  client.post(`/webmail/accounts/${id}/test`);

export const setDefaultAccount = (id: number) =>
  client.post(`/webmail/accounts/${id}/default`);

// ── Folders ───────────────────────────────────────────

export const getFolders = (accountId: number) =>
  client.get('/webmail/folders', { params: { account_id: accountId } });

// ── Messages ──────────────────────────────────────────

export const getMessages = (params: MessageListParams) =>
  client.get('/webmail/messages', { params });

export const getMessage = (uid: number, accountId: number, folder = 'INBOX') =>
  client.get(`/webmail/messages/${uid}`, {
    params: { account_id: accountId, folder },
  });

export const deleteMessage = (uid: number, accountId: number, folder: string) =>
  client.delete(`/webmail/messages/${uid}`, {
    params: { account_id: accountId, folder },
  });

export const moveMessage = (data: MoveMessageInput) =>
  client.post('/webmail/messages/move', data);

export const flagMessage = (data: FlagMessageInput) =>
  client.post('/webmail/messages/flag', data);

// ── Send (multipart/form-data) ────────────────────────

export const sendEmail = (data: FormData) =>
  client.post('/webmail/send', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ── Attachments ───────────────────────────────────────

/** Returns a download URL — use fileDownload utility to stream */
export const getAttachmentUrl = (
  accountId: number,
  folder: string,
  uid: number,
  partId: string,
) =>
  `/webmail/attachment?account_id=${accountId}&folder=${encodeURIComponent(folder)}&uid=${uid}&partId=${partId}`;
```

> **Important — `sendEmail` FormData:**  
> React Native's `fetch` (and the custom client) handles `multipart/form-data` natively.  
> Build the `FormData` object in the compose screen (see §7 below).  
> Do **not** manually set a `boundary` — the HTTP layer adds it automatically.

---

## 3. TypeScript Interfaces

Create **`src/types/webmail.ts`**:

```typescript
// src/types/webmail.ts

// ── Address ───────────────────────────────────────────

export interface EmailAddress {
  name: string;
  address: string;
}

// ── Account ───────────────────────────────────────────

export interface MailboxAccount {
  id: number;
  user_id: string;
  display_name: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  is_default: boolean;
  is_active: boolean;
  last_connected_at: string | null;
  connection_error: string | null;
  created_at: string;
  updated_at: string;
  // ⚠️ Passwords are NEVER returned by the API
}

export interface CreateMailboxInput {
  display_name: string;     // 1–255 chars
  email_address: string;    // valid email
  password: string;         // email account password
  is_default?: boolean;
}

export interface UpdateMailboxInput {
  display_name?: string;
  email_address?: string;
  password?: string;
  is_default?: boolean;
  is_active?: boolean;
}

export interface ConnectionTestResult {
  imap: { connected: boolean; message: string };
  smtp: { connected: boolean; message: string };
}

// ── Folder ────────────────────────────────────────────

export interface MailFolder {
  path: string;            // e.g. 'INBOX', 'INBOX.Sent'
  name: string;            // e.g. 'INBOX', 'Sent'
  delimiter: string;       // e.g. '/' or '.'
  flags: string[];
  specialUse: string;      // '\\Inbox', '\\Sent', '\\Trash', '\\Drafts', '\\Junk'
  totalMessages: number;
  unseenMessages: number;
}

// ── Message ───────────────────────────────────────────

export interface MailMessageHeader {
  uid: number;
  messageId: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  date: string;            // ISO 8601
  flags: string[];         // '\\Seen', '\\Flagged', '\\Answered'
  size: number;
  preview: string;         // first ~200 chars plain text
}

export interface MailMessage extends MailMessageHeader {
  cc: EmailAddress[];
  bcc: EmailAddress[];
  html: string;
  text: string;
  attachments: MailAttachment[];
}

export interface MailAttachment {
  filename: string;
  contentType: string;
  size: number;
  partId: string;          // 1-based index string
  contentId?: string;      // for inline images
}

// ── List Response ─────────────────────────────────────

export interface MessageListResponse {
  messages: MailMessageHeader[];
  total: number;
  page: number;
  pages: number;
}

// ── Params & Inputs ───────────────────────────────────

export interface MessageListParams {
  account_id: number;
  folder?: string;         // defaults to 'INBOX'
  page?: number;           // defaults to 1
  limit?: number;          // defaults to 50, max 100
  search?: string;         // searches subject + from
}

export interface MoveMessageInput {
  account_id: number;
  folder: string;          // source folder path
  uid: number;
  destination: string;     // target folder path
}

export interface FlagMessageInput {
  account_id: number;
  folder: string;
  uid: number;
  flags: {
    seen?: boolean;
    flagged?: boolean;
    answered?: boolean;
  };
}
```

---

## 4. API Endpoint Quick-Reference

All routes require JWT (auto-attached by `client.ts`). Base: `https://api.softaware.net.za`

| # | Method | Path | Body / Params | Response `data` |
|---|--------|------|---------------|-----------------|
| 1 | GET | `/webmail/accounts` | — | `MailboxAccount[]` |
| 2 | POST | `/webmail/accounts` | `CreateMailboxInput` JSON | `{ id, email_address }` |
| 3 | PUT | `/webmail/accounts/:id` | `UpdateMailboxInput` JSON | `{ message }` |
| 4 | DELETE | `/webmail/accounts/:id` | — | `{ message }` |
| 5 | POST | `/webmail/accounts/:id/test` | — | `ConnectionTestResult` |
| 6 | POST | `/webmail/accounts/:id/default` | — | `{ message }` |
| 7 | GET | `/webmail/folders` | `?account_id` | `MailFolder[]` |
| 8 | GET | `/webmail/messages` | `?account_id&folder&page&limit&search` | `MessageListResponse` |
| 9 | GET | `/webmail/messages/:uid` | `?account_id&folder` | `MailMessage` |
| 10 | DELETE | `/webmail/messages/:uid` | `?account_id&folder` | `{ message }` |
| 11 | POST | `/webmail/messages/move` | `MoveMessageInput` JSON | `{ message }` |
| 12 | POST | `/webmail/messages/flag` | `FlagMessageInput` JSON | `{ message }` |
| 13 | POST | `/webmail/send` | `FormData` (multipart) | `{ message, data: { messageId } }` |
| 14 | GET | `/webmail/attachment` | `?account_id&folder&uid&partId` | Binary stream |

All JSON responses are wrapped: `{ success: boolean, data?: ..., error?: string }`

---

## 5. Navigation Placement

Add a **MailTab** to both `AdminTabNavigator` and `PortalTabNavigator` (all users can have email). Create a new feature stack:

```
├─ MailTab → MailStack
│   ├─ MailAccounts          (MailAccountsScreen)     ← account list + add
│   ├─ MailAccountForm       (MailAccountFormScreen)   ← create / edit account
│   ├─ MailFolders           (MailFoldersScreen)       ← folder list for an account
│   ├─ MailMessages          (MailMessagesScreen)      ← message list in a folder
│   ├─ MailMessageDetail     (MailMessageDetailScreen) ← full message view
│   └─ MailCompose           (MailComposeScreen) modal ← compose / reply / forward
```

### Navigation types

Add to `src/navigation/types.ts`:

```typescript
export type MailStackParamList = {
  MailAccounts: undefined;
  MailAccountForm: { accountId?: number };               // undefined = create
  MailFolders: { accountId: number };
  MailMessages: { accountId: number; folder: string };
  MailMessageDetail: { accountId: number; folder: string; uid: number };
  MailCompose: {
    accountId: number;
    replyTo?: { messageId: string; subject: string; to: string; references?: string };
    forward?: { subject: string; html: string; attachments?: MailAttachment[] };
  };
};
```

### Stack file

Create **`src/navigation/MailStack.tsx`**:

```typescript
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MailStackParamList } from './types';

const Stack = createNativeStackNavigator<MailStackParamList>();

export default function MailStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MailAccounts" component={MailAccountsScreen} />
      <Stack.Screen name="MailAccountForm" component={MailAccountFormScreen} />
      <Stack.Screen name="MailFolders" component={MailFoldersScreen} />
      <Stack.Screen name="MailMessages" component={MailMessagesScreen} />
      <Stack.Screen name="MailMessageDetail" component={MailMessageDetailScreen} />
      <Stack.Screen
        name="MailCompose"
        component={MailComposeScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
```

Register the tab in `AdminTabNavigator` and `PortalTabNavigator` with an envelope icon (e.g. `Ionicons` `mail-outline`).

---

## 6. Screens — Implementation Plan

### 6.1 MailAccountsScreen

**Purpose:** List the user's mailbox accounts. Entry point for the Mail tab.

| Element | Component | Notes |
|---------|-----------|-------|
| Account list | `PaginatedList` | Pull-to-refresh via `useCachedFetch` → `getAccounts()` |
| Each row | `ListItemCard` | Show `display_name`, `email_address`, connection status dot (green/red) |
| Add button | FAB or header action | Navigate → `MailAccountForm` |
| Row press | Navigate → `MailFolders { accountId }` | |
| Row long-press | Action sheet | Edit · Test Connection · Set Default · Delete |
| Test connection | `testAccount(id)` | Show `ConnectionTestResult` in Alert with ✅/❌ per protocol |
| Empty state | `EmptyView` | "No mailboxes yet — tap + to add one" |

### 6.2 MailAccountFormScreen

**Purpose:** Create or edit a mailbox account.

| Field | Input | Validation |
|-------|-------|------------|
| Display Name | `AppTextInput` | Required, 1–255 chars |
| Email Address | `AppTextInput` (keyboardType: email) | Required, valid email |
| Password | `AppTextInput` (secureTextEntry) | Required on create; optional on edit |
| Set as Default | Toggle / Switch | Optional |

- **Create:** `createAccount(data)` → navigate back + refresh list
- **Edit:** `updateAccount(id, data)` → navigate back + refresh list
- Server settings (IMAP/SMTP host, port, TLS) are managed by the admin — the user only provides the three fields above.

### 6.3 MailFoldersScreen

**Purpose:** Show IMAP folders for a mailbox account.

| Element | Component | Notes |
|---------|-----------|-------|
| Folder list | `FlatList` | `getFolders(accountId)` |
| Each row | `ListItemCard` | Show `name`, `totalMessages`, `unseenMessages` badge |
| Folder icon | By `specialUse` | `\\Inbox` → inbox, `\\Sent` → paper-plane, `\\Trash` → trash, `\\Drafts` → pencil, `\\Junk` → warning |
| Row press | Navigate → `MailMessages { accountId, folder: path }` | |
| Compose FAB | Floating button | Navigate → `MailCompose { accountId }` |

### 6.4 MailMessagesScreen

**Purpose:** Paginated message list for a folder.

| Element | Component | Notes |
|---------|-----------|-------|
| Message list | `PaginatedList` | `getMessages({ account_id, folder, page, limit })` |
| Each row | Custom `MailListItem` | Show `from.name`, `subject`, `date`, `preview`, unread bold, flagged star |
| Search bar | `AppTextInput` | Debounce 300 ms → `search` param |
| Row press | Navigate → `MailMessageDetail { accountId, folder, uid }` | |
| Swipe left | Delete | `deleteMessage(uid, accountId, folder)` |
| Swipe right | Flag/unflag | `flagMessage(...)` |
| Pull-to-refresh | Refresh page 1 | |
| Load more | Increment `page` | |
| Compose FAB | Floating button | Navigate → `MailCompose { accountId }` |

**Visual hints:**
- Unread (`\\Seen` NOT in flags) → bold subject + blue dot
- Flagged (`\\Flagged` in flags) → star icon
- Has attachments → paperclip icon (infer from list — or defer to detail view)

### 6.5 MailMessageDetailScreen

**Purpose:** Full email view with HTML body, attachments, and actions.

| Element | Component | Notes |
|---------|-----------|-------|
| Header | `GradientHeader` | Subject, from, to, date |
| HTML body | `WebView` (react-native-webview) | Render `html` field. Sanitise if needed. |
| Plain text fallback | `Text` | If `html` is empty, show `text` |
| Attachments | `FlatList` of `FileMessageBubble` | Show `filename`, `contentType`, `size` |
| Attachment tap | `fileDownload` utility | Download URL from `getAttachmentUrl(...)`, open with system viewer |
| Reply button | Navigate → `MailCompose { accountId, replyTo: { ... } }` | |
| Forward button | Navigate → `MailCompose { accountId, forward: { ... } }` | |
| Delete button | `deleteMessage(...)` → navigate back | |
| Move button | Bottom sheet → pick folder → `moveMessage(...)` | Reuse folder list from `getFolders()` |
| Flag toggle | `flagMessage(...)` | Toggle star in header |

### 6.6 MailComposeScreen (Modal)

**Purpose:** Compose, reply, or forward an email.

| Field | Input | Notes |
|-------|-------|-------|
| To | `AppTextInput` | Required. Comma-separated addresses |
| CC | `AppTextInput` | Optional, collapsible |
| BCC | `AppTextInput` | Optional, collapsible |
| Subject | `AppTextInput` | Required |
| Body | Multi-line `TextInput` or lightweight RichText | HTML body |
| Attachments | `AttachmentPicker` + `FileMessageBubble` list | Camera, Gallery, Document |

**Reply pre-fill:**
- `to` = original sender
- `subject` = `Re: ${original subject}`
- `inReplyTo` = original `messageId`
- `references` = original `messageId`
- Body = quoted original below separator

**Forward pre-fill:**
- `subject` = `Fwd: ${original subject}`
- Body = original HTML below separator
- Carry original attachments (re-download if needed)

**Building FormData for send:**

```typescript
const buildSendFormData = (
  accountId: number,
  to: string,
  subject: string,
  html: string,
  options?: {
    cc?: string;
    bcc?: string;
    text?: string;
    inReplyTo?: string;
    references?: string;
    attachments?: { uri: string; name: string; type: string }[];
  },
): FormData => {
  const fd = new FormData();
  fd.append('account_id', String(accountId));
  fd.append('to', to);
  fd.append('subject', subject);
  fd.append('html', html);

  if (options?.cc) fd.append('cc', options.cc);
  if (options?.bcc) fd.append('bcc', options.bcc);
  if (options?.text) fd.append('text', options.text);
  if (options?.inReplyTo) fd.append('inReplyTo', options.inReplyTo);
  if (options?.references) fd.append('references', options.references);

  options?.attachments?.forEach((file) => {
    fd.append('attachments', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
  });

  return fd;
};

// Usage:
const fd = buildSendFormData(accountId, to, subject, html, { cc, attachments: pickedFiles });
await sendEmail(fd);
```

> **⚠️ Do NOT set `Content-Type` header manually** — the HTTP client must auto-generate the `multipart/form-data` boundary. The existing `client.ts` handles this when it receives a `FormData` body.

---

## 7. Reusable Components Map

Existing components that can be used directly:

| Screen / Element | Component | Usage |
|------------------|-----------|-------|
| Account list | `PaginatedList` | Paginated pull-to-refresh list |
| Account rows | `ListItemCard` | Pressable card with status indicator |
| Empty states | `EmptyView` from `StateViews` | "No mailboxes" / "No messages" |
| Loading | `LoadingView` from `StateViews` | Full-screen spinner |
| Errors | `ErrorBanner` from `StateViews` | API error display |
| Screen headers | `GradientHeader` | Mail detail header, folder header |
| Form inputs | `AppTextInput` from `FormControls` | All form fields |
| Buttons | `AppButton` from `FormControls` | Send, Save, Delete, Test |
| Attachments (pick) | `AttachmentPicker` | Camera, Gallery, Document picker in compose |
| Attachments (display) | `FileMessageBubble` | File cards with download progress |
| File download | `utils/fileDownload.ts` | Download + cache + open attachment |
| Image viewer | `ImageViewerModal` | Inline image attachments |
| Badges | `Badge` / `NotificationDot` | Unread count on folders / messages |
| Avatar | `Avatar` | Sender initials in message list |

**New components needed:**

| Component | Suggested File | Purpose |
|-----------|---------------|---------|
| `MailListItem` | `ui/MailListItem.tsx` | Message row — sender, subject, date, preview, unread/flag indicators |
| `FolderRow` | `ui/FolderRow.tsx` | Folder row — icon by specialUse, name, message count, unread badge |
| `RecipientInput` | `ui/RecipientInput.tsx` | Chip-style email address input (optional — plain TextInput works for v1) |

---

## 8. State Management Approach

Webmail does **not** need a dedicated Context. Use `useCachedFetch` for read operations and direct API calls for mutations, matching the Tasks pattern.

```typescript
// In MailAccountsScreen:
const { data: accounts, loading, error, refresh } = useCachedFetch(
  'webmail-accounts',
  getAccounts,
  { ttl: 5 * 60 * 1000 }, // 5 min cache
);

// In MailMessagesScreen:
const { data, loading, error, refresh } = useCachedFetch(
  `webmail-messages-${accountId}-${folder}-${page}`,
  () => getMessages({ account_id: accountId, folder, page, limit: 30 }),
  { ttl: 60 * 1000 }, // 1 min — mail changes frequently
);
```

For mutations (send, delete, move, flag), call the API function directly and then call `refresh()` on the relevant cached query.

---

## 9. Attachment Download Flow

The `/webmail/attachment` endpoint streams binary with proper `Content-Type` and `Content-Disposition` headers. Use the existing `fileDownload.ts` utility:

```typescript
import { downloadFile, openFile } from '../utils/fileDownload';

const handleAttachmentPress = async (att: MailAttachment) => {
  const url = getAttachmentUrl(accountId, folder, uid, att.partId);
  const fullUrl = `${BASE_URL}${url}`; // prepend API base
  const localPath = await downloadFile(fullUrl, att.filename, {
    headers: { Authorization: `Bearer ${token}` },
    onProgress: (pct) => setProgress(pct),
  });
  await openFile(localPath);
};
```

---

## 10. Error Handling

The backend returns consistent error shapes:

```json
{ "success": false, "error": "Human-readable message" }
```

Key errors to handle in UI:

| Scenario | Error message | Suggested UX |
|----------|--------------|--------------|
| No domain config | "Mail server settings have not been configured. Please contact your administrator." | Show `ErrorBanner` — user cannot self-fix |
| IMAP connection failure | "IMAP connection failed: ..." | Show in test result or `ErrorBanner` |
| Account not found | "Account not found" | Navigate back + refresh list |
| Unauthorized (not owner) | "Account not found" (same) | Account doesn't belong to user |
| Send failure | "Failed to send email: ..." | Alert with retry option |
| Attachment too large | HTTP 413 or multer limit error | Alert: "File exceeds 25 MB limit" |

---

## 11. Suggested File Structure

```
src/
├── api/
│   └── webmail.ts                  ← NEW: API service module
├── types/
│   └── webmail.ts                  ← NEW: TypeScript interfaces
├── navigation/
│   ├── MailStack.tsx               ← NEW: Stack navigator
│   └── types.ts                    ← UPDATE: add MailStackParamList
├── screens/
│   └── mail/                       ← NEW: feature folder
│       ├── MailAccountsScreen.tsx
│       ├── MailAccountFormScreen.tsx
│       ├── MailFoldersScreen.tsx
│       ├── MailMessagesScreen.tsx
│       ├── MailMessageDetailScreen.tsx
│       └── MailComposeScreen.tsx
└── components/
    └── ui/
        ├── MailListItem.tsx         ← NEW: message row component
        └── FolderRow.tsx            ← NEW: folder row component
```

---

## 12. Implementation Order

| Step | Task | Depends On |
|------|------|-----------|
| 1 | Create `types/webmail.ts` | — |
| 2 | Create `api/webmail.ts` | Step 1 |
| 3 | Add `MailStackParamList` to `navigation/types.ts` | Step 1 |
| 4 | Create `MailStack.tsx` | Step 3 |
| 5 | Register `MailTab` in `AdminTabNavigator` + `PortalTabNavigator` | Step 4 |
| 6 | Build `MailAccountsScreen` | Steps 2, 4 |
| 7 | Build `MailAccountFormScreen` | Step 6 |
| 8 | Build `MailFoldersScreen` + `FolderRow` component | Step 6 |
| 9 | Build `MailMessagesScreen` + `MailListItem` component | Step 8 |
| 10 | Build `MailMessageDetailScreen` | Step 9 |
| 11 | Build `MailComposeScreen` (plain text first, attachments second) | Step 10 |
| 12 | Add reply/forward pre-fill logic | Step 11 |
| 13 | Polish — loading states, error banners, swipe actions, unread badge on tab | All |

---

## 13. Notes & Gotchas

1. **Passwords never returned** — The `GET /webmail/accounts` response omits `imap_password` and `smtp_password`. The edit form password field should show a placeholder like "••••••••" and only send a value if the user actually types a new password.

2. **Account creation is simple** — The user only provides `display_name`, `email_address`, and `password`. The backend pulls IMAP/SMTP server settings from the admin-configured domain settings automatically.

3. **Folder paths vary by server** — Some servers use `INBOX.Sent`, others use `Sent`. Always use the `path` field returned by `getFolders()`, never hardcode folder paths.

4. **Message UIDs are folder-scoped** — A UID is only unique within a folder. Always pass both `uid` and `folder` to message endpoints.

5. **Send uses FormData, not JSON** — The `/webmail/send` endpoint uses `multipart/form-data` because of file attachments. All fields (including `account_id`) must be appended as strings to the `FormData` object.

6. **Sent folder copy is automatic** — The backend auto-appends sent messages to the IMAP Sent folder. The mobile app does not need to do anything extra.

7. **Mark-as-read is automatic** — Opening a message via `GET /webmail/messages/:uid` automatically marks it as `\Seen` on the server.

8. **Delete tries Trash first** — The backend attempts to move to Trash. If that fails, it falls back to setting the `\Deleted` flag. No special handling needed on the mobile side.

9. **Tab badge** — Consider polling `getFolders(defaultAccountId)` periodically (or on app foreground) to get the INBOX `unseenMessages` count and show it as a badge on the Mail tab icon.
