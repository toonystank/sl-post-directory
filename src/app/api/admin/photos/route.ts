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

        // Delete photo
        await prisma.communityPhoto.delete({
            where: { id: photoId },
        });

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
