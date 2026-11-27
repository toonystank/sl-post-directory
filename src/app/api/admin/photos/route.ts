import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { extractUploadcareUuid } from "@/lib/security";
import { getUploadcarePublicKey } from "@/lib/uploadcare";
import { photoApprovalSchema } from "@/lib/validations";

function revalidateOfficePages(slug: string) {
    revalidatePath(`/office/${slug}`);
    revalidatePath(`/si/office/${slug}`);
    revalidatePath(`/ta/office/${slug}`);
}

export async function PATCH(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const auth = await requireRole(["ADMIN", "SUPER_ADMIN", "MODERATOR"]);
        if (!auth.ok) {
            return auth.response;
        }
        const user = auth.user;

        const body = await req.json();
        const parsed = photoApprovalSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "Photo ID is required" }, { status: 400 });
        }
        const photoId = parsed.data.id;

        const photo = await prisma.communityPhoto.update({
            where: { id: photoId },
            data: { status: "APPROVED" },
            include: { postOffice: { select: { name: true, slug: true } } },
        });

        await prisma.actionLog.create({
            data: {
                userId: user.id,
                action: "APPROVED_COMMUNITY_PHOTO",
                details: JSON.stringify({
                    photoId,
                    url: photo.url,
                    postOfficeId: photo.postOfficeId,
                    postOfficeName: photo.postOffice.name,
                }),
            },
        });

        revalidateOfficePages(photo.postOffice.slug);

        return NextResponse.json({ success: true, photo });
    } catch (error) {
        console.error("Photo Approval API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const auth = await requireRole(["ADMIN", "SUPER_ADMIN", "MODERATOR"]);
        if (!auth.ok) {
            return auth.response;
        }
        const user = auth.user;

        const url = new URL(req.url);
        const photoId = url.searchParams.get("id")?.trim();

        if (!photoId) {
            return NextResponse.json({ error: "Photo ID is required" }, { status: 400 });
        }

        // Check if photo exists first to get context
        const photo = await prisma.communityPhoto.findUnique({
            where: { id: photoId },
            include: { postOffice: true },
        });

        if (!photo) {
            return NextResponse.json({ error: "Photo not found" }, { status: 404 });
        }

        // Delete photo from database
        await prisma.communityPhoto.delete({
            where: { id: photoId },
        });

        // Delete file from Uploadcare storage only when URL matches strict Uploadcare UUID format
        const uploadcareSecretKey = process.env.UPLOADCARE_SECRET_KEY?.trim();
        const uploadcarePubKey = getUploadcarePublicKey();
        const fileUuid = extractUploadcareUuid(photo.url);
        if (uploadcareSecretKey && fileUuid) {
            try {
                const ucRes = await fetch(`https://api.uploadcare.com/files/${fileUuid}/storage/`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Uploadcare.Simple ${uploadcarePubKey}:${uploadcareSecretKey}`,
                        Accept: "application/vnd.uploadcare-v0.7+json",
                    },
                    redirect: "error",
                    signal: AbortSignal.timeout(10_000),
                });

                if (!ucRes.ok) {
                    console.warn(`Uploadcare deletion failed for ${fileUuid}: ${ucRes.status} ${ucRes.statusText}`);
                }
            } catch (ucError) {
                // Log but don't fail — DB record is already deleted
                console.error("Failed to delete from Uploadcare:", ucError);
            }
        }

        // Log the action for audit trail
        await prisma.actionLog.create({
            data: {
                userId: user.id,
                action: "DELETED_COMMUNITY_PHOTO",
                details: JSON.stringify({
                    photoId,
                    url: photo.url,
                    postOfficeId: photo.postOfficeId,
                    postOfficeName: photo.postOffice.name,
                }),
            },
        });

        revalidateOfficePages(photo.postOffice.slug);

        return NextResponse.json({ success: true, message: "Photo deleted successfully" });
    } catch (error) {
        console.error("Photo Moderation API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
