import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChangePasswordForm from "./ChangePasswordForm";
import TwoFactorAuthManager from "./TwoFactorAuthManager";
import BetaFeaturesManager from "./BetaFeaturesManager";

export default async function ProfileSettingsPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const [session, sp] = await Promise.all([
        getServerSession(authOptions),
        searchParams,
    ]);

    if (!session || !session.user?.email) {
        redirect("/login");
    }

    const [user, settings] = hasDatabaseUrl
        ? await Promise.all([
              prisma.user.findUnique({
                  where: { email: session.user.email },
                  select: {
                      id: true,
                      email: true,
                      name: true,
                      role: true,
                      twoFactorEnabled: true,
                      backupCodes: true,
                      mailRoutingBetaEnabled: true,
                  },
              }),
              prisma.siteSettings.findUnique({
                  where: { id: "default" },
                  select: {
                      mailRoutingBetaAvailable: true,
                      mailRoutingSelfOptIn: true,
                  },
              }),
          ])
        : [null, null];

    if (!user) {
        redirect("/login");
    }

    const defaultTab = sp.tab === "beta" ? "beta" : sp.tab === "2fa" ? "2fa" : "security";
    const betaAvailable = settings?.mailRoutingBetaAvailable ?? true;
    const selfOptInAllowed = settings?.mailRoutingSelfOptIn ?? true;

    return (
        <div className="max-w-3xl space-y-5">
            <header>
                <p className="label-mono">Account Security &amp; Preferences</p>
                <h1 className="display text-3xl sm:text-4xl mt-1">Profile, 2FA &amp; Beta</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage your password, authenticator app, recovery backup codes, and opt-in Beta features.
                </p>
            </header>

            <Tabs defaultValue={defaultTab} className="w-full space-y-4">
                <TabsList className="grid w-full max-w-lg grid-cols-3 h-12 border-2 border-foreground bg-muted p-1">
                    <TabsTrigger value="security" className="font-bold text-xs sm:text-sm">
                        Password
                    </TabsTrigger>
                    <TabsTrigger value="2fa" className="font-bold text-xs sm:text-sm">
                        Two-Factor
                    </TabsTrigger>
                    <TabsTrigger value="beta" className="font-bold text-xs sm:text-sm gap-1.5">
                        <span>Beta Features</span>
                        <span className="hidden sm:inline rounded bg-amber-500/20 px-1 py-px font-mono text-[9px] font-extrabold text-amber-900 dark:text-amber-300">
                            BETA
                        </span>
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
                                backupCodeCount={user.backupCodes.length}
                            />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="beta">
                    <div className="rounded-md border-2 border-foreground bg-card overflow-hidden shadow-[3px_3px_0_0_hsl(var(--foreground))]">
                        <div className="border-b border-border bg-muted/40 px-5 py-4 flex items-center gap-2.5">
                            <ShieldAlert className="w-5 h-5 text-primary" aria-hidden="true" />
                            <div>
                                <h2 className="font-heading text-lg font-extrabold">
                                    Opt-In Beta Features
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Disabled by default. Enable experimental tools on your account for testing.
                                </p>
                            </div>
                        </div>
                        <div className="p-5 sm:p-6">
                            <BetaFeaturesManager
                                initialEnabled={Boolean(user.mailRoutingBetaEnabled)}
                                betaAvailable={betaAvailable}
                                selfOptInAllowed={selfOptInAllowed}
                                role={user.role}
                            />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
