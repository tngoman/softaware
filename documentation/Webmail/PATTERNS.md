# Webmail — Patterns & Anti-Patterns

## Architectural Patterns

### 1. Domain Settings Indirection
**Pattern**: Users never enter IMAP/SMTP server details. Admins configure domain-wide server settings once in System Settings (`app_settings` table). When a user adds a mailbox, only email + password is needed — server config is pulled automatically.

```typescript
// createMailbox() pulls from domain settings
const serverCfg = await getWebmailSettings();
// INSERT uses serverCfg.imap_host, serverCfg.smtp_host, etc.
// Username = email_address, password = shared for both IMAP & SMTP
```

**Benefit**: Users can't misconfigure server settings. Admin changes propagate to new accounts.
**Trade-off**: Existing accounts retain the server config from creation time — updating domain settings doesn't retroactively update existing mailboxes.

---

### 2. AES-256-GCM Credential Encryption
**Pattern**: Passwords are encrypted before database storage and decrypted only when needed for IMAP/SMTP operations.

```typescript
// On create/update:
const encPwd = encryptPassword(data.password);  // → "iv:authTag:ciphertext"

// On use (getMailbox):
imap_password: decryptPassword(row.imap_password)  // → plaintext

// On list (listMailboxes):
// SELECT excludes imap_password, smtp_password columns entirely
```

**Benefit**: Passwords never stored in plaintext. List endpoint never exposes passwords.
**Trade-off**: If encryption key is lost/changed, all stored passwords become unrecoverable.

---

### 3. Shared Password for IMAP/SMTP
**Pattern**: A single password field on the profile form is encrypted once and stored in both `imap_password` and `smtp_password` columns. The username for both protocols is the email address.

```typescript
const encPwd = encryptPassword(data.password);
// ... imap_username = email_address, imap_password = encPwd
// ... smtp_username = email_address, smtp_password = encPwd
```

**Benefit**: Simplifies the user experience — one password for everything.
**Trade-off**: Can't support accounts with different IMAP/SMTP credentials.

---

### 4. Lazy Table Initialization
**Pattern**: The `user_mailboxes` table is created on first API request via middleware, not at server startup.

```typescript
let tableReady = false;
webmailRouter.use(async (_req, _res, next) => {
  if (!tableReady) {
    await ensureWebmailTable();
    tableReady = true;
  }
  next();
});
```

**Benefit**: No migration scripts needed for initial deployment. Table auto-creates with correct schema.
**Trade-off**: First request has slight delay. The in-memory flag resets on server restart.

---

### 5. MailComposer for Sent Folder
**Pattern**: After sending via SMTP, the full RFC822 message (including attachments) is rebuilt using nodemailer's `MailComposer` and appended to the IMAP Sent folder.

```typescript
const MailComposer = (await import('nodemailer/lib/mail-composer')).default;
const composer = new MailComposer({ ...mailOptions, messageId: info.messageId });
const rawMessage = await new Promise((resolve, reject) => {
  composer.compile().build((err, message) => { ... });
});
await client.append(sentPath, rawMessage, ['\\Seen']);
```

**Benefit**: Sent folder copy includes attachments, proper MIME structure, and matching Message-ID.
**Trade-off**: Attachments are held in memory during this process (up to 25 MB × 20 files).

---

### 6. Auto-Detect Sent Folder Path
**Pattern**: The Sent folder path varies by mail server (e.g., `Sent`, `INBOX.Sent`, `Sent Items`). The code scans the IMAP folder tree for `specialUse === '\\Sent'` before appending.

```typescript
const findSent = (items: any[]): string | null => {
  for (const item of items) {
    if (item.specialUse === '\\Sent') return item.path;
    if (item.folders) { const found = findSent(item.folders); if (found) return found; }
  }
  return null;
};
const detected = tree.folders ? findSent(tree.folders) : null;
if (detected) sentPath = detected;
```

**Benefit**: Works with any IMAP server regardless of folder naming conventions.
**Trade-off**: Extra IMAP `listTree()` call on every send. Could cache the path per account.

---

### 7. Multipart Form Data for Send (multer)
**Pattern**: The send endpoint uses multer for file upload handling instead of JSON body. Text fields and files are mixed in a single multipart request.

```typescript
const sendUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
webmailRouter.post('/send', sendUpload.array('attachments', 20), async (req, res, next) => {
  const body = req.body;  // text fields
  const files = (req.files as Express.Multer.File[]) || [];  // file buffers
});
```

**Frontend**: Uses `FormData` — must NOT set `Content-Type` header manually (axios auto-sets boundary).

```typescript
const formData = new FormData();
formData.append('to', data.to);
// ... text fields
data.attachments?.forEach(file => formData.append('attachments', file));
const res = await api.post('/webmail/send', formData);  // NO Content-Type header!
```

**Benefit**: Supports binary file uploads alongside text fields in a single request.
**Trade-off**: No Zod validation on send body (multipart fields are all strings). Manual validation instead.

---

### 8. IMAP Connection Per-Request
**Pattern**: Every IMAP operation creates a new `ImapFlow` client, connects, performs the operation, and disconnects.

```typescript
export async function listMessages(account, folder, page, limit, search) {
  const client = createImapClient(account);
  await client.connect();
  try {
    // ... operations
  } finally {
    await client.logout();
  }
}
```

**Benefit**: No connection pool to manage. No stale connections.
**Trade-off**: High latency per request (TCP + TLS handshake + IMAP login). Could benefit from connection pooling or keep-alive for the same session.

---

### 9. Attachment by Index (partId)
**Pattern**: Attachments are identified by their 1-based index in the parsed attachment array. The full message is re-downloaded and re-parsed to extract a single attachment.

```typescript
const download = await client.download(String(uid), undefined, { uid: true });
const parsed = await simpleParser(download.content);
const partIndex = parseInt(partId, 10) - 1;
const att = parsed.attachments?.[partIndex];
```

**Benefit**: Simple implementation, no MIME part addressing needed.
**Trade-off**: Re-downloads entire message for each attachment. Inefficient for large messages with many attachments.

---

## Anti-Patterns & Known Issues

### 1. Connection Per Request (Performance)
Every IMAP operation opens a new TCP+TLS connection. Folder listing alone requires N+1 connections (list + status per folder). Consider connection pooling or session caching.

### 2. Full Message Re-Download for Attachments
`getAttachment()` re-downloads and re-parses the entire message to extract one attachment by index. Should use IMAP BODY[partId] for targeted download.

### 3. No Zod Validation on Send Route
The send endpoint uses multer (multipart), so fields arrive as strings. Validation is done with manual `if (!body.html)` checks instead of Zod. Could use `z.preprocess()` to coerce types.

### 4. Sequential Folder Status Queries
`listFolders()` calls `client.status()` for each folder in a serial loop. Could parallelize or batch.

### 5. No Offline/Caching Layer
All data comes from live IMAP queries. Navigating between folders re-fetches everything. Adding a local cache would significantly improve UX.

### 6. Domain Settings Not Propagated to Existing Accounts
If admin changes domain settings, existing mailboxes retain old server config. Only new accounts pick up new settings.
