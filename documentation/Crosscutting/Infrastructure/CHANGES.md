# Crosscutting / Infrastructure Module - Changelog

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

This changelog tracks the version history and known issues for the Infrastructure module (middleware, database layer, configuration).

---

## 2. Version History

### v1.0.0 — Initial Documentation (2026-03-02)

**Status:** ✅ Current

**Release Notes:**
- Documented all 8 middleware files, 2 config files, db layer, and error utilities
- Total: 12 files, 1,683 LOC
- Identified 5 anti-patterns with recommendations

**Limitations:**
- No rate limiting middleware
- No query logging/timing infrastructure
- Credit deduction has no retry mechanism
- Team resolution limited to single team per user

---

## 3. Known Issues

| # | Severity | Status | File:Line | Description | Impact | Recommended Fix | Effort |
|---|----------|--------|-----------|-------------|--------|-----------------|--------|
| 1 | 🔴 CRITICAL | Open | — (missing) | No rate limiting on any endpoint | Brute force, credential stuffing, and API abuse possible | Install `express-rate-limit`, apply to `/auth` and public endpoints | 🟢 LOW |
| 2 | 🟡 WARNING | Open | middleware/credits.ts:L67-L90 | Credit deduction failure silently drops charges | Revenue leakage when DB errors occur during async deduction | Add retry queue for failed deductions | 🟡 MED |
| 3 | ✅ RESOLVED | Closed | middleware/team.ts | `requireTeam` is dead code — not imported by any route file since v1.1.0 | None — can be safely deleted | Remove file | 🟢 LOW |
| 4 | 🟡 WARNING | Open | app.ts:L88 | CORS allows `*` origin | Acceptable for API server, but limits CSRF protection | Consider allowlisting known frontend origins | 🟢 LOW |
| 5 | 🟡 WARNING | Open | middleware/auth.ts | No token blacklist/revocation | Stolen JWT tokens remain valid until natural expiry | Add token blacklist (Redis or DB table) checked in requireAuth | 🟡 MED |
| 6 | 🟡 WARNING | Open | db/mysql.ts:L76 | `insertOne` interpolates table name (not parameterized) | SQL injection if table name comes from user input (currently safe — all callers use string literals) | Validate table against allowlist | 🟢 LOW |
| 7 | ✅ OK | Accepted | middleware/statusCheck.ts | Fail-open policy on DB errors | Suspended users can access during DB outage (intentional design decision) | — | — |
| 8 | ✅ OK | Accepted | config/env.ts | 100+ vars in single schema | Large but manageable; all typed with Zod defaults | Could split by domain if file grows further | 🟢 LOW |

---

## 4. Migration Notes

*No migrations needed — Infrastructure module is documentation-only at this time.*

---

## 5. Future Roadmap

| Priority | Feature | Description | Effort |
|----------|---------|-------------|--------|
| 🔴 HIGH | Rate limiting | Add `express-rate-limit` to auth and public endpoints | 1 hour |
| � LOW | Dead code cleanup | Remove unused `middleware/team.ts` (requireTeam, validateTeamMembership, requireTeamAdmin) | 15 min |
| 🟡 MED | Credit retry queue | Persist failed deductions for later retry | 3-4 hours |
| 🟡 MED | Token revocation | Add JWT blacklist checked in requireAuth | 3-4 hours |
| 🟢 LOW | Query logging | Add SQL timing/logging to db helper methods | 1-2 hours |
| 🟢 LOW | Pool monitoring | Track connection pool usage metrics | 1 hour |
