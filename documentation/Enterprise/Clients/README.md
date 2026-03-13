# Enterprise Clients Directory

**Last Updated:** 2026-03-13

---

## Purpose

This directory contains per-client documentation for each enterprise client provisioned in the system. Each client document covers their specific configuration, endpoint wiring, package assignment, and any client-specific integration details.

### Directory Convention

Client directories are named by **MySQL contact ID** (not company name) to remain stable if a company is renamed or had a typo:

```
Clients/
├── README.md              ← This file
├── {contact_id}/
│   ├── {CompanyName}.md   ← Internal profile (config, history, kill switches)
│   └── Api.md             ← Client-facing API documentation
```

Example: Silulumanzi (contact_id=68) → `Clients/68/Silulumanzi.md`

---

## Client Index

| Client | Contact ID | Package | Endpoint ID | Status | Document |
|--------|-----------|---------|-------------|--------|----------|
| Silulumanzi Water Services | 68 | Bring Your Own Endpoint | `ep_silulumanzi_91374147` | ✅ Active | [Profile](68/Silulumanzi.md) · [API](68/Api.md) |
| Kone Solutions | 71 | Bring Your Own Endpoint | `ep_kone_solutions_cv` | ✅ Active | [Profile](71/KoneSolutions.md) · [API](71/Api.md) |
| Soft Aware (Staff) | 1 | Staff | `ep_admin-softaware-001_*` (×2) | ✅ Active | [Profile](1/SoftAware.md) |

---

## Onboarding Checklist

When provisioning a new enterprise client, ensure the following steps are completed:

1. **Contact** — Create or verify the contact in MySQL `contacts` table
2. **Package** — Assign the appropriate enterprise package via `contact_packages`
3. **Credits** — Seed an initial `MONTHLY_ALLOCATION` transaction
4. **Endpoint** — Create the enterprise endpoint in SQLite (admin UI or mobile AI)
5. **Link** — Set `contact_id` on the endpoint record to link it to the MySQL contact
6. **Target API** — Configure `target_api_url` if the client has their own backend
7. **Tools** — Define `llm_tools_config` if the endpoint needs function calling
8. **Test** — Send a test request to `POST /api/v1/webhook/{endpoint_id}`
9. **Verify kill switch** — Confirm suspending the package blocks the endpoint

---

## Package Enforcement

All enterprise endpoints with a `contact_id` are subject to package enforcement:

| Check | Failure | HTTP | Description |
|-------|---------|------|-------------|
| Active subscription | `NO_ACTIVE_PACKAGE` | 403 | Contact has no ACTIVE/TRIAL package |
| Credit balance | `INSUFFICIENT_CREDITS` | 402 | Package credits exhausted |
| Endpoint status | `Endpoint disabled` | 403 | Admin kill switch |
| Endpoint status | `Endpoint paused` | 503 | Temporary maintenance |

Each successful webhook request deducts credits (default **10 credits** for TEXT_CHAT), logged as `ENTERPRISE_WEBHOOK` transaction type with endpoint metadata. Some clients have custom pricing — see individual client profiles for details.

---

## Related Documentation

- [Enterprise Module README](../README.md) — Module overview
- [Packages README](../../Packages/README.md) — Package system overview
- [Enterprise FIELDS](../FIELDS.md) — Database schema
