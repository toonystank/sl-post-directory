# Contributing to Lanka Post Directory

Thank you for helping improve **Lanka Post Directory**! Whether you are fixing a post office record, improving Sinhala/Tamil translations, or contributing code, please follow these guidelines.

---

## Suggesting Post Office or Tariff Corrections (No Code Needed)

- **Post office edits:** Open any post office page on [lankapost.vercel.app](https://lankapost.vercel.app) and click **Suggest an edit** — moderators review submissions directly in the dashboard queue.
- **Bulk / tariff / app data issues:** Open a [Data Correction issue](ISSUE_TEMPLATE/data_correction.md) with the official Sri Lanka Post circular or source reference.

---

## Local Development Setup

```bash
git clone https://github.com/toonystank/sl-post-directory.git
cd sl-post-directory
npm install
cp .env.example .env.local
npm run dev
```

- Read-only directory pages, the 2026 postage calculator, offline search index, and local markdown guides work out of the box without a database.
- Working on **authentication, moderation, or `/dashboard`** requires a PostgreSQL `DATABASE_URL` and `NEXTAUTH_SECRET` in `.env.local`, followed by `npx prisma db push`.

---

## Coding & Localization Standards

1. **TypeScript & Components:** Keep TypeScript strict with no `any` leaks. Follow existing component patterns (shadcn/ui primitives, Tailwind CSS v4 tokens in `src/app/globals.css`, mobile-first layouts with `44px` minimum touch targets).
2. **Trilingual Parity (Important):** Whenever you add, rename, or remove keys in `messages/en.json`, you **must** add matching keys in `messages/si.json` (Sinhala) and `messages/ta.json` (Tamil). Our automated test suite fails on any missing or mismatched i18n keys.
3. **Database Schema Changes:**
   - Avoid destructive schema edits that drop production data.
   - Because Vercel production builds run `prisma generate && node scripts/ensure-news-schema.cjs && next build` (not `prisma migrate dev`), add both an additive Prisma migration under `prisma/migrations/` and coordinate any production DDL safely.
4. **Security & Sanitization:**
   - Validate request bodies with `zod` schemas in `src/lib/validations.ts`.
   - Keep external image URLs restricted through `src/lib/security.ts` and rich HTML filtered through `sanitizeRichHtml()` in `src/lib/sanitize-html.ts`.
   - Never expose secrets, stack traces, or `.env*` files in client components or commits.

---

## Pre-PR Verification Checklist

Run all checks locally before opening a pull request:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

All four commands should exit cleanly with zero errors.

## Commit & Pull Request Guidelines

- Create focused branches from `main` (for example, `fix/cod-tier-rounding` or `feat/office-hours-filter`).
- Use clear, conventional commit prefixes (`feat:`, `fix:`, `ui:`, `docs:`, `chore:`, `test:`).
- Fill out the [Pull Request Template](PULL_REQUEST_TEMPLATE.md) and attach before/after screenshots (especially at mobile `390px` width) for any UI change.
