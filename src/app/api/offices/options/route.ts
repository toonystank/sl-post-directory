import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cache for 24 hours just like the main directory
export const revalidate = 86400;

export async function GET() {
    try {
        const divisions = await prisma.postOfficeField.groupBy({
            by: ['value'],
            where: { name: 'Division' },
            orderBy: { value: 'asc' }
        });

        // Map and filter out any empty strings
        const divisionNames = divisions
            .map(d => d.value.trim())
            .filter(Boolean);

        return NextResponse.json({ divisions: divisionNames }, { status: 200 });
    } catch (error) {
        console.error("Error fetching divisions:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
