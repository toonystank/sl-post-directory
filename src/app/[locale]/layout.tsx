import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Archivo, Public_Sans, IBM_Plex_Mono, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import "../globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/shell/BottomTabBar";
import SiteFooter from "@/components/shell/SiteFooter";
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

// Display: Archivo with the width axis so headlines can be condensed (signage feel)
const archivo = Archivo({
    subsets: ["latin"],
    axes: ["wdth"],
    variable: "--font-archivo",
    display: "swap",
});

// UI / body text
const publicSans = Public_Sans({
    subsets: ["latin"],
    variable: "--font-body",
    display: "swap",
});

// Postcodes, phone numbers, data labels
const plexMono = IBM_Plex_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    variable: "--font-plex",
    display: "swap",
});

// Sinhala / Tamil — not preloaded; unicode-range means they only download when needed
const notoSinhala = Noto_Sans_Sinhala({
    subsets: ["sinhala"],
    variable: "--font-sinhala",
    display: "swap",
    preload: false,
});

const notoTamil = Noto_Sans_Tamil({
    subsets: ["tamil"],
    variable: "--font-tamil",
    display: "swap",
    preload: false,
});

export const metadata: Metadata = {
    metadataBase: new URL("https://lankapost.vercel.app"),
    alternates: {
        canonical: "/",
    },
    title: {
        default: "Lanka Post Directory | Find Sri Lanka Post Offices & Postal Codes",
        template: "%s | Lanka Post Directory",
    },
    description: "Search every post office in Sri Lanka — postal codes, opening hours, phone numbers and locations. Plus a postage calculator and guides.",
    keywords: ["Sri Lanka Post Office", "Postal Codes Sri Lanka", "Zip Codes Sri Lanka", "Lanka Post Directory", "Post Office Opening Hours"],
    applicationName: "Lanka Post Directory",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Lanka Post",
    },
    formatDetection: {
        telephone: false,
    },
    openGraph: {
        title: "Lanka Post Directory | Find Sri Lanka Post Offices & Postal Codes",
        description: "Search every post office in Sri Lanka — postal codes, opening hours, phone numbers and locations.",
        url: "https://lankapost.vercel.app",
        siteName: "Lanka Post Directory",
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Lanka Post Directory",
        description: "Search every post office in Sri Lanka — postal codes, opening hours, phone numbers and locations.",
    },
    other: {
        "google-adsense-account": "ca-pub-2503310431210239",
    },
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#FBF7EF" },
        { media: "(prefers-color-scheme: dark)", color: "#15120F" },
    ],
    viewportFit: "cover",
    width: "device-width",
    initialScale: 1,
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
            <head>
                <script
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var a=['bis_skin_checked','bis_register','bis_id','bis_size'];function c(r){for(var i=0;i<a.length;i++){var s='['+a[i]+']';var n=r.querySelectorAll?r.querySelectorAll(s):[];for(var j=0;j<n.length;j++)n[j].removeAttribute(a[i]);if(r.removeAttribute)r.removeAttribute(a[i]);}}c(document.documentElement);if(document.addEventListener)document.addEventListener('DOMContentLoaded',function(){c(document.documentElement);},true);var o=Element.prototype.setAttribute;Element.prototype.setAttribute=function(k,v){if(a.indexOf(k)!==-1)return;return o.call(this,k,v);};new MutationObserver(function(m){for(var i=0;i<m.length;i++){var t=m[i].target;if(t&&t.removeAttribute&&m[i].attributeName&&a.indexOf(m[i].attributeName)!==-1){t.removeAttribute(m[i].attributeName);}}}).observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:a});}catch(e){}})();`,
                    }}
                />
            </head>

            <body className={`${archivo.variable} ${publicSans.variable} ${plexMono.variable} ${notoSinhala.variable} ${notoTamil.variable} font-sans min-h-dvh flex flex-col antialiased bg-background`} suppressHydrationWarning>
                <Script
                    src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
                    strategy="lazyOnload"
                />
                <Script id="google-analytics" strategy="lazyOnload">
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
                                defaultTheme="system"
                                enableSystem
                                disableTransitionOnChange
                            >
                                <ServiceWorkerRegister />
                                <Navbar />
                                <main className="flex-1 pb-tabbar">
                                    {children}
                                </main>
                                <InstallPrompt />
                                <SiteFooter />
                                <AdBanner position="sticky-bottom" />
                                <BottomTabBar />
                            </ThemeProvider>
                        </AdManager>
                    </AuthProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
