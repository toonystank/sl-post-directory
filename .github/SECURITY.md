# Security Policy

## Supported Versions

Security updates are applied directly to the `main` branch and deployed to production at [lankapost.vercel.app](https://lankapost.vercel.app).

| Branch / Release | Supported |
| --- | --- |
| `main` (Production) | Yes |
| Older snapshots / forks | No |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

If you discover a vulnerability (such as an authentication bypass, privilege escalation in `/dashboard` or `/api/admin/*`, XSS in article/comment rendering, SSRF in tracking/upload endpoints, or exposed secrets):

1. Open a private security report via **GitHub Security Advisories** on the repository (`Security` → `Advisories` → `Report a vulnerability`), or contact the maintainer privately via the address listed on the live [About & Contact](https://lankapost.vercel.app/about) page.
2. Include as much detail as possible:
   - Affected endpoint, route, or file path
   - Step-by-step reproduction instructions or proof-of-concept request
   - Potential impact and suggested remediation (if known)

### What to Expect

- We aim to acknowledge reports within **48 hours** and confirm severity and reproduction shortly after.
- Once a fix is verified and deployed to production, we will coordinate credit/disclosure timing with you.

---

## Security Architecture Notes

Contributors modifying security-sensitive paths should preserve these safeguards:

- **Authentication & RBAC:** Session enforcement and role checks (`SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `CONTRIBUTOR`) across `/dashboard` and `/api/admin/*`, including mandatory TOTP 2FA verification and timing-safe backup code checks.
- **Input & HTML Sanitization:** `zod` request validation (`src/lib/validations.ts`), `sanitizeRichHtml` allowlisting (`src/lib/sanitize-html.ts`), and `safeJsonLd` escaping for structured data.
- **Media & External URLs:** Strict Uploadcare UUID host allowlisting (`isUploadcareImageUrl`) and HTTPS URL checks before persisting images or external source links.
- **Abuse Protection:** Upstash Redis distributed sliding-window rate limiting and Cloudflare Turnstile verification on public submission/auth routes.
