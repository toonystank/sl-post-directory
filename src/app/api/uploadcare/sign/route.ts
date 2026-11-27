import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimiters } from "@/lib/rate-limiter";
import { verifyTurnstile } from "@/lib/turnstile";
import {
    createUploadcareSignature,
    getUploadcareCdnBase,
    getUploadcarePublicKey,
    signUploadTicket,
} from "@/lib/uploadcare";

const signRequestSchema = z.object({
    scope: z.enum(["admin", "community"]).default("community"),
    officeId: z.string().trim().min(1).max(64).optional(),
    turnstileToken: z.string().nullable().optional(),
});

export async function POST(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
        }

        const rateLimit = await checkRateLimit(req, rateLimiters.uploadSign);
        const rlHeaders = { ...rateLimitHeaders(rateLimit), "Cache-Control": "no-store" };
        if (rateLimit.isRateLimited) {
            return NextResponse.json(
                { error: "Too many upload requests. Please try again later." },
                { status: 429, headers: rlHeaders }
            );
        }

        const body = await req.json();
        const parsed = signRequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid upload sign payload" },
                { status: 400, headers: rlHeaders }
            );
        }

        const { scope, officeId, turnstileToken } = parsed.data;
        const secretKey = process.env.UPLOADCARE_SECRET_KEY?.trim();
        const signed = secretKey ? createUploadcareSignature(secretKey, 120) : null;

        if (scope === "admin") {
            const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);
            if (!auth.ok) {
                return auth.response;
            }

            return NextResponse.json(
                {
                    publicKey: getUploadcarePublicKey(),
                    cdnBase: getUploadcareCdnBase(),
                    store: "1",
                    ...(signed ? { signature: signed.signature, expire: signed.expire } : {}),
                },
                { headers: rlHeaders }
            );
        }

        // Community photo upload scope requires officeId + Turnstile verification
        if (!officeId) {
            return NextResponse.json({ error: "Office ID is required" }, { status: 400, headers: rlHeaders });
        }

        const captcha = await verifyTurnstile(turnstileToken);
        if (!captcha.ok) {
            return NextResponse.json({ error: captcha.error }, { status: captcha.status, headers: rlHeaders });
        }

        if (hasDatabaseUrl) {
            const office = await prisma.postOffice.findUnique({
                where: { id: officeId },
                select: { id: true },
            });
            if (!office) {
                return NextResponse.json({ error: "Post office not found" }, { status: 404, headers: rlHeaders });
            }
        }

        const ip = getClientIp(req);
        const uploadTicket = signUploadTicket({ officeId, ip });

        return NextResponse.json(
            {
                publicKey: getUploadcarePublicKey(),
                cdnBase: getUploadcareCdnBase(),
                // Defer permanent Uploadcare storage until server verification when secret key is set
                store: secretKey ? "0" : "1",
                ...(signed ? { signature: signed.signature, expire: signed.expire } : {}),
                ...(uploadTicket ? { uploadTicket } : {}),
            },
            { headers: rlHeaders }
        );
    } catch (error) {
        console.error("Uploadcare sign error:", error);
        return NextResponse.json(
            { error: "Failed to initialize secure upload" },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
