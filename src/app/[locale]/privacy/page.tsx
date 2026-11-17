import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "Privacy Policy for Lanka Post Directory, including information about contributor submissions, analytics, cookies, and Google AdSense.",
    alternates: {
        canonical: "https://lankapost.vercel.app/privacy",
    },
};

export default async function PrivacyPolicyPage() {
    const t = await getTranslations("Privacy");

    return (
        <div className="container mx-auto max-w-3xl px-4 py-6 md:py-12 min-h-[calc(100vh-4rem)]">
            <header className="mb-8 border-b-2 border-foreground pb-6">
                <p className="label-mono mb-2">{t("kicker")}</p>
                <h1 className="display text-3xl md:text-5xl">{t("title")}</h1>
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                    {t("lastUpdated")}
                </p>
            </header>

            <div className="space-y-8 text-base leading-relaxed text-foreground/90">
                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        {t("s1Title")}
                    </h2>
                    <p className="text-muted-foreground">{t("s1P1")}</p>
                    <p className="text-muted-foreground">{t("s1P2")}</p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        {t("s2Title")}
                    </h2>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        <li>
                            <strong className="text-foreground">{t("s2Item1Label")}</strong> {t("s2Item1Body")}
                        </li>
                        <li>
                            <strong className="text-foreground">{t("s2Item2Label")}</strong> {t("s2Item2Body")}
                        </li>
                        <li>
                            <strong className="text-foreground">{t("s2Item3Label")}</strong> {t("s2Item3Body")}
                        </li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        {t("s3Title")}
                    </h2>
                    <p className="text-muted-foreground">{t("s3P1")}</p>
                    <p className="text-muted-foreground">{t("s3P2")}</p>
                    <p className="text-muted-foreground">
                        {t("s3OptOutPrefix")}{" "}
                        <a
                            href="https://www.google.com/settings/ads"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                        >
                            Google Ads Settings
                        </a>
                        {t("s3OptOutMid")}{" "}
                        <a
                            href="https://www.aboutads.info"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                        >
                            www.aboutads.info
                        </a>
                        .
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        {t("s4Title")}
                    </h2>
                    <p className="text-muted-foreground">{t("s4P1")}</p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        {t("s5Title")}
                    </h2>
                    <p className="text-muted-foreground">
                        {t("s5Prefix")}{" "}
                        <a
                            href="https://github.com/toonystank/sl-post-directory/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                        >
                            {t("s5Link")}
                        </a>
                        .
                    </p>
                </section>

                <div className="pt-4 border-t border-border">
                    <Link
                        href="/"
                        className="text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                        &larr; {t("backToDirectory")}
                    </Link>
                </div>
            </div>
        </div>
    );
}
