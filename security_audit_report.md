# SL Post Directory — Security, Performance & Code Audit Report

**Date:** 2026-03-12  
**Scope:** Full codebase review of `sl-post-directory` — all 26 API routes, library files, Prisma schema, utility scripts, and configuration.

---

## Executive Summary

The application is a Next.js 16 web app with Prisma (PostgreSQL/Neon), NextAuth credentials-based auth with 2FA support, and Capacitor for mobile builds. The audit found **4 critical**, **6 high-severity**, and several medium/low issues across security, performance, and code quality.

---

## 🔴 CRITICAL Severity

### 1. Hardcoded Super Admin Credentials in Source

> [!CAUTION]
> [update_admin.js](file:///e:/mm/PostDirectory/sl-post-directory/update_admin.js) contains a **plaintext Super Admin password** and email.

```js
const newEmail = 'hakeemiiqbal@gmail.com';
const newPassword = 'Xk9$mR2vLp!7wQzT';  // PLAINTEXT PASSWORD IN SOURCE
```

While this file is in `.gitignore`, it's present on disk. If it was ever committed before being gitignored, the password is in git history. **This password should be considered compromised.**

**Fix:** Delete this file. Rotate the password immediately. Use environment variables for any admin seeding scripts.

---

### 2. 2FA Bypass — Client-Supplied Secret & Backup Codes

> [!CAUTION]
> [/api/user/2fa/verify](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/user/2fa/verify/route.ts) accepts `secret` and `backupCodes` **from the client request body** and saves them directly to the database.

```ts
const { token, secret, backupCodes } = await req.json();
// ...
await prisma.user.update({
    data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,      // ATTACKER-CONTROLLED
        backupCodes: backupCodes       // ATTACKER-CONTROLLED
    }
});
```

An authenticated attacker can:
1. Generate their own TOTP secret
2. Send it along with a valid token for that secret
3. **Replace the legitimate 2FA secret** with one they control
4. Supply arbitrary backup codes they know

**Fix:** The server must generate and store the secret (as the `/api/auth/2fa/setup` route correctly does). The verify endpoint should only accept the `token` and verify it against the server-stored secret.

---

### 3. Exposed Production Credentials in `.env`

> [!CAUTION]
> The [.env](file:///e:/mm/PostDirectory/sl-post-directory/.env) file contains live production secrets:

| Secret | Risk |
|--------|------|
| `DATABASE_URL` | Full Neon PostgreSQL connection string with password |
| `NEXTAUTH_SECRET` | JWT signing key — allows session forgery |
| `RESEND_API_KEY` | Email service key — allows sending arbitrary emails |

While `.env*` is in `.gitignore`, this file exists on disk. If it was ever committed, these credentials are in git history.

**Fix:** Rotate ALL of these credentials immediately. Run `git log --all --full-history -- .env` to check if they were ever committed. Use a secrets manager for production.

---

### 4. No Role Whitelist on User Role Assignment

> [!CAUTION]
> The [admin user creation](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/admin/users/route.ts#L17) and [user role update](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/admin/users/%5Bid%5D/route.ts#L17) endpoints accept **any string** as a role.

```ts
const { name, email, password, role } = body;  // No validation on role
```

A Super Admin could accidentally (or a compromised account could intentionally) set a role to any arbitrary string, potentially causing auth bypass or privilege confusion.

**Fix:** Validate role against a whitelist: `["CONTRIBUTOR", "MODERATOR", "ADMIN", "SUPER_ADMIN"]`.

---

## 🟠 HIGH Severity

### 5. In-Memory Rate Limiter — Ineffective in Serverless

> [!WARNING]
> The [rate limiter](file:///e:/mm/PostDirectory/sl-post-directory/src/lib/rate-limiter.ts) uses an in-memory `Map`. In Vercel's serverless environment, each function invocation gets its own memory space.

**Impact:** Rate limiting is essentially **non-functional** in production. An attacker can brute-force login, registration, or suggestion endpoints without restriction.

**Fix:** Use a distributed rate limiter backed by Redis (e.g., Upstash) or Vercel KV, or use Vercel Edge Config / middleware-based rate limiting.

---

### 6. Backup Code Timing Attack

> [!WARNING]
> [Backup code comparison](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/auth/%5B...nextauth%5D/options.ts#L47) uses `Array.includes()` which performs non-constant-time string comparison.

```ts
const isBackupCode = user.backupCodes?.includes(token);  // Timing-unsafe
```

**Fix:** Use `crypto.timingSafeEqual()` with fixed-length buffer comparison for each backup code.

---

### 7. User Enumeration via Registration & Suggestion Endpoints

> [!WARNING]
> Multiple endpoints reveal whether an email is registered:

| Endpoint | Response |
|----------|----------|
| [/api/auth/register](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/auth/register/route.ts#L59-L61) | "An account with this email already exists" |
| [/api/suggest](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/suggest/route.ts#L84-L86) | "An account with this email already exists" |

**Fix:** Return a generic message like "If this email is available, a verification email has been sent."

---

### 8. XSS in Email Templates via Unsanitized User Input

> [!WARNING]
> [Email templates](file:///e:/mm/PostDirectory/sl-post-directory/src/lib/email.ts) inject `userName` and `officeName` directly into HTML without sanitization:

```ts
`<h2>Welcome to SL Post Directory, ${userName}!</h2>`
```

If a user registers with a name like `<img src=x onerror=alert(1)>`, this renders as executable HTML in email clients that support it.

**Fix:** HTML-encode all user-supplied values before interpolation into email templates.

---

### 9. No Rate Limiting on Login (Brute Force)

> [!WARNING]
> The [NextAuth authorize](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/auth/%5B...nextauth%5D/options.ts) callback has **no rate limiting**. Combined with issue #5 (in-memory rate limiter being ineffective), there is no protection against brute-force password attacks.

**Fix:** Add rate limiting to the `[...nextauth]` route, ideally using a distributed store.

---

### 10. No Rate Limiting on Password Change & 2FA Endpoints

> [!WARNING]
> The [password change](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/user/password/route.ts), [2FA disable](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/user/2fa/disable/route.ts), and admin password reset endpoints have no rate limiting. An attacker with a valid session could brute-force the current password.

---

## 🟡 MEDIUM Severity

### 11. Duplicate 2FA Flows With Inconsistent Security

Two separate 2FA flows exist:

| Flow | Path | Security |
|------|------|----------|
| Auth 2FA | `/api/auth/2fa/setup` + `/verify` | ✅ Server stores secret first, verify only checks token |
| User 2FA | `/api/user/2fa/setup` + `/verify` | ❌ Client supplies secret (see Critical #2) |

**Fix:** Remove the insecure `/api/user/2fa/` flow entirely, or refactor it to match the secure `/api/auth/2fa/` pattern.

---

### 12. Missing Input Validation on Admin Endpoints

Several admin endpoints accept raw un-validated JSON:

| Endpoint | Missing Validation |
|----------|-------------------|
| [PUT /api/admin/office/[id]](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/admin/office/%5Bid%5D/route.ts#L16-L17) | No Zod schema; accepts arbitrary body fields |
| [POST /api/admin/users](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/admin/users/route.ts#L17) | No Zod schema; no email format / role validation |
| [POST /api/admin/bulk](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/admin/bulk/route.ts#L16) | `officeIds` array elements not validated as CUIDs |

**Fix:** Add Zod validation schemas for all admin endpoints.

---

### 13. Zod `.catchall()` Weakens Schema Validation

> [!IMPORTANT]
> [suggestSchema](file:///e:/mm/PostDirectory/sl-post-directory/src/lib/validations.ts#L37), [suggestAddSchema](file:///e:/mm/PostDirectory/sl-post-directory/src/lib/validations.ts#L51), and [createOfficeSchema](file:///e:/mm/PostDirectory/sl-post-directory/src/lib/validations.ts#L57) use `.catchall(z.union([z.string(), z.undefined()]))`.

This allows **any arbitrary key** to pass validation, defeating the purpose of schema validation.

**Fix:** Use `.passthrough()` instead if you need to allow `field_` prefixed keys, and strip unknown keys after extracting dynamic fields. Or use a more targeted approach with `.and(z.record(...))`.

---

### 14. User Deletion Not Atomic (Race Condition)

[User deletion](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/admin/users/%5Bid%5D/route.ts#L56-L62) runs two separate queries without a transaction:

```ts
await prisma.editRequest.deleteMany({ where: { requestedById: id } });
await prisma.user.delete({ where: { id } });
```

If the second query fails, orphaned edit requests are deleted. Also, `ActionLog` records for the deleted user are not handled, leaving orphaned foreign key references.

**Fix:** Wrap in `prisma.$transaction()` and handle `ActionLog` cleanup.

---

### 15. Turnstile CAPTCHA Bypass When Secret Not Configured

> [!IMPORTANT]
> When `TURNSTILE_SECRET_KEY` is not set, CAPTCHA is **completely skipped**:

```ts
if (turnstileSecret && turnstileToken) { /* verify */ }
else if (turnstileSecret && !turnstileToken) { /* require */ }
// else: NO CAPTCHA AT ALL
```

In production, if the env var is missing, bots can freely register accounts and submit suggestions.

**Fix:** Require `TURNSTILE_SECRET_KEY` in production or fail-closed.

---

## 🔵 LOW Severity / Code Quality

### 16. `setInterval` in Module Scope

The rate limiter creates a `setInterval` at [module import time](file:///e:/mm/PostDirectory/sl-post-directory/src/lib/rate-limiter.ts#L42-L51). In serverless, this timer will never fire (functions are short-lived). In long-running dev servers, it can prevent clean shutdown.

---

### 17. Prisma Dev Database Checked into Repo

[prisma/dev.db](file:///e:/mm/PostDirectory/sl-post-directory/prisma/dev.db) (164KB) is present in the project. This SQLite database may contain development data including user records. Add `*.db` to `.gitignore`.

---

### 18. No `max` on `limit` Query Parameter

The [/api/offices](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/offices/route.ts#L18-L19) endpoint allows any `limit` value:

```ts
let limit = parseInt(searchParams.get("limit") || "12");
```

An attacker can pass `?limit=999999` to dump the entire database in one request.

**Fix:** Clamp limit to a maximum (e.g., `Math.min(limit, 50)`).

---

### 19. Unused `resend` Dependency

`resend` (v6.9.3) is in `package.json` but the app uses `nodemailer` for email. This is dead weight.

---

### 20. `puppeteer` in Production Dependencies

`puppeteer` (a 300MB+ headless browser) is listed as a **production** dependency despite only being used in utility scraping scripts. This bloats the deployment bundle significantly.

**Fix:** Move to `devDependencies`.

---

## ⚡ Performance Issues

### P1. N+1 Query in Bulk Service Operations

[/api/admin/bulk](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/admin/bulk/route.ts#L42-L53) runs individual `postOffice.update()` for each office in a loop:

```ts
const updatePromises = offices.map((office) => {
    return prisma.postOffice.update({ ... });  // N individual queries
});
```

For 500 offices, this fires 500 separate UPDATE queries.

**Fix:** Use `prisma.$transaction()` or raw SQL `UPDATE ... WHERE id IN (...)` for batch operations.

---

### P2. N+1 Query in Edit Approval (Field Upserts)

[/api/admin/moderate](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/admin/moderate/route.ts#L136-L158) does a `findFirst` + `update/create` per field inside a loop, each being a separate query.

---

### P3. Unbounded Activity Log Query

[/api/admin/activity](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/admin/activity/route.ts#L17-L24) fetches up to 100 logs but has no pagination. As the log table grows, this will become slow.

**Fix:** Add cursor-based pagination like the offices endpoint uses.

---

### P4. `force-dynamic` on Heavily-Trafficked Routes

[/api/offices](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/offices/route.ts#L5) and [/api/offices/[id]](file:///e:/mm/PostDirectory/sl-post-directory/src/app/api/offices/%5Bid%5D/route.ts#L4) use `force-dynamic`, preventing any edge caching. For a directory of post offices that rarely change, this causes unnecessary database hits.

**Fix:** Use ISR (Incremental Static Regeneration) with `revalidate` or add proper `Cache-Control` headers like the autocomplete route does.

---

### P5. SearchDirectory.tsx is 51KB

[SearchDirectory.tsx](file:///e:/mm/PostDirectory/sl-post-directory/src/components/SearchDirectory.tsx) is a **51KB single component file**. This likely contains too many responsibilities and will be slow to parse/render.

**Fix:** Break into smaller components (SearchBar, FilterPanel, ResultCard, Pagination, etc.).

---

## Summary Table

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🔴 CRITICAL | Security | Hardcoded Super Admin password in source |
| 2 | 🔴 CRITICAL | Security | 2FA bypass via client-supplied secret |
| 3 | 🔴 CRITICAL | Security | Exposed production credentials in .env |
| 4 | 🔴 CRITICAL | Security | No role whitelist on user role assignment |
| 5 | 🟠 HIGH | Security | In-memory rate limiter ineffective in serverless |
| 6 | 🟠 HIGH | Security | Backup code timing attack |
| 7 | 🟠 HIGH | Security | User enumeration via registration |
| 8 | 🟠 HIGH | Security | XSS in email templates |
| 9 | 🟠 HIGH | Security | No rate limiting on login |
| 10 | 🟠 HIGH | Security | No rate limiting on password/2FA endpoints |
| 11 | 🟡 MEDIUM | Code | Duplicate 2FA flows with inconsistent security |
| 12 | 🟡 MEDIUM | Security | Missing input validation on admin endpoints |
| 13 | 🟡 MEDIUM | Security | Zod .catchall() weakens validation |
| 14 | 🟡 MEDIUM | Reliability | User deletion not atomic |
| 15 | 🟡 MEDIUM | Security | CAPTCHA bypass when secret not configured |
| 16 | 🔵 LOW | Code | setInterval in module scope |
| 17 | 🔵 LOW | Security | Dev database in repo |
| 18 | 🔵 LOW | Security | No max on limit query parameter |
| 19 | 🔵 LOW | Code | Unused resend dependency |
| 20 | 🔵 LOW | Performance | puppeteer in production deps |
| P1 | ⚡ | Performance | N+1 queries in bulk operations |
| P2 | ⚡ | Performance | N+1 queries in edit approval |
| P3 | ⚡ | Performance | Unbounded activity log query |
| P4 | ⚡ | Performance | force-dynamic on cacheable routes |
| P5 | ⚡ | Performance | 51KB monolith component |

---

## Recommended Priority

1. **Immediately:** Rotate all exposed credentials (database, NextAuth secret, Resend key, Super Admin password)
2. **Urgently:** Fix 2FA bypass (Critical #2), add role whitelist (Critical #4)
3. **Soon:** Implement distributed rate limiting, fix email XSS, add admin validation
4. **Planned:** Address performance issues, refactor large components, clean up dependencies
