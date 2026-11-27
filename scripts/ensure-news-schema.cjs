/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const EXPECTED_COLUMNS = [
    "category",
    "coverCaption",
    "coverImage",
    "featured",
    "sourceUrl",
];

async function main() {
    const databaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();
    if (!databaseUrl) {
        console.log("[schema] DATABASE_URL not set — skipping BlogPost news columns check.");
        return;
    }

    const prisma = new PrismaClient();
    try {
        const tableCheck = await prisma.$queryRawUnsafe(
            'SELECT to_regclass(\'"BlogPost"\')::text AS tbl'
        );
        if (!Array.isArray(tableCheck) || !tableCheck[0] || !tableCheck[0].tbl) {
            console.log("[schema] BlogPost table not found — skipping BlogPost news columns check.");
            return;
        }

        await prisma.$executeRawUnsafe(`
            ALTER TABLE "BlogPost"
              ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GUIDE',
              ADD COLUMN IF NOT EXISTS "coverImage" TEXT,
              ADD COLUMN IF NOT EXISTS "coverCaption" TEXT,
              ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
              ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT
        `);

        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "BlogPost_published_category_date_idx"
              ON "BlogPost"("published", "category", "date")
        `);

        const cols = await prisma.$queryRawUnsafe(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'BlogPost'
              AND column_name IN ('category', 'coverImage', 'coverCaption', 'featured', 'sourceUrl')
            ORDER BY column_name
        `);

        const found = Array.isArray(cols) ? cols.map((row) => row.column_name) : [];
        if (found.length < EXPECTED_COLUMNS.length) {
            throw new Error(
                `Expected columns [${EXPECTED_COLUMNS.join(", ")}], found [${found.join(", ")}]`
            );
        }

        console.log(`[schema] Verified BlogPost news columns: ${found.join(", ")}`);

        // Ensure Mail Routing Beta feature flag columns exist on User & SiteSettings
        const userTableCheck = await prisma.$queryRawUnsafe(
            'SELECT to_regclass(\'"User"\')::text AS tbl'
        );
        if (Array.isArray(userTableCheck) && userTableCheck[0] && userTableCheck[0].tbl) {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "User"
                  ADD COLUMN IF NOT EXISTS "mailRoutingBetaEnabled" BOOLEAN NOT NULL DEFAULT false
            `);
            console.log('[schema] Verified User.mailRoutingBetaEnabled column.');
        }

        const settingsTableCheck = await prisma.$queryRawUnsafe(
            'SELECT to_regclass(\'"SiteSettings"\')::text AS tbl'
        );
        if (Array.isArray(settingsTableCheck) && settingsTableCheck[0] && settingsTableCheck[0].tbl) {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "SiteSettings"
                  ADD COLUMN IF NOT EXISTS "mailRoutingBetaAvailable" BOOLEAN NOT NULL DEFAULT true,
                  ADD COLUMN IF NOT EXISTS "mailRoutingSelfOptIn" BOOLEAN NOT NULL DEFAULT true
            `);
            console.log('[schema] Verified SiteSettings mail routing beta columns.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[schema] Failed to ensure BlogPost news columns:", message);
    process.exit(1);
});
