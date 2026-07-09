import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const reviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    content: z.string().min(10).max(1000),
    authorName: z.string().min(2).max(50),
    postOfficeId: z.string().min(1),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = reviewSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { rating, content, authorName, postOfficeId } = parsed.data;

        // Verify post office exists
        const office = await prisma.postOffice.findUnique({
            where: { id: postOfficeId },
            select: { id: true },
        });

        if (!office) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }

        const review = await prisma.review.create({
            data: { rating, content, authorName, postOfficeId },
        });

        return NextResponse.json(review, { status: 201 });
    } catch (error) {
        console.error("Error creating review:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const postOfficeId = request.nextUrl.searchParams.get("postOfficeId");

        if (!postOfficeId) {
            return NextResponse.json({ error: "postOfficeId is required" }, { status: 400 });
        }

        const reviews = await prisma.review.findMany({
            where: { postOfficeId },
            orderBy: { createdAt: "desc" },
            take: 20,
        });

        return NextResponse.json(reviews, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
