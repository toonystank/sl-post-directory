import { NextResponse } from "next/server";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

const PUBLIC_CONFIG_CACHE_CONTROL =
    "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

const RATE_VARIABLE_KEYS = [
    "rates_domestic_services",
    "rates_ems_zones",
    "rates_ems_countries",
    "rates_extra_fees",
];

interface PublicConfigPayload {
    adsEnabled: boolean;
    rateVariables: { key: string; value: string }[];
}

let cachedConfig: { data: PublicConfigPayload; builtAt: number } | null = null;
const MEMORY_TTL_MS = 1000 * 60 * 5;

/**
 * Public, edge- and Service-Worker-cacheable runtime configuration endpoint.
 * Replaces uncached client fetches to `/api/admin/settings` and `/api/admin/variables`
 * on public user-facing pages.
 */
export async function GET() {
    if (cachedConfig && Date.now() - cachedConfig.builtAt < MEMORY_TTL_MS) {
        return NextResponse.json(cachedConfig.data, {
            status: 200,
            headers: { "Cache-Control": PUBLIC_CONFIG_CACHE_CONTROL },
        });
    }

    const fallback: PublicConfigPayload = {
        adsEnabled: true,
        rateVariables: [],
    };

    if (!hasDatabaseUrl) {
        cachedConfig = { data: fallback, builtAt: Date.now() };
        return NextResponse.json(fallback, {
            status: 200,
            headers: { "Cache-Control": PUBLIC_CONFIG_CACHE_CONTROL },
        });
    }

    try {
        const [settings, variables] = await Promise.all([
            prisma.siteSettings.findUnique({
                where: { id: "default" },
                select: { adsEnabled: true },
            }),
            prisma.siteVariable.findMany({
                where: { key: { in: RATE_VARIABLE_KEYS } },
                select: { key: true, value: true },
                orderBy: { key: "asc" },
            }),
        ]);

        const data: PublicConfigPayload = {
            adsEnabled: settings?.adsEnabled ?? true,
            rateVariables: variables,
        };
        cachedConfig = { data, builtAt: Date.now() };

        return NextResponse.json(data, {
            status: 200,
            headers: { "Cache-Control": PUBLIC_CONFIG_CACHE_CONTROL },
        });
    } catch {
        return NextResponse.json(fallback, {
            status: 200,
            headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
        });
    }
}
