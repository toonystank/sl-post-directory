import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import NewsStudioEditor from "@/components/admin/NewsStudioEditor";

interface SessionUser {
    name?: string | null;
    role?: string;
}

export default async function NewNewsDispatchPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(user?.role || "")) {
        redirect("/dashboard");
    }

    return (
        <NewsStudioEditor
            initialPost={null}
            defaultAuthor={user?.name || "Lanka Post Editorial"}
        />
    );
}
