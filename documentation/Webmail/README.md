# Webmail Module

## Overview
The Webmail module provides a full-featured email client within the application, allowing users to connect existing email accounts from their domain and manage all mailboxes in a single UI. No emails are stored locally — all operations go directly to the IMAP/SMTP mail server in real time. Users add mailboxes from their Profile, admins configure domain-wide server settings in System Settings, and the Webmail page provides a 3-column layout for folder navigation, message listing, and reading/composing.

**Current Data**: 1 user mailbox connected (as of March 2026)
**Last Updated**: March 2026 — File attachment support via multer, MailComposer for Sent folder copies, auto-detect Sent folder path

## Key Responsibilities
- Mailbox account management: add, edit, delete, test, set-default (per-user, multi-account)
- Domain-wide mail server settings (IMAP/SMTP host, port, TLS) stored in `app_settings` — admin only
- Real-time IMAP folder listing with message counts (total + unseen)
- Message listing with pagination, search, flag indicators (seen, flagged, starred)
- Full message viewing with HTML rendering, text fallback, and inline attachments
- Email composition with rich text editor (contentEditable), CC/BCC, reply/reply-all/forward
- File attachments via drag-and-drop and file picker (max 20 files, 25 MB total)
- Sending via SMTP with automatic Sent folder append (full MIME via MailComposer)
- Message operations: delete/trash, move between folders, flag/unflag/mark-read
- Attachment download from viewed messages
- AES-256-GCM encrypted credential storage (passwords encrypted at rest)
- Connection testing (IMAP + SMTP independently)

## Architecture

### Backend
- **Service**: `src/services/webmailService.ts` (812 LOC) — Core IMAP/SMTP operations, account CRUD, credential encryption, domain settings
- **Router**: `src/routes/webmail.ts` (413 LOC) — 17 route handlers mounted at `/webmail`
- **Database**: Direct `mysql2/promise` pool queries via `db` helper; `user_mailboxes` table + `app_settings` for domain config
- **Validation**: Zod schemas for account create/update, message move/flag, settings
- **File Uploads**: multer with memory storage for email attachments (max 25 MB per file, 20 files)
- **Encryption**: `cryptoUtils.ts` (AES-256-GCM) for password storage
- **IMAP**: imapflow library for all IMAP operations (connect, listTree, fetch, download, flags, move, append)
- **SMTP**: nodemailer for sending + MailComposer for building RFC822 Sent copies
- **MIME Parsing**: mailparser (simpleParser) for parsing downloaded messages

### Frontend
- **Webmail Page**: `src/pages/admin/Webmail.tsx` (968 LOC) — Full email client with 3-column layout, compose modal
- **Model**: `src/models/WebmailModel.ts` (255 LOC) — Static API wrapper (3 model classes, ~20 methods)
- **Profile Integration**: `src/pages/general/Profile.tsx` — MailboxesTab for adding/managing accounts
- **System Settings**: `src/pages/system/SystemSettings.tsx` — Webmail Server tab for domain IMAP/SMTP config
- **State**: Local component state (useState/useCallback) — no Zustand store
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
  → POST /webmail/accounts (display_name, email_address, password, is_default)
  → Service pulls server settings from app_settings (webmail_imap_*, webmail_smtp_*)
  → Encrypts password with AES-256-GCM
  → INSERT into user_mailboxes (IMAP + SMTP config populated from domain settings)
  → Return { id, email_address }
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
