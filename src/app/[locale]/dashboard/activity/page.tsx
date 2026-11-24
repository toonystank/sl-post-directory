import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import ActivityLogClient from "@/components/admin/ActivityLogClient";

interface SessionUser {
    role?: string;
}

const INITIAL_LIMIT = 30;

export default async function ActivityLogPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(user?.role || "")) {
        redirect("/dashboard");
    }

    const rawLogs = hasDatabaseUrl
        ? await prisma.actionLog.findMany({
              orderBy: { createdAt: "desc" },
              include: {
                  user: {
                      select: { name: true, email: true },
                  },
              },
              take: INITIAL_LIMIT + 1,
          })
        : [];

    const hasMore = rawLogs.length > INITIAL_LIMIT;
    const logs = hasMore ? rawLogs.slice(0, INITIAL_LIMIT) : rawLogs;
    const initialCursor = hasMore ? logs[logs.length - 1]?.id : undefined;

    return (
        <div className="space-y-5">
            <header>
                <p className="label-mono">Audit Trail</p>
                <h1 className="display text-3xl sm:text-4xl mt-1">Activity Log</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Track recent moderation approvals, rejections, photo actions &amp; system changes.
                </p>
            </header>

            <ActivityLogClient initialLogs={logs} initialCursor={initialCursor} />
        </div>
    );
}
