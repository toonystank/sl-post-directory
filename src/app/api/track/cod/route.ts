import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/csrf";
import { checkRateLimit, rateLimitHeaders, rateLimiters } from "@/lib/rate-limiter";
import {
    MAX_BATCH_BARCODES,
    VALID_BARCODE_REGEX,
    classifyBarcode,
} from "@/lib/tracking/classifier";
import {
    buildCodSteps,
    classifyCodStatus,
    extractBepostCsrfToken,
    parseCodDetailsHtml,
    parseCodSummaryHtml,
} from "@/lib/tracking/parsers";
import type {
    CodBatchApiResponse,
    CodLookupItemResponse,
    CodTrackingResult,
} from "@/lib/tracking/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BEPOST_MULTI_URL = "https://bepost.lk/p/Search/New_serch_barcode.php";
const MAX_UPSTREAM_HTML_BYTES = 512_000;
const COD_CACHE_TTL_MS = 60_000;
const COD_CACHE_MAX_ENTRIES = 500;
const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const codDetailCache = new Map<string, { result: CodTrackingResult | null; expiresAt: number }>();

function getCachedCodResult(barcode: string): CodTrackingResult | null | undefined {
    const entry = codDetailCache.get(barcode);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
        codDetailCache.delete(barcode);
        return undefined;
    }
    return entry.result;
}

function setCachedCodResult(barcode: string, result: CodTrackingResult | null): void {
    codDetailCache.set(barcode, { result, expiresAt: Date.now() + COD_CACHE_TTL_MS });
    if (codDetailCache.size > COD_CACHE_MAX_ENTRIES) {
        const oldest = codDetailCache.keys().next().value;
        if (oldest !== undefined) codDetailCache.delete(oldest);
    }
}

const codRequestSchema = z.object({
    barcodes: z
        .array(z.string().trim().toUpperCase().regex(VALID_BARCODE_REGEX, "Invalid barcode format"))
        .min(1, "At least one barcode is required")
        .max(MAX_BATCH_BARCODES, `Maximum ${MAX_BATCH_BARCODES} barcodes per request`),
});

async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    async function runWorker(): Promise<void> {
        while (nextIndex < items.length) {
            const current = nextIndex++;
            results[current] = await worker(items[current], current);
        }
    }

    const poolSize = Math.min(Math.max(1, concurrency), items.length);
    await Promise.all(Array.from({ length: poolSize }, () => runWorker()));
    return results;
}

function extractCookieHeader(headers: Headers): string {
    const setCookies =
        typeof headers.getSetCookie === "function"
            ? headers.getSetCookie()
            : headers.get("set-cookie")
                ? [headers.get("set-cookie") as string]
                : [];
    return setCookies
        .map((c) => c.split(";")[0]?.trim())
        .filter(Boolean)
        .join("; ");
}

/**
 * Fetch full COD details for a single barcode in a fresh PHP session
 * (avoids bepost.lk's same-session cooldown between consecutive POSTs).
 */
async function fetchSingleCodDetails(barcode: string): Promise<CodTrackingResult | null> {
    const cached = getCachedCodResult(barcode);
    if (cached !== undefined) {
        return cached;
    }

    const initRes = await fetch(BEPOST_MULTI_URL, {
        method: "GET",
        headers: {
            "User-Agent": BROWSER_UA,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
    });

    if (!initRes.ok) {
        throw new Error(`bepost.lk returned HTTP ${initRes.status}`);
    }

    const cookieHeader = extractCookieHeader(initRes.headers);
    const initHtml = (await initRes.text()).slice(0, MAX_UPSTREAM_HTML_BYTES);
    const csrfToken = extractBepostCsrfToken(initHtml);

    if (!csrfToken) {
        throw new Error("Could not initialize COD tracking session");
    }

    const detailParams = new URLSearchParams({
        csrf_token: csrfToken,
        details_barcode: barcode,
        website: "", // honeypot must remain empty
    });

    const detailRes = await fetch(BEPOST_MULTI_URL, {
        method: "POST",
        headers: {
            "User-Agent": BROWSER_UA,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Origin: "https://bepost.lk",
            Referer: BEPOST_MULTI_URL,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: detailParams.toString(),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
    });

    if (!detailRes.ok) {
        throw new Error(`bepost.lk details query returned HTTP ${detailRes.status}`);
    }

    const detailHtml = (await detailRes.text()).slice(0, MAX_UPSTREAM_HTML_BYTES);
    const parsed = parseCodDetailsHtml(detailHtml, barcode);
    setCachedCodResult(barcode, parsed);
    return parsed;
}

export async function POST(req: NextRequest): Promise<NextResponse<CodBatchApiResponse>> {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) {
        return NextResponse.json(
            { success: false, items: [], error: csrf.error },
            { status: 403, headers: { "Cache-Control": "no-store" } }
        );
    }

    const rl = await checkRateLimit(req, rateLimiters.tracking);
    const headers = { ...rateLimitHeaders(rl), "Cache-Control": "no-store" };
    if (rl.isRateLimited) {
        return NextResponse.json(
            { success: false, items: [], error: "Too many tracking requests. Please wait a moment." },
            { status: 429, headers }
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { success: false, items: [], error: "Invalid JSON body" },
            { status: 400, headers }
        );
    }

    const parsed = codRequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                items: [],
                error: parsed.error.issues[0]?.message || "Invalid barcodes",
            },
            { status: 400, headers }
        );
    }

    const barcodes = Array.from(new Set(parsed.data.barcodes));

    if (barcodes.length > 1) {
        const batchRl = await checkRateLimit(req, rateLimiters.trackingBatch);
        if (batchRl.isRateLimited) {
            return NextResponse.json(
                { success: false, items: [], error: "Too many batch tracking requests. Please wait a moment." },
                { status: 429, headers: { ...rateLimitHeaders(batchRl), "Cache-Control": "no-store" } }
            );
        }
    }

    try {
        // Fast path for single barcode: 1 GET + 1 direct details_barcode POST (0ms delay, full details)
        if (barcodes.length === 1) {
            const barcode = barcodes[0];
            const classification = classifyBarcode(barcode);
            const eligibleForSlp = classification !== "cod_only" && classification !== "international";
            const result = await fetchSingleCodDetails(barcode);

            return NextResponse.json(
                {
                    success: true,
                    items: [
                        {
                            barcode,
                            classification,
                            found: Boolean(result),
                            eligibleForSlp: result ? false : eligibleForSlp,
                            ...(result ? { result } : {}),
                        },
                    ],
                },
                { status: 200, headers }
            );
        }

        // Batch path (2–20 barcodes): 1 batch summary lookup, then fresh-session detail fetches for found rows
        const initRes = await fetch(BEPOST_MULTI_URL, {
            method: "GET",
            headers: {
                "User-Agent": BROWSER_UA,
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(12000),
        });

        if (!initRes.ok) {
            throw new Error(`bepost.lk returned HTTP ${initRes.status}`);
        }

        const cookieHeader = extractCookieHeader(initRes.headers);
        const initHtml = (await initRes.text()).slice(0, MAX_UPSTREAM_HTML_BYTES);
        const csrfToken = extractBepostCsrfToken(initHtml);

        if (!csrfToken) {
            throw new Error("Could not initialize COD tracking session");
        }

        const searchParams = new URLSearchParams({
            barcodes: barcodes.join(" "),
            csrf_token: csrfToken,
            website: "",
        });

        const batchRes = await fetch(BEPOST_MULTI_URL, {
            method: "POST",
            headers: {
                "User-Agent": BROWSER_UA,
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                Origin: "https://bepost.lk",
                Referer: BEPOST_MULTI_URL,
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: searchParams.toString(),
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(15000),
        });

        if (!batchRes.ok) {
            throw new Error(`bepost.lk batch query returned HTTP ${batchRes.status}`);
        }

        const batchHtml = (await batchRes.text()).slice(0, MAX_UPSTREAM_HTML_BYTES);
        const summary = parseCodSummaryHtml(batchHtml);

        if (summary.rateLimited) {
            return NextResponse.json(
                {
                    success: false,
                    items: [],
                    error: "Sri Lanka Post COD server asked us to pause. Please retry in a few seconds.",
                },
                { status: 503, headers }
            );
        }

        const summaryByBarcode = new Map(summary.rows.map((r) => [r.barcode, r]));

        // Fetch full details for found items with max concurrency of 3 using fresh sessions
        const items: CodLookupItemResponse[] = await mapWithConcurrency(
            barcodes,
            3,
            async (barcode): Promise<CodLookupItemResponse> => {
                const classification = classifyBarcode(barcode);
                const eligibleForSlp = classification !== "cod_only" && classification !== "international";
                const row = summaryByBarcode.get(barcode);

                if (!row || !row.found) {
                    return {
                        barcode,
                        classification,
                        found: false,
                        eligibleForSlp,
                    };
                }

                try {
                    const detailResult = await fetchSingleCodDetails(barcode);
                    if (detailResult) {
                        return {
                            barcode,
                            classification,
                            found: true,
                            eligibleForSlp: false,
                            result: detailResult,
                        };
                    }
                } catch (detailErr) {
                    console.error(`Failed to fetch COD details for ${barcode}:`, detailErr);
                }

                // Summary-only fallback with accurate status & stepper
                const statusCategory = classifyCodStatus(row.statusText, false);
                return {
                    barcode,
                    classification,
                    found: true,
                    eligibleForSlp: false,
                    result: {
                        service: "cod",
                        barcode,
                        statusLabel: row.statusText,
                        statusCategory,
                        steps: buildCodSteps(statusCategory),
                        checkedAt: new Date().toISOString(),
                    },
                };
            }
        );

        return NextResponse.json({ success: true, items }, { status: 200, headers });
    } catch (err) {
        console.error("COD tracking API error:", err);
        return NextResponse.json(
            {
                success: false,
                items: [],
                error: "Unable to reach Sri Lanka Post COD server right now. Please try again.",
            },
            { status: 502, headers }
        );
    }
}
