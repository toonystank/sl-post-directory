import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const auth = await requireRole(["SUPER_ADMIN"]);
        if (!auth.ok) {
            return auth.response;
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
                "Cache-Control": "no-store",
            },
        });

    } catch (error) {
        console.error("Error creating database backup:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
