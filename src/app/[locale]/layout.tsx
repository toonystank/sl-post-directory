import type { Metadata, Viewport } from "next";
import { Archivo, Public_Sans, IBM_Plex_Mono, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import "../globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import AuthProvider from "@/context/AuthContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import Navbar from "@/components/Navbar";
import BottomTabBar from "@/components/shell/BottomTabBar";
import SiteFooter from "@/components/shell/SiteFooter";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/InstallPrompt";
import NextTopLoader from "nextjs-toploader";
import AdManager from "@/components/ads/AdManager";
import AdBanner from "@/components/ads/AdBanner";
import DeferredAnalytics from "@/components/analytics/DeferredAnalytics";
import MotionProvider from "@/components/motion/MotionProvider";
import { InstantLocaleProvider } from "@/context/InstantLocaleContext";
import { PWAProvider } from "@/context/PWAContext";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { getSiteUrl } from "@/lib/site";

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

// Sinhala / Tamil — preloaded with explicit weights so switching languages is instant
const notoSinhala = Noto_Sans_Sinhala({
    subsets: ["sinhala"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-sinhala",
    display: "swap",
    preload: false,
});

const notoTamil = Noto_Sans_Tamil({
    subsets: ["tamil"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-tamil",
    display: "swap",
    preload: false,
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
        default: "Lanka Post Directory | Find Sri Lanka Post Offices & Postal Codes",
        template: "%s | Lanka Post Directory",
    },
    description: "Search every post office in Sri Lanka — postal codes, opening hours, phone numbers and locations. Plus a postage calculator and guides.",
    keywords: ["Sri Lanka Post Office", "Postal Codes Sri Lanka", "Zip Codes Sri Lanka", "Sri Lanka Post Postage Rates", "EMS Sri Lanka Rates", "Lanka Post Directory", "Post Office Opening Hours"],
    applicationName: "Lanka Post Directory",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Lanka Post",
    },
    icons: {
        icon: "/icon-192x192.png",
        apple: "/apple-touch-icon.png",
    },
    formatDetection: {
        telephone: false,
    },
    openGraph: {
        title: "Lanka Post Directory | Find Sri Lanka Post Offices & Postal Codes",
        description: "Search every post office in Sri Lanka — postal codes, opening hours, phone numbers and locations.",
        url: siteUrl,
        siteName: "Lanka Post Directory",
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Lanka Post Directory",
        description: "Search every post office in Sri Lanka — postal codes, opening hours, phone numbers and locations.",
    },
    verification: {
        google:
            process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
            "NRSZmmfWoQ_951WXlbBILyHQXkVHfjr5jFeMXSWW2vA",
    },
    other: {
        "google-adsense-account": "ca-pub-2503310431210239",
    },
};

export const viewport: Viewport = {
    colorScheme: "light dark",
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#FBF7EF" },
        { media: "(prefers-color-scheme: dark)", color: "#14110E" },
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

    const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
    const initialMessages = locale === "en" ? undefined : await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <script
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var a=['bis_skin_checked','bis_register','bis_id','bis_size'];function c(r){for(var i=0;i<a.length;i++){var s='['+a[i]+']';var n=r.querySelectorAll?r.querySelectorAll(s):[];for(var j=0;j<n.length;j++)n[j].removeAttribute(a[i]);if(r.removeAttribute)r.removeAttribute(a[i]);}}c(document.documentElement);if(document.addEventListener)document.addEventListener('DOMContentLoaded',function(){c(document.documentElement);},true);var o=Element.prototype.setAttribute;Element.prototype.setAttribute=function(k,v){if(a.indexOf(k)!==-1)return;return o.call(this,k,v);};new MutationObserver(function(m){for(var i=0;i<m.length;i++){var t=m[i].target;if(t&&t.removeAttribute&&m[i].attributeName&&a.indexOf(m[i].attributeName)!==-1){t.removeAttribute(m[i].attributeName);}}}).observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:a});}catch(e){}})();`,
                    }}
                />
                <script
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var K='__slp_chunk_recover_ts';function canReload(){var last=Number(sessionStorage.getItem(K)||'0');if(Date.now()-last<15000)return false;sessionStorage.setItem(K,String(Date.now()));return true;}function purgeAndReload(){if(!canReload())return;var jobs=[];if('caches' in window){jobs.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));}).catch(function(){}));}if('serviceWorker' in navigator){jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.update().catch(function(){});}));}).catch(function(){}));}Promise.all(jobs).finally(function(){window.location.reload();});}function isStaleChunkErr(msg){return typeof msg==='string'&&(msg.indexOf('module factory is not available')!==-1||msg.indexOf('ChunkLoadError')!==-1||msg.indexOf('Loading chunk')!==-1);}window.addEventListener('error',function(ev){var m=(ev&&ev.message)||(ev&&ev.error&&ev.error.message)||'';if(isStaleChunkErr(m))purgeAndReload();});window.addEventListener('unhandledrejection',function(ev){var r=ev&&ev.reason;var m=(typeof r==='string'?r:(r&&r.message))||'';if(isStaleChunkErr(m))purgeAndReload();});if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('message',function(ev){if(ev&&ev.data&&ev.data.type==='SW_FORCE_RELOAD_AFTER_PURGE'&&canReload()){window.location.reload();}});}}catch(e){}})();`,
                    }}
                />
            </head>

            <body className={`${archivo.variable} ${publicSans.variable} ${plexMono.variable} ${notoSinhala.variable} ${notoTamil.variable} font-sans min-h-dvh flex flex-col antialiased bg-background`} suppressHydrationWarning>
                {gaId && <DeferredAnalytics gaId={gaId} />}
                <NextTopLoader color="hsl(var(--primary))" showSpinner={false} height={3} />
                <InstantLocaleProvider initialLocale={locale} initialMessages={initialMessages}>
                    <AuthProvider>
                        <CurrencyProvider>
                            <AdManager>
                                <ThemeProvider
                                    attribute="class"
                                    defaultTheme="system"
                                    enableSystem
                                    disableTransitionOnChange
                                >
                                    <MotionProvider>
                                        <PWAProvider>
                                            <ServiceWorkerRegister />
                                            <Navbar />
                                            <main className="flex-1 pb-tabbar">
                                                {children}
                                            </main>
                                            <InstallPrompt />
                                            <SiteFooter />
                                            <AdBanner position="sticky-bottom" />
                                            <BottomTabBar />
                                        </PWAProvider>
                                    </MotionProvider>
                                </ThemeProvider>
                            </AdManager>
                        </CurrencyProvider>
                    </AuthProvider>
                </InstantLocaleProvider>
            </body>
        </html>
    );
}
