import test from "node:test";
import assert from "node:assert/strict";
import {
    buildLocalizedUrl,
    getLocaleFromPathname,
    resolveMiddlewareLocaleRedirect,
    stripLocalePrefix,
} from "./locale";

test("stripLocalePrefix normalizes all locale-prefixed paths to canonical routes so Home logo never disappears", () => {
    assert.equal(stripLocalePrefix("/"), "/");
    assert.equal(stripLocalePrefix("/en"), "/");
    assert.equal(stripLocalePrefix("/si"), "/");
    assert.equal(stripLocalePrefix("/ta"), "/");
    assert.equal(stripLocalePrefix("/ta/"), "/");
    assert.equal(stripLocalePrefix("/si/calculator"), "/calculator");
    assert.equal(stripLocalePrefix("/ta/office/colombo-gpo"), "/office/colombo-gpo");
    // Must not corrupt paths that merely start with letters like "si" or "en"
    assert.equal(stripLocalePrefix("/sitemap.xml"), "/sitemap.xml");
    assert.equal(stripLocalePrefix("/suggest/123"), "/suggest/123");
});

test("buildLocalizedUrl produces clean as-needed URLs and preserves query strings and hashes", () => {
    assert.equal(buildLocalizedUrl("/ta", "en"), "/");
    assert.equal(buildLocalizedUrl("/si/calculator", "en", "?mode=intl&country=TW"), "/calculator?mode=intl&country=TW");
    assert.equal(buildLocalizedUrl("/", "si"), "/si");
    assert.equal(buildLocalizedUrl("/calculator", "ta", "?mode=cod", "#rates"), "/ta/calculator?mode=cod#rates");
    assert.equal(buildLocalizedUrl("/si/browse", "ta"), "/ta/browse");
});

test("getLocaleFromPathname extracts explicit prefix only when present", () => {
    assert.equal(getLocaleFromPathname("/"), null);
    assert.equal(getLocaleFromPathname("/calculator"), null);
    assert.equal(getLocaleFromPathname("/si"), "si");
    assert.equal(getLocaleFromPathname("/ta/browse"), "ta");
    assert.equal(getLocaleFromPathname("/en/track"), "en");
});

test("resolveMiddlewareLocaleRedirect defaults to English when no cookie and remembers explicit si/ta choice", () => {
    // First visit with no cookie -> always defaults to English (no redirect)
    assert.equal(
        resolveMiddlewareLocaleRedirect({
            method: "GET",
            pathname: "/",
            search: "",
            cookieLocale: undefined,
            isSwPrecache: false,
            isRscOrPrefetch: false,
        }),
        null
    );

    // Explicit English choice -> no redirect
    assert.equal(
        resolveMiddlewareLocaleRedirect({
            method: "GET",
            pathname: "/calculator",
            search: "?mode=intl",
            cookieLocale: "en",
            isSwPrecache: false,
            isRscOrPrefetch: false,
        }),
        null
    );

    // Explicit Tamil choice -> redirects unprefixed navigation to /ta preserving query params
    assert.equal(
        resolveMiddlewareLocaleRedirect({
            method: "GET",
            pathname: "/calculator",
            search: "?mode=intl&country=TW",
            cookieLocale: "ta",
            isSwPrecache: false,
            isRscOrPrefetch: false,
        }),
        "/ta/calculator?mode=intl&country=TW"
    );

    // Already prefixed path -> never double-redirects
    assert.equal(
        resolveMiddlewareLocaleRedirect({
            method: "GET",
            pathname: "/si/browse",
            search: "",
            cookieLocale: "ta",
            isSwPrecache: false,
            isRscOrPrefetch: false,
        }),
        null
    );

    // Service Worker precache or RSC/prefetch -> never redirects
    assert.equal(
        resolveMiddlewareLocaleRedirect({
            method: "GET",
            pathname: "/",
            search: "",
            cookieLocale: "si",
            isSwPrecache: true,
            isRscOrPrefetch: false,
        }),
        null
    );
    assert.equal(
        resolveMiddlewareLocaleRedirect({
            method: "GET",
            pathname: "/",
            search: "",
            cookieLocale: "si",
            isSwPrecache: false,
            isRscOrPrefetch: true,
        }),
        null
    );
});
