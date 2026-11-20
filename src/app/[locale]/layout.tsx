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
import { getMessages, setRequestLocale } from "next-intl/server";
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

const LOCALE_METADATA: Record<
    string,
    {
        defaultTitle: string;
        template: string;
        description: string;
        ogDescription: string;
        ogLocale: string;
    }
> = {
    en: {
        defaultTitle: "Lanka Post Directory | Find Sri Lanka Post Offices & Postal Codes",
        template: "%s | Lanka Post Directory",
        description:
            "Search every post office in Sri Lanka — postal codes, opening hours, phone numbers and locations. Plus a 2026 postage calculator, parcel tracking and guides.",
        ogDescription:
            "Search 4,000+ Sri Lanka post offices — postal codes, opening hours, phone numbers, 2026 postage rates and parcel tracking.",
        ogLocale: "en_US",
    },
    si: {
        defaultTitle: "ලංකා තැපැල් නාමාවලිය | ශ්‍රී ලංකා තැපැල් කාර්යාල, තැපැල් කේත සහ ගාස්තු",
        template: "%s | ලංකා තැපැල් නාමාවලිය",
        description:
            "ශ්‍රී ලංකාවේ සියලුම තැපැල් කාර්යාල, තැපැල් කේත, දුරකථන අංක, විවෘත වේලාවන්, 2026 තැපැල් ගාස්තු සහ පාර්සල් ලුහුබැඳීම එකම තැනකින් සොයන්න.",
        ogDescription:
            "ශ්‍රී ලංකාවේ තැපැල් කාර්යාල 4,000+ ක තැපැල් කේත, දුරකථන අංක, 2026 තැපැල් ගාස්තු සහ පාර්සල් ලුහුබැඳීම.",
        ogLocale: "si_LK",
    },
    ta: {
        defaultTitle: "இலங்கை அஞ்சல் அடைவு | இலங்கை அஞ்சல் நிலையங்கள், அஞ்சல் குறியீடுகள் & கட்டணங்கள்",
        template: "%s | இலங்கை அஞ்சல் அடைவு",
        description:
            "இலங்கையின் அனைத்து அஞ்சல் நிலையங்கள், அஞ்சல் குறியீடுகள், தொலைபேசி எண்கள், திறக்கும் நேரங்கள், 2026 தபால் கட்டணங்கள் மற்றும் பொதி கண்காணிப்பு.",
        ogDescription:
            "இலங்கையின் 4,000+ அஞ்சல் நிலையங்கள், அஞ்சல் குறியீடுகள், 2026 தபால் கட்டணங்கள் மற்றும் பொதி கண்காணிப்பு.",
        ogLocale: "ta_LK",
    },
};

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const meta = LOCALE_METADATA[locale] ?? LOCALE_METADATA.en;

    return {
        metadataBase: new URL(siteUrl),
        title: {
            default: meta.defaultTitle,
            template: meta.template,
        },
        description: meta.description,
        keywords: [
            "Sri Lanka Post Office",
            "Postal Codes Sri Lanka",
            "Zip Codes Sri Lanka",
            "Sri Lanka Post Postage Rates",
            "EMS Sri Lanka Rates",
            "Sri Lanka Post Tracking",
            "Lanka Post Directory",
            "Post Office Opening Hours",
        ],
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
            title: meta.defaultTitle,
            description: meta.ogDescription,
            url: siteUrl,
            siteName: "Lanka Post Directory",
            locale: meta.ogLocale,
            type: "website",
            images: [
                {
                    url: `${siteUrl}/opengraph-image`,
                    width: 1200,
                    height: 630,
                    alt: meta.defaultTitle,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: meta.defaultTitle,
            description: meta.ogDescription,
            images: [`${siteUrl}/twitter-image`],
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
}

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

    // Enable static rendering & ISR caching across all [locale] routes
    setRequestLocale(locale);

    const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
    const initialMessages = locale === "en" ? undefined : await getMessages({ locale });

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
