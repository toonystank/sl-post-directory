import { NextResponse } from "next/server";
import { verifySameOrigin } from "@/lib/csrf";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";
import { extractUploadcareUuid } from "@/lib/security";
import { verifyTurnstile } from "@/lib/turnstile";
import { verifyAndStoreUploadcareFile, verifyUploadTicket } from "@/lib/uploadcare";
import { photoUploadSchema } from "@/lib/validations";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const rateLimit = await checkRateLimit(req, rateLimiters.photos);
        if (rateLimit.isRateLimited) {
            return NextResponse.json(
                { error: "Too many photo uploads. Please try again later." },
                { status: 429, headers: rateLimitHeaders(rateLimit) }
            );
        }

        if (!hasDatabaseUrl) {
            return NextResponse.json({ error: "Database unavailable in preview mode" }, { status: 503 });
        }

        const { id } = await params;
        const officeId = id?.trim();
        if (!officeId || officeId.length > 64) {
            return NextResponse.json({ error: "Invalid post office ID" }, { status: 400 });
        }

        const body = await req.json();
        const parsed = photoUploadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid photo payload" },
                { status: 400 }
            );
        }

        const { url, caption, turnstileToken, uploadTicket } = parsed.data;
        const ip = getClientIp(req);
        const ticketValid = uploadTicket ? verifyUploadTicket(uploadTicket, { officeId, ip }) : false;

        if (!ticketValid) {
            const captcha = await verifyTurnstile(turnstileToken);
            if (!captcha.ok) {
                return NextResponse.json({ error: captcha.error }, { status: captcha.status });
            }
        }

        const office = await prisma.postOffice.findUnique({
            where: { id: officeId },
            select: { id: true },
        });

        if (!office) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }

        const fileUuid = extractUploadcareUuid(url);
        if (!fileUuid) {
            return NextResponse.json({ error: "Invalid Uploadcare photo URL" }, { status: 400 });
        }

        const verification = await verifyAndStoreUploadcareFile(fileUuid);
        if (!verification.ok) {
            return NextResponse.json({ error: verification.error }, { status: verification.status });
        }

        const photo = await prisma.communityPhoto.create({
            data: {
                url,
                caption: caption || null,
                postOfficeId: officeId,
                status: "PENDING",
            },
        });

        return NextResponse.json({ success: true, photo }, { status: 201 });
    } catch (error) {
        console.error("Error creating photo:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
