import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import UserManagementTable from "./UserManagementTable";

export default async function UserManagementPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string } | undefined;

    if (!session || user?.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const users = hasDatabaseUrl
        ? await prisma.user.findMany({
              orderBy: { role: "asc" },
              select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  twoFactorEnabled: true,
                  emailVerified: true,
              },
          })
        : [];

    return (
        <div className="space-y-5">
            <header>
                <p className="label-mono">Super Admin Control</p>
                <h1 className="display text-3xl sm:text-4xl mt-1">Users &amp; Roles</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Issue admin access, update roles, reset temporary passwords, or manage 2FA locks.
                </p>
            </header>

            <UserManagementTable initialUsers={users} />
        </div>
    );
}
