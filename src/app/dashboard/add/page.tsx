import { Building } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import AddOfficeForm from "./AddOfficeForm";

export default async function AdminAddOfficePage() {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string } | undefined;

    if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN")) {
        redirect("/login");
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl min-h-[calc(100vh-4rem)]">
            <Button variant="ghost" asChild className="mb-8 hover:bg-primary/10 hover:text-primary transition-colors -ml-4">
                <Link href="/dashboard">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </Link>
            </Button>

            <Card className="shadow-2xl border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden">
                <CardHeader className="border-b border-border/40 bg-card/80 px-8 pt-8 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20">
                            <Building className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl md:text-3xl font-extrabold tracking-tight">Add Post Office</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Create a new directory listing.</p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-2 md:p-8">
                    <AddOfficeForm />
                </CardContent>
            </Card>
        </div>
    );
}
