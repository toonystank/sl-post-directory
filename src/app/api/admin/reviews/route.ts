import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

function revalidateOfficePages(slug: string) {
    revalidatePath(`/office/${slug}`);
    revalidatePath(`/si/office/${slug}`);
    revalidatePath(`/ta/office/${slug}`);
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN" && user?.role !== "MODERATOR")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json()) as { reviewId?: string; action?: string };
        const { reviewId, action } = body;

        if (!reviewId || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (action === "APPROVE") {
            const updatedReview = await prisma.review.update({
                where: { id: reviewId },
                data: { status: "APPROVED" },
                include: { postOffice: { select: { slug: true } } },
            });
            revalidateOfficePages(updatedReview.postOffice.slug);
            return NextResponse.json(updatedReview);
        } else if (action === "REJECT") {
            const deleted = await prisma.review.delete({
                where: { id: reviewId },
                include: { postOffice: { select: { slug: true } } },
            });
            revalidateOfficePages(deleted.postOffice.slug);
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error: unknown) {
        console.error("Review Moderation Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
