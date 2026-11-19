import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { LOCALE_COOKIE_NAME, resolveMiddlewareLocaleRedirect } from "./lib/locale";

const intlMiddleware = createMiddleware(routing);

function applySecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), interest-cohort=()");
    return response;
}

export default function proxy(request: NextRequest) {
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
    return applySecurityHeaders(response);
}

export const config = {
    // Match only internationalized pathnames, skip api/static/images/.well-known
    matcher: ["/", "/(si|ta|en)/:path*", "/((?!api|_next|_vercel|\\.well-known|.*\\..*).*)"],
};
