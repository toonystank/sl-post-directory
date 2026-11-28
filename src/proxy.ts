import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { LOCALE_COOKIE_NAME, resolveMiddlewareLocaleRedirect } from "./lib/locale";
import { resolveLegacyHostRedirect } from "./lib/seo-office";
import { getSiteUrl } from "./lib/site";

const intlMiddleware = createMiddleware(routing);

const SENSITIVE_ROUTE_RE = /^\/(?:(?:en|si|ta)\/)?dashboard(?:\/|$)/i;

function applySecurityHeaders(response: NextResponse, pathname?: string): NextResponse {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(self), interest-cohort=()");
    if (pathname && SENSITIVE_ROUTE_RE.test(pathname)) {
        response.headers.set("Cache-Control", "private, no-store");
    }
    return response;
}

export default function proxy(request: NextRequest) {
    // Automatically 301-redirect legacy lankapost.vercel.app traffic once a custom domain
    // (e.g., https://thapal.lk) is configured via NEXT_PUBLIC_SITE_URL.
    const legacyRedirectTarget = resolveLegacyHostRedirect({
        host: request.headers.get("host"),
        canonicalOrigin: getSiteUrl(),
        pathname: request.nextUrl.pathname,
        search: request.nextUrl.search,
        method: request.method,
    });
    if (legacyRedirectTarget) {
        return applySecurityHeaders(NextResponse.redirect(legacyRedirectTarget, 301));
    }

    const isSwPrecache = request.headers.get("x-sw-precache") === "1";
    const isRscOrPrefetch =
        request.headers.get("rsc") === "1" ||
        request.headers.get("next-router-prefetch") === "1" ||
        request.headers.get("purpose") === "prefetch" ||
        request.nextUrl.searchParams.has("_rsc");

    const redirectTarget = resolveMiddlewareLocaleRedirect({
        method: request.method,
        pathname: request.nextUrl.pathname,
        search: request.nextUrl.search,
        cookieLocale: request.cookies.get(LOCALE_COOKIE_NAME)?.value,
        isSwPrecache,
        isRscOrPrefetch,
    });

    if (redirectTarget) {
        const redirectUrl = new URL(redirectTarget, request.url);
        const redirectRes = NextResponse.redirect(redirectUrl, 307);
        redirectRes.headers.set("Vary", "Cookie");
        redirectRes.headers.set("Cache-Control", "no-store");
        return applySecurityHeaders(redirectRes);
    }

    const response = intlMiddleware(request);
    if (isSwPrecache) {
        response.headers.delete("set-cookie");
    }
    return applySecurityHeaders(response, request.nextUrl.pathname);
}

export const config = {
    // Match only internationalized pathnames, skip api/static/images/OG/.well-known
    matcher: [
        "/",
        "/(si|ta|en)/:path*",
        "/((?!api|_next|_vercel|opengraph-image|twitter-image|\\.well-known|.*\\..*).*)",
    ],
};
