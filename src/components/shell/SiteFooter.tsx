import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import StampLogo from "@/components/brand/StampLogo";

/** Desktop footer (hidden on mobile — the More sheet carries this info there). */
export default async function SiteFooter() {
    const t = await getTranslations("Footer");
    const tNav = await getTranslations("Nav");
    return (
        <footer className="hidden md:block mt-auto border-t-2 border-foreground bg-card">
            <div className="airmail-stripe h-1.5" aria-hidden="true" />
            <div className="container mx-auto grid grid-cols-[1.4fr_1fr_1fr] gap-10 px-4 py-10 text-sm">
                <div>
                    <StampLogo size={40} />
                    <p className="mt-4 max-w-sm text-muted-foreground leading-relaxed">{t("disclaimer")}</p>
                </div>
                <div>
                    <h2 className="label-mono mb-3">{t("explore")}</h2>
                    <ul className="space-y-2 font-medium">
                        <li><Link href="/" className="hover:text-primary">{tNav("directory")}</Link></li>
                        <li><Link href="/browse" className="hover:text-primary">{t("browse")}</Link></li>
                        <li><Link href="/calculator" className="hover:text-primary">{tNav("calculator")}</Link></li>
                        <li><Link href="/blog" className="hover:text-primary">{tNav("blog")}</Link></li>
                    </ul>
                </div>
                <div>
                    <h2 className="label-mono mb-3">{t("project")}</h2>
                    <ul className="space-y-2 font-medium">
                        <li>
                            <a href="https://github.com/toonystank/sl-post-directory" target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                                {t("source")}
                            </a>
                        </li>
                        <li><Link href="/login" className="hover:text-primary">{t("contribute")}</Link></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-border">
                <p className="container mx-auto px-4 py-4 font-mono text-xs text-muted-foreground">
                    © {new Date().getFullYear()}{" "}
                    <a href="https://github.com/toonystank/sl-post-directory" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-primary">
                        ToonyStank
                    </a>
                    . {t("rights")}
                </p>
            </div>
        </footer>
    );
}
