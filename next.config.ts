import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const securityHeaders = [
    {
        key: "X-Content-Type-Options",
        value: "nosniff",
    },
    {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
    },
    {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
    },
    {
        key: "X-DNS-Prefetch-Control",
        value: "on",
    },
    {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
    },
    {
        key: "Content-Security-Policy",
        value: "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'self' https://aistudio.google.com https://*.google.com;",
    },
];

const nextConfig: NextConfig = {
    poweredByHeader: false,
    compress: true,
    serverExternalPackages: ["bcrypt"],
    images: {
        formats: ["image/avif", "image/webp"],
        remotePatterns: [
            {
                protocol: "https",
                hostname: "ucarecdn.com",
            },
            {
                protocol: "https",
                hostname: "3q5fhu0dw8.ucarecd.net",
            },
        ],
    },
    experimental: {
        optimizePackageImports: ["lucide-react", "radix-ui"],
        turbopackFileSystemCacheForDev: false,
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: securityHeaders,
            },
            {
                source: "/sw.js",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "no-cache, no-store, must-revalidate",
                    },
                    {
                        key: "Service-Worker-Allowed",
                        value: "/",
                    },
                ],
            },
            {
                source: "/(icons|assets)/:path*",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable",
                    },
                ],
            },
        ];
    },
};

export default withNextIntl(nextConfig);
