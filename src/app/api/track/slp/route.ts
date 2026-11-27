import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/csrf";
import { checkRateLimit, rateLimitHeaders, rateLimiters } from "@/lib/rate-limiter";
import { VALID_BARCODE_REGEX } from "@/lib/tracking/classifier";
import { parseSlpHtml } from "@/lib/tracking/parsers";
import { consumeUpstreamSessionCookie } from "@/lib/tracking/session-token";
import type { SlpTrackApiResponse } from "@/lib/tracking/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLP_TRACK_URL = "https://slpmail.slpost.gov.lk/track/index.php";
const MAX_UPSTREAM_HTML_BYTES = 512_000;
const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const slpTrackSchema = z.object({
    barcode: z.string().trim().toUpperCase().regex(VALID_BARCODE_REGEX, "Invalid barcode format"),
    captcha: z.string().trim().min(1, "Security code is required").max(20, "Invalid security code"),
    token: z.string().trim().min(10, "Session token is required"),
});

export async function POST(req: NextRequest): Promise<NextResponse<SlpTrackApiResponse>> {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) {
        return NextResponse.json(
            { success: false, status: "error", error: csrf.error },
            { status: 403, headers: { "Cache-Control": "no-store" } }
        );
    }

    const rl = await checkRateLimit(req, rateLimiters.tracking);
    const headers = {
        ...rateLimitHeaders(rl),
        "Cache-Control": "no-store",
    };

    if (rl.isRateLimited) {
        return NextResponse.json(
            {
                success: false,
                status: "error",
                error: "Too many tracking requests. Please wait a moment.",
            },
            { status: 429, headers }
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { success: false, status: "error", error: "Invalid JSON body" },
            { status: 400, headers }
        );
    }

    const parsed = slpTrackSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                status: "error",
                error: parsed.error.issues[0]?.message || "Invalid tracking request",
            },
            { status: 400, headers }
        );
    }

    const { barcode, captcha, token } = parsed.data;
    const cookiePair = await consumeUpstreamSessionCookie(token);
    if (!cookiePair) {
        return NextResponse.json(
            {
                success: false,
                status: "invalid_captcha",
                error: "Security code expired. Please refresh and try again.",
            },
            { status: 400, headers }
        );
    }

    try {
        const params = new URLSearchParams();
        params.append("barcode", barcode);
        params.append("input", captcha);
        params.append("Submit", "Search");

        const res = await fetch(SLP_TRACK_URL, {
            method: "POST",
            headers: {
                "User-Agent": BROWSER_UA,
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                Origin: "https://slpmail.slpost.gov.lk",
                Referer: "https://slpmail.slpost.gov.lk/track/",
                Cookie: cookiePair,
            },
            body: params.toString(),
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            throw new Error(`SLP track endpoint returned HTTP ${res.status}`);
        }

        const html = (await res.text()).slice(0, MAX_UPSTREAM_HTML_BYTES);
        const result = parseSlpHtml(html, barcode);

        if (result.status === "invalid_captcha") {
            return NextResponse.json(
                {
                    success: false,
                    status: "invalid_captcha",
                    error: "Incorrect security code. Please refresh and try again.",
                },
                { status: 400, headers }
            );
        }

        if (result.status === "not_found" || !result.result) {
            return NextResponse.json(
                {
                    success: true,
                    status: "not_found",
                },
                { status: 200, headers }
            );
        }

        return NextResponse.json(
            {
                success: true,
                status: "ok",
                result: result.result,
            },
            { status: 200, headers }
        );
    } catch (err) {
        console.error("SLP tracking API error:", err);
        return NextResponse.json(
            {
                success: false,
                status: "error",
                error: "Unable to reach Sri Lanka Post SLP Courier server right now. Please try again.",
            },
            { status: 502, headers }
        );
    }
}
