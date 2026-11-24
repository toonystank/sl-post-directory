import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string } | undefined;

    if (!session || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(user?.role || "")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasDatabaseUrl) {
        return NextResponse.json(
            {
                stats: {
                    totalOffices: 0,
                    pendingEdits: 0,
                    pendingPhotos: 0,
                    pendingReviews: 0,
                    publishedNews: 0,
                    contributorCount: 0,
                },
                priorityEdits: [],
                pendingPhotosList: [],
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    }

    try {
        const [
            totalOffices,
            pendingEdits,
            pendingPhotos,
            pendingReviews,
            publishedNews,
            contributorCount,
            priorityEdits,
            pendingPhotosList,
        ] = await Promise.all([
            prisma.postOffice.count(),
            prisma.editRequest.count({ where: { status: { in: ["PENDING", "MORE_INFO"] } } }),
            prisma.communityPhoto.count({ where: { status: "PENDING" } }),
            prisma.review.count({ where: { status: "PENDING" } }),
            prisma.blogPost.count({ where: { published: true } }),
            prisma.user.count({ where: { role: "CONTRIBUTOR" } }),
            prisma.editRequest.findMany({
                where: { status: { in: ["PENDING", "MORE_INFO"] } },
                include: {
                    postOffice: { select: { name: true, postalCode: true } },
                    requestedBy: { select: { name: true, email: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
            prisma.communityPhoto.findMany({
                where: { status: "PENDING" },
                include: {
                    postOffice: { select: { name: true, postalCode: true, slug: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
        ]);

        return NextResponse.json(
            {
                stats: {
                    totalOffices,
                    pendingEdits,
                    pendingPhotos,
                    pendingReviews,
                    publishedNews,
                    contributorCount,
                },
                priorityEdits,
                pendingPhotosList,
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("Admin Summary API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
