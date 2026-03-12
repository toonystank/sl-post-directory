import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { sendVerificationEmail } from "@/lib/email";
import { registerSchema } from "@/lib/validations";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export async function POST(req: Request) {
    try {
        // Enforce Rate Limit: Max 5 accounts per hour per IP
        const rateLimit = await checkRateLimit(req, rateLimiters.register);

        if (rateLimit.isRateLimited) {
            return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
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

        const { name, email, password, turnstileToken } = validation.data;

        // Verify Turnstile Captcha — fail-closed in production
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

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            // Generic response to prevent user enumeration
            return NextResponse.json({
                success: true,
                message: "If this email is available, a verification email has been sent.",
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");

        // Create the user
        const user = await prisma.user.create({
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
            message: "Account created successfully. Please check your email to verify your account.",
        });
    } catch (error: any) {
        console.error("Registration Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
