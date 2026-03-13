# Webmail Module

## Overview
The Webmail module provides a full-featured email client within the application, allowing users to connect existing email accounts from their domain and manage all mailboxes in a single UI. No emails are stored locally — all operations go directly to the IMAP/SMTP mail server in real time. Users add mailboxes from their Profile, admins configure domain-wide server settings in System Settings, and the Webmail page provides a 3-column layout for folder navigation, message listing, and reading/composing.

**Current Data**: 5 user mailboxes connected (as of March 2026)
**Last Updated**: March 2026 — Email signatures (per-account, HTML, WYSIWYG + source editor, template insertion), sent items attachment fix, forward fix, Zod coercion fix, MySQL strict mode migration fix

## Key Responsibilities
- Mailbox account management: add, edit, delete, test, set-default (per-user, multi-account)
- Per-account HTML email signatures with WYSIWYG editor, raw HTML source mode, and corporate template insertion
- Domain-wide mail server settings (IMAP/SMTP host, port, TLS) stored in `app_settings` — admin only
- Real-time IMAP folder listing with message counts (total + unseen)
- Message listing with pagination, search, flag indicators (seen, flagged, starred)
- Full message viewing with HTML rendering, text fallback, and inline attachments
- Email composition with rich text editor (contentEditable), CC/BCC, reply/reply-all/forward
- Automatic signature append on compose/reply/forward with per-account switching
- File attachments via drag-and-drop and file picker (max 20 files, 25 MB total)
- Sending via SMTP with automatic Sent folder append (full MIME via MailComposer)
- Message operations: delete/trash, move between folders, flag/unflag/mark-read
- Attachment download from viewed messages
- Forward email with original body and attachments preserved
- AES-256-GCM encrypted credential storage (passwords encrypted at rest)
- Connection testing (IMAP + SMTP independently)
- Unread INBOX count for sidebar badge (polled every 2 minutes)

## Architecture

### Backend
- **Service**: `src/services/webmailService.ts` (942 LOC) — Core IMAP/SMTP operations, account CRUD, credential encryption, domain settings, signature storage
- **Router**: `src/routes/webmail.ts` (437 LOC) — 17 route handlers mounted at `/webmail`
- **Database**: Direct `mysql2/promise` pool queries via `db` helper; `user_mailboxes` table + `app_settings` for domain config
- **Validation**: Zod schemas with `coerceBool` preprocessor for MySQL TINYINT → boolean coercion
- **File Uploads**: multer with memory storage for email attachments (max 25 MB per file, 20 files)
- **Encryption**: `cryptoUtils.ts` (AES-256-GCM) for password storage
- **IMAP**: imapflow library for all IMAP operations (connect, listTree, fetch, download, flags, move, append)
- **SMTP**: nodemailer for sending + MailComposer for building RFC822 Sent copies
- **MIME Parsing**: mailparser (simpleParser) for parsing downloaded messages

### Frontend
- **Webmail Page**: `src/pages/admin/Webmail.tsx` (1047 LOC) — Full email client with 3-column layout, compose modal, signature auto-append
- **Model**: `src/models/WebmailModel.ts` (267 LOC) — Static API wrapper (3 model classes, ~21 methods)
- **Profile Integration**: `src/pages/general/Profile.tsx` — MailboxesTab for adding/managing accounts with signature editor
- **Rich Text Editor**: `src/components/RichTextEditor.tsx` (112 LOC) — ReactQuill wrapper for WYSIWYG editing
- **System Settings**: `src/pages/system/SystemSettings.tsx` — Webmail Server tab for domain IMAP/SMTP config
- **Layout Badge**: `src/components/Layout/Layout.tsx` — Sidebar Webmail link shows unread count badge (polled every 2 min)
- **State**: Local component state (useState/useCallback) + Zustand `useAppStore` for user profile data in MailboxesTab
- **Styling**: Tailwind CSS with `picton-blue` accent

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `imapflow` | IMAP protocol operations (connect, list, fetch, download, flags, move, append) |
| `nodemailer` | SMTP sending + MailComposer for RFC822 message building |
| `mailparser` | MIME message parsing (simpleParser) |
| `multer` | Multipart file upload handling for email attachments |
| `mysql2/promise` | Database queries |
| `zod` | Request validation |
| `cryptoUtils` | AES-256-GCM password encryption/decryption |
| `requireAuth` middleware | JWT authentication for all routes |
| `requireAdmin` middleware | Admin-only route protection (settings endpoints) |
| `SweetAlert2` | User confirmations and feedback toasts |
| `Heroicons` | Folder/status/action icons |

## Database Tables

| Table | Purpose |
|-------|---------|
| `user_mailboxes` | Mailbox accounts per user (credentials, server config, status) |
| `app_settings` | Domain-wide mail server settings (`webmail_*` keys) |

## Key Data Flows

### Mailbox Setup (User)
```
Profile → MailboxesTab → Add Mailbox form
  → POST /webmail/accounts (display_name, email_address, password, signature, is_default)
  → Service pulls server settings from app_settings (webmail_imap_*, webmail_smtp_*)
  → Encrypts password with AES-256-GCM
  → INSERT into user_mailboxes (IMAP + SMTP config populated from domain settings)
  → Return { id, email_address }
```

### Signature Editing
```
Profile → MailboxesTab → Edit mailbox → Email Signature section
  → Two modes: "Visual" (ReactQuill WYSIWYG) or "HTML Source" (textarea + live preview)
  → "Insert Template" button → populates corporate template with user.first_name,
    user.last_name, user.phone, and mailbox email from user profile (Zustand store)
  → Template: <table> with Softaware logo + name + email + phone
  → Stored in user_mailboxes.signature column (TEXT NULL)
  → PUT /webmail/accounts/:id with { signature: html_string }
```

### Signature in Compose
```
Compose modal opens → getSignatureHtml(accountId)
  → Finds account in loaded accounts list
  → If account.signature exists → wraps in <div class="email-signature"> with top border
  → Appended to compose body (new compose, reply, forward)
  → Account switcher: swaps old signature div for new account's signature
```

### Connection Test
```
Profile → MailboxesTab → Test button
  → POST /webmail/accounts/:id/test
  → Service decrypts credentials
  → Connects to IMAP server (imapflow)
  → Connects to SMTP server (nodemailer verify)
  → UPDATE user_mailboxes SET last_connected_at, connection_error
  → Return { imap: { connected, message }, smtp: { connected, message } }
```

### Email Reading
```
Webmail page loads
  → GET /webmail/accounts (list user's mailboxes)
  → GET /webmail/folders?account_id=X (IMAP listTree with status counts)
  → GET /webmail/messages?account_id=X&folder=INBOX&page=1 (IMAP fetch with envelope)
  → User clicks message → GET /webmail/messages/:uid?account_id=X&folder=INBOX
    → IMAP download + simpleParser → mark as \Seen
    → Return { html, text, attachments[], from, to, cc, ... }
```

### Email Sending
```
Compose modal → handleSend()
  → Frontend builds FormData (to, cc, bcc, subject, html, text, attachment files)
  → POST /webmail/send (multipart/form-data via multer)
  → Service sends via nodemailer SMTP transport
  → MailComposer builds full RFC822 message (with attachments)
  → IMAP append to auto-detected Sent folder (\Sent specialUse)
  → Return { messageId }
```

### Attachment Download
```
Reading pane → click attachment
  → GET /webmail/attachment?account_id=X&folder=INBOX&uid=Y&partId=Z
  → IMAP download + simpleParser → extract attachment by partId index
  → Stream binary with Content-Disposition: attachment
```

### Admin Server Settings
```
System Settings → Webmail Server tab
  → GET /webmail/settings (reads webmail_* keys from app_settings)
  → Admin edits IMAP/SMTP host, port, TLS toggle
  → PUT /webmail/settings (UPSERT each key into app_settings)
```

### Sidebar Unread Badge
```
Layout mounts → fetchUnreadCount()
  → GET /webmail/unread-count
  → Service lists user's active mailboxes
  → For each account: IMAP connect → STATUS INBOX (unseen) → logout
  → Parallel execution via Promise.all
  → Return { total, accounts: [{ id, email_address, unseen }] }
  → Layout stores total in badgeCounts['webmail-unread']
  → Red badge pill rendered next to Webmail menu item
  → Polls every 2 minutes via setInterval
```
