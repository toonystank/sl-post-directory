import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { adminCreateUserSchema } from "@/lib/validations";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || user?.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 401 });
        }

        const body = await req.json();
        const parsed = adminCreateUserSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid user payload" },
                { status: 400 }
            );
        }

        const { name, email, password, role } = parsed.data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
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

        return NextResponse.json({ success: true, user: newUser });
    } catch (error) {
        console.error("Super Admin Create User Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
