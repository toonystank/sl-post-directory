import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders, rateLimiters } from "@/lib/rate-limiter";
import { signUpstreamSessionCookie } from "@/lib/tracking/session-token";
import type { SlpCaptchaApiResponse } from "@/lib/tracking/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLP_CAPTCHA_URL = "https://slpmail.slpost.gov.lk/track/captcha.php";
const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function detectImageMime(buf: Buffer): string {
    if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        return "image/png";
    }
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return "image/jpeg";
    }
    if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
        return "image/gif";
    }
    return "image/png";
}

export async function GET(req: NextRequest): Promise<NextResponse<SlpCaptchaApiResponse>> {
    const rl = await checkRateLimit(req, rateLimiters.tracking);
    const headers = {
        ...rateLimitHeaders(rl),
        "Cache-Control": "no-store, no-cache, must-revalidate",
    };

    if (rl.isRateLimited) {
        return NextResponse.json(
            { success: false, error: "Too many CAPTCHA requests. Please wait a moment." },
            { status: 429, headers }
        );
    }

    try {
        const res = await fetch(SLP_CAPTCHA_URL, {
            method: "GET",
            headers: {
                "User-Agent": BROWSER_UA,
                Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                Referer: "https://slpmail.slpost.gov.lk/track/",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(12000),
        });

        if (!res.ok) {
            throw new Error(`SLP captcha endpoint returned HTTP ${res.status}`);
        }

        const setCookies =
            typeof res.headers.getSetCookie === "function"
                ? res.headers.getSetCookie()
                : res.headers.get("set-cookie")
                    ? [res.headers.get("set-cookie") as string]
                    : [];

        const rawSessionCookie = setCookies.find((c) => c.trim().startsWith("PHPSESSID=")) || "";
        const token = signUpstreamSessionCookie(rawSessionCookie);

        if (!token) {
            throw new Error("SLP server did not issue a valid session cookie");
        }

        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (buf.length < 50) {
            throw new Error("SLP server returned an invalid CAPTCHA image");
        }

        const mime = detectImageMime(buf);
        const image = `data:${mime};base64,${buf.toString("base64")}`;

        return NextResponse.json({ success: true, image, token }, { status: 200, headers });
    } catch (err) {
        console.error("SLP captcha fetch error:", err);
        return NextResponse.json(
            {
                success: false,
                error: "Unable to load SLP Courier security code right now. Please retry.",
            },
            { status: 502, headers }
        );
    }
}
