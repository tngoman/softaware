# Webmail — File Inventory

## Backend Files

### `/var/opt/backend/src/services/webmailService.ts` (942 LOC)
**Purpose**: Core IMAP/SMTP operations, account CRUD, credential encryption, domain settings, signature storage
**Used by**: `webmail.ts` route handlers

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & setup | 1–18 | imapflow, nodemailer/MailComposer, mailparser, db, cryptoUtils |
| `MailboxAccount` interface | 21–43 | Full account type with decrypted passwords + signature |
| `MailFolder` interface | 45–53 | IMAP folder with message counts |
| `MailMessageHeader` interface | 55–66 | Envelope-level message data |
| `MailMessage` interface | 68–76 | Full parsed message with HTML/text/attachments |
| `MailAttachment` interface | 78–84 | Attachment metadata (filename, type, size, partId) |
| `SendMailInput` interface | 82–93 | Send parameters including optional file attachments |
| `ensureWebmailTable()` | 98–136 | CREATE TABLE IF NOT EXISTS with signature column (TEXT NULL) + migration ALTER |
| `WebmailDomainSettings` interface | 140–147 | Domain IMAP/SMTP config shape |
| `getWebmailSettings()` | 153–172 | Read `webmail_*` keys from `app_settings` |
| `saveWebmailSettings()` | 174–192 | UPSERT `webmail_*` keys into `app_settings` |
| `listMailboxes()` | 197–208 | SELECT accounts for user (includes signature, excludes passwords) |
| `getMailbox()` | 210–230 | SELECT single account + decrypt passwords |
| `createMailbox()` | 232–270 | Pull domain config, encrypt password, INSERT with signature, uses `db.insert()` |
| `updateMailbox()` | 272–320 | Partial update with password re-encryption, signature field support |
| `deleteMailbox()` | 322–328 | DELETE by id + userId |
| `setDefaultMailbox()` | 330–334 | Clear others, set new default |
| `createImapClient()` | 328–338 | Factory for ImapFlow instances |
| `testConnection()` | 342–393 | Test IMAP + SMTP independently, update DB status |
| `listFolders()` | 397–449 | IMAP listTree → recursive walk with status counts |
| `listMessages()` | 453–522 | Paginated IMAP fetch with search, envelope data |
| `getMessage()` | 526–589 | Full IMAP download + simpleParser, mark as Seen |
| `getAttachment()` | 593–624 | Download message + extract attachment by partId |
| `deleteMessage()` | 628–656 | Move to Trash or mark \Deleted |
| `moveMessage()` | 660–678 | IMAP messageMove |
| `flagMessage()` | 682–725 | Add/remove \Seen, \Flagged, \Answered flags |
| `sendMail()` | 729–812 | SMTP send → MailComposer RFC822 build → IMAP append to Sent folder |
| `getUnreadCount()` | 814–852 | Sum INBOX unseen count across all active user mailboxes (parallel IMAP STATUS) |

---

### `/var/opt/backend/src/routes/webmail.ts` (437 LOC)
**Purpose**: Express route handlers for all webmail API endpoints
**Mount**: `/webmail` via `webmailRouter`

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & setup | 1–50 | Express, Zod, auth, httpErrors, service imports |
| Auth middleware | 52 | `requireAuth` applied to all routes |
| Table initialization | 54–67 | Lazy `ensureWebmailTable()` on first request (wrapped in try/catch) |
| `GET /accounts` | 75–82 | List user's mailboxes |
| `coerceBool` helper | 84–88 | Zod preprocessor: MySQL TINYINT (0/1) → boolean coercion |
| `POST /accounts` | 91–114 | Add mailbox (CreateAccountSchema with signature, coerceBool) |
| `PUT /accounts/:id` | 116–138 | Update mailbox (UpdateAccountSchema with coerceBool) |
| `DELETE /accounts/:id` | 140–152 | Remove mailbox |
| `POST /accounts/:id/test` | 154–168 | Test IMAP/SMTP connection |
| `POST /accounts/:id/default` | 170–181 | Set default account |
| `resolveAccount()` helper | 170–179 | Extract & validate account from query param |
| `GET /folders` | 181–189 | List IMAP folders |
| `GET /messages` | 200–214 | List messages (paginated) |
| `GET /messages/:uid` | 216–230 | Get full message |
| `DELETE /messages/:uid` | 232–245 | Delete/trash message |
| `POST /messages/move` | 247–265 | Move message (MoveSchema) |
| `POST /messages/flag` | 267–292 | Flag message (FlagSchema) |
| `POST /send` | 298–340 | Send email (multer multipart, max 20 attachments) |
| `GET /attachment` | 342–362 | Download attachment |
| `GET /unread-count` | 364–374 | Unread INBOX count across all user accounts |
| `GET /settings` | 368–375 | Get domain server config (requireAdmin) |
| `PUT /settings` | 377–413 | Update domain server config (requireAdmin, WebmailSettingsSchema) |

---

## Frontend Files

### `/var/opt/frontend/src/models/WebmailModel.ts` (255 LOC)
**Purpose**: Static API wrapper for all webmail endpoints (3 model classes)

| Class | Method | HTTP | Endpoint | Notes |
|-------|--------|------|----------|-------|
| `WebmailAccountModel` | `list()` | GET | `/webmail/accounts` | |
| | `create(data)` | POST | `/webmail/accounts` | |
| | `update(id, data)` | PUT | `/webmail/accounts/:id` | |
| | `delete(id)` | DELETE | `/webmail/accounts/:id` | |
| | `testConnection(id)` | POST | `/webmail/accounts/:id/test` | |
| | `setDefault(id)` | POST | `/webmail/accounts/:id/default` | |
| `WebmailModel` | `getFolders(accountId)` | GET | `/webmail/folders` | |
| | `getMessages(accountId, folder, page, limit, search)` | GET | `/webmail/messages` | |
| | `getMessage(accountId, folder, uid)` | GET | `/webmail/messages/:uid` | |
| | `deleteMessage(accountId, folder, uid)` | DELETE | `/webmail/messages/:uid` | |
| | `moveMessage(accountId, folder, uid, dest)` | POST | `/webmail/messages/move` | |
| | `flagMessage(accountId, folder, uid, flags)` | POST | `/webmail/messages/flag` | |
| | `send(data)` | POST | `/webmail/send` | FormData (multipart) |
| | `getAttachmentUrl(...)` | — | `/webmail/attachment` | Returns URL string |
| `WebmailSettingsModel` | `get()` | GET | `/webmail/settings` | Admin only |
| | `save(data)` | PUT | `/webmail/settings` | Admin only |

---

### `/var/opt/frontend/src/pages/admin/Webmail.tsx` (1047 LOC)
**Purpose**: Full email client page — folder tree, message list, reading pane, compose modal

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–42 | React, Heroicons, Swal, models, config |
| Helper functions | 44–88 | `getFolderIcon()`, `formatDate()`, `formatFullDate()`, `formatSize()` |
| `ComposeModal` component | 97–470 | Compose/reply/forward with rich text editor, attachments, signature |
| Main `Webmail` component | 478–1047 | 3-column layout with all state and handlers |

**ComposeModal features**:
- Account selector (if multiple mailboxes)
- `getSignatureHtml(acctId)` — wraps account signature in styled `<div class="email-signature">`
- `buildInitialBody()` — initializes compose body with signature for new/reply/forward
- Automatic signature append on compose, reply, forward
- Account switcher swaps old signature div for new account’s signature
- To / Cc / Bcc fields (Cc/Bcc toggled)
- Rich text editor (contentEditable with toolbar: bold, italic, underline, lists, links)
- File attachment via toolbar button + hidden `<input type="file" multiple>`
- Drag-and-drop file attachment on entire modal
- Attachment list with filename, size, remove button
- Total size display + 25 MB limit warning
- Reply/Reply-All/Forward auto-population with original body and attachments
- Forward fetches original attachments via `/webmail/attachment` and includes them

**Main Webmail features**:
- Activity indicator bar (animated) during loading states
- Account switcher dropdown
- Search bar (Enter to search)
- Folder tree with icons, unread counts, active highlight
- Message list with sender, subject, date, flag/star indicators
- Pagination controls (page N of M)
- Reading pane with full HTML message rendering
- Message action toolbar: reply, reply-all, forward, delete, move, flag, mark read/unread
- Attachment list on viewed messages with download links
- Compose button (floating action)

---

### `/var/opt/frontend/src/pages/general/Profile.tsx` (2303 LOC, partial)
**Purpose**: User profile with MailboxesTab for managing email accounts
**Relevant section**: MailboxesTab — add/edit/delete mailboxes, test connection, signature editor

| Feature | Description |
|---------|-------------|
| Add mailbox form | display_name, email_address, password, signature, is_default toggle |
| Mailbox list | Card per account showing email, status badge, last connected, signature indicator |
| Test button | Tests IMAP + SMTP, shows result toast, refreshes list |
| Edit inline | Expand card to edit display name, email, password, signature, is_default |
| Delete | SweetAlert confirmation → delete account |
| Set default | Toggle default account |
| Signature editor | Dual-mode: ReactQuill WYSIWYG ("Visual") or raw HTML textarea with live preview ("HTML Source") |
| Insert Template | Inserts corporate HTML table template pre-filled with user’s first_name, last_name, phone (from Zustand store), and mailbox email |
| Zustand integration | `useAppStore()` for user profile data (name, email, phone) in signature template |

---

### `/var/opt/frontend/src/pages/system/SystemSettings.tsx` (981 LOC, partial)
**Purpose**: System settings with Webmail Server tab for domain IMAP/SMTP config
**Relevant section**: Webmail Server tab — 6 fields for domain mail server

| Feature | Description |
|---------|-------------|
| IMAP Host | Text input for IMAP hostname |
| IMAP Port | Number input (default 993) |
| IMAP Secure | Toggle for TLS |
| SMTP Host | Text input for SMTP hostname |
| SMTP Port | Number input (default 587) |
| SMTP Secure | Toggle for TLS |
| Save button | PUT /webmail/settings |

---

### `/var/opt/frontend/src/components/Layout/Layout.tsx` (partial)
**Relevant**: Sidebar navigation — Webmail menu item in **Main** section with dynamic unread count badge. Polls `GET /webmail/unread-count` every 2 minutes. Badge rendered as a red pill (white on active) next to the menu item name. Uses `badgeKey` field on `NavItem` interface for extensible badge support.

### `/var/opt/frontend/src/App.tsx` (partial)
**Relevant**: Route `/admin/webmail` → `Webmail` component

### `/var/opt/frontend/src/models/index.ts` (partial)
**Relevant**: Barrel exports for `WebmailModel`, `WebmailAccountModel`, `WebmailSettingsModel`, and all webmail types
