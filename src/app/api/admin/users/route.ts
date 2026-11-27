import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { adminCreateUserSchema } from "@/lib/validations";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const auth = await requireRole(["SUPER_ADMIN"]);
        if (!auth.ok) {
            return auth.response;
        }

        const body = await req.json();
        const parsed = adminCreateUserSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid user payload" },
                { status: 400 }
            );
        }

        const { name, email: rawEmail, password, role } = parsed.data;
        const email = rawEmail.trim().toLowerCase();

        const existingUser = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
        });
        if (existingUser) {
            return NextResponse.json({ error: "User already exists with this email" }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                role,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
        });

        await prisma.actionLog.create({
            data: {
                userId: auth.user.id,
                action: "CREATED_USER",
                details: JSON.stringify({ targetUserId: newUser.id, role: newUser.role }),
            },
        });

        return NextResponse.json({ success: true, user: newUser }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Super Admin Create User Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
