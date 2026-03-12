import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEditRequestReceivedEmail, sendVerificationEmail } from "@/lib/email";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";
import { suggestSchema, suggestAddSchema } from "@/lib/validations";

export async function POST(req: Request) {
    try {
        // Enforce Rate Limit: Max 15 suggestions per hour per IP
        const rateLimit = await checkRateLimit(req, rateLimiters.suggest);

        if (rateLimit.isRateLimited) {
            return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
        }

        const body = await req.json();

        // Validate Payload using Zod based on the type
        const isAddRequest = body.type === "ADD";
        const validation = isAddRequest ? suggestAddSchema.safeParse(body) : suggestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error?.issues[0]?.message || "Invalid input" },
                { status: 400 }
            );
        }

        const data = validation.data;
        const type = data.type || "EDIT";
        const reason = data.reason || null;
        const officeId = isAddRequest ? null : (data as any).officeId;

        const { submitterName, submitterEmail, submitterPassword, turnstileToken, name, postalCode, newFieldName, newFieldValue, ...fields } = data as any;

        // Verify Captcha — fail-closed in production
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
        if (turnstileSecret && turnstileToken) {
            const formData = new FormData();
            formData.append("secret", turnstileSecret);
            formData.append("response", turnstileToken);

            const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                body: formData,
                method: "POST",
            });
            const outcome = await result.json();
            if (!outcome.success) {
                return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
            }
        } else if (turnstileSecret && !turnstileToken) {
            return NextResponse.json({ error: "Please complete the Captcha" }, { status: 400 });
        } else if (!turnstileSecret && process.env.NODE_ENV === "production") {
            console.error("CRITICAL: TURNSTILE_SECRET_KEY is not configured in production!");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        let user;
        const session = await getServerSession(authOptions);

        if (session && session.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email }
            });

            if (!user) {
                return NextResponse.json({ error: "Session invalid" }, { status: 401 });
            }
        } else {
            // Unauthenticated User flow
            if (!submitterName || !submitterEmail || !submitterPassword) {
                return NextResponse.json({ error: "Name, email, and password are required to create an account." }, { status: 400 });
            }



            // Check existing user
            const existingUser = await prisma.user.findUnique({
                where: { email: submitterEmail }
            });

            if (existingUser) {
                // Generic error to prevent user enumeration
                return NextResponse.json({ error: "Please log in to submit suggestions." }, { status: 400 });
            }

            // Create new user
            const passwordHash = await bcrypt.hash(submitterPassword, 10);
            const verificationToken = crypto.randomBytes(32).toString("hex");

            user = await prisma.user.create({
                data: {
                    name: submitterName,
                    email: submitterEmail,
                    passwordHash,
                    role: "CONTRIBUTOR",
                    verificationToken
                }
            });

            // Send Verification Email
            await sendVerificationEmail(submitterEmail, submitterName, verificationToken);
        }

        let office = null;
        if (!isAddRequest) {
            if (!officeId) {
                return NextResponse.json({ error: "Office ID is required" }, { status: 400 });
            }

            office = await prisma.postOffice.findUnique({
                where: { id: officeId }
            });

            if (!office) {
                return NextResponse.json({ error: "Post office not found" }, { status: 404 });
            }
        }

        // Build the changes object (for EDIT and ADD)
        const changes: any = {
            name,
            postalCode,
            fields: []
        };

        // Process dynamic fields
        for (const [key, value] of Object.entries(fields)) {
            if (key.startsWith("field_") && key !== "type" && key !== "reason") {
                const fieldName = key.replace("field_", "");
                changes.fields.push({ name: fieldName, value });
            }
        }

        // Processing a potential new field addition
        if (newFieldName && newFieldValue) {
            changes.fields.push({ name: newFieldName, value: newFieldValue });
        }

        // Create the edit request
        const editRequest = await prisma.editRequest.create({
            data: {
                postOfficeId: officeId,
                requestedById: user.id,
                type: type,
                reason: reason,
                changes: JSON.stringify(changes),
                status: "PENDING"
            }
        });

        // Trigger email notification for the edit
        const emailOfficeName = isAddRequest ? name || "New Office" : office?.name || "";
        await sendEditRequestReceivedEmail(user.email, user.name, emailOfficeName);

        return NextResponse.json({
            success: true,
            message: `${type === "ADD" ? "Addition" : type === "REMOVAL" ? "Removal" : "Edit"} request submitted successfully`,
            requestId: editRequest.id
        });

    } catch (error: any) {
        console.error("Suggest API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
