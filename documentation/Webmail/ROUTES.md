# Webmail — Route & API Reference

## Route Registration

**Backend mount point**: `/webmail` — All routes require JWT via `requireAuth`; settings routes additionally require `requireAdmin`

```
src/routes/webmail.ts → webmailRouter mounted at /webmail
```

---

## Route Summary

### Account Management

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | GET | `/webmail/accounts` | JWT | List user's mailboxes |
| 2 | POST | `/webmail/accounts` | JWT | Add a mailbox |
| 3 | PUT | `/webmail/accounts/:id` | JWT | Update a mailbox |
| 4 | DELETE | `/webmail/accounts/:id` | JWT | Remove a mailbox |
| 5 | POST | `/webmail/accounts/:id/test` | JWT | Test IMAP/SMTP connection |
| 6 | POST | `/webmail/accounts/:id/default` | JWT | Set default account |

### Mail Operations

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 7 | GET | `/webmail/folders` | JWT | List IMAP folders |
| 8 | GET | `/webmail/messages` | JWT | List messages in folder |
| 9 | GET | `/webmail/messages/:uid` | JWT | Get full message |
| 10 | DELETE | `/webmail/messages/:uid` | JWT | Delete/trash message |
| 11 | POST | `/webmail/messages/move` | JWT | Move message to folder |
| 12 | POST | `/webmail/messages/flag` | JWT | Flag/unflag message |
| 13 | POST | `/webmail/send` | JWT | Send email (multipart) |
| 14 | GET | `/webmail/attachment` | JWT | Download attachment |

### Admin Settings

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 15 | GET | `/webmail/settings` | JWT + Admin | Get domain mail server config |
| 16 | PUT | `/webmail/settings` | JWT + Admin | Update domain mail server config |

---

## Detailed Route Documentation

### 1. GET `/webmail/accounts`
**Purpose**: List all mailboxes for the authenticated user
**Auth**: JWT required

**Response** `200`:
```json
{
  "success": true,
  "data": [{
    "id": 1,
    "user_id": "admin-softaware-001",
    "display_name": "My Personal",
    "email_address": "user@example.com",
    "imap_host": "mail.example.com",
    "imap_port": 993,
    "imap_secure": true,
    "imap_username": "user@example.com",
    "smtp_host": "mail.example.com",
    "smtp_port": 465,
    "smtp_secure": true,
    "smtp_username": "user@example.com",
    "is_default": true,
    "is_active": true,
    "last_connected_at": "2026-03-06T20:10:00.000Z",
    "connection_error": null,
    "created_at": "...",
    "updated_at": "..."
  }]
}
```

⚠️ **Note**: Passwords are never included in the list response (`Omit<MailboxAccount, 'imap_password' | 'smtp_password'>`).

---

### 2. POST `/webmail/accounts`
**Purpose**: Add a new mailbox account
**Auth**: JWT required
**Body**: Validated with `CreateAccountSchema`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_name` | `string` | Yes | Friendly name (1–255 chars) |
| `email_address` | `string` | Yes | Valid email address |
| `password` | `string` | Yes | Email account password |
| `is_default` | `boolean` | No | Set as default account |

**Flow**:
1. Zod validate request body
2. Service reads domain settings from `app_settings` (webmail_imap_*, webmail_smtp_*)
3. If no domain settings configured → throw error
4. If `is_default` → clear other user's defaults
5. Encrypt password with AES-256-GCM
6. INSERT into `user_mailboxes` (server config from domain settings, username = email)

**Response** `201`:
```json
{ "success": true, "data": { "id": 1, "email_address": "user@example.com" } }
```

**Error** `500` (no domain config):
```json
{ "success": false, "error": "Mail server settings have not been configured. Please contact your administrator." }
```

---

### 3. PUT `/webmail/accounts/:id`
**Purpose**: Update a mailbox account
**Auth**: JWT required (must own the mailbox)
**Body**: Validated with `UpdateAccountSchema`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_name` | `string` | No | Friendly name |
| `email_address` | `string` | No | Email address (also updates IMAP/SMTP username) |
| `password` | `string` | No | New password (re-encrypted for both IMAP/SMTP) |
| `is_default` | `boolean` | No | Set as default |
| `is_active` | `boolean` | No | Enable/disable account |

**Response** `200`:
```json
{ "success": true, "message": "Mailbox updated" }
```

---

### 4. DELETE `/webmail/accounts/:id`
**Purpose**: Remove a mailbox account
**Auth**: JWT required (must own the mailbox)

**Response** `200`:
```json
{ "success": true, "message": "Mailbox removed" }
```

---

### 5. POST `/webmail/accounts/:id/test`
**Purpose**: Test IMAP and SMTP connection independently
**Auth**: JWT required (must own the mailbox)

**Flow**:
1. Decrypt stored credentials
2. Attempt IMAP connect (imapflow) → login → logout
3. Attempt SMTP verify (nodemailer transport.verify())
4. Update `last_connected_at` and `connection_error` in DB

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "imap": { "connected": true, "message": "IMAP connection successful" },
    "smtp": { "connected": true, "message": "SMTP connection successful" }
  }
}
```

---

### 6. POST `/webmail/accounts/:id/default`
**Purpose**: Set a mailbox as the default account
**Auth**: JWT required (must own the mailbox)

**Flow**: Clear all user's `is_default` → set this one to `1`

**Response** `200`:
```json
{ "success": true, "message": "Default account updated" }
```

---

### 7. GET `/webmail/folders`
**Purpose**: List all IMAP folders for an account with message counts
**Auth**: JWT required
**Query params**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `account_id` | `number` | Yes | Mailbox account ID |

**Flow**: IMAP `listTree()` → recursive walk → `status()` for each folder

**Response** `200`:
```json
{
  "success": true,
  "data": [
    { "path": "INBOX", "name": "INBOX", "delimiter": "/", "flags": [], "specialUse": "\\Inbox", "totalMessages": 42, "unseenMessages": 3 },
    { "path": "INBOX.Sent", "name": "Sent", "delimiter": ".", "flags": [], "specialUse": "\\Sent", "totalMessages": 15, "unseenMessages": 0 }
  ]
}
```

---

### 8. GET `/webmail/messages`
**Purpose**: List messages in a folder with pagination and search
**Auth**: JWT required
**Query params**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `account_id` | `number` | — | **Required** — Mailbox account ID |
| `folder` | `string` | `'INBOX'` | IMAP folder path |
| `page` | `number` | `1` | Page number (1-based) |
| `limit` | `number` | `50` | Messages per page (max 100) |
| `search` | `string` | — | Search subject or from |

**Flow**: IMAP fetch with envelope, flags, size → reverse for newest-first

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "messages": [{
      "uid": 123,
      "messageId": "<abc@example.com>",
      "subject": "Hello",
      "from": { "name": "John", "address": "john@example.com" },
      "to": [{ "name": "You", "address": "you@example.com" }],
      "date": "2026-03-06T10:00:00.000Z",
      "flags": ["\\Seen"],
      "size": 4096,
      "preview": ""
    }],
    "total": 42,
    "page": 1,
    "pages": 1
  }
}
```

---

### 9. GET `/webmail/messages/:uid`
**Purpose**: Get full message content (HTML, text, attachments)
**Auth**: JWT required
**Query params**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `account_id` | `number` | — | **Required** |
| `folder` | `string` | `'INBOX'` | IMAP folder path |

**Flow**: IMAP download → `simpleParser` → mark as `\Seen` → extract HTML/text/attachments

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "uid": 123,
    "messageId": "<abc@example.com>",
    "subject": "Hello",
    "from": { "name": "John", "address": "john@example.com" },
    "to": [{ "name": "You", "address": "you@example.com" }],
    "cc": [],
    "bcc": [],
    "date": "2026-03-06T10:00:00.000Z",
    "flags": ["\\Seen"],
    "size": 0,
    "preview": "Hello, this is a test...",
    "html": "<p>Hello, this is a test</p>",
    "text": "Hello, this is a test",
    "attachments": [
      { "filename": "report.pdf", "contentType": "application/pdf", "size": 12345, "partId": "1" }
    ]
  }
}
```

---

### 10. DELETE `/webmail/messages/:uid`
**Purpose**: Delete or trash a message
**Auth**: JWT required
**Query params**: `account_id`, `folder`

**Flow**: Try `messageMove` to Trash → fallback to `\Deleted` flag + `messageDelete`

**Response** `200`:
```json
{ "success": true, "message": "Message deleted" }
```

---

### 11. POST `/webmail/messages/move`
**Purpose**: Move a message to another folder
**Auth**: JWT required
**Body**: Validated with `MoveSchema`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `account_id` | `number` | Yes | Mailbox account ID |
| `folder` | `string` | Yes | Source folder path |
| `uid` | `number` | Yes | Message UID |
| `destination` | `string` | Yes | Target folder path |

**Response** `200`:
```json
{ "success": true, "message": "Message moved" }
```

---

### 12. POST `/webmail/messages/flag`
**Purpose**: Add or remove message flags
**Auth**: JWT required
**Body**: Validated with `FlagSchema`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `account_id` | `number` | Yes | Mailbox account ID |
| `folder` | `string` | Yes | Folder path |
| `uid` | `number` | Yes | Message UID |
| `flags.seen` | `boolean` | No | Mark read/unread |
| `flags.flagged` | `boolean` | No | Star/unstar |
| `flags.answered` | `boolean` | No | Mark as answered |

**Response** `200`:
```json
{ "success": true, "message": "Flags updated" }
```

---

### 13. POST `/webmail/send`
**Purpose**: Send an email via SMTP with optional file attachments
**Auth**: JWT required
**Content-Type**: `multipart/form-data` (handled by multer)
**Limits**: Max 20 files, 25 MB per file

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `account_id` | `string` (parsed as int) | Yes | Mailbox account ID |
| `to` | `string` | Yes | Recipient(s) |
| `cc` | `string` | No | CC recipients |
| `bcc` | `string` | No | BCC recipients |
| `subject` | `string` | Yes | Email subject |
| `html` | `string` | Yes | HTML body |
| `text` | `string` | No | Plain text body |
| `inReplyTo` | `string` | No | In-Reply-To header |
| `references` | `string` | No | References header |
| `attachments` | `File[]` | No | Attached files (multipart) |

**Flow**:
1. multer parses multipart form data (files in memory)
2. Validate required fields manually (not Zod — multipart strings)
3. Get user's mailbox account (decrypt credentials)
4. nodemailer `sendMail()` via SMTP transport
5. `MailComposer` builds full RFC822 message (including attachments)
6. Auto-detect Sent folder via IMAP `listTree()` (`specialUse: '\\Sent'`)
7. IMAP `append()` RFC822 message to Sent folder with `\Seen` flag
8. Return messageId

**Response** `200`:
```json
{ "success": true, "message": "Email sent successfully", "data": { "messageId": "<abc@example.com>" } }
```

⚠️ **Note**: Sent folder append is best-effort. If IMAP append fails, the email is still sent successfully — failure is logged but not returned to the client.

---

### 14. GET `/webmail/attachment`
**Purpose**: Download an attachment from a message
**Auth**: JWT required
**Query params**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `account_id` | `number` | Yes | Mailbox account ID |
| `folder` | `string` | Yes | Folder path |
| `uid` | `number` | Yes | Message UID |
| `partId` | `string` | Yes | Attachment part ID (1-based index) |

**Flow**: IMAP download → simpleParser → extract attachment by index → stream binary

**Response**: Binary file with `Content-Type` and `Content-Disposition: attachment` headers

---

### 15. GET `/webmail/settings`
**Purpose**: Get domain-wide mail server configuration
**Auth**: JWT + Admin required

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "imap_host": "mail.softaware.co.za",
    "imap_port": 993,
    "imap_secure": true,
    "smtp_host": "mail.softaware.co.za",
    "smtp_port": 465,
    "smtp_secure": true
  }
}
```

---

### 16. PUT `/webmail/settings`
**Purpose**: Update domain-wide mail server configuration
**Auth**: JWT + Admin required
**Body**: Validated with `WebmailSettingsSchema`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imap_host` | `string` | Yes | IMAP hostname |
| `imap_port` | `number` | Yes | IMAP port (1–65535) |
| `imap_secure` | `boolean` | Yes | IMAP TLS |
| `smtp_host` | `string` | Yes | SMTP hostname |
| `smtp_port` | `number` | Yes | SMTP port (1–65535) |
| `smtp_secure` | `boolean` | Yes | SMTP TLS |

**Flow**: UPSERT each key into `app_settings` table

**Response** `200`:
```json
{ "success": true, "message": "Webmail server settings updated" }
```
