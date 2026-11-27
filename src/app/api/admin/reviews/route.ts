import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { reviewModerationSchema } from "@/lib/validations";

function revalidateOfficePages(slug: string) {
    revalidatePath(`/office/${slug}`);
    revalidatePath(`/si/office/${slug}`);
    revalidatePath(`/ta/office/${slug}`);
}

export async function POST(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const auth = await requireRole(["ADMIN", "SUPER_ADMIN", "MODERATOR"]);
        if (!auth.ok) {
            return auth.response;
        }

        const body = await req.json();
        const parsed = reviewModerationSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Missing or invalid review moderation fields" },
                { status: 400 }
            );
        }

        const { reviewId, action } = parsed.data;

        if (action === "APPROVE") {
            const updatedReview = await prisma.review.update({
                where: { id: reviewId },
                data: { status: "APPROVED" },
                include: { postOffice: { select: { slug: true } } },
            });
            await prisma.actionLog.create({
                data: {
                    userId: auth.user.id,
                    action: "APPROVED_REVIEW",
                    details: JSON.stringify({ reviewId, postOfficeId: updatedReview.postOfficeId }),
                },
            });
            revalidateOfficePages(updatedReview.postOffice.slug);
            return NextResponse.json(updatedReview);
        } else {
            const deleted = await prisma.review.delete({
                where: { id: reviewId },
                include: { postOffice: { select: { slug: true } } },
            });
            await prisma.actionLog.create({
                data: {
                    userId: auth.user.id,
                    action: "REJECTED_REVIEW",
                    details: JSON.stringify({ reviewId, postOfficeId: deleted.postOfficeId }),
                },
            });
            revalidateOfficePages(deleted.postOffice.slug);
            return NextResponse.json({ success: true });
        }
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
            return NextResponse.json({ error: "Review not found" }, { status: 404 });
        }
        console.error("Review Moderation Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
