import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import QueueClient from "@/components/admin/QueueClient";

interface SessionUser {
    role?: string;
}

export default async function DashboardQueuePage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(user?.role || "")) {
        redirect("/dashboard");
    }

    const [pendingEditItems, communityPhotos, pendingReviewItems] = hasDatabaseUrl
        ? await Promise.all([
              prisma.editRequest.findMany({
                  where: { status: { in: ["PENDING", "MORE_INFO"] } },
                  include: {
                      postOffice: {
                          select: {
                              name: true,
                              postalCode: true,
                              fields: { select: { name: true, value: true } },
                          },
                      },
                      requestedBy: { select: { name: true, email: true } },
                  },
                  orderBy: { createdAt: "desc" },
              }),
              prisma.communityPhoto.findMany({
                  include: {
                      postOffice: { select: { name: true, postalCode: true, slug: true } },
                  },
                  orderBy: { createdAt: "desc" },
                  take: 100,
              }),
              prisma.review.findMany({
                  where: { status: "PENDING" },
                  include: {
                      postOffice: { select: { name: true, postalCode: true } },
                  },
                  orderBy: { createdAt: "desc" },
              }),
          ])
        : [[], [], []];

    return (
        <Suspense fallback={<div className="h-64 rounded-md border border-border bg-card animate-pulse" />}>
            <QueueClient
                initialEdits={pendingEditItems}
                initialPhotos={communityPhotos}
                initialReviews={pendingReviewItems}
            />
        </Suspense>
    );
}
