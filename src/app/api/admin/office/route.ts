import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, postalCode, ...fields } = body;

        if (!name || !postalCode) {
            return NextResponse.json({ error: "Name and Postal Code are required" }, { status: 400 });
        }

        // Build the dynamic fields array
        const dynamicFields: { name: string; value: string; type: string }[] = [];
        for (const [key, value] of Object.entries(fields)) {
            if (key.startsWith("field_") && typeof value === 'string' && value.trim() !== '') {
                const fieldName = key.replace("field_", "");
                dynamicFields.push({ name: fieldName, value: value.trim(), type: "TEXT" });
            }
        }

        const newOffice = await prisma.postOffice.create({
            data: {
                name,
                postalCode,
                fields: {
                    create: dynamicFields
                }
            },
            include: {
                fields: true
            }
        });

        return NextResponse.json({ success: true, office: newOffice });

    } catch (error: any) {
        console.error("Admin Create Office Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
