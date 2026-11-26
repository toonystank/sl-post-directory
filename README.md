# Lanka Post Directory

**An independent, offline-first Sri Lanka Post office directory, 2026 postage calculator, live parcel tracker, and postal newsroom — built for mobile first.**

<p>
  <a href="https://lankapost.vercel.app"><img src="https://img.shields.io/badge/Live-lankapost.vercel.app-B4161B?style=flat-square&logo=vercel&logoColor=white" alt="Live Site" height="20" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16.1-1A1714?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" height="20" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" height="20" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" height="20" /></a>
  <a href="https://www.prisma.io"><img src="https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" height="20" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-MIT-F5B700?style=flat-square" alt="License: MIT" height="20" /></a>
</p>

[Live App](https://lankapost.vercel.app) · [Postage Calculator](https://lankapost.vercel.app/calculator) · [Parcel Tracker](https://lankapost.vercel.app/track) · [News & Guides](https://lankapost.vercel.app/blog) · [Report a Bug](.github/ISSUE_TEMPLATE/bug_report.md) · [Suggest Data Fix](.github/ISSUE_TEMPLATE/data_correction.md)

> **Independent Project Disclaimer:** Lanka Post Directory is a community-maintained open-source project. It is **not** affiliated with, operated by, sponsored by, or endorsed by the Department of Posts (Sri Lanka Post) or any government agency. Always verify time-sensitive hours or international restrictions directly with the relevant post office.

---

## Features

- **4,158+ Post Offices & Postal Codes** — Instant search by office name, 5-digit postal code, district/division, or Sinhala/Tamil alias with PostgreSQL `pg_trgm` fuzzy matching, local client-side index caching, A–Z & district browsing (`/browse`, `/district/[division]`), controlling office & RMSC/TPO chains, opening hours, maps, community photos, and reviews.
- **Trilingual Experience (`EN` / `සිං` / `தமிழ்`)** — Full localization across English, Sinhala, and Tamil powered by `next-intl` (`localePrefix: "as-needed"`), backed by automated key-parity tests across [`messages/en.json`](messages/en.json), [`messages/si.json`](messages/si.json), and [`messages/ta.json`](messages/ta.json).
- **2026 Postage Rate Calculator (`/calculator` & `/rates/*`)** — Up-to-date tariff calculations for **International** (Air Mail, Sea Mail, EMS, U-Packet, TDS), **Cash on Delivery (COD)** net payouts & sub-PO caps, and **Domestic** mail (Letters, Registered Post, AR Receipt, Parcels, SLP Courier), with LKR/USD currency switching and a compact collapsible receipt summary.
- **Live Parcel Tracking & Receipt OCR (`/track`)** — Single and bulk barcode tracking for SLP Courier and COD items, live camera barcode scanning (`barcode-detector`), and receipt text extraction (`tesseract.js` locally with optional Gemini fallback).
- **Postal Newsroom, Alerts & Guides (`/blog`)** — Categorized dispatches (`Service Alert`, `Tariff Update`, `Postal News`, `Guide`), featured breaking-alert homepage strip, Uploadcare cover & inline imagery, `NewsArticle` JSON-LD structured data, and dynamic `{{variable}}` hydration.
- **Mobile-First Admin & Contributor Workspace (`/dashboard`)** —
  - Responsive `AdminShell` with a 5-slot bottom tab bar + swipeable More sheet on mobile, collapsible sidebar rail on desktop, and `⌘K` Command Palette.
  - **Offices Manager** with uncached paginated search, division/service/24h filters, and 4-tab mobile edit sheets supporting custom fields.
  - **Moderation Queue** for community edit suggestions (with `MORE_INFO` tracking and field diffs), community photos (Uploadcare lightbox), and reviews.
  - **News & Article Studio (`/dashboard/news`)** powered by **Tiptap v3** with starter templates, custom alert callouts, Uploadcare figure blocks, `{{variable}}` insertion, `localStorage` draft autosave, and live preview.
  - **Operations & Security**: postage rate & site variable editors, user & role management (`SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `CONTRIBUTOR`), cursor-paginated audit logs, email verification, TOTP two-factor authentication + backup codes, Upstash Redis distributed rate limiting, and Cloudflare Turnstile protection.
- **Offline-First PWA & Mobile** — Service worker caching (`public/sw.js`), installable web app + offline fallback page (`/offline`), Android Trusted Web Activity (`/.well-known/assetlinks.json`), and Capacitor 8 configuration for Android/iOS builds.

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Framework & UI** | Next.js 16.1 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, Radix UI, Motion, Lucide Icons |
| **Database & ORM** | PostgreSQL (Neon), Prisma 5.22 (`prisma-client-js`, `pg_trgm`) |
| **Auth & Security** | NextAuth.js v4 (JWT + Credentials), `bcrypt`, `otplib` (TOTP 2FA), Upstash Redis (`@upstash/ratelimit`), Cloudflare Turnstile |
| **Rich Editor & Media** | Tiptap v3 (StarterKit, Image, Table, Custom Callout/Figure nodes), Uploadcare CDN |
| **i18n & Content** | `next-intl` v4 (`en`, `si`, `ta`), Markdown + DB hybrid `BlogPost` store |
| **Tracking & OCR** | `cheerio`, `barcode-detector`, `tesseract.js`, Google Gemini (`@google/genai`) |
| **Email & Mobile** | Resend HTTP API / Nodemailer (SMTP), Capacitor 8 (Android & iOS), TWA |

---

## Project Structure

```text
├── messages/                  # Trilingual i18n dictionaries (en.json, si.json, ta.json)
├── prisma/
│   ├── schema.prisma          # PostgreSQL models (PostOffice, BlogPost, User, EditRequest, etc.)
│   ├── migrations/            # SQL migrations
│   └── seed/                  # Database seeding scripts
├── public/                    # PWA manifest, Service Worker (sw.js), offline data, icons
├── scripts/
│   ├── ensure-news-schema.cjs # Idempotent BlogPost news column check run during production build
│   └── normalize-postcodes.ts # Postal code normalization helper
└── src/
    ├── app/
    │   ├── [locale]/          # App Router pages (home, browse, calculator, rates, track, blog,
    │   │                      # office/[slug], district/[division], suggest, login, register, dashboard/*)
    │   └── api/               # REST & NextAuth route handlers (admin/*, auth/*, offices/*, track/*, ocr/*)
    ├── components/
    │   ├── admin/             # AdminShell, CommandPalette, NewsStudioEditor, TiptapRichEditor, QueueClient
    │   ├── blog/              # NewsFeedClient & public news components
    │   ├── directory/         # SearchBar, HomeHero, HomeBottomSection, Office views
    │   ├── shell/             # BottomTabBar, MoreSheet, SiteFooter, PWA bridges
    │   └── tracking/          # TrackerClient, camera scanner, OCR drawer
    ├── content/blog/          # Fallback Markdown guides
    ├── data/                  # Local offline fallback dataset when DATABASE_URL is unset
    ├── i18n/                  # next-intl routing & request config
    ├── lib/                   # Prisma client, rate calculator, OCR/tracking parsers, security, validations
    └── proxy.ts               # Locale redirect & security header middleware
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** (project builds on Node 24.x on Vercel)
- **PostgreSQL database** (optional for read-only local browsing — the directory and guides include local fallbacks when `DATABASE_URL` is unset, while auth, moderation, and `/dashboard` require PostgreSQL)

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/toonystank/sl-post-directory.git
cd sl-post-directory

# 2. Install dependencies (automatically runs `prisma generate`)
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL, NEXTAUTH_SECRET, and optional integration keys

# 4. Sync schema & seed initial data (when DATABASE_URL is configured)
npx prisma db push
npm run seed

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js development server (`0.0.0.0:3000`) |
| `npm run build` | Generate Prisma Client, run `scripts/ensure-news-schema.cjs`, and build for production |
| `npm run start` | Start the compiled production Next.js server |
| `npm run typecheck` | Run strict TypeScript check (`tsc --noEmit`) |
| `npm run lint` | Run ESLint across `src/` |
| `npm test` | Run unit & security/i18n parity test suite via `tsx --test` |
| `npm run seed` | Seed database using `prisma/seed/seed.ts` |
| `npm run build:mobile` | Build web assets and sync Capacitor native projects |
| `npm run mobile:android` | Open Android project in Android Studio |
| `npm run mobile:ios` | Open iOS project in Xcode |

---

## Environment Variables

Copy [`.env.example`](.env.example) to `.env.local`.

<details>
<summary><strong>Database &amp; Authentication</strong></summary>

| Variable | Description | Required |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (Neon) | For DB/Admin |
| `NEXTAUTH_SECRET` | Random secret for JWT signing (`openssl rand -base64 32`) | For Auth |
| `NEXTAUTH_URL` | Canonical auth origin (e.g. `http://localhost:3000`) | For Auth |
| `TRACKING_SESSION_SECRET` | Optional secret for SLP CAPTCHA cookie signing (falls back to `NEXTAUTH_SECRET`) | Optional |

</details>

<details>
<summary><strong>Email Delivery (Verification &amp; Moderation Updates)</strong></summary>

| Variable | Description |
| --- | --- |
| `RESEND_API_KEY` | Resend API key (recommended for verified domains) |
| `EMAIL_FROM` | Sender address (e.g. `Lanka Post <noreply@yourdomain.com>`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Alternative SMTP transport (e.g. Brevo / Gmail App Password) |

</details>

<details>
<summary><strong>Security, Media, Rate Limiting &amp; AI</strong></summary>

| Variable | Description |
| --- | --- |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Distributed sliding-window rate limiting across serverless instances |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile bot protection on registration, edits, reviews, and photos |
| `NEXT_PUBLIC_UPLOADCARE_PUB_KEY`, `NEXT_PUBLIC_UPLOADCARE_CDN`, `UPLOADCARE_SECRET_KEY` | Uploadcare direct image uploads & CDN optimization for photos and News Studio |
| `GEMINI_API_KEY`, `GEMINI_OCR_MODEL` | Optional server-side AI fallback for receipt scanning |

</details>

<details>
<summary><strong>Site, Analytics &amp; Play Store TWA</strong></summary>

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` | Canonical URL (used in metadata, sitemaps, JSON-LD) and support email |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | AdSense, Google Analytics, and Search Console verification |
| `TWA_ANDROID_PACKAGE_NAME`, `TWA_SHA256_CERT_FINGERPRINTS`, `NEXT_PUBLIC_DISABLE_ADS_IN_TWA` | Digital Asset Links (`/.well-known/assetlinks.json`) and TWA runtime controls |

</details>

---

## Deploying to Vercel

1. Connect the repository to **Vercel** (Framework Preset: **Next.js**).
2. Configure production environment variables (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, plus optional Upstash/Resend/Turnstile/Uploadcare keys).
3. Keep the default build command (`npm run build`), which automatically runs:
   - `prisma generate`
   - `node scripts/ensure-news-schema.cjs` (safely ensures `BlogPost` news columns & index exist in production PostgreSQL)
   - `next build`

---

## Contributing & Security

- Read the [Contributing Guide](.github/CONTRIBUTING.md) before opening a pull request.
- Spot an incorrect postal code, phone number, or tariff? Use **"Suggest an edit"** directly on any post office page or open a [Data Correction issue](.github/ISSUE_TEMPLATE/data_correction.md).
- To report a security issue privately, follow our [Security Policy](.github/SECURITY.md).

## License

This project is open-source under the **MIT License**.
