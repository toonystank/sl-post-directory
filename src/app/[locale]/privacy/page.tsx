import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { getLocalizedPageMetadata } from "@/lib/seo-office";
import { buildLocalizedAlternates, getContactEmail } from "@/lib/site";

export const revalidate = 86400;

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const { title, description } = getLocalizedPageMetadata("privacy", locale);
    return {
        title,
        description,
        alternates: buildLocalizedAlternates("/privacy", locale),
    };
}

export default async function PrivacyPolicyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("Privacy");
    const contactEmail = getContactEmail();

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
                        Mobile App &amp; Offline Storage (Google Play / PWA)
                    </h2>
                    <p className="text-muted-foreground">
                        When installed on Android via Google Play (Trusted Web Activity) or as a Progressive Web App, Lanka Post Directory stores a compact copy of the public Sri Lanka Post office directory and postage tariff tables locally on your device (IndexedDB and Cache Storage) so search and rate calculations work offline. We do not collect background location data, contacts, or device identifiers.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        Camera, Barcode Scanner &amp; Optional AI OCR
                    </h2>
                    <p className="text-muted-foreground">
                        Camera access is requested only when you explicitly open the barcode or parcel label scanner. Standard barcode detection and Tesseract text recognition run locally inside your browser on your device. When optional AI-assisted scanning is triggered for handwritten addresses or receipts, only the cropped image is transmitted transiently to our <code className="font-mono text-xs">/api/ocr/extract</code> endpoint powered by Google Gemini (<code className="font-mono text-xs">store: false</code>) to extract the tracking number or destination town and is never stored in our database.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        Account &amp; Data Deletion (Google Play Requirement)
                    </h2>
                    <p className="text-muted-foreground">
                        You can request permanent deletion of your contributor account, edit history, submitted reviews, or uploaded post office photos at any time{" "}
                        {contactEmail ? (
                            <>
                                by emailing{" "}
                                <a
                                    href={`mailto:${contactEmail}?subject=${encodeURIComponent("Lanka Post Directory — Data Deletion Request")}`}
                                    className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                                >
                                    {contactEmail}
                                </a>{" "}
                                or opening a request on our{" "}
                            </>
                        ) : (
                            <>via our </>
                        )}
                        <a
                            href="https://github.com/toonystank/sl-post-directory/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                        >
                            GitHub support tracker
                        </a>
                        . Verified deletion requests are processed within 7 days.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        {t("s5Title")}
                    </h2>
                    <p className="text-muted-foreground">
                        {contactEmail && (
                            <>
                                You can contact us directly at{" "}
                                <a
                                    href={`mailto:${contactEmail}`}
                                    className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                                >
                                    {contactEmail}
                                </a>
                                .{" "}
                            </>
                        )}
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

                <div className="pt-4 border-t border-border flex flex-wrap gap-6">
                    <Link
                        href="/"
                        className="text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                        &larr; {t("backToDirectory")}
                    </Link>
                    <Link
                        href="/about"
                        className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        About &amp; Contact
                    </Link>
                    <Link
                        href="/terms"
                        className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        Terms of Use
                    </Link>
                </div>
            </div>
        </div>
    );
}
