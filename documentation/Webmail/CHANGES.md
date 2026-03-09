# Webmail — Changelog & Pending Changes

## Known Issues

| ID | Severity | Component | Description | Suggested Fix |
|----|----------|-----------|-------------|---------------|
| WM-001 | 🟠 High | `webmailService.ts` | IMAP connection opened per request — high latency, especially for folder listing (N+1 status queries) | Implement connection pooling per account or session-based keep-alive |
| WM-002 | 🟠 High | `webmailService.ts` | `getAttachment()` re-downloads entire message to extract one attachment by index | Use IMAP `BODY[partId]` for targeted part download |
| WM-003 | 🟡 Medium | `webmail.ts` | Send route has no Zod validation (multer multipart fields are strings) | Use `z.preprocess()` or create manual validation layer |
| WM-004 | 🟡 Medium | `webmailService.ts` | `listFolders()` calls `client.status()` sequentially for each folder | Parallelize or batch status queries |
| WM-005 | 🟡 Medium | `webmailService.ts` | Domain settings changes don't propagate to existing mailboxes | Add migration/update mechanism or pull settings at connection time |
| WM-006 | 🟡 Medium | `Webmail.tsx` | No local caching — every folder switch re-fetches from IMAP | Add in-memory or local storage cache with TTL |
| WM-007 | 🟡 Medium | `webmailService.ts` | `sendMail()` does extra `listTree()` on every send to find Sent folder | Cache Sent folder path per account in DB or memory |
| WM-008 | 🟢 Low | `webmailService.ts` | `listMessages()` returns empty `preview` field (never populated from envelope) | Fetch BODY.PEEK[1] for first text part preview |
| WM-009 | 🟢 Low | `webmail.ts` | Debug logging in send route (`[Webmail Send Debug]`) left in production | Remove or gate behind `NODE_ENV === 'development'` |
| WM-010 | 🟢 Low | `Webmail.tsx` | Activity indicator uses inline `<style>` tag for keyframe animation | Move animation to Tailwind config or CSS file |
| WM-011 | 🟢 Low | `App.tsx` / `Layout.tsx` | Route path is `/admin/webmail` but Webmail menu is in Main section | Consider moving route to `/webmail` for consistency |

---

## Migration Notes

### Connection Pooling (WM-001)
```typescript
// Create a connection cache keyed by account ID
const connectionCache = new Map<number, { client: ImapFlow; lastUsed: number }>();

// Reuse connections within a TTL window (e.g., 5 minutes)
function getImapClient(account: MailboxAccount): ImapFlow {
  const cached = connectionCache.get(account.id);
  if (cached && Date.now() - cached.lastUsed < 300_000) {
    cached.lastUsed = Date.now();
    return cached.client;
  }
  const client = createImapClient(account);
  connectionCache.set(account.id, { client, lastUsed: Date.now() });
  return client;
}
```

### Targeted Attachment Download (WM-002)
```typescript
// Instead of downloading full message:
const download = await client.download(String(uid), partId, { uid: true });
// Returns only the specific MIME part
```

### Remove Debug Logging (WM-009)
```typescript
// Remove or wrap:
if (process.env.NODE_ENV === 'development') {
  console.log('[Webmail Send Debug]', { ... });
}
```

---

## Suggested Improvements

### Short-term (Sprint-level)

1. **Remove debug logging** (WM-009) — Gate behind NODE_ENV or remove entirely.

2. **Cache Sent folder path** (WM-007) — Store detected Sent path in `user_mailboxes` table (new column) or in-memory Map, refresh on folder list.

3. **Propagate domain settings** (WM-005) — When admin saves settings, offer to update all existing mailboxes' server config.

4. **Add message preview** (WM-008) — Fetch BODY.PEEK[1] in listMessages to populate the preview field.

### Medium-term

1. **Connection pooling** (WM-001) — Per-account ImapFlow connection cache with TTL and idle disconnect.

2. **Targeted attachment download** (WM-002) — Use IMAP part addressing instead of full message re-download.

3. **Local message cache** (WM-006) — Cache message lists and read messages in React state or IndexedDB with invalidation on folder change.

4. **Batch folder status** (WM-004) — Use STATUS commands in parallel via `Promise.all()`.

### Long-term

1. **Draft support** — Save compose drafts to IMAP Drafts folder, auto-save on interval.

2. **Contacts integration** — Auto-complete recipients from app's Contacts module.

3. **Inline image support** — Handle `contentId` references in HTML body for embedded images.

4. **Multi-domain support** — Allow different IMAP/SMTP settings per email domain (currently single domain).

5. **Push notifications** — IMAP IDLE for real-time new message notifications.

6. **Signature management** — Per-account email signatures (HTML/text).

7. **Search improvements** — Full server-side IMAP SEARCH with more criteria (date range, has-attachment, etc.).

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| March 2026 | Copilot | **Initial Implementation** — Full webmail module: backend service (812 LOC), routes (413 LOC), frontend model (255 LOC), Webmail page (968 LOC). IMAP via imapflow, SMTP via nodemailer, AES-256-GCM credential encryption |
| March 2026 | Copilot | **Menu Reorganization** — Moved Webmail menu from Admin to Main section in sidebar. Moved Software/Updates to Development section |
| March 2026 | Copilot | **Simplified Mailbox Form** — Removed IMAP/SMTP fields from profile form. Added domain-wide server settings in System Settings (Webmail Server tab). Profile form now only: display_name, email_address, password, is_default |
| March 2026 | Copilot | **Fix 404 on PUT /webmail/settings** — Backend JS was stale; needed recompile (`npx tsc`) + PM2 restart |
| March 2026 | Copilot | **Fix 500 on POST /webmail/accounts** — `user_id` column was INT but auth returns string IDs. Fixed via `ALTER TABLE user_mailboxes MODIFY COLUMN user_id VARCHAR(100)` |
| March 2026 | Copilot | **Profile Test Refresh** — Added `loadMailboxes()` to `finally` block of `handleTest` so list refreshes after connection test |
| March 2026 | Copilot | **File Attachments** — Added multer multipart upload to send route (max 20 files, 25 MB). Frontend ComposeModal: drag-and-drop zone, file picker button, attachment list with size/remove. Model uses FormData |
| March 2026 | Copilot | **Sent Folder MIME Fix** — Fixed blank email in Sent folder caused by `filter(Boolean)` removing RFC 2822 mandatory blank line between headers and body |
| March 2026 | Copilot | **FormData Content-Type Fix** — Removed explicit `Content-Type: multipart/form-data` header from frontend (was stripping boundary needed by multer). Let axios auto-set |
| March 2026 | Copilot | **MailComposer for Sent Copy** — Replaced hand-built MIME with nodemailer MailComposer to build full RFC822 message (with attachments) for Sent folder append |
| March 2026 | Copilot | **Auto-Detect Sent Folder** — Scans IMAP folder tree for `specialUse: '\\Sent'` instead of hardcoding `'Sent'` path |

---

## Dependencies on Other Modules

| Module | Dependency Type | Description |
|--------|----------------|-------------|
| Authentication | Hard | JWT auth required for all routes (`requireAuth`) |
| Admin Roles | Hard | Settings endpoints require admin role (`requireAdmin`) |
| Encryption (cryptoUtils) | Hard | AES-256-GCM password encryption/decryption |
| System Settings (app_settings) | Hard | Domain IMAP/SMTP config stored in app_settings table |
| Profile | Soft | MailboxesTab in Profile page for account management UI |

## Modules That Depend on Webmail

| Module | Usage |
|--------|-------|
| Profile | MailboxesTab uses `WebmailAccountModel` for account CRUD and testing |
| System Settings | Webmail Server tab uses `WebmailSettingsModel` for domain config |
| Layout | Sidebar renders Webmail menu item in Main section |
