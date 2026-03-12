import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN" && user?.role !== "MODERATOR")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const cursor = searchParams.get("cursor") || undefined;
        let limit = parseInt(searchParams.get("limit") || "50");
        if (isNaN(limit)) limit = 50;
        limit = Math.min(Math.max(limit, 1), 100);

        const logs = await prisma.actionLog.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { name: true, email: true }
                }
            },
            take: limit + 1, // Fetch one extra to check if there's a next page
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const hasMore = logs.length > limit;
        const results = hasMore ? logs.slice(0, limit) : logs;
        const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

        return NextResponse.json({ logs: results, nextCursor }, { status: 200 });

    } catch (error) {
        console.error("Error fetching activity logs:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
