import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChangePasswordForm from "./ChangePasswordForm";
import TwoFactorAuthManager from "./TwoFactorAuthManager";

export default async function ProfileSettingsPage() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        redirect("/login");
    }

    const user = hasDatabaseUrl
        ? await prisma.user.findUnique({
              where: { email: session.user.email },
              select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  twoFactorEnabled: true,
                  backupCodes: true,
              },
          })
        : null;

    if (!user) {
        redirect("/login");
    }

    return (
        <div className="max-w-3xl space-y-5">
            <header>
                <p className="label-mono">Account Security</p>
                <h1 className="display text-3xl sm:text-4xl mt-1">Profile &amp; 2FA</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage your password, authenticator app &amp; recovery backup codes.
                </p>
            </header>

            <Tabs defaultValue="security" className="w-full space-y-4">
                <TabsList className="grid w-full max-w-md grid-cols-2 h-12 border-2 border-foreground bg-muted p-1">
                    <TabsTrigger value="security" className="font-bold">
                        Password
                    </TabsTrigger>
                    <TabsTrigger value="2fa" className="font-bold">
                        Two-Factor Auth
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="security">
                    <div className="rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                        <div className="border-b border-border bg-muted/40 px-5 py-4 flex items-center gap-2.5">
                            <ShieldAlert className="w-5 h-5 text-primary" aria-hidden="true" />
                            <div>
                                <h2 className="font-heading text-lg font-extrabold">Update Password</h2>
                                <p className="text-xs text-muted-foreground">
                                    Signed in as {user.email}
                                </p>
                            </div>
                        </div>
                        <div className="p-5 sm:p-6">
                            <ChangePasswordForm />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="2fa">
                    <div className="rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                        <div className="border-b border-border bg-muted/40 px-5 py-4 flex items-center gap-2.5">
                            <ShieldAlert className="w-5 h-5 text-primary" aria-hidden="true" />
                            <div>
                                <h2 className="font-heading text-lg font-extrabold">
                                    Two-Factor Authentication (2FA)
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Use an authenticator app + backup recovery codes at login.
                                </p>
                            </div>
                        </div>
                        <div className="p-5 sm:p-6">
                            <TwoFactorAuthManager
                                enabled={user.twoFactorEnabled}
                                backupCodes={user.backupCodes}
                            />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
