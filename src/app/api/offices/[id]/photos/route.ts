import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { url, caption } = body;

        if (!url) {
            return NextResponse.json(
                { error: "URL is required" },
                { status: 400 }
            );
        }

        // Verify office exists
        const office = await prisma.postOffice.findUnique({
            where: { id },
        });

        if (!office) {
            return NextResponse.json(
                { error: "Post office not found" },
                { status: 404 }
            );
        }

        // Save photo record
        const photo = await prisma.communityPhoto.create({
            data: {
                url,
                caption,
                postOfficeId: id,
                status: "APPROVED", // Auto-approve for now
            },
        });

        return NextResponse.json({ success: true, photo });
    } catch (error) {
        console.error("Error creating photo:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
