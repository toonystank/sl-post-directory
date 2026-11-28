import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";
import { buildEnglishCanonicalAlternates, getContactEmail } from "@/lib/site";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "Terms of Use",
        description:
            "Terms of Use for Lanka Post Directory web application and Android app, covering data disclaimers, community contributions, acceptable use, and advertising disclosures.",
        alternates: buildEnglishCanonicalAlternates("/terms"),
    };
}

export default async function TermsPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const contactEmail = getContactEmail();

    return (
        <div className="container mx-auto max-w-3xl px-4 py-6 md:py-12 min-h-[calc(100vh-4rem)]">
            <header className="mb-8 border-b-2 border-foreground pb-6">
                <p className="label-mono mb-2">Legal &amp; Disclosures</p>
                <h1 className="display text-3xl md:text-5xl">Terms of Use</h1>
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                    Last updated: November 2026
                </p>
            </header>

            <div className="space-y-8 text-base leading-relaxed text-foreground/90">
                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        1. Acceptance of Terms
                    </h2>
                    <p className="text-muted-foreground">
                        By accessing or using Lanka Post Directory on the web, as a Progressive Web App, or via Google Play (Trusted Web Activity), you agree to comply with these Terms of Use and our{" "}
                        <Link href="/privacy" className="text-primary font-medium underline underline-offset-4 hover:text-primary/80">
                            Privacy Policy
                        </Link>
                        . If you do not agree with these terms, please discontinue use of the service.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        2. Informational Accuracy &amp; No Government Affiliation
                    </h2>
                    <p className="text-muted-foreground">
                        Lanka Post Directory is an independent, community-maintained informational service and is not affiliated with or endorsed by the Department of Posts (Sri Lanka Post). Post office phone numbers, opening hours, holiday schedules, and calculated postage estimates are provided on an &ldquo;as-is&rdquo; informational basis. Always confirm exact fees and counter hours directly with Sri Lanka Post before mailing critical or high-value items.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        3. Community Contributions &amp; Moderation
                    </h2>
                    <p className="text-muted-foreground">
                        When submitting post office edits, reviews, or community photos, you confirm that your submission is accurate to the best of your knowledge, does not infringe third-party rights or privacy, and contains no unlawful, abusive, or misleading material. Moderators reserve the right to review, edit, reject, or permanently remove any submission at their discretion.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        4. Prohibited Use
                    </h2>
                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                        <li>Automated scraping, excessive API polling, or bypassing rate limits and CAPTCHA protections.</li>
                        <li>Submitting spam reviews, malicious links, or unrelated/inappropriate images.</li>
                        <li>Attempting unauthorized access to administrative endpoints, user accounts, or underlying infrastructure.</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        5. Advertising &amp; Third-Party Services
                    </h2>
                    <p className="text-muted-foreground">
                        To keep this directory free without paywalls, Lanka Post Directory may display advertisements served via Google AdSense and relies on third-party infrastructure providers including Cloudflare (bot protection), Uploadcare (image hosting), and official Sri Lanka Post tracking gateways. Third-party sites and services are governed by their own terms and privacy policies.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        6. Limitation of Liability
                    </h2>
                    <p className="text-muted-foreground">
                        To the maximum extent permitted by applicable law, Lanka Post Directory and its contributors are not liable for any direct, indirect, incidental, or consequential damages resulting from postal delays, tariff discrepancies, temporary upstream tracking outages, or reliance on directory listings.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading text-xl font-extrabold [font-stretch:82%] text-foreground">
                        7. Contact
                    </h2>
                    <p className="text-muted-foreground">
                        Questions regarding these Terms of Use may be directed{" "}
                        {contactEmail ? (
                            <>
                                to{" "}
                                <a
                                    href={`mailto:${contactEmail}`}
                                    className="text-primary font-medium underline underline-offset-4 hover:text-primary/80"
                                >
                                    {contactEmail}
                                </a>{" "}
                                or via our{" "}
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
                            GitHub repository
                        </a>
                        .
                    </p>
                </section>

                <div className="pt-4 border-t border-border flex flex-wrap gap-6">
                    <Link
                        href="/"
                        className="text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                        &larr; Back to Directory
                    </Link>
                    <Link
                        href="/about"
                        className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        About &amp; Contact
                    </Link>
                    <Link
                        href="/privacy"
                        className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        Privacy Policy
                    </Link>
                </div>
            </div>
        </div>
    );
}
