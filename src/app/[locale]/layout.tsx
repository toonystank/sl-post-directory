import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Outfit } from "next/font/google";
import "../globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/InstallPrompt";
import NextTopLoader from "nextjs-toploader";
import AdManager from "@/components/ads/AdManager";
import AdBanner from "@/components/ads/AdBanner";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";

const outfit = Outfit({
    subsets: ["latin"],
    variable: "--font-outfit",
});

export const metadata: Metadata = {
    metadataBase: new URL("https://postagedirectory.vercel.app"),
    title: {
        default: "SL Post Directory",
        template: "%s | SL Post Directory",
    },
    description: "A comprehensive, modern directory for Sri Lanka Post Offices.",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "SL Post Directory",
    },
    formatDetection: {
        telephone: false,
    },
    openGraph: {
        title: "SL Post Directory",
        description: "A comprehensive, modern directory for Sri Lanka Post Offices.",
        url: "https://postagedirectory.vercel.app",
        siteName: "SL Post Directory",
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "SL Post Directory",
        description: "A comprehensive, modern directory for Sri Lanka Post Offices.",
    },
    other: {
        "google-adsense-account": "ca-pub-2503310431210239",
    },
};

export const viewport: Viewport = {
    themeColor: "#0f172a",
};

export default async function RootLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}>) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }

    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>

            <body className={`${outfit.variable} font-sans min-h-screen flex flex-col antialiased bg-background`} suppressHydrationWarning>
                <Script
                    src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
                    strategy="afterInteractive"
                />
                <Script id="google-analytics" strategy="afterInteractive">
                    {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
                    `}
                </Script>
                <NextTopLoader color="hsl(var(--primary))" showSpinner={false} height={3} />
                <NextIntlClientProvider messages={messages}>
                    <AuthProvider>
                        <AdManager>
                            <ThemeProvider
                                attribute="class"
                                defaultTheme="dark"
                                enableSystem
                                disableTransitionOnChange
                            >
                                <ServiceWorkerRegister />
                                <Navbar />
                                <main className="flex-1">
                                    {children}
                                </main>
                                <InstallPrompt />
                                <footer className="border-t border-border/40 bg-card">
                                    <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
                                        <p className="mb-2">
                                            <strong>Disclaimer:</strong> This project is not affiliated with, endorsed by, or a product of the Department of Posts - Sri Lanka. It is an independent open-source initiative.
                                        </p>
                                        <p>
                                            © {new Date().getFullYear()} <a href="https://github.com/toonystank/sl-post-directory" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors underline underline-offset-4">ToonyStank</a>. All rights reserved.
                                        </p>
                                    </div>
                                </footer>
                                <AdBanner position="sticky-bottom" />
                            </ThemeProvider>
                        </AdManager>
                    </AuthProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
