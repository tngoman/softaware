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

### 3. Customer/Supplier Tab Architecture
**Pattern**: Frontend uses a single `Contacts` component with `activeTab` state to separate customers and suppliers.

```typescript
const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
```

**Flow**:
- Tab toggle sets `activeTab`
- `useEffect` triggers `fetchContacts()` when tab changes
- API call includes type parameter
- Results stored in separate Zustand arrays: `customers` / `suppliers`

**Benefit**: Single component handles two logical entity lists.  
**Observation**: The backend `CONTACT_SELECT` hardcodes `contact_type = 1`, so the customer/supplier distinction may be handled at a layer not visible in the current router (possibly middleware or a different query path for suppliers).

---

### 4. In-Memory Rate Limiting
**Pattern**: `contactFormRouter.ts` uses a `Map<string, { count, firstRequest }>` for per-IP rate limiting on the public contact form.

```typescript
const rateLimits = new Map<string, { count: number; firstRequest: number }>();

// On each request:
if (rateLimit.count >= MAX_REQUESTS && timeDiff < WINDOW_MS) {
  return res.status(429).json({ ... });
}
```

**Configuration**: 5 requests per minute per IP.  
**Limitation**: In-memory — resets on server restart; not shared across PM2 cluster instances.  
**Improvement**: Use Redis-backed rate limiter (e.g., `express-rate-limit` with `rate-limit-redis`).

---

### 5. Honeypot Anti-Spam
**Pattern**: The public contact form includes a hidden `honeypot` field. If filled (by bots), the submission is silently accepted but discarded.

```typescript
if (honeypot) {
  return res.status(200).json({
    success: true,
    message: 'Thank you for your message. We will get back to you soon.'
  });
}
```

**Benefit**: Transparent to real users, confuses naive bots.  
**Limitation**: Sophisticated bots may detect hidden field patterns.

---

### 6. Owner Email Cascade Lookup
**Pattern**: For the contact form, the recipient email is resolved through a multi-table cascade:

```
generated_sites → widget_clients → users
```

Each query runs only if the previous one returned no result. This handles sites, widgets, and direct user ownership.

---

### 7. Permission Gating (Frontend Only)
**Pattern**: All CRUD operations are wrapped in `<Can>` components:

```tsx
<Can permission="contacts.create">
  <button onClick={() => setShowForm(true)}>Add Contact</button>
</Can>
```

**Permissions used**: `contacts.view`, `contacts.create`, `contacts.edit`, `contacts.delete`  
**Gap**: Backend routes have no permission middleware — any authenticated user can perform any contact operation via direct API call.

---

### 8. Zod Validation with Express
**Pattern**: Request body validated using Zod schemas before database operations.

```typescript
const result = createContactSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ success: false, errors: result.error.errors });
}
```

**Benefit**: Type-safe validation, consistent error format.  
**Consistency**: Used in both `POST` and `PUT` (with `.partial()` for updates).

---

## Anti-Patterns & Issues

### A1. Client-Side Invoice/Quotation Filtering (ContactDetails.tsx)
**Problem**: The contact details page loads ALL invoices and ALL quotations, then filters client-side.

```typescript
// Loads all invoices, then filters by contact_id in the component
const allInvoices = await InvoiceModel.getAll();
const filtered = allInvoices.filter(inv => inv.invoice_contact_id === contactId);
```

**Impact**: Performance degrades as invoice/quotation count grows — N invoices transferred when only a handful belong to this contact.  
**Fix**: Use the existing `GET /contacts/:id/invoices` and `GET /contacts/:id/quotations` backend endpoints instead.

---

### A2. Hardcoded contact_type in CONTACT_SELECT
**Problem**: The SQL fragment always returns `1 AS contact_type`, making all contacts appear as "customers" regardless of their actual type.

```sql
1 AS contact_type  -- always 1
```

**Impact**: The frontend customer/supplier tab distinction may not work correctly with this hardcoded value.  
**Fix**: Store `contact_type` in the database and select it dynamically.

---

### A3. No Backend Authorization
**Problem**: All contact routes only require authentication (valid JWT), not specific permissions.

**Impact**: Any logged-in user can create, edit, and delete any contact, bypassing RBAC.  
**Fix**: Add `permissionMiddleware('contacts.create')` etc. to each route.

---

### A4. Statement Routes Missing from Router
**Problem**: `ContactModel` has `getStatementData(id)` and `downloadStatement(id, params)` methods, but no corresponding routes exist in `contacts.ts`.

**Impact**: Frontend may hit endpoints that return 404, or these routes exist in a separate file not captured here.  
**Resolution**: Verify if statement routes are defined elsewhere; if not, implement them.

---

### A6. Rate Limit Map Memory Leak
**Problem**: The in-memory rate limit `Map` in `contactFormRouter.ts` never cleans up expired entries.

```typescript
const rateLimits = new Map<string, { count: number; firstRequest: number }>();
// Entries are only reset when a new request arrives and the window has passed
// But if an IP never makes another request, its entry stays forever
```

**Impact**: Under sustained traffic from many unique IPs, memory grows unbounded.  
**Fix**: Add periodic cleanup interval or use a TTL-aware data structure.

---

### A7. No Input Sanitization on Contact Form
**Problem**: The public contact form (`/v1/leads/submit`) passes user input directly into the SMTP email HTML body without sanitization.

```typescript
html: `<p><strong>Name:</strong> ${name}</p>
       <p><strong>Email:</strong> ${email}</p>
       <p><strong>Message:</strong> ${message}</p>`
```

**Impact**: HTML/script injection into email content. While most email clients sanitize HTML, this is still a risk.  
**Fix**: Escape HTML entities before embedding in email body.

---

## Design Patterns Summary

| Pattern | Location | Quality |
|---------|----------|---------|
| Column aliasing (CONTACT_SELECT) | `contacts.ts` | ✅ Good (but hardcoded type) |
| Soft delete | `contacts.ts` | ✅ Good |
| Zod validation | `contacts.ts` | ✅ Good |
| Customer/supplier tabs | `Contacts.tsx` | ✅ Good |
| In-memory rate limiting | `contactFormRouter.ts` | ⚠️ Adequate (not production-grade) |
| Honeypot anti-spam | `contactFormRouter.ts` | ✅ Good |
| Email cascade lookup | `contactFormRouter.ts` | ✅ Good |
| Frontend-only permissions | `Contacts.tsx` | ❌ Anti-pattern |
| Client-side filtering | `ContactDetails.tsx` | ❌ Anti-pattern |
| Statement model without routes | `ContactModel.ts` | ⚠️ Inconsistency |
