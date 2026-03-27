# Updates & Error Reporting Module — Architecture Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-06-10

---

## 1. Dual Authentication Model

The defining authentication pattern of this module. Two entirely separate auth mechanisms serve different audiences.

### Client Auth (software_key)

```
Client App
  → POST /updates/heartbeat
    Body: { software_key: "abc-123", hostname: "reception-pc", ... }
    — OR —
    Header: X-Software-Key: abc-123

  → Server:
    1. Extract software_key from body OR X-Software-Key header
    2. SELECT * FROM update_software WHERE software_key = ?
    3. If not found → 400 "Invalid software key"
    4. Proceed with client identity resolution
```

**Key characteristics:**
- **No user accounts** — clients authenticate with a shared product key, not per-user credentials
- **Two delivery methods** — body field `software_key` or `X-Software-Key` header (endpoints check both)
- **One key per software product** — all installations of the same software share one key
- **No token expiry** — software keys are static until manually rotated by an admin
- **Used by:** heartbeat, error-report (POST), download, update check

### Admin Auth (JWT Bearer)

```
Admin Browser
  → GET /updates/clients
    Header: Authorization: Bearer eyJhbGciOi...

  → Server:
    1. requireAuth middleware: verify JWT, attach user to req
    2. requireAdmin middleware: check user.role includes admin
    3. Proceed with admin operation
```

**Key characteristics:**
- Standard JWT Bearer token from `POST /auth/login`
- Middleware chain: `requireAuth` → `requireAdmin`
- Token contains `userId`, verified against `env.JWT_SECRET`
- **Used by:** clients (GET/PUT/DELETE), error-report (GET), software (POST/PUT/DELETE), updates (POST/PUT/DELETE), modules (mutations), dashboard

### Upload Auth (Hybrid)

```
Upload Tool
  → POST /updates/upload
    Header: X-API-Key: softaware_test_update_key_2026
    — OR —
    Header: Authorization: Bearer eyJhbGciOi...
```

The upload endpoint accepts **either** a static API key or a JWT token — the only endpoint with this dual mechanism. If JWT is provided, the uploading user is attributed in `uploaded_by`.

---

## 2. Heartbeat Protocol

### Heartbeat Lifecycle

```
┌─────────────────┐     POST /updates/heartbeat      ┌─────────────┐
│  Client App     │ ──────────────────────────────► │  Server       │
│                 │                                   │               │
│  Sends every    │     { software_key, hostname,     │  1. Validate  │
│  60s (desktop)  │       machine_name, ip_address,   │  2. Find/Upsert│
│  or on resume   │       os_info, app_version,       │  3. Check block│
│  (mobile)       │       current_user,               │  4. Store errors│
│                 │       recent_errors[] }            │  5. Check update│
│                 │                                   │  6. Read cmds  │
│                 │  ◄────────────────────────────── │  7. Return     │
│  Process resp:  │     { success, client_id,         │               │
│  • Show message │       update_available,           │               │
│  • Force logout │       latest_version,             │               │
│  • Download upd │       force_logout,               │               │
└─────────────────┘       server_message }            └───────────────┘
```

### Client Identity Resolution

Clients are identified by the composite of `(software_id, hostname, machine_name)`:

```sql
SELECT * FROM update_clients
WHERE software_id = ? AND hostname = ? AND machine_name = ?
```

If no match → INSERT new client record with `first_seen = NOW()`.

The `client_identifier` field is a derived value used for cross-referencing with error reports. It typically holds the hostname or a generated machine fingerprint.

### Status Computation

Status is **never stored** in the database. It's computed at query time from `last_heartbeat`:

```typescript
function computeClientStatus(secondsSinceHeartbeat: number): ClientStatus {
  if (secondsSinceHeartbeat < 300)     return 'online';   // < 5 minutes
  if (secondsSinceHeartbeat < 86400)   return 'recent';   // < 24 hours
  if (secondsSinceHeartbeat < 604800)  return 'inactive'; // < 7 days
  return 'offline';                                        // > 7 days
}
```

The backend computes `seconds_since_heartbeat` via SQL:
```sql
TIMESTAMPDIFF(SECOND, last_heartbeat, NOW()) AS seconds_since_heartbeat
```

The frontend receives this value and maps it to status using the same thresholds (replicated in `STATUS_CONFIG`).

### Command Delivery Pattern

Server-to-client commands use a **poll-and-clear** model:

```
Admin: PUT /updates/clients { id: 42, action: "send_message", message: "Update now" }
  → UPDATE update_clients SET server_message = "Update now" WHERE id = 42

Client: POST /updates/heartbeat { ... }
  → Server reads: SELECT force_logout, server_message FROM update_clients WHERE id = 42
  → Response includes: { server_message: "Update now" }
  → Server clears: UPDATE update_clients SET server_message = NULL WHERE id = 42

Client receives message → displays to user
Next heartbeat → server_message is NULL, no message delivered
```

**Available commands:**

| Command | DB Field | Delivery | Client Action |
|---------|----------|----------|---------------|
| `force_logout` | `force_logout = 1` | Next heartbeat | Client logs out current user |
| `send_message` | `server_message = "text"` | Next heartbeat | Client shows message dialog |
| `block` | `is_blocked = 1` | Next heartbeat | Client receives 403, should stop heartbeating |

---

## 3. Error Ingestion Pipeline

### Dual Ingestion Paths

Errors enter the system through two paths, both converging on the same storage logic:

```
Path 1: Dedicated Error Report
  POST /updates/error-report { software_key, errors: [...] }
  → updErrorReport.ts → normalizeError() → INSERT error_reports → UPSERT summaries

Path 2: Piggy-backed on Heartbeat
  POST /updates/heartbeat { ..., recent_errors: [...] }
  → updHeartbeat.ts → storeRecentErrors() → INSERT error_reports → UPSERT summaries
```

Both paths perform identical storage: INSERT individual errors + UPSERT aggregated summaries.

### Error Normalization

The `normalizeError()` function handles backward compatibility with different client implementations:

```typescript
function normalizeError(err: any) {
  return {
    error_type:    err.type    ?? err.error_type    ?? null,
    error_level:   err.level   ?? err.error_level   ?? 'error',
    error_message: err.message ?? err.error_message ?? null,
    file:          err.file        ?? null,
    line:          err.line        ?? null,
    stack_trace:   err.stack_trace ?? null,
    url:           err.url         ?? null,
    method:        err.method      ?? null,
  };
}
```

This allows clients to send either `{ type: "TypeError" }` or `{ error_type: "TypeError" }` — both are accepted.

### Summary Aggregation

The `client_error_summaries` table uses an **UPSERT pattern** keyed on `(software_key, client_identifier)`:

```sql
INSERT INTO client_error_summaries
  (software_key, client_identifier, hostname, total_errors, error_count, warning_count, notice_count, ...)
VALUES (?, ?, ?, ?, ?, ?, ?, ...)
ON DUPLICATE KEY UPDATE
  total_errors = total_errors + VALUES(total_errors),
  error_count = error_count + VALUES(error_count),
  warning_count = warning_count + VALUES(warning_count),
  notice_count = notice_count + VALUES(notice_count),
  last_error_at = NOW()
```

This provides O(1) lookups for per-client error totals without scanning the entire `error_reports` table.

---

## 4. File Upload & Download Pattern

### Upload Flow

```
Upload Client (CLI tool or admin UI)
  → POST /updates/upload (multipart/form-data)
    Field: updatePackage (file)
    Fields: software_id, version, description, ...

  → Server (updFiles.ts):
    1. Auth check: X-API-Key OR JWT Bearer
    2. multer stores to temp file: tmp_{timestamp}_{original_name}
    3. Zod validates body fields
    4. Verify software_id exists
    5. Rename temp → {version}_{timestamp}_{original_name}
    6. Compute SHA-256 checksum
    7. If update_id provided → replace existing (delete old file, UPDATE record)
       Else → INSERT new update_releases record
    8. Return { success, update_id, file_path, checksum }
    9. On error → clean up temp file
```

**Key design decisions:**
- **Temp-then-rename** — file is stored with a temp name, then renamed only after validation passes. If validation fails, the temp file is cleaned up.
- **Replace mode** — providing `update_id` replaces an existing release's file, avoiding orphaned files.
- **500 MB limit** — enforced by multer configuration.
- **SHA-256 checksum** — computed server-side for integrity verification.

### Download Flow

```
Client App
  → GET /updates/download?update_id=15
    Header: X-Software-Key: abc-123

  → Server (updFiles.ts):
    1. Validate software_key → lookup update_software
    2. Lookup update_releases by update_id
    3. Resolve file_path to absolute path
    4. Stream file with Content-Disposition: attachment
```

---

## 5. Frontend Auto-Refresh Pattern

Both admin pages implement the same auto-refresh pattern with identical UX controls.

### Pattern

```typescript
const [autoRefresh, setAutoRefresh] = useState(true);
const REFRESH_INTERVAL = 15_000; // or 30_000

useEffect(() => {
  fetchData();                              // Initial fetch
  if (!autoRefresh) return;
  const interval = setInterval(fetchData, REFRESH_INTERVAL);
  return () => clearInterval(interval);
}, [autoRefresh, /* ...filter dependencies */]);
```

**Implementation per page:**

| Page | Interval | Trigger Dependencies |
|------|----------|---------------------|
| ClientMonitor | 15 seconds | `autoRefresh`, `selectedSoftware` |
| ErrorReports | 30 seconds | `autoRefresh`, `activeTab`, `filters`, `page` |

**UX controls:**
- Toggle button in the page header to enable/disable auto-refresh
- Refresh pauses during detail interactions (drawer/modal open)
- Manual refresh button always available

---

## 6. Cross-Page Navigation Pattern

The Client Monitor and Error Reports pages are **bidirectionally linked** via URL search parameters:

### Client Monitor → Error Reports

```typescript
// In ClientDetailDrawer, "View Error Reports" action:
navigate(`/error-reports?hostname=${encodeURIComponent(client.hostname)}`);
```

### Error Reports → Client Monitor

```typescript
// In error table, hostname column is clickable:
<span onClick={() => navigate(`/client-monitor?search=${encodeURIComponent(hostname)}`)}>
  {hostname}
</span>
```

### URL Parameter Consumption

Both pages read URL params on mount to pre-populate filters:

```typescript
// ClientMonitor.tsx
const searchParams = new URLSearchParams(location.search);
const initialSearch = searchParams.get('search') || '';

// ErrorReports.tsx
const searchParams = new URLSearchParams(location.search);
const initialHostname = searchParams.get('hostname') || '';
```

This enables seamless drill-down workflows:
1. Admin sees noisy client in Client Monitor → clicks "View Error Reports"
2. Error Reports opens pre-filtered to that hostname
3. Admin sees error pattern → clicks hostname to go back to Client Monitor
4. Client Monitor opens with that hostname in the search box

---

## 7. Status-Based UI Filtering

The Client Monitor uses **summary cards as interactive filter buttons**:

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Total   │  │  Online  │  │  Recent  │  │ Inactive │  │ Offline  │  │ Blocked  │
│   150    │  │    23    │  │    45    │  │    32    │  │    47    │  │     3    │
│          │  │  (green) │  │ (yellow) │  │ (orange) │  │  (red)   │  │  (gray)  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
     ▲ click = show all    ▲ click = filter to online only
```

```typescript
// SummaryCard component (embedded in ClientMonitor.tsx)
const SummaryCard = ({ label, count, color, active, onClick }) => (
  <button
    onClick={onClick}
    className={`... ${active ? 'ring-2 ring-offset-2' : ''}`}
  >
    <div className={`text-2xl font-bold ${color}`}>{count}</div>
    <div className="text-sm text-gray-500">{label}</div>
  </button>
);

// Usage: clicking a card sets statusFilter state
<SummaryCard
  label="Online"
  count={clients.filter(c => c.status === 'online').length}
  active={statusFilter === 'online'}
  onClick={() => setStatusFilter(statusFilter === 'online' ? null : 'online')}
/>
```

Clicking the same card again **toggles the filter off** (shows all).

---

## 8. Error Detail Modal Pattern

The ErrorReports page uses a **click-to-expand** pattern where table rows are clickable:

```
┌─────────────────────────────────────────────────────────┐
│  Error Detail Modal                                 [✕] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Metadata Grid ──────────────────────────────────┐   │
│  │  Type: TypeError    Level: ● Error               │   │
│  │  Source: frontend   Hostname: reception-pc        │   │
│  │  Created: 2026-06-10 14:30                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ File Location ──────────────────────────────────┐   │
│  │  src/components/Widget.tsx : 42                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Request Info ───────────────────────────────────┐   │
│  │  GET /api/widgets?page=1                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Message (red background) ───────────────────────┐   │
│  │  Cannot read properties of undefined              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Stack Trace (dark background, monospace) ───────┐   │
│  │  TypeError: Cannot read properties of undefined   │   │
│  │    at Widget.render (Widget.tsx:42)                │   │
│  │    at processChild (react-dom.js:1234)             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The modal conditionally renders sections — file location only shown if `file` is present, request info only if `url` or `request_method` is present, stack trace only if `stack_trace` is present.

---

## 9. Client Detail Drawer Pattern

The ClientMonitor uses a **slide-in drawer** instead of a modal for client details:

```
                                          ┌──────────────────────────┐
  Main Table                              │  Client Detail Drawer    │
  ┌──────────────────────────────────┐    │                          │
  │  hostname  │ ip       │ status  │    │  ┌─ Info Grid ──────┐   │
  │  ─────────────────────────────── │    │  │ Hostname: ...    │   │
  │  pc-01     │ 10.0.0.1 │ ● online│◄───│  │ IP: ...          │   │
  │  pc-02     │ 10.0.0.2 │ ● recent│    │  │ OS: ...          │   │
  │  ...       │ ...      │ ...     │    │  │ Version: ...     │   │
  └──────────────────────────────────┘    │  │ Last HB: ...     │   │
                                          │  └──────────────────┘   │
                                          │                          │
                                          │  ┌─ Actions ────────┐   │
                                          │  │ [Block] [Logout]  │   │
                                          │  │ [Message] [Delete]│   │
                                          │  │ [View Errors]     │   │
                                          │  └──────────────────┘   │
                                          │                          │
                                          └──────────────────────────┘
```

Actions trigger `PUT /updates/clients` with the appropriate action payload, except:
- **delete** → `DELETE /updates/clients?id=N` (with SweetAlert confirmation)
- **view_errors** → `navigate('/error-reports?hostname=...')`
- **block** → prompts for reason text before sending
- **send_message** → prompts for message text before sending

---

## 10. Blocked Client Handling

Blocking is enforced at the **heartbeat level**, creating a server-side killswitch:

```
Admin blocks client:
  PUT /updates/clients { id: 42, action: "block", reason: "Suspicious activity" }
  → UPDATE update_clients SET is_blocked = 1, blocked_at = NOW(), blocked_reason = "..." WHERE id = 42

Next client heartbeat:
  POST /updates/heartbeat { software_key: "...", hostname: "pc-42", ... }
  → Server looks up client → sees is_blocked = 1
  → Returns 403 { success: false, blocked: true, reason: "Suspicious activity" }

Client should:
  1. Stop heartbeating (to avoid 403 spam)
  2. Display block reason to user
  3. Optionally disable functionality

Admin unblocks:
  PUT /updates/clients { id: 42, action: "unblock" }
  → UPDATE update_clients SET is_blocked = 0, blocked_at = NULL, blocked_reason = NULL WHERE id = 42

Client resumes heartbeating → receives success response
```

---

## 11. Version Comparison Pattern

The heartbeat endpoint checks for available updates using a simple version comparison:

```typescript
// In updHeartbeat.ts:
const latestRelease = await db.queryOne<UpdUpdate>(
  `SELECT id, version FROM update_releases
   WHERE software_id = ? ORDER BY released_at DESC LIMIT 1`,
  [software.id]
);

const updateAvailable = latestRelease && latestRelease.version !== client.app_version;
```

> **Note:** This uses **string inequality** (`!==`), not semantic version comparison. If the client's `app_version` differs from the latest release's `version` in any way, an update is flagged as available. This works correctly for standard version strings but does not handle pre-release or build metadata comparisons.

The lightweight `GET /check` endpoint uses the same logic but without updating client state.

---

## 12. Password Reset Flow

A three-step OTP flow with security best practices:

```
Step 1: Request OTP
  POST /updates/password_reset { identifier: "john@example.com" }
  → Always returns success (prevents user enumeration)
  → If user found: generates 6-digit OTP, stores in update_password_resets, sends via SMTP
  → OTP expires in 15 minutes

Step 2: Verify OTP
  POST /updates/verify_otp { identifier: "john@example.com", otp: "123456" }
  → Validates: user exists, token exists, not used, not expired
  → Returns user_id and username (needed for Step 3)

Step 3: Reset Password
  POST /updates/reset_password { identifier: "john@example.com", otp: "123456", new_password: "..." }
  → Re-validates OTP (defense in depth)
  → Hashes password with bcrypt (10 rounds)
  → Updates users.passwordHash
  → Marks token as used, deletes other tokens for same user
```

**Security measures:**
- Constant-time response on Step 1 (doesn't reveal if user exists)
- OTP is 6 digits (100,000 combinations) with 15-minute expiry
- Single-use tokens (marked `used = 1` after consumption)
- Expired tokens cleaned up on each new request
- Dev mode: OTP included in response for testing (`dev_otp` field)
