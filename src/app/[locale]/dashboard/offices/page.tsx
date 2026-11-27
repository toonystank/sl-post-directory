import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import AdminOfficeManager from "../AdminOfficeManager";

interface SessionUser {
    id?: string;
    email?: string | null;
    role?: string;
}

export default async function DashboardOfficesPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !user?.id || !user?.email || !user?.role) {
        redirect("/login");
    }

    const userRole = user.role;

    return (
        <Suspense fallback={<div className="h-48 rounded-md border border-border bg-card animate-pulse" />}>
            <AdminOfficeManager
                isContributor={userRole === "CONTRIBUTOR"}
                userRole={userRole}
            />
        </Suspense>
    );
}
