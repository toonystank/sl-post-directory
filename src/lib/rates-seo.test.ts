import test from "node:test";
import assert from "node:assert/strict";
import {
    buildCountryTariffTable,
    buildInternationalRateSeoData,
    parseWeightSlug,
    resolveCountryFromSlug,
} from "./rates-seo";
import {
    buildLocalizedAlternates,
    formatSriLankaPhone,
    normalizePostalCode,
    postalCodeSearchVariants,
} from "./site";

test("normalizePostalCode restores leading zeros on Sri Lankan 5-digit codes", () => {
    assert.equal(normalizePostalCode("100"), "00100");
    assert.equal(normalizePostalCode("110"), "00110");
    assert.equal(normalizePostalCode("1200"), "01200");
    assert.equal(normalizePostalCode("00100"), "00100");
    assert.equal(normalizePostalCode("20000"), "20000");
    assert.equal(normalizePostalCode("—"), "");
    assert.equal(normalizePostalCode(""), "");
});

test("postalCodeSearchVariants matches both padded and legacy unpadded codes", () => {
    const v1 = postalCodeSearchVariants("00100");
    assert.ok(v1.includes("00100"));
    assert.ok(v1.includes("100"));

    const v2 = postalCodeSearchVariants("100");
    assert.ok(v2.includes("100"));
    assert.ok(v2.includes("00100"));
});

test("formatSriLankaPhone restores missing leading zero on 9-digit numbers while preserving formatted numbers", () => {
    assert.equal(formatSriLankaPhone("672250448"), "067 225-0448");
    assert.equal(formatSriLankaPhone("011-2328301"), "011-2328301");
    assert.equal(formatSriLankaPhone("067 227-7220"), "067 227-7220");
});

test("resolveCountryFromSlug resolves canonical slugs, ISO codes, and typos like thaiwan", () => {
    const exact = resolveCountryFromSlug("taiwan");
    assert.ok(exact);
    assert.equal(exact.country.code, "TW");
    assert.equal(exact.canonicalSlug, "taiwan");
    assert.equal(exact.isCanonical, true);

    const typo = resolveCountryFromSlug("thaiwan");
    assert.ok(typo);
    assert.equal(typo.country.code, "TW");
    assert.equal(typo.canonicalSlug, "taiwan");
    assert.equal(typo.isCanonical, false);

    const ukAlias = resolveCountryFromSlug("uk");
    assert.ok(ukAlias);
    assert.equal(ukAlias.country.code, "GB");
    assert.equal(ukAlias.canonicalSlug, "united-kingdom");
});

test("parseWeightSlug parses grams and kilograms cleanly", () => {
    assert.deepEqual(parseWeightSlug("1kg"), { grams: 1000, canonicalSlug: "1kg" });
    assert.deepEqual(parseWeightSlug("500g"), { grams: 500, canonicalSlug: "500g" });
    assert.deepEqual(parseWeightSlug("1.5kg"), { grams: 1500, canonicalSlug: "1.5kg" });
    assert.deepEqual(parseWeightSlug("5kgs"), { grams: 5000, canonicalSlug: "5kg" });
    assert.equal(parseWeightSlug("invalid"), null);
    assert.equal(parseWeightSlug("999kg"), null);
});

test("buildInternationalRateSeoData builds Google-ready prices, tariff table, and structured data for Taiwan 1kg", () => {
    const resolved = resolveCountryFromSlug("taiwan");
    assert.ok(resolved);

    const seo = buildInternationalRateSeoData(resolved.country, 1000, "en");
    assert.ok(seo.validQuotes.length >= 2);
    assert.ok(seo.cheapest && seo.cheapest.result.totalCost > 0);
    assert.ok(seo.answerSentence.includes("Taiwan"));
    assert.ok(seo.answerSentence.includes("Rs."));
    assert.equal(seo.faqJsonLd["@type"], "FAQPage");
    assert.equal(seo.serviceJsonLd["@type"], "Service");
    assert.equal(seo.breadcrumbJsonLd["@type"], "BreadcrumbList");

    const table = buildCountryTariffTable("TW");
    assert.ok(table.some((row) => row.weightSlug === "1kg" && row.emsLkr !== null));
});

test("buildLocalizedAlternates produces self-referencing canonicals and hreflang tags", () => {
    const altTa = buildLocalizedAlternates("/rates/taiwan/1kg", "ta");
    assert.equal(altTa.canonical, "https://lankapost.vercel.app/ta/rates/taiwan/1kg");
    const langs = altTa.languages as Record<string, string>;
    assert.equal(langs.en, "https://lankapost.vercel.app/rates/taiwan/1kg");
    assert.equal(langs.si, "https://lankapost.vercel.app/si/rates/taiwan/1kg");
    assert.equal(langs.ta, "https://lankapost.vercel.app/ta/rates/taiwan/1kg");
    assert.equal(langs["x-default"], "https://lankapost.vercel.app/rates/taiwan/1kg");
});
