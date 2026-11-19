import test from "node:test";
import assert from "node:assert/strict";
import {
    classifySwRequest,
    isStandaloneDisplayMode,
    isTwaRuntime,
    resolveOfflinePageLookupKeys,
    saveOfficesToOfflineCache,
    searchOfflineOfficesCache,
    type StorageLike,
} from "./pwa";
import type { PostOffice } from "@/components/directory/types";

function makeMemoryStorage(): StorageLike {
    const store = new Map<string, string>();
    return {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, val) => {
            store.set(key, val);
        },
    };
}

const sampleOffices: PostOffice[] = [
    {
        id: "col-1",
        slug: "colombo-gpo",
        name: "Colombo GPO",
        postalCode: "00100",
        services: ["POSTAL_COMPLEX"],
        fields: [{ name: "Division", value: "Colombo" }],
    },
    {
        id: "kdy-1",
        slug: "kandy",
        name: "Kandy",
        postalCode: "20000",
        services: ["FOREIGN_PARCEL"],
        fields: [{ name: "Division", value: "Kandy" }],
    },
    {
        id: "nel-1",
        slug: "nuwara-eliya",
        name: "Nuwara Eliya",
        postalCode: "22200",
        services: [],
        fields: [{ name: "Division", value: "Nuwara Eliya" }],
    },
];

test("classifySwRequest separates static assets, APIs, RSC payloads, and page navigations", () => {
    const origin = "https://lankapost.vercel.app";

    assert.equal(
        classifySwRequest({ url: `${origin}/_next/static/chunks/a1b2c3d4.js`, origin, method: "GET" }),
        "cache-first-static"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/_next/static/chunks/src_components_analytics_DeferredAnalytics_tsx_.js`, origin, method: "GET" }),
        "ignore"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client.js`, origin, method: "GET" }),
        "ignore"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/.well-known/assetlinks.json`, origin, method: "GET" }),
        "ignore"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/icon-192x192.png`, origin, method: "GET" }),
        "cache-first-static"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/api/autocomplete?q=colombo`, origin, method: "GET" }),
        "api-swr"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/api/offices?q=kandy`, origin, method: "GET" }),
        "api-swr"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/api/offices/index`, origin, method: "GET" }),
        "api-swr"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/api/public/config`, origin, method: "GET" }),
        "api-swr"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/api/auth/session`, origin, method: "GET" }),
        "ignore"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/api/suggest`, origin, method: "POST" }),
        "ignore"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/calculator?_rsc=123`, origin, method: "GET", isRsc: true }),
        "rsc"
    );
    assert.equal(
        classifySwRequest({ url: `${origin}/calculator?mode=intl&country=TW`, origin, method: "GET", mode: "navigate" }),
        "navigate"
    );
});

test("resolveOfflinePageLookupKeys returns ordered fallback chain for deep-linked and localized routes", () => {
    const intlKeys = resolveOfflinePageLookupKeys("https://lankapost.app/calculator?mode=intl&country=TW&weight=5000");
    assert.deepEqual(intlKeys, [
        "/calculator?mode=intl&country=TW&weight=5000",
        "/calculator",
        "/",
        "/offline",
    ]);

    const siKeys = resolveOfflinePageLookupKeys("https://lankapost.app/si/calculator?mode=cod");
    assert.deepEqual(siKeys, [
        "/si/calculator?mode=cod",
        "/si/calculator",
        "/si",
        "/calculator",
        "/si/offline",
        "/",
        "/offline",
    ]);
});

test("isStandaloneDisplayMode and isTwaRuntime detect PWA standalone and Play Store TWA launches", () => {
    assert.equal(isStandaloneDisplayMode(() => false, false), false);
    assert.equal(isStandaloneDisplayMode((q) => q === "(display-mode: standalone)", false), true);
    assert.equal(isStandaloneDisplayMode(() => false, true), true);

    assert.equal(isTwaRuntime("", () => false), false);
    assert.equal(isTwaRuntime("https://google.com", () => false), false);
    assert.equal(isTwaRuntime("android-app://com.toonystank.slpostdirectory", () => false), true);
});

test("offline office cache stores, deduplicates, and filters by name, postcode, division, and service", () => {
    const storage = makeMemoryStorage();
    const count = saveOfficesToOfflineCache(sampleOffices, storage);
    assert.equal(count, 3);

    // Re-saving duplicate does not inflate count
    const countAfterDup = saveOfficesToOfflineCache([sampleOffices[0]], storage);
    assert.equal(countAfterDup, 3);

    const byPostcode = searchOfflineOfficesCache({ q: "22200", mode: "name" }, storage);
    assert.equal(byPostcode.length, 1);
    assert.equal(byPostcode[0].slug, "nuwara-eliya");

    const byDivision = searchOfflineOfficesCache({ q: "Kandy", mode: "division" }, storage);
    assert.equal(byDivision.length, 1);
    assert.equal(byDivision[0].slug, "kandy");

    const byService = searchOfflineOfficesCache({ service: "FOREIGN_PARCEL" }, storage);
    assert.equal(byService.length, 1);
    assert.equal(byService[0].slug, "kandy");
});
