import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN" && user?.role !== "MODERATOR")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const logs = await prisma.actionLog.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { name: true, email: true }
                }
            },
            take: 100 // Limit to latest 100 for now
        });

        return NextResponse.json({ logs }, { status: 200 });

    } catch (error) {
        console.error("Error fetching activity logs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
