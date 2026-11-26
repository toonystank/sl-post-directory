import test from "node:test";
import assert from "node:assert/strict";
import {
    extractWeightFromQuery,
    getSearchCyclingExamples,
    matchSmartCountry,
    parseSmartSearchIntent,
    resolveSmartRouteIntent,
    SMART_WEIGHT_CHIPS,
} from "./smart-search";
import type { RoutingOfficeNode } from "./mail-routing";

test("matchSmartCountry matches exact names, aliases, and fuzzy typos like 'thaiwan'", () => {
    const exact = matchSmartCountry("Taiwan");
    assert.ok(exact);
    assert.equal(exact.countryCode, "TW");
    assert.equal(exact.isFuzzyMatch, false);

    const typo = matchSmartCountry("thaiwan 5kg");
    assert.ok(typo);
    assert.equal(typo.countryCode, "TW");
    assert.equal(typo.isFuzzyMatch, true);
    assert.equal(typo.matchedToken, "thaiwan");

    const aliasUk = matchSmartCountry("uk 250g");
    assert.ok(aliasUk);
    assert.equal(aliasUk.countryCode, "GB");

    const aliasDubai = matchSmartCountry("dubai 1kg");
    assert.ok(aliasDubai);
    assert.equal(aliasDubai.countryCode, "AE");

    const sinhalaTaiwan = matchSmartCountry("තායිවානය 5kg");
    assert.ok(sinhalaTaiwan);
    assert.equal(sinhalaTaiwan.countryCode, "TW");
});

test("extractWeightFromQuery parses grams and kilograms while ignoring 5-digit postcodes", () => {
    const kg5 = extractWeightFromQuery("thaiwan 5kg");
    assert.equal(kg5.weightGrams, 5000);
    assert.equal(kg5.cleanedQuery, "thaiwan");

    const g250 = extractWeightFromQuery("uk 250g");
    assert.equal(g250.weightGrams, 250);

    const decimalKg = extractWeightFromQuery("1.5kg parcel");
    assert.equal(decimalKg.weightGrams, 1500);

    // Pure 5-digit Sri Lankan postal code should NOT be treated as a weight
    const postcode = extractWeightFromQuery("20000");
    assert.equal(postcode.weightGrams, null);
});

test("parseSmartSearchIntent returns international rate preview and deep-link query for 'thaiwan 5kg'", () => {
    const intent = parseSmartSearchIntent("thaiwan 5kg", "en");
    assert.ok(intent);
    assert.equal(intent.kind, "international");
    if (intent.kind === "international") {
        assert.equal(intent.countryCode, "TW");
        assert.equal(intent.weightGrams, 5000);
        assert.equal(intent.hasExplicitWeight, true);
        assert.equal(intent.isFuzzyMatch, true);
        assert.ok(intent.quotes.length >= 2);
        assert.equal(intent.calculatorHref.query.mode, "intl");
        assert.equal(intent.calculatorHref.query.country, "TW");
        assert.equal(intent.calculatorHref.query.weight, "5000");
    }
});

test("parseSmartSearchIntent handles weight chip overrides for instant interactive switching", () => {
    const intent = parseSmartSearchIntent("taiwan", "en", 2000);
    assert.ok(intent);
    assert.equal(intent.kind, "international");
    if (intent.kind === "international") {
        assert.equal(intent.countryCode, "TW");
        assert.equal(intent.weightGrams, 2000);
        assert.equal(intent.calculatorHref.query.weight, "2000");
    }
});

test("parseSmartSearchIntent detects COD and domestic weight+service queries, and ignores pure office names/postcodes", () => {
    const codIntent = parseSmartSearchIntent("cod 5000 1kg", "en");
    assert.ok(codIntent);
    assert.equal(codIntent.kind, "cod");
    if (codIntent.kind === "cod") {
        assert.equal(codIntent.codAmountLkr, 5000);
        assert.equal(codIntent.weightGrams, 1000);
        assert.equal(codIntent.calculatorHref.query.mode, "cod");
        assert.equal(codIntent.calculatorHref.query.codAmount, "5000");
        assert.equal(codIntent.calculatorHref.query.weight, "1000");
    }

    const domIntent = parseSmartSearchIntent("500g registered letter", "en");
    assert.ok(domIntent);
    assert.equal(domIntent.kind, "domestic");
    if (domIntent.kind === "domestic") {
        assert.equal(domIntent.weightGrams, 500);
        assert.equal(domIntent.registered, true);
        assert.equal(domIntent.calculatorHref.query.mode, "local");
        assert.equal(domIntent.calculatorHref.query.weight, "500");
        assert.equal(domIntent.calculatorHref.query.registered, "1");
    }

    // Pure post office or postcode searches return null so post office results lead cleanly
    assert.equal(parseSmartSearchIntent("Nuwara Eliya", "en"), null);
    assert.equal(parseSmartSearchIntent("22200", "en"), null);
    assert.equal(parseSmartSearchIntent("Kandy GPO", "en"), null);
});

test("getSearchCyclingExamples returns rich localized cycling examples including live tracking", () => {
    for (const locale of ["en", "si", "ta"]) {
        const examples = getSearchCyclingExamples(locale);
        assert.ok(examples.length >= 10);
        assert.ok(examples.some((ex) => ex.includes("5kg")));
        assert.ok(examples.some((ex) => ex.includes("BD070817564LK")));
    }
    assert.ok(SMART_WEIGHT_CHIPS.includes(5000));
});

test("resolveSmartRouteIntent resolves 'kandy to jafna' and guards international country targets", () => {
    const nodes: RoutingOfficeNode[] = [
        {
            id: "kd",
            slug: "kandy-20000",
            name: "Kandy",
            postalCode: "20000",
            shortCode: "KY",
            type: "Post Office",
            grade: "Supra",
            division: "Kandy (North)",
            delivery: "Yes",
            rmsc: "Kandy RMSC",
        },
        {
            id: "ja",
            slug: "jaffna-40000",
            name: "Jaffna",
            postalCode: "40000",
            shortCode: "JA",
            type: "Post Office",
            grade: "Supra",
            division: "Jaffna",
            delivery: "Yes",
            rmsc: "JAFFNA TPO",
        },
        {
            id: "co",
            slug: "colombo-gpo-00100",
            name: "Colombo G. P. O.",
            postalCode: "00100",
            shortCode: "GPO",
            type: "Post Office",
            grade: "Supra",
            division: "Colombo",
            delivery: "No",
            rmsc: "Colombo CME",
        },
    ];

    const route = resolveSmartRouteIntent("kandy to jafna", nodes);
    assert.ok(route);
    assert.equal(route.origin.slug, "kandy-20000");
    assert.equal(route.dest.slug, "jaffna-40000");
    assert.equal(route.destFuzzy, true);
    assert.equal(route.routingHref, "/routing?from=kandy-20000&to=jaffna-40000");

    // International destination must NOT be hijacked by domestic routing
    assert.equal(resolveSmartRouteIntent("kandy to taiwan", nodes), null);
    assert.equal(resolveSmartRouteIntent("colombo to uk", nodes), null);
    assert.equal(resolveSmartRouteIntent("Kandy", nodes), null);

    // Single-sided staff query ("to jafna") uses defaultOriginSlug only when set
    assert.equal(resolveSmartRouteIntent("to jafna", nodes), null);
    const staffRoute = resolveSmartRouteIntent("to jafna", nodes, "kandy-20000");
    assert.ok(staffRoute);
    assert.equal(staffRoute.origin.slug, "kandy-20000");
    assert.equal(staffRoute.dest.slug, "jaffna-40000");
    assert.equal(staffRoute.routingHref, "/routing?from=kandy-20000&to=jaffna-40000");
    assert.equal(resolveSmartRouteIntent("to taiwan", nodes, "kandy-20000"), null);
    assert.equal(resolveSmartRouteIntent("to uk 1kg", nodes, "kandy-20000"), null);
});
