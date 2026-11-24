import { Building, ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { Link } from "@/navigation";
import AddOfficeForm from "./AddOfficeForm";

export default async function AdminAddOfficePage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string } | undefined;

    if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN")) {
        redirect("/dashboard");
    }

    return (
        <div className="max-w-3xl mx-auto space-y-5">
            <Link
                href="/dashboard/offices"
                className="tap inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back to Offices</span>
            </Link>

            <div className="rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <div className="airmail-stripe h-1.5" aria-hidden="true" />
                <div className="border-b border-border p-5 sm:p-6 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-foreground bg-secondary text-secondary-foreground">
                        <Building className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                        <h1 className="display text-2xl sm:text-3xl">Add Post Office</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Create a new public directory listing.
                        </p>
                    </div>
                </div>

                <div className="p-5 sm:p-6">
                    <AddOfficeForm />
                </div>
            </div>
        </div>
    );
}
