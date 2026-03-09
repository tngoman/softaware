# Webmail — Field & Data Dictionary

## Database Schema: `user_mailboxes` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `INT` (PK, AI) | No | Auto | `id` | Auto-increment primary key |
| `user_id` | `VARCHAR(100)` | No | — | `user_id` | User ID (string, e.g., 'admin-softaware-001') |
| `display_name` | `VARCHAR(255)` | No | — | `display_name` | Friendly name shown in UI |
| `email_address` | `VARCHAR(255)` | No | — | `email_address` | Full email address |
| `imap_host` | `VARCHAR(255)` | No | — | `imap_host` | IMAP server hostname (populated from domain settings) |
| `imap_port` | `INT` | No | `993` | `imap_port` | IMAP port |
| `imap_secure` | `TINYINT(1)` | No | `1` | `imap_secure` | IMAP TLS enabled |
| `imap_username` | `VARCHAR(255)` | No | — | `imap_username` | IMAP username (= email_address) |
| `imap_password` | `TEXT` | No | — | — | AES-256-GCM encrypted password ⚠️ Never sent to frontend |
| `smtp_host` | `VARCHAR(255)` | No | — | `smtp_host` | SMTP server hostname (populated from domain settings) |
| `smtp_port` | `INT` | No | `587` | `smtp_port` | SMTP port |
| `smtp_secure` | `TINYINT(1)` | No | `1` | `smtp_secure` | SMTP TLS enabled |
| `smtp_username` | `VARCHAR(255)` | No | — | `smtp_username` | SMTP username (= email_address) |
| `smtp_password` | `TEXT` | No | — | — | AES-256-GCM encrypted password ⚠️ Never sent to frontend |
| `is_default` | `TINYINT(1)` | No | `0` | `is_default` | Default account flag (one per user) |
| `is_active` | `TINYINT(1)` | No | `1` | `is_active` | Account enabled/disabled |
| `last_connected_at` | `DATETIME` | Yes | `NULL` | `last_connected_at` | Last successful connection time |
| `connection_error` | `TEXT` | Yes | `NULL` | `connection_error` | Last connection error message |
| `created_at` | `DATETIME` | No | `CURRENT_TIMESTAMP` | `created_at` | Creation timestamp |
| `updated_at` | `DATETIME` | No | `CURRENT_TIMESTAMP` (on update) | `updated_at` | Last modification timestamp |

### Indexes

| Name | Type | Columns | Purpose |
|------|------|---------|---------|
| `PRIMARY` | Primary Key | `id` | Row identity |
| `idx_user_mailboxes_user` | Index | `user_id` | Fast lookup by user |
| `idx_user_mailboxes_email` | Index | `email_address` | Fast lookup by email |
| `idx_user_mailbox_unique` | Unique | `(user_id, email_address)` | Prevent duplicate accounts per user |

### Password Encryption Format
```
iv_hex:auth_tag_hex:ciphertext_hex
```
Encrypted via `cryptoUtils.encryptPassword()`, decrypted via `cryptoUtils.decryptPassword()`.
Algorithm: AES-256-GCM.

---

## Domain Settings: `app_settings` Table (webmail keys)

| setting_key | Type | Default | Description |
|-------------|------|---------|-------------|
| `webmail_imap_host` | `string` | `''` | IMAP server hostname for the domain |
| `webmail_imap_port` | `string` | `'993'` | IMAP port (parsed as int) |
| `webmail_imap_secure` | `string` | `'1'` | IMAP TLS (`'1'`/`'0'`) |
| `webmail_smtp_host` | `string` | `''` | SMTP server hostname for the domain |
| `webmail_smtp_port` | `string` | `'587'` | SMTP port (parsed as int) |
| `webmail_smtp_secure` | `string` | `'1'` | SMTP TLS (`'1'`/`'0'`) |

**Note**: All values stored as strings in `app_settings.setting_value`. Parsed by `getWebmailSettings()`.

---

## Backend TypeScript Interfaces

### `MailboxAccount` (full, internal use)
```typescript
interface MailboxAccount {
  id: number;
  user_id: number;
  display_name: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;
  imap_password: string;   // decrypted
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;   // decrypted
  is_default: boolean;
  is_active: boolean;
  last_connected_at: string | null;
  connection_error: string | null;
  created_at: string;
  updated_at: string;
}
```

### `MailboxAccount` (list endpoint, passwords excluded)
```typescript
// listMailboxes() returns: Omit<MailboxAccount, 'imap_password' | 'smtp_password'>
```

### `SendMailInput`
```typescript
interface SendMailInput {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  text?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}
```

### `WebmailDomainSettings`
```typescript
interface WebmailDomainSettings {
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
}
```

### `MailFolder`
```typescript
interface MailFolder {
  path: string;        // e.g. 'INBOX', 'INBOX.Sent'
  name: string;        // e.g. 'INBOX', 'Sent'
  delimiter: string;   // e.g. '/'
  flags: string[];
  specialUse: string;  // e.g. '\\Sent', '\\Trash', '\\Drafts'
  totalMessages: number;
  unseenMessages: number;
}
```

### `MailMessage`
```typescript
interface MailMessageHeader {
  uid: number;
  messageId: string;
  subject: string;
  from: { name: string; address: string };
  to: { name: string; address: string }[];
  date: string;     // ISO 8601
  flags: string[];  // e.g. ['\\Seen', '\\Flagged']
  size: number;
  preview: string;  // first 200 chars of text
}

interface MailMessage extends MailMessageHeader {
  cc: { name: string; address: string }[];
  bcc: { name: string; address: string }[];
  html: string;
  text: string;
  attachments: MailAttachment[];
}

interface MailAttachment {
  filename: string;
  contentType: string;
  size: number;
  partId: string;      // 1-based index string
  contentId?: string;  // for inline images
}
```

---

## Frontend TypeScript Interfaces

### `CreateMailboxInput` (Profile form → API)
```typescript
interface CreateMailboxInput {
  display_name: string;
  email_address: string;
  password: string;
  is_default?: boolean;
}
```

### `ConnectionTestResult`
```typescript
interface ConnectionTestResult {
  imap: { connected: boolean; message: string };
  smtp: { connected: boolean; message: string };
}
```

### `MessageListResponse`
```typescript
interface MessageListResponse {
  messages: MailMessageHeader[];
  total: number;
  page: number;
  pages: number;
}
```
