import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { sendVerificationEmail } from "@/lib/email";
import { registerSchema } from "@/lib/validations";
import { checkRateLimit, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";
import { verifyTurnstile } from "@/lib/turnstile";
import { verifySameOrigin } from "@/lib/csrf";

const NEUTRAL_REGISTER_MESSAGE = "If this email is available, a verification email has been sent.";

export async function POST(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        // Enforce Rate Limit: Max 5 accounts per hour per IP
        const rateLimit = await checkRateLimit(req, rateLimiters.register);

        if (rateLimit.isRateLimited) {
            return NextResponse.json(
                { error: "Too many registration attempts. Please try again later." },
                { status: 429, headers: rateLimitHeaders(rateLimit) }
            );
        }

        const body = await req.json();

        // Validate Payload using Zod
        const validation = registerSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error?.issues[0]?.message || "Invalid input" },
                { status: 400 }
            );
        }

        const { name, email: rawEmail, password, turnstileToken } = validation.data;
        const email = rawEmail.trim().toLowerCase();

        const captcha = await verifyTurnstile(turnstileToken);
        if (!captcha.ok) {
            return NextResponse.json({ error: captcha.error }, { status: captcha.status });
        }

        // Check if user already exists (case-insensitive)
        const existingUser = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
        });

        // Always perform bcrypt work to eliminate timing side-channel for email enumeration
        const passwordHash = await bcrypt.hash(password, 10);

        if (existingUser) {
            return NextResponse.json({
                success: true,
                message: NEUTRAL_REGISTER_MESSAGE,
            });
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");

        // Create the user
        await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                role: "CONTRIBUTOR",
                verificationToken,
            },
        });

        // Send verification email
        await sendVerificationEmail(email, name, verificationToken);

        return NextResponse.json({
            success: true,
            message: NEUTRAL_REGISTER_MESSAGE,
        });
    } catch (error: unknown) {
        console.error("Registration Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
