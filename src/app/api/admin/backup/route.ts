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

        const offices = await prisma.postOffice.findMany({
            include: {
                fields: {
                    select: {
                        name: true,
                        value: true,
                        type: true
                    }
                }
            }
        });

        // Generate a timestamped file name
        const timestamp = new Date().toISOString().split("T")[0];
        const fileName = `post-office-backup-${timestamp}.json`;

        return new NextResponse(JSON.stringify(offices, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="${fileName}"`,
            },
        });

    } catch (error) {
        console.error("Error creating database backup:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
