# 🇱🇰 SL Post Directory

A modern, searchable directory of Sri Lanka Post offices built with **Next.js 16**, **Prisma**, and **PostgreSQL**.

## Features

- 🔍 **Smart Search** — Search by name, postal code, or division with debounced instant results
- 📃 **Infinite Scroll** — Browse the full directory with lazy-loaded results
- 🔤 **Alphabetic Filtering** — Jump to offices by letter
- 📝 **Community Suggestions** — Anyone can submit edit requests for post office data
- ✅ **Moderation Queue** — Admin dashboard with approve/reject/need-more-info workflow and before/after diff view
- 👥 **Role-Based Access** — Super Admin, Admin, Moderator, and Contributor roles
- 📧 **Email Notifications** — Automated emails via Resend for edit request status updates
- 🌓 **Dark Mode** — Full light/dark theme support
- 📱 **Mobile Ready** — Capacitor integration for native mobile builds

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Auth | NextAuth.js (Credentials) |
| Email | Resend |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Mobile | Capacitor |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL, NextAuth secret, and Resend API key

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the directory.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret for JWT signing |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `RESEND_API_KEY` | Resend API key for email notifications |

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes (offices, auth, admin, suggest)
│   ├── dashboard/        # Admin dashboard, moderation, user management
│   ├── office/[id]/      # Office detail pages
│   ├── suggest/          # Edit suggestion form
│   └── login/            # Authentication
├── components/           # Reusable UI components
└── lib/                  # Prisma client, email utilities
```

## License

MIT
