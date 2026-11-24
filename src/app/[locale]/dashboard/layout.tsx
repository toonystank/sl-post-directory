import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import AdminShell from "@/components/admin/AdminShell";

interface SessionUser {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string;
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !user?.email) {
        redirect("/login");
    }

    const role = user.role || "CONTRIBUTOR";
    let queueBadge = 0;

    if (hasDatabaseUrl && ["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(role)) {
        try {
            const [pendingEdits, pendingPhotos, pendingReviews] = await Promise.all([
                prisma.editRequest.count({ where: { status: { in: ["PENDING", "MORE_INFO"] } } }),
                prisma.communityPhoto.count({ where: { status: "PENDING" } }),
                prisma.review.count({ where: { status: "PENDING" } }),
            ]);
            queueBadge = pendingEdits + pendingPhotos + pendingReviews;
        } catch {
            queueBadge = 0;
        }
    }

    return (
        <AdminShell
            user={{
                name: user.name || "User",
                email: user.email,
                role,
            }}
            queueBadge={queueBadge}
        >
            {children}
        </AdminShell>
    );
}
