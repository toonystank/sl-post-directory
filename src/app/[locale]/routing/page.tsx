import { Suspense } from "react";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, ArrowRight, Lock, Route, ShieldAlert } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { computeMailRoutingAccess } from "@/lib/beta-features";
import RoutingHubClient from "@/components/routing/RoutingHubClient";
import { Link } from "@/navigation";
import { Button } from "@/components/ui/button";
import {
    buildLocalizedAlternates,
    buildLocalizedUrl,
    getDefaultOpenGraphImages,
    getOgLocale,
} from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const title = "Mail Routing Hub (Beta)";
    const description =
        "Opt-in Beta Mail Routing & Forwarding Hub for signed-in Sri Lanka Post staff and testers.";
    return {
        title,
        description,
        robots: { index: false, follow: false },
        alternates: buildLocalizedAlternates("/routing", locale),
        openGraph: {
            title: `${title} | Lanka Post Directory`,
            description,
            url: buildLocalizedUrl("/routing", locale),
            locale: getOgLocale(locale),
            images: getDefaultOpenGraphImages(`${title} | Lanka Post Directory`),
        },
    };
}

export default async function RoutingPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const [session, t] = await Promise.all([
        getServerSession(authOptions),
        getTranslations("Routing"),
    ]);

    const sessionUser = session?.user as
        | {
              id?: string;
              role?: string;
          }
        | undefined;

    const isAuthenticated = Boolean(session && sessionUser?.id);
    let betaAvailable = true;
    let selfOptInAllowed = true;
    let userEnabled = false;

    if (isAuthenticated && hasDatabaseUrl && sessionUser?.id) {
        try {
            const [dbUser, settings] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: sessionUser.id },
                    select: { mailRoutingBetaEnabled: true },
                }),
                prisma.siteSettings.findUnique({
                    where: { id: "default" },
                    select: {
                        mailRoutingBetaAvailable: true,
                        mailRoutingSelfOptIn: true,
                    },
                }),
            ]);
            userEnabled = Boolean(dbUser?.mailRoutingBetaEnabled);
            betaAvailable = settings?.mailRoutingBetaAvailable ?? true;
            selfOptInAllowed = settings?.mailRoutingSelfOptIn ?? true;
        } catch {
            userEnabled = false;
        }
    }

    const canUseMailRouting = computeMailRoutingAccess({
        isAuthenticated,
        betaAvailable,
        userEnabled,
    });

    if (!canUseMailRouting) {
        const isAdminPlus =
            sessionUser?.role === "ADMIN" || sessionUser?.role === "SUPER_ADMIN";

        return (
            <div className="container mx-auto max-w-xl px-4 py-10 md:py-16">
                <div className="rounded-xl border-2 border-foreground bg-card overflow-hidden shadow-[0_3px_0_0_hsl(var(--foreground))]">
                    <div className="airmail-stripe h-1.5" aria-hidden="true" />
                    <div className="p-6 sm:p-8 space-y-5 text-center">
                        <div className="flex flex-col items-center gap-2">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-foreground bg-amber-500/15 text-amber-900 dark:text-amber-300">
                                {isAuthenticated && !betaAvailable ? (
                                    <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                                ) : (
                                    <Lock className="h-6 w-6" aria-hidden="true" />
                                )}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded border border-amber-700/50 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                                <Route className="h-3 w-3" aria-hidden="true" />
                                {t("betaBadge")}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <h1 className="display text-2xl sm:text-3xl">
                                {t("betaGateTitle")}
                            </h1>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {!isAuthenticated
                                    ? t("betaGateSignInBody")
                                    : !betaAvailable
                                      ? t("betaGatePausedBody")
                                      : selfOptInAllowed || isAdminPlus
                                        ? t("betaGateEnableBody")
                                        : t("betaGateInviteOnlyBody")}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                            {!isAuthenticated ? (
                                <Button asChild size="lg" className="w-full sm:w-auto font-bold">
                                    <Link href="/login">
                                        <span>{t("betaGateSignInCta")}</span>
                                        <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden="true" />
                                    </Link>
                                </Button>
                            ) : betaAvailable && (selfOptInAllowed || isAdminPlus) ? (
                                <Button asChild size="lg" className="w-full sm:w-auto font-bold">
                                    <Link href="/dashboard/profile?tab=beta">
                                        <ShieldAlert className="h-4 w-4 mr-1.5" aria-hidden="true" />
                                        <span>{t("betaGateEnableCta")}</span>
                                        <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden="true" />
                                    </Link>
                                </Button>
                            ) : null}

                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="w-full sm:w-auto border-2 border-foreground font-bold"
                            >
                                <Link href="/browse">{t("betaGateBackCta")}</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Suspense
            fallback={
                <div className="container mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
                    Loading Mail Routing &amp; Forwarding Hub...
                </div>
            }
        >
            <RoutingHubClient />
        </Suspense>
    );
}
