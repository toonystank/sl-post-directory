import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import VariableManager from "../VariableManager";

interface SessionUser {
    role?: string;
}

export default async function DashboardVariablesPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(user?.role || "")) {
        redirect("/dashboard");
    }

    return <VariableManager />;
}
