# Contacts — Changelog & Pending Changes

## Known Issues

| ID | Severity | Component | Description | Suggested Fix |
|----|----------|-----------|-------------|---------------|
| CONT-001 | 🔴 Critical | `contacts.ts` | No backend permission enforcement — any authenticated user can CRUD all contacts | Add `permissionMiddleware('contacts.*')` to each route |
| CONT-003 | 🟠 High | `ContactDetails.tsx` | Client-side invoice/quotation filtering loads ALL records then filters in browser | Use `GET /contacts/:id/invoices` and `/quotations` endpoints |
| CONT-004 | 🟠 High | `contactFormRouter.ts` | No HTML sanitization on public contact form — email body injection risk | Escape HTML entities before embedding in SMTP body |
| CONT-005 | 🟡 Medium | `contacts.ts` | `contact_type` hardcoded to `1` in CONTACT_SELECT — supplier type never returned | Store `contact_type` in DB and select dynamically |
| CONT-006 | 🟡 Medium | `contactFormRouter.ts` | In-memory rate limit map has no cleanup — potential memory leak | Use TTL-aware structure or periodic cleanup interval |
| CONT-007 | 🟡 Medium | `ContactModel.ts` | `getStatementData` and `downloadStatement` methods reference routes not found in router | Implement `/contacts/:id/statement` and `/contacts/:id/statement/download` routes, or verify they exist elsewhere |
| CONT-008 | 🟢 Low | `contactFormRouter.ts` | Rate limiting is in-memory — not shared across PM2 instances | Migrate to Redis-backed rate limiter |
| CONT-009 | 🟢 Low | `contacts.ts` | No endpoint to restore soft-deleted contacts | Add `PUT /contacts/:id/restore` route |

---

## Migration Notes

### Adding contact_type Column (CONT-005)
```sql
-- Step 1: Add column
ALTER TABLE contacts ADD COLUMN contact_type TINYINT NOT NULL DEFAULT 1 AFTER active;

-- Step 2: Update CONTACT_SELECT to use column
-- Replace: 1 AS contact_type
-- With:    contact_type
```

---

## Suggested Improvements

### Short-term (Sprint-level)

1. **Backend permission middleware** (CONT-001)
   ```typescript
   router.get('/', permissionMiddleware('contacts.view'), async (req, res) => { ... });
   router.post('/', permissionMiddleware('contacts.create'), async (req, res) => { ... });
   router.put('/:id', permissionMiddleware('contacts.edit'), async (req, res) => { ... });
   router.delete('/:id', permissionMiddleware('contacts.delete'), async (req, res) => { ... });
   ```

2. **Replace client-side filtering** (CONT-003)
   ```typescript
   // ContactDetails.tsx — replace:
   const allInvoices = await InvoiceModel.getAll();
   const filtered = allInvoices.filter(inv => inv.invoice_contact_id === contactId);
   
   // With:
   const invoices = await ContactModel.getInvoices(contactId);
   ```

3. **Sanitize contact form input** (CONT-004)
   ```typescript
   const escapeHtml = (str: string) =>
     str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
   
   html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p>...`
   ```

### Medium-term

4. **Team/tenant scoping** (CONT-002) — requires migration (see above)
5. **Dynamic contact_type** (CONT-005) — requires migration
6. **Redis-backed rate limiting** (CONT-008)
   ```typescript
   import rateLimit from 'express-rate-limit';
   import RedisStore from 'rate-limit-redis';
   
   const limiter = rateLimit({
     store: new RedisStore({ /* redis config */ }),
     windowMs: 60 * 1000,
     max: 5,
   });
   router.post('/submit', limiter, async (req, res) => { ... });
   ```

### Long-term

7. **Statement route implementation** (CONT-007) — PDF generation with financial data
8. **Contact import/export** — CSV/Excel bulk operations
9. **Contact merge** — deduplicate contacts with same email/company
10. **Audit trail** — log who created/edited/deleted each contact

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| *(initial)* | — | Module created with basic CRUD operations |
| *(initial)* | — | Contact form router added for public lead capture |
| *(initial)* | — | Contact details page with tabs (overview/invoices/quotations/statement) |
| *(initial)* | — | Statement data and PDF download model methods added |

---

## Dependencies on Other Modules

| Module | Dependency Type | Description |
|--------|----------------|-------------|
| **Invoices** | Data | Contacts linked via `contact_id` FK in invoices table |
| **Quotations** | Data | Contacts linked via `contact_id` FK in quotations table |
| **Authentication** | Auth | JWT middleware protects all CRUD routes |
| **Roles** | RBAC | Permission keys `contacts.*` defined in roles module |
| **SiteBuilder** | Lookup | Contact form resolves owner via `generated_sites` table |
| **Settings** | Config | SMTP configuration for contact form email delivery |

## Modules That Depend on Contacts

| Module | Usage |
|--------|-------|
| **Invoices** | Invoice creation requires selecting a contact |
| **Quotations** | Quotation creation requires selecting a contact |
| **Payments** | Payments linked to invoices which link to contacts |
| **FinancialReports** | Financial reports may aggregate by contact |
| **Dashboard** | Outstanding amounts counted per contact |
