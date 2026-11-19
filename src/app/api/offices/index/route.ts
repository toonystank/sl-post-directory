import { NextRequest, NextResponse } from "next/server";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { loadLocalOffices } from "@/lib/local-sqlite";
import {
    type CompactOfficeIndex,
    encodeOfficeIndex,
} from "@/lib/office-index";

const INDEX_CACHE_TTL_MS = 1000 * 60 * 30; // 30 min in-memory server cache
const INDEX_CACHE_CONTROL = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

let serverCachedPayload: {
    json: string;
    etag: string;
    builtAt: number;
} | null = null;

async function buildCompactIndex(): Promise<CompactOfficeIndex> {
    if (!hasDatabaseUrl) {
        return encodeOfficeIndex(loadLocalOffices());
    }

    try {
        const offices = await prisma.postOffice.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                slug: true,
                name: true,
                postalCode: true,
                services: true,
                fields: {
                    where: {
                        name: { in: ["Type", "Division", "Phone", "Telephone", "Is24Hour"] },
                    },
                    select: {
                        name: true,
                        value: true,
                    },
                },
            },
        });
        if (offices.length > 0) {
            return encodeOfficeIndex(offices);
        }
    } catch {
        // Fall back seamlessly to bundled SQLite directory when DB is unreachable
    }

    return encodeOfficeIndex(loadLocalOffices());
}

async function getSerializedIndex() {
    if (serverCachedPayload && Date.now() - serverCachedPayload.builtAt < INDEX_CACHE_TTL_MS) {
        return serverCachedPayload;
    }

    const encoded = await buildCompactIndex();
    const json = JSON.stringify(encoded);
    const etag = `"${encoded.v}"`;

    serverCachedPayload = {
        json,
        etag,
        builtAt: Date.now(),
    };
    return serverCachedPayload;
}

export async function GET(request: NextRequest) {
    const { json, etag } = await getSerializedIndex();

    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.replace(/^W\//, "") === etag) {
        return new NextResponse(null, {
            status: 304,
            headers: {
                ETag: etag,
                "Cache-Control": INDEX_CACHE_CONTROL,
            },
        });
    }

    return new NextResponse(json, {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ETag: etag,
            "Cache-Control": INDEX_CACHE_CONTROL,
        },
    });
}
