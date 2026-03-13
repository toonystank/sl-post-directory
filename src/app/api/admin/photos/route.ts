import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { id?: string; role?: string } | undefined;

        // Ensure user is an admin or moderator
        if (!session || !user?.id || !["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(user?.role || "")) {
            return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 401 });
        }

        const url = new URL(req.url);
        const photoId = url.searchParams.get("id");

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

        // Delete file from Uploadcare storage
        const uploadcareSecretKey = process.env.UPLOADCARE_SECRET_KEY;
        const uploadcarePubKey = process.env.NEXT_PUBLIC_UPLOADCARE_PUB_KEY || "16423b7c9e1a87e5884e";
        if (uploadcareSecretKey) {
            try {
                // Extract UUID from CDN URL (e.g. https://3q5fhu0dw8.ucarecd.net/UUID/ or https://ucarecdn.com/UUID/)
                const urlParts = photo.url.replace(/\/$/, '').split('/');
                const fileUuid = urlParts[urlParts.length - 1];

                if (fileUuid) {
                    const ucRes = await fetch(`https://api.uploadcare.com/files/${fileUuid}/storage/`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Uploadcare.Simple ${uploadcarePubKey}:${uploadcareSecretKey}`,
                            'Accept': 'application/vnd.uploadcare-v0.7+json',
                        },
                    });

                    if (!ucRes.ok) {
                        console.warn(`Uploadcare deletion failed for ${fileUuid}: ${ucRes.status} ${ucRes.statusText}`);
                    }
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
                    postOfficeName: photo.postOffice.name 
                })
            }
        });

        return NextResponse.json({ success: true, message: "Photo deleted successfully" });

    } catch (error) {
        console.error("Photo Moderation API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
