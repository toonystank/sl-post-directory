import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RATE_CONFIG } from "./postage-rates";
import { filterCountries, POPULAR_COUNTRY_CODES } from "./country-search";
import { hasCountryFlag } from "../components/brand/CountryFlag";

const sortedCountries = [...DEFAULT_RATE_CONFIG.emsCountries].sort((a, b) =>
    a.name.localeCompare(b.name)
);

test("every international rate country has a dedicated SVG flag", () => {
    const missing = sortedCountries.filter((c) => !hasCountryFlag(c.code));
    assert.deepEqual(
        missing.map((c) => `${c.code} (${c.name})`),
        [],
        "All countries in DEFAULT_RATE_CONFIG.emsCountries must have a dedicated SVG flag"
    );
});

test("popular country shortcuts all exist in DEFAULT_RATE_CONFIG and have SVG flags", () => {
    for (const code of POPULAR_COUNTRY_CODES) {
        assert.ok(
            sortedCountries.some((c) => c.code === code),
            `Popular country ${code} should exist in DEFAULT_RATE_CONFIG`
        );
        assert.equal(hasCountryFlag(code), true, `Popular country ${code} must have an SVG flag`);
    }
});

test("filterCountries returns full list for empty or whitespace queries", () => {
    assert.equal(filterCountries(sortedCountries, "").length, sortedCountries.length);
    assert.equal(filterCountries(sortedCountries, "   ").length, sortedCountries.length);
});

test("filterCountries matches ISO codes, aliases, cities, and typos cleanly", () => {
    assert.equal(filterCountries(sortedCountries, "gb")[0]?.code, "GB");
    assert.equal(filterCountries(sortedCountries, "uk")[0]?.code, "GB");
    assert.equal(filterCountries(sortedCountries, "london")[0]?.code, "GB");
    assert.equal(filterCountries(sortedCountries, "usa")[0]?.code, "US");
    assert.equal(filterCountries(sortedCountries, "dubai")[0]?.code, "AE");
    assert.equal(filterCountries(sortedCountries, "uae")[0]?.code, "AE");
    assert.equal(filterCountries(sortedCountries, "thaiwan")[0]?.code, "TW");
    assert.equal(filterCountries(sortedCountries, "holland")[0]?.code, "NL");
    assert.equal(filterCountries(sortedCountries, "swiss")[0]?.code, "CH");
    assert.equal(filterCountries(sortedCountries, "austrlia")[0]?.code, "AU");
    assert.equal(filterCountries(sortedCountries, "germny")[0]?.code, "DE");
    assert.equal(filterCountries(sortedCountries, "korea")[0]?.code, "KR");
});

test("filterCountries supports Sinhala and Tamil country names", () => {
    assert.equal(filterCountries(sortedCountries, "එක්සත් රාජධානිය", "si")[0]?.code, "GB");
    assert.equal(filterCountries(sortedCountries, "ஐக்கிய இராச்சியம்", "ta")[0]?.code, "GB");
    // English search still works when browsing in Sinhala or Tamil locale
    assert.equal(filterCountries(sortedCountries, "Japan", "si")[0]?.code, "JP");
    assert.equal(filterCountries(sortedCountries, "Australia", "ta")[0]?.code, "AU");
});

test("filterCountries returns empty array when no countries match", () => {
    assert.deepEqual(filterCountries(sortedCountries, "zzzznotacountry"), []);
});
