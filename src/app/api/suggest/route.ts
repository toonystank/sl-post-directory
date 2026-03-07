import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEditRequestReceivedEmail, sendVerificationEmail } from "@/lib/email";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import { checkRateLimit } from "@/lib/rate-limiter";
import { suggestSchema } from "@/lib/validations";

export async function POST(req: Request) {
    try {
        // Enforce Rate Limit: Max 15 suggestions per hour per IP
        const rateLimitConfig = { limit: 15, windowMs: 60 * 60 * 1000 };
        const rateLimit = checkRateLimit(req, rateLimitConfig);

        if (rateLimit.isRateLimited) {
            return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
        }

        const body = await req.json();

        // Validate Payload using Zod
        const validation = suggestSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error?.issues[0]?.message || "Invalid input" },
                { status: 400 }
            );
        }

        const { officeId, submitterName, submitterEmail, submitterPassword, turnstileToken, name, postalCode, newFieldName, newFieldValue, ...fields } = validation.data;

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

            // Verify Captcha
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
            }

            // Check existing user
            const existingUser = await prisma.user.findUnique({
                where: { email: submitterEmail }
            });

            if (existingUser) {
                return NextResponse.json({ error: "An account with this email already exists. Please log in first." }, { status: 400 });
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

        if (!officeId) {
            return NextResponse.json({ error: "Office ID is required" }, { status: 400 });
        }

        const office = await prisma.postOffice.findUnique({
            where: { id: officeId }
        });

        if (!office) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }

        // Build the changes object
        const changes: any = {
            name,
            postalCode,
            fields: []
        };

        // Process dynamic fields
        for (const [key, value] of Object.entries(fields)) {
            if (key.startsWith("field_")) {
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
                changes: JSON.stringify(changes),
                status: "PENDING"
            }
        });

        // Trigger email notification for the edit
        await sendEditRequestReceivedEmail(user.email, user.name, office.name);

        return NextResponse.json({
            success: true,
            message: "Edit request submitted successfully",
            requestId: editRequest.id
        });

    } catch (error: any) {
        console.error("Suggest API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
