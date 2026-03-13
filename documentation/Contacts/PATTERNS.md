# Contacts — Patterns & Anti-Patterns

## Architectural Patterns

### 1. SQL Column Aliasing via CONTACT_SELECT
**Pattern**: Centralized SQL fragment rewriting DB column names to frontend-friendly names.

```typescript
const CONTACT_SELECT = `
  id AS contact_id, company_name AS contact_name, contact_person,
  location AS contact_address, email AS contact_email, phone AS contact_phone,
  fax AS contact_alt_phone, remarks AS contact_notes, website, contact_code, active,
  1 AS contact_type
`;
```

**Benefit**: Decouples DB schema from API contract — DB uses `company_name`, API returns `contact_name`.  
**Trade-off**: Hardcoded `contact_type = 1` means this SELECT always reports "customer" regardless of actual type.  
**Usage**: Reused across `GET /`, `GET /:id`, `POST`, and `PUT` routes.

---

### 2. Soft Delete Pattern
**Pattern**: `DELETE` route sets `active = 0` instead of removing the row.

```typescript
router.delete('/:id', async (req, res) => {
  await pool.query('UPDATE contacts SET active = 0 WHERE id = ?', [id]);
});
```

**Benefit**: Data recovery possible; referential integrity with invoices/quotations preserved.  
**Consistency**: All list queries include `WHERE active = 1` filter.  
**Gap**: No restore/undelete endpoint exists.

---

### 3. Five-Tab Admin Hub Architecture
**Pattern**: `Contacts.tsx` serves as a centralized admin hub with 5 tabs, each rendering a different entity type using a union `TabKey` type.

```typescript
type TabKey = 'customers' | 'suppliers' | 'assistants' | 'landingPages' | 'enterpriseEndpoints';
const [activeTab, setActiveTab] = useState<TabKey>('customers');
```

**Flow**:
- Tabs defined as array with icons, labels, and count badges from `overviewData.stats`
- Customer/Supplier tabs use `<DataTable>` with TanStack column defs
- Assistants/Landing Pages/Endpoints tabs use dedicated `render*()` functions with rich card grids
- `loadOverviewData()` called on mount → populates all non-contact tabs from single API call
- `loadContacts()` called separately for paginated customer/supplier data

**Benefit**: Single-page admin experience — everything in one place with tab-based navigation.  
**Data flow**: Two separate data sources — contact CRUD via `ContactModel`, everything else via `AdminClientModel.getOverview()`.

---

### 4. Rich Card Grid Pattern
**Pattern**: Assistants, Landing Pages, and Enterprise Endpoints are all rendered as responsive card grids instead of data tables.

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
  {items.map(item => (
    <div key={item.id} className="bg-white rounded-xl shadow-sm border ...">
      {/* Hero/header section */}
      {/* Info grid (2×2 or 3×2) */}
      {/* Stats row */}
      {/* Action buttons */}
    </div>
  ))}
</div>
```

**Card anatomy** (consistent across all 3 types):
1. **Header**: Visual identifier (hero image, color swatch, or LLM badge)
2. **Info grid**: Key metadata in 2×2 or 2×3 grid with label/value pairs
3. **Stats row**: Numeric highlights (knowledge sources, HTML size, request count)
4. **Owner**: Creator attribution with email
5. **Actions**: Contextual buttons (Chat/Preview/Logs/Copy/Toggle)

**Benefit**: Much richer information density than table rows; scannable at a glance.

---

### 5. Knowledge Health Score Calculation
**Pattern**: Frontend parses `knowledge_categories` JSON to compute a health percentage.

```typescript
const categories = JSON.parse(assistant.knowledge_categories);
const checklist = categories?.checklist || [];
const satisfied = checklist.filter((c: any) => c.satisfied).length;
const healthScore = checklist.length > 0 ? Math.round((satisfied / checklist.length) * 100) : 0;
```

**Display**: Progress bar (green ≥70%, yellow ≥40%, red <40%) + individual checklist items with ✓/✗ icons.

**Benefit**: Visual knowledge quality indicator for admins.  
**Data source**: `assistants.knowledge_categories` JSON column.

---

### 6. SSE Streaming Chat Pattern
**Pattern**: Chat modal uses Server-Sent Events (SSE) via `fetch()` for real-time assistant responses.

```typescript
const response = await fetch(`${API_BASE_URL}/v1/assistants/${id}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ message, history: chatHistoryRef.current })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Parse SSE chunks, accumulate content, update state
}
```

**Key details**:
- Conversation history maintained in `chatHistoryRef` (persists across messages)
- Auto-scroll to bottom on new content
- `chatStreaming` state disables input during response
- Graceful error handling with user-visible error messages

---

### 7. Admin Preview Bypass Pattern
**Pattern**: Site preview endpoint allows admin users to view any user's generated site.

```typescript
// siteBuilder.ts preview endpoint
if (site.user_id !== userId) {
  const [roles] = await pool.query(
    `SELECT r.name FROM user_roles ur 
     JOIN roles r ON ur.role_id = r.id 
     WHERE ur.user_id = ?`, [userId]
  );
  const isAdmin = roles.some(r => ['admin', 'super_admin'].includes(r.name));
  if (!isAdmin) return res.status(403).json({ error: 'Access denied' });
}
```

**Auth delivery**: JWT passed as `?token=` query parameter (not header) because preview opens in new tab/window.

```typescript
// Frontend preview button
window.open(`${API_BASE_URL}/v1/sites/${siteId}/preview?token=${encodeURIComponent(jwt)}`, '_blank');
```

**Note**: `API_BASE_URL` already includes `/api` — do NOT prepend `/api` again.

---

### 8. Explicit Collation in Cross-Table Subqueries
**Pattern**: When joining tables with different MySQL collations, explicit `COLLATE` clause resolves the mismatch.

```sql
-- assistants.id is utf8mb4_unicode_ci
-- assistant_knowledge.assistant_id is utf8mb4_0900_ai_ci
SELECT COUNT(DISTINCT ak.source)
FROM assistant_knowledge ak
WHERE ak.assistant_id = a.id COLLATE utf8mb4_0900_ai_ci
```

**Context**: The `assistants` table uses `utf8mb4_unicode_ci` while `assistant_knowledge` uses `utf8mb4_0900_ai_ci`. Without explicit COLLATE, MySQL throws "Illegal mix of collations" error.

**Rule**: Always apply `COLLATE utf8mb4_0900_ai_ci` to `a.id` (the unicode_ci side) when joining with `assistant_knowledge`.

---

### 9. In-Memory Rate Limiting
**Pattern**: `contactFormRouter.ts` uses a `Map<string, { count, firstRequest }>` for per-IP rate limiting on the public contact form.

**Configuration**: 5 requests per minute per IP.  
**Limitation**: In-memory — resets on server restart; not shared across PM2 cluster instances.

---

### 10. Honeypot Anti-Spam
**Pattern**: The public contact form includes a hidden `honeypot` field. If filled (by bots), the submission is silently accepted but discarded.

**Benefit**: Transparent to real users, confuses naive bots.

---

### 11. Owner Email Cascade Lookup
**Pattern**: For the contact form, the recipient email is resolved through a multi-table cascade:

```
generated_sites → widget_clients → users
```

Each query runs only if the previous one returned no result.

---

### 12. Permission Gating (Frontend Only for Contacts)
**Pattern**: Contact CRUD operations are wrapped in `<Can>` components:

```tsx
<Can permission="contacts.create">
  <button onClick={() => setShowForm(true)}>Add Contact</button>
</Can>
```

**Permissions used**: `contacts.view`, `contacts.create`, `contacts.edit`, `contacts.delete`  
**Gap**: Backend routes have no permission middleware — any authenticated user can perform any contact operation via direct API call.

---

### 13. Zod Validation with Express
**Pattern**: Request body validated using Zod schemas before database operations.

**Benefit**: Type-safe validation, consistent error format.  
**Consistency**: Used in both `POST` and `PUT` (with `.partial()` for updates).

---

### 14. Endpoint Logs Modal Pattern
**Pattern**: Enterprise endpoint cards have an in-context logs viewer modal.

```typescript
const loadEndpointLogs = async (endpointId: string) => {
  const logs = await AdminEnterpriseModel.getLogs(endpointId);
  setEndpointLogs(logs);
  setEndpointLogsId(endpointId);
};
```

**Display**: Timestamp, duration (ms), status badge (success/error), expandable JSON payload viewer.  
**UX**: Modal overlay with scrollable log list, click-to-expand individual entries.

---

### 15. Inline Status Toggle Pattern
**Pattern**: Status toggles (activate/pause) work directly from card action buttons without navigation.

```typescript
const handleEndpointStatusToggle = async (id: string, currentStatus: string) => {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  await AdminEnterpriseModel.updateStatus(id, newStatus);
  loadOverviewData(); // Refresh all data
};
```

**Benefit**: Quick admin actions without leaving the card context.

---

### 16. Contact Detail Rich Cards (Pattern Reuse)
**Pattern**: ContactDetails.tsx reuses the same rich card grid pattern from the admin hub (Contacts.tsx) but filtered by a single contact's linked user.

**Data flow**:
```
Contact (id) → users (WHERE contact_id = id) → linkedUserId
→ AdminClientModel.getClient(linkedUserId) → { client, assistants, landingPages }
```

**Reused elements**:
- Assistant rich cards: 2×2 info grid, Knowledge Health Score, Knowledge Base stats, Chat/Embed/Link buttons
- Landing page rich cards: hero image, status badges, stats grid, Preview/Live Site buttons
- Chat modal: SSE streaming, conversation history, auto-scroll
- Embed modal: Script snippet + direct chat URL
- `parseKnowledgeCategories()`, `formatSize()` helper functions

**Tabs** (6 total, was 7 before widgets removal):
1. Overview — financial summary
2. Invoices — DataTable
3. Quotations — DataTable
4. Statement — aging analysis + PDF download
5. Assistants — rich card grid (filtered by contact's linked user)
6. Landing Pages — rich card grid (filtered by contact's linked user)

**Widgets tab removed**: Previously existed with website URL, tier, message counts, page ingestion cards. Removed entirely — no nav button, no content, no handler function.

**Benefit**: Consistent admin experience — same rich card UX whether browsing all clients in the hub or drilling into a specific contact.

---

## Anti-Patterns & Issues

### A1. Client-Side Invoice/Quotation Filtering (ContactDetails.tsx)
**Problem**: The contact details page loads ALL invoices and ALL quotations, then filters client-side.

**Impact**: Performance degrades as invoice/quotation count grows.  
**Fix**: Use the existing `GET /contacts/:id/invoices` and `GET /contacts/:id/quotations` backend endpoints instead.

---

### A2. Hardcoded contact_type in CONTACT_SELECT
**Problem**: The SQL fragment always returns `1 AS contact_type`, making all contacts appear as "customers".

**Fix**: Store `contact_type` in the database and select it dynamically.

---

### A3. No Backend Authorization for Contact CRUD
**Problem**: All contact routes only require authentication (valid JWT), not specific permissions.

**Impact**: Any logged-in user can create, edit, and delete any contact, bypassing RBAC.  
**Fix**: Add `permissionMiddleware('contacts.create')` etc. to each route.  
**Note**: Admin routes DO enforce role via `requireAdmin` middleware.

---

### A4. Statement Routes Missing from Router
**Problem**: `ContactModel` has `getStatementData(id)` and `downloadStatement(id, params)` methods, but no corresponding routes exist in `contacts.ts`.

**Resolution**: Verify if statement routes are defined elsewhere; if not, implement them.

---

### A5. Rate Limit Map Memory Leak
**Problem**: The in-memory rate limit `Map` in `contactFormRouter.ts` never cleans up expired entries under certain conditions.

**Fix**: Add periodic cleanup interval or use a TTL-aware data structure.

---

### A6. No Input Sanitization on Contact Form
**Problem**: The public contact form (`/v1/leads/submit`) passes user input directly into the SMTP email HTML body without sanitization.

**Fix**: Escape HTML entities before embedding in email body.

---

### A7. Collation Mismatch Risk
**Problem**: `assistants.id` (utf8mb4_unicode_ci) and `assistant_knowledge.assistant_id` (utf8mb4_0900_ai_ci) use different collations. Any new query joining these tables MUST include explicit COLLATE.

**Impact**: 500 error ("Illegal mix of collations") if forgotten.  
**Fix**: Long-term — align collations via `ALTER TABLE`. Short-term — always use `COLLATE utf8mb4_0900_ai_ci` on `a.id`.

---

## Design Patterns Summary

| Pattern | Location | Quality |
|---------|----------|---------|
| Column aliasing (CONTACT_SELECT) | `contacts.ts` | ✅ Good (but hardcoded type) |
| Soft delete | `contacts.ts` | ✅ Good |
| Zod validation | `contacts.ts` | ✅ Good |
| 5-tab admin hub | `Contacts.tsx` | ✅ Good |
| Rich card grids | `Contacts.tsx`, `ContactDetails.tsx` | ✅ Good |
| Knowledge Health Score | `Contacts.tsx`, `ContactDetails.tsx` | ✅ Good |
| SSE streaming chat | `Contacts.tsx`, `ContactDetails.tsx` | ✅ Good |
| Admin preview bypass | `siteBuilder.ts` | ✅ Good |
| Explicit collation handling | `adminClientManager.ts` | ✅ Good (workaround) |
| Endpoint logs modal | `Contacts.tsx` | ✅ Good |
| Inline status toggle | `Contacts.tsx` | ✅ Good |
| Contact detail rich cards (pattern reuse) | `ContactDetails.tsx` | ✅ Good |
| Contact→User linkage for AI tabs | `ContactDetails.tsx` | ✅ Good |
| In-memory rate limiting | `contactFormRouter.ts` | ⚠️ Adequate |
| Honeypot anti-spam | `contactFormRouter.ts` | ✅ Good |
| Email cascade lookup | `contactFormRouter.ts` | ✅ Good |
| Frontend-only contact permissions | `Contacts.tsx` | ❌ Anti-pattern |
| Client-side filtering | `ContactDetails.tsx` | ❌ Anti-pattern |
| Mismatched collations | DB schema | ❌ Anti-pattern |
