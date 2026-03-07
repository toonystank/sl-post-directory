import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { User as UserIcon, ShieldAlert, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChangePasswordForm from "./ChangePasswordForm";
import TwoFactorAuthManager from "./TwoFactorAuthManager";

export default async function ProfileSettingsPage() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            twoFactorEnabled: true,
            backupCodes: true
        }
    });

    if (!user) {
        redirect("/login");
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-5xl min-h-[calc(100vh-4rem)]">
            <Button variant="ghost" asChild className="mb-8 hover:bg-primary/10 hover:text-primary transition-colors -ml-4">
                <Link href="/dashboard">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </Link>
            </Button>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                            <UserIcon className="w-7 h-7" />
                        </div>
                        Profile Settings
                    </h1>
                    <p className="text-muted-foreground mt-2 ml-[52px]">Manage your account security and authentication methods.</p>
                </div>
            </div>

            <Tabs defaultValue="security" className="w-full">
                <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="security">Password & Security</TabsTrigger>
                    <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
                </TabsList>

                <TabsContent value="security" className="space-y-6 max-w-2xl">
                    <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-xl">
                        <CardHeader className="border-b border-border/40 bg-card/80 p-6">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-primary" /> Security Basics
                            </CardTitle>
                            <CardDescription>Update your account password.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <ChangePasswordForm />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="2fa" className="space-y-6 max-w-3xl">
                    <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-xl">
                        <CardHeader className="border-b border-border/40 bg-card/80 p-6">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-primary" /> Two-Factor Authentication (2FA)
                            </CardTitle>
                            <CardDescription>
                                Add an extra layer of security to your account by configuring a device-based authenticator.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <TwoFactorAuthManager enabled={user.twoFactorEnabled} backupCodes={user.backupCodes} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
