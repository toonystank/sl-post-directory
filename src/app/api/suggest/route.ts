import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEditRequestReceivedEmail, sendVerificationEmail } from "@/lib/email";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import { checkRateLimit, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";
import { verifyTurnstile } from "@/lib/turnstile";
import { verifySameOrigin } from "@/lib/csrf";
import { suggestSchema, suggestAddSchema, extractValidatedDynamicFields } from "@/lib/validations";

const DUMMY_BCRYPT_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function POST(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        // Enforce Rate Limit: Max 15 suggestions per hour per IP
        const rateLimit = await checkRateLimit(req, rateLimiters.suggest);

        if (rateLimit.isRateLimited) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Try again later." },
                { status: 429, headers: rateLimitHeaders(rateLimit) }
            );
        }

        const body = (await req.json()) as Record<string, unknown>;

        // Validate Payload using Zod based on the type
        const isAddRequest = body.type === "ADD";
        const validation = isAddRequest ? suggestAddSchema.safeParse(body) : suggestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error?.issues[0]?.message || "Invalid input" },
                { status: 400 }
            );
        }

        const data = validation.data as Record<string, unknown>;
        const type = typeof data.type === "string" ? data.type : "EDIT";
        const reason = typeof data.reason === "string" && data.reason ? data.reason : null;
        const officeId = isAddRequest ? null : typeof data.officeId === "string" ? data.officeId : null;

        const submitterName = typeof data.submitterName === "string" ? data.submitterName : undefined;
        const submitterEmailRaw = typeof data.submitterEmail === "string" ? data.submitterEmail : undefined;
        const submitterEmail = submitterEmailRaw?.trim().toLowerCase();
        const submitterPassword = typeof data.submitterPassword === "string" ? data.submitterPassword : undefined;
        const turnstileToken = typeof data.turnstileToken === "string" ? data.turnstileToken : null;
        const name = typeof data.name === "string" ? data.name : undefined;
        const postalCode = typeof data.postalCode === "string" ? data.postalCode : undefined;
        const newFieldName = typeof data.newFieldName === "string" ? data.newFieldName : undefined;
        const newFieldValue = typeof data.newFieldValue === "string" ? data.newFieldValue : undefined;

        let validatedDynamicFields: Array<{ name: string; value: string }>;
        try {
            validatedDynamicFields = extractValidatedDynamicFields(data, 50);
        } catch (fieldErr) {
            return NextResponse.json(
                { error: fieldErr instanceof Error ? fieldErr.message : "Invalid custom fields" },
                { status: 400 }
            );
        }

        const captcha = await verifyTurnstile(turnstileToken);
        if (!captcha.ok) {
            return NextResponse.json({ error: captcha.error }, { status: captcha.status });
        }

        let user;
        const session = await getServerSession(authOptions);

        if (session && session.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });

            if (!user) {
                return NextResponse.json({ error: "Session invalid" }, { status: 401 });
            }
        } else {
            // Unauthenticated User flow
            if (!submitterName || !submitterEmail || !submitterPassword) {
                return NextResponse.json({ error: "Name, email, and password are required to create an account." }, { status: 400 });
            }

            const existingUser = await prisma.user.findFirst({
                where: { email: { equals: submitterEmail, mode: "insensitive" } },
                select: { id: true },
            });

            if (existingUser) {
                // Equalize timing and return generic error to prevent email enumeration
                await bcrypt.compare(submitterPassword, DUMMY_BCRYPT_HASH);
                return NextResponse.json({ error: "Please log in to submit suggestions." }, { status: 400 });
            }

            const passwordHash = await bcrypt.hash(submitterPassword, 10);
            const verificationToken = crypto.randomBytes(32).toString("hex");

            user = await prisma.user.create({
                data: {
                    name: submitterName,
                    email: submitterEmail,
                    passwordHash,
                    role: "CONTRIBUTOR",
                    verificationToken,
                },
            });

            await sendVerificationEmail(submitterEmail, submitterName, verificationToken);
        }

        let office = null;
        if (!isAddRequest) {
            if (!officeId) {
                return NextResponse.json({ error: "Office ID is required" }, { status: 400 });
            }

            office = await prisma.postOffice.findUnique({
                where: { id: officeId },
            });

            if (!office) {
                return NextResponse.json({ error: "Post office not found" }, { status: 404 });
            }
        }

        const changes: {
            name?: string;
            postalCode?: string;
            fields: { name: string; value: string }[];
        } = {
            name,
            postalCode,
            fields: [...validatedDynamicFields],
        };

        if (newFieldName && newFieldValue && changes.fields.length < 50) {
            changes.fields.push({ name: newFieldName, value: newFieldValue });
        }

        const editRequest = await prisma.editRequest.create({
            data: {
                postOfficeId: officeId,
                requestedById: user.id,
                type,
                reason,
                changes: JSON.stringify(changes),
                status: "PENDING",
            },
        });

        const emailOfficeName = isAddRequest ? name || "New Office" : office?.name || "";
        await sendEditRequestReceivedEmail(user.email, user.name, emailOfficeName);

        return NextResponse.json({
            success: true,
            message: `${type === "ADD" ? "Addition" : type === "REMOVAL" ? "Removal" : "Edit"} request submitted successfully`,
            requestId: editRequest.id,
        });
    } catch (error: unknown) {
        console.error("Suggest API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
