import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import NewsManager from "@/components/admin/NewsManager";

interface SessionUser {
    role?: string;
}

export default async function DashboardNewsPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(user?.role || "")) {
        redirect("/dashboard");
    }

    return <NewsManager userRole={user?.role || "MODERATOR"} />;
}
