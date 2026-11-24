import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import SystemToolsClient from "@/components/admin/SystemToolsClient";

interface SessionUser {
    role?: string;
}

export default async function DashboardSystemPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || user?.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    return <SystemToolsClient />;
}
