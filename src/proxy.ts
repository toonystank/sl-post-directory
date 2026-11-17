import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
    const response = intlMiddleware(request);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), interest-cohort=()");
    return response;
}

export const config = {
    // Match only internationalized pathnames, skip api/static/images
    matcher: ["/", "/(si|ta|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
