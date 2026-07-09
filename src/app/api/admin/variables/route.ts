import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const variables = await prisma.siteVariable.findMany({
            orderBy: { key: 'asc' }
        });
        return NextResponse.json(variables);
    } catch (error) {
        console.error("Error fetching variables:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { key, value, description } = body;

        if (!key || !value) {
            return NextResponse.json({ error: "Key and Value are required" }, { status: 400 });
        }

        const variable = await prisma.siteVariable.upsert({
            where: { key },
            update: { value, description },
            create: { key, value, description }
        });

        return NextResponse.json(variable);
    } catch (error) {
        console.error("Error saving variable:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const key = searchParams.get('key');
        
        if (!key) {
            return NextResponse.json({ error: "Key is required" }, { status: 400 });
        }

        await prisma.siteVariable.delete({ where: { key } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting variable:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
