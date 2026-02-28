import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { ShieldAlert, Users, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import UserManagementTable from "./UserManagementTable";

export default async function UserManagementPage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string } | undefined;

    // ONLY Super Admins can access this page
    if (!session || user?.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const users = await prisma.user.findMany({
        orderBy: { role: 'asc' },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        }
    });

    return (
        <div className="container mx-auto px-4 py-12 max-w-5xl min-h-[calc(100vh-4rem)]">
            <Button variant="ghost" asChild className="mb-8 hover:bg-primary/10 hover:text-primary transition-colors -ml-4">
                <Link href="/dashboard">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </Link>
            </Button>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-destructive/10 text-destructive rounded-xl">
                            <ShieldAlert className="w-7 h-7" />
                        </div>
                        Super Admin Access
                    </h1>
                    <p className="text-muted-foreground mt-2 ml-[52px]">Manage platform users and their roles.</p>
                </div>
            </div>

            <Card className="border-border/50 overflow-hidden shadow-2xl bg-card/50 backdrop-blur-xl">
                <CardHeader className="border-b border-border/40 bg-card/80">
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-primary" />
                        <div>
                            <CardTitle className="text-lg">Registered Users</CardTitle>
                            <CardDescription>View all accounts and quickly upgrade/downgrade privileges.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <UserManagementTable initialUsers={users} />
                </CardContent>
            </Card>
        </div>
    );
}
