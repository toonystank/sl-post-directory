import test from "node:test";
import assert from "node:assert/strict";
import {
    buildOfficeMetadataCopy,
    buildOfficeSeoContent,
    classifyOfficeSitemapTier,
    getLocalizedPageMetadata,
    resolveLegacyHostRedirect,
    selectRelatedDivisionOffices,
    sortOfficesForSitemap,
} from "./seo-office";
import {
    buildCanonicalToPathAlternates,
    buildEnglishCanonicalAlternates,
} from "./site";

test("classifyOfficeSitemapTier and sortOfficesForSitemap place Main POs before coded SPOs before uncoded SPOs", () => {
    assert.equal(classifyOfficeSitemapTier({ type: "Post Office", postalCode: "00100" }).tier, 1);
    assert.equal(classifyOfficeSitemapTier({ type: "RMSC / Sorting Hub", postalCode: "" }).tier, 1);
    assert.equal(classifyOfficeSitemapTier({ type: "Sub Post Office", postalCode: "40167" }).tier, 2);
    assert.equal(classifyOfficeSitemapTier({ type: "Sub Post Office", postalCode: "" }).tier, 3);

    const sorted = sortOfficesForSitemap([
        { slug: "abanwala", name: "Abanwala", type: "Sub Post Office", postalCode: "" },
        { slug: "achchelu-40167", name: "Achchelu", type: "Sub Post Office", postalCode: "40167" },
        { slug: "kandy-20000", name: "Kandy", type: "Post Office", postalCode: "20000" },
        { slug: "colombo-00100", name: "Colombo", type: "Post Office", postalCode: "00100" },
    ]);

    assert.deepEqual(
        sorted.map((o) => o.slug),
        ["colombo-00100", "kandy-20000", "achchelu-40167", "abanwala"]
    );
});

test("buildOfficeMetadataCopy localizes EN/SI/TA and uses controlling postal code when SPO lacks its own code", () => {
    const spoNoCode = buildOfficeMetadataCopy(
        {
            name: "Abanwala",
            postalCode: "",
            type: "Sub Post Office",
            division: "Kandy (South)",
            phoneNumbers: ["081 388-4569"],
            hoursSummary: "Mon–Fri 8:30 AM – 4:00 PM",
            is24Hour: false,
            isDeliveryOffice: false,
            isNonDeliveryOffice: true,
            controllingOffice: { name: "Gampola", postalCode: "20500", phone: "081 235-2222" },
            controlledCount: 0,
        },
        "en"
    );

    assert.ok(spoNoCode.title.includes("20500"));
    assert.ok(spoNoCode.description.includes("Gampola"));
    assert.ok(spoNoCode.description.includes("081 388-4569"));

    const siMain = buildOfficeMetadataCopy(
        {
            name: "Kandy",
            postalCode: "20000",
            type: "Post Office",
            division: "Kandy (North)",
            phoneNumbers: ["081 222-2222"],
            hoursSummary: "Mon–Fri 8:30 AM – 4:00 PM",
            is24Hour: false,
            isDeliveryOffice: true,
            isNonDeliveryOffice: false,
            controllingOffice: null,
            controlledCount: 14,
        },
        "si"
    );
    assert.ok(siMain.title.includes("තැපැල් කේතය 20000"));

    const taMain = buildOfficeMetadataCopy(
        {
            name: "Jaffna",
            postalCode: "40000",
            type: "Post Office",
            division: "Jaffna",
            phoneNumbers: ["021 222-2222"],
            hoursSummary: "Mon–Fri 8:30 AM – 4:00 PM",
            is24Hour: false,
            isDeliveryOffice: true,
            isNonDeliveryOffice: false,
            controllingOffice: null,
            controlledCount: 20,
        },
        "ta"
    );
    assert.ok(taMain.title.includes("அஞ்சல் குறியீடு 40000"));
});

test("buildOfficeSeoContent generates rich overview prose, FAQs, and valid FAQPage JSON-LD", () => {
    const content = buildOfficeSeoContent(
        {
            name: "Abanwala",
            postalCode: "",
            type: "Sub Post Office",
            division: "Kandy (South)",
            dpmg: "Central",
            rmsc: "Kandy RMSC",
            phoneNumbers: ["081 388-4569"],
            hoursSummary: "Mon–Fri 8:30 AM – 4:00 PM",
            is24Hour: false,
            weekdayHours: "8:30 AM – 4:00 PM",
            saturdayHours: "8:30 AM – 12:30 PM",
            isDeliveryOffice: false,
            isNonDeliveryOffice: true,
            controllingOffice: { name: "Gampola", postalCode: "20500", phone: "081 235-2222" },
            controlledCount: 0,
        },
        "en"
    );

    assert.ok(content.overviewParagraph.includes("Gampola"));
    assert.ok(content.overviewParagraph.includes("20500"));
    assert.equal(content.faqs.length, 4);
    assert.equal(content.faqJsonLd["@type"], "FAQPage");
});

test("selectRelatedDivisionOffices creates deterministic non-self sibling mesh including major offices and neighbors", () => {
    const division = Array.from({ length: 15 }, (_, idx) => ({
        slug: `office-${String(idx).padStart(2, "0")}`,
        name: `Office ${String(idx).padStart(2, "0")}`,
        postalCode: idx % 3 === 0 ? `200${String(idx).padStart(2, "0")}` : "",
        type: idx === 0 || idx === 7 ? "Post Office" : "Sub Post Office",
    }));

    const related = selectRelatedDivisionOffices("office-05", division, 8);
    assert.equal(related.length, 8);
    assert.ok(!related.some((r) => r.slug === "office-05"));
    assert.ok(related.some((r) => r.slug === "office-06"));
    assert.ok(related.some((r) => r.slug === "office-04"));
    assert.ok(related.some((r) => r.slug === "office-00"));
});

test("buildEnglishCanonicalAlternates and buildCanonicalToPathAlternates omit duplicate hreflang bloat", () => {
    const engOnly = buildEnglishCanonicalAlternates("/district/kandy");
    assert.equal(engOnly.canonical, "https://lankapost.vercel.app/district/kandy");
    assert.equal(engOnly.languages, undefined);

    const weightCanonical = buildCanonicalToPathAlternates("/rates/taiwan");
    assert.equal(weightCanonical.canonical, "https://lankapost.vercel.app/rates/taiwan");
    assert.equal(weightCanonical.languages, undefined);
});

test("getLocalizedPageMetadata returns distinct localized metadata for en, si, and ta", () => {
    const en = getLocalizedPageMetadata("calculator", "en");
    const si = getLocalizedPageMetadata("calculator", "si");
    const ta = getLocalizedPageMetadata("calculator", "ta");
    assert.notEqual(en.title, si.title);
    assert.notEqual(en.title, ta.title);
    assert.ok(si.title.includes("තැපැල්"));
    assert.ok(ta.title.includes("தபால்"));
});

test("resolveLegacyHostRedirect only redirects legacy vercel.app host once custom domain is configured", () => {
    // No-op when NEXT_PUBLIC_SITE_URL is still lankapost.vercel.app
    assert.equal(
        resolveLegacyHostRedirect({
            host: "lankapost.vercel.app",
            canonicalOrigin: "https://lankapost.vercel.app",
            pathname: "/office/colombo",
            search: "",
            method: "GET",
        }),
        null
    );

    // 301 target when custom domain like thapal.lk is configured
    assert.equal(
        resolveLegacyHostRedirect({
            host: "lankapost.vercel.app",
            canonicalOrigin: "https://thapal.lk",
            pathname: "/office/colombo",
            search: "?ref=test",
            method: "GET",
        }),
        "https://thapal.lk/office/colombo?ref=test"
    );

    // Never touches preview deployments or the custom domain itself
    assert.equal(
        resolveLegacyHostRedirect({
            host: "lankapost-git-feat.vercel.app",
            canonicalOrigin: "https://thapal.lk",
            pathname: "/",
            search: "",
            method: "GET",
        }),
        null
    );
    assert.equal(
        resolveLegacyHostRedirect({
            host: "thapal.lk",
            canonicalOrigin: "https://thapal.lk",
            pathname: "/",
            search: "",
            method: "GET",
        }),
        null
    );
    // Never redirects POST requests
    assert.equal(
        resolveLegacyHostRedirect({
            host: "lankapost.vercel.app",
            canonicalOrigin: "https://thapal.lk",
            pathname: "/api/track",
            search: "",
            method: "POST",
        }),
        null
    );
});
