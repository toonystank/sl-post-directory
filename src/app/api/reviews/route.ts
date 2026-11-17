import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimiters, rateLimitHeaders } from "@/lib/rate-limiter";
import { reviewSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const rateLimit = await checkRateLimit(request, rateLimiters.reviews);
        if (rateLimit.isRateLimited) {
            return NextResponse.json(
                { error: "Too many review submissions. Please try again later." },
                { status: 429, headers: rateLimitHeaders(rateLimit) }
            );
        }

        if (!hasDatabaseUrl) {
            return NextResponse.json({ error: "Database unavailable in preview mode" }, { status: 503 });
        }

        const body = await request.json();
        const parsed = reviewSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { rating, content, authorName, postOfficeId } = parsed.data;

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
    const postOfficeId = request.nextUrl.searchParams.get("postOfficeId")?.trim();

    if (!postOfficeId || postOfficeId.length > 64) {
        return NextResponse.json({ error: "Valid postOfficeId is required" }, { status: 400 });
    }

    const cacheHeaders = {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    };

    if (!hasDatabaseUrl) {
        return NextResponse.json([], { headers: cacheHeaders });
    }

    try {
        const reviews = await prisma.review.findMany({
            where: { postOfficeId, status: "APPROVED" },
            orderBy: { createdAt: "desc" },
            take: 20,
        });

        return NextResponse.json(reviews, { headers: cacheHeaders });
    } catch {
        return NextResponse.json([], { headers: cacheHeaders });
    }
}
