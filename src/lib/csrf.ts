import type { NextRequest } from "next/server";

const CAPACITOR_ORIGINS = new Set(["capacitor://localhost", "ionic://localhost"]);

function parseOrigin(rawUrl: string | undefined | null): string | null {
    if (!rawUrl) return null;
    try {
        const u = new URL(rawUrl.trim());
        const normalizedSchemeOrigin = `${u.protocol}//${u.host}`.toLowerCase();
        if (CAPACITOR_ORIGINS.has(normalizedSchemeOrigin)) {
            return normalizedSchemeOrigin;
        }
        if (u.origin === "null") return null;
        return u.origin.toLowerCase();
    } catch {
        return null;
    }
}

function buildAllowedOrigins(
    req: Request | NextRequest,
    env: Record<string, string | undefined>
): Set<string> {
    const allowed = new Set<string>(CAPACITOR_ORIGINS);

    const reqOrigin = parseOrigin(req.url);
    if (reqOrigin) allowed.add(reqOrigin);

    const nextAuthOrigin = parseOrigin(env.NEXTAUTH_URL);
    if (nextAuthOrigin) allowed.add(nextAuthOrigin);

    const siteOrigin = parseOrigin(env.NEXT_PUBLIC_SITE_URL);
    if (siteOrigin) allowed.add(siteOrigin);

    const hostHeader =
        req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
        req.headers.get("host")?.trim();
    if (hostHeader && /^[a-z0-9.-]+(:\d+)?$/i.test(hostHeader)) {
        const protoRaw = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
        const proto = protoRaw === "http" || protoRaw === "https" ? protoRaw : reqOrigin?.startsWith("http:") ? "http" : "https";
        allowed.add(`${proto}://${hostHeader.toLowerCase()}`);
    }

    if (env.NODE_ENV !== "production") {
        allowed.add("http://localhost:3000");
        allowed.add("http://127.0.0.1:3000");
    }

    return allowed;
}

/**
 * Verifies same-origin / Fetch-Metadata safety for state-changing API endpoints
 * and cost-bearing endpoints to protect against CSRF and cross-origin abuse.
 */
export function verifySameOrigin(
    req: Request | NextRequest,
    env: Record<string, string | undefined> = process.env
): { ok: true } | { ok: false; error: string } {
    const fetchSite = req.headers.get("sec-fetch-site")?.trim().toLowerCase();
    if (fetchSite === "cross-site") {
        return { ok: false, error: "Cross-site request blocked" };
    }

    const allowedOrigins = buildAllowedOrigins(req, env);
    const originHeader = req.headers.get("origin")?.trim();

    if (originHeader !== undefined) {
        if (originHeader.toLowerCase() === "null") {
            return { ok: false, error: "Null origin request blocked" };
        }
        const parsedOrigin = parseOrigin(originHeader);
        if (!parsedOrigin || !allowedOrigins.has(parsedOrigin)) {
            return { ok: false, error: "Cross-origin request blocked" };
        }
        return { ok: true };
    }

    const refererHeader = req.headers.get("referer")?.trim();
    if (refererHeader) {
        const parsedRefererOrigin = parseOrigin(refererHeader);
        if (!parsedRefererOrigin || !allowedOrigins.has(parsedRefererOrigin)) {
            return { ok: false, error: "Cross-origin referer blocked" };
        }
    }

    return { ok: true };
}
