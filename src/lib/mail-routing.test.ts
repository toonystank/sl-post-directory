import test from "node:test";
import assert from "node:assert/strict";
import {
    computeMailRoute,
    generateSortingQuizQuestions,
    inferHubFromOffice,
    lookupPrefixZone,
    parseRouteQueryPair,
    resolveOfficeForRoute,
    searchRoutingOffices,
    type RoutingOfficeNode,
} from "./mail-routing";

const sampleOffices: RoutingOfficeNode[] = [
    {
        id: "1",
        slug: "avissawella",
        name: "Avissawella",
        postalCode: "10700",
        shortCode: "AW",
        type: "Post Office",
        grade: "Class I",
        division: "Colombo (North)",
        delivery: "Yes",
        rmsc: "Colombo CME",
    },
    {
        id: "2",
        slug: "akarawita",
        name: "Akarawita",
        postalCode: "10732",
        type: "Sub Post Office",
        division: "Colombo (North)",
        delivery: "Yes",
        rmsc: "Colombo CME",
        controllingOfficeId: "1",
        controllingOfficeSlug: "avissawella",
        controllingOfficeName: "Avissawella",
        controllingOfficePostalCode: "10700",
        controllingOfficeShortCode: "AW",
    },
    {
        id: "3",
        slug: "daigala",
        name: "Daigala",
        postalCode: "10705",
        type: "Sub Post Office",
        division: "Colombo (North)",
        delivery: "No",
        rmsc: "Colombo CME",
        controllingOfficeId: "1",
        controllingOfficeSlug: "avissawella",
        controllingOfficeName: "Avissawella",
        controllingOfficePostalCode: "10700",
        controllingOfficeShortCode: "AW",
    },
    {
        id: "4",
        slug: "kandy",
        name: "Kandy",
        postalCode: "20000",
        shortCode: "KD",
        type: "Post Office",
        grade: "Supra",
        division: "Kandy (North)",
        delivery: "Yes",
        rmsc: "Kandy RMSC",
    },
    {
        id: "5",
        slug: "peradeniya",
        name: "Peradeniya",
        postalCode: "20400",
        shortCode: "PD",
        type: "Post Office",
        division: "Kandy (South)",
        delivery: "Yes",
        rmsc: "Kandy RMSC",
    },
    {
        id: "6",
        slug: "kottawa-colombo",
        name: "Kottawa",
        postalCode: "10230",
        division: "Colombo (South)",
        delivery: "Yes",
        rmsc: "Colombo CME",
    },
    {
        id: "7",
        slug: "kottawa-galle",
        name: "Kottawa",
        postalCode: "80000",
        division: "Galle",
        delivery: "No",
        rmsc: "DOWN GALLE TPO",
    },
];

test("lookupPrefixZone maps Sri Lanka 2-digit prefixes accurately", () => {
    assert.equal(lookupPrefixZone("00100")?.district, "Colombo City (Colombo 01–15)");
    assert.equal(lookupPrefixZone("20000")?.primaryHub, "Kandy RMSC");
    assert.equal(lookupPrefixZone("81")?.province, "Southern");
    assert.equal(lookupPrefixZone("99"), null);
});

test("computeMailRoute detects same-controlling-office shortcut and non-delivery warning", () => {
    const route = computeMailRoute(sampleOffices[1], sampleOffices[2], sampleOffices);
    assert.equal(route.scope, "SAME_CONTROLLING");
    assert.ok(route.steps.some((s) => s.title === "Avissawella"));
    assert.ok(route.bagLabel.deliveryWarning?.includes("Non-Delivery"));
    assert.equal(route.bagLabel.controllingOffice, "Avissawella (AW)");
});

test("computeMailRoute detects same-RMSC regional shortcut", () => {
    const route = computeMailRoute(sampleOffices[3], sampleOffices[4], sampleOffices);
    assert.equal(route.scope, "SAME_HUB");
    assert.equal(route.steps.some((s) => s.role === "NATIONAL_HUB"), false);
});

test("computeMailRoute detects cross-region route through CME and duplicate town names", () => {
    const route = computeMailRoute(sampleOffices[3], sampleOffices[5], sampleOffices);
    assert.equal(route.scope, "CROSS_REGION");
    assert.equal(route.duplicateNames.length, 1);
    assert.equal(route.duplicateNames[0].postalCode, "80000");
    assert.equal(inferHubFromOffice(sampleOffices[6]), "DOWN GALLE TPO");
});

test("generateSortingQuizQuestions builds valid multiple-choice questions", () => {
    const questions = generateSortingQuizQuestions(sampleOffices, 5);
    assert.ok(questions.length > 0);
    for (const q of questions) {
        assert.ok(q.options.includes(q.correctAnswer));
    }
});

test("parseRouteQueryPair and resolveOfficeForRoute handle 'kandy to jafna', arrows, postcodes, short codes, and guard postage queries", () => {
    assert.deepEqual(parseRouteQueryPair("kandy to jafna"), { originQuery: "kandy", destQuery: "jafna" });
    assert.deepEqual(parseRouteQueryPair("from kandy to jaffna"), { originQuery: "kandy", destQuery: "jaffna" });
    assert.deepEqual(parseRouteQueryPair("20000 -> 40000"), { originQuery: "20000", destQuery: "40000" });
    assert.equal(parseRouteQueryPair("parcel to taiwan 5kg"), null);
    assert.equal(parseRouteQueryPair("registered letter to uk"), null);

    const nodesWithJaffna: RoutingOfficeNode[] = [
        ...sampleOffices,
        {
            id: "8",
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
    ];

    const kandy = resolveOfficeForRoute("kandy", nodesWithJaffna);
    assert.equal(kandy?.office.slug, "kandy");
    assert.equal(kandy?.isFuzzyMatch, false);

    const jafna = resolveOfficeForRoute("jafna", nodesWithJaffna);
    assert.equal(jafna?.office.slug, "jaffna-40000");
    assert.equal(jafna?.isFuzzyMatch, true);

    const byShort = resolveOfficeForRoute("aw", nodesWithJaffna);
    assert.equal(byShort?.office.slug, "avissawella");
});

test("searchRoutingOffices ranks exact/prefix Main POs like 'kandy' above 25 alphabetically-earlier Kandy-division SPOs and handles typos", () => {
    const kandySubOffices: RoutingOfficeNode[] = Array.from({ length: 25 }, (_, i) => ({
        id: `a-spo-${i}`,
        slug: `akuran-${20100 + i}`,
        name: `A${String(i + 1).padStart(2, "0")} Kandy Village`,
        postalCode: String(20100 + i),
        type: "Sub Post Office",
        division: "Kandy",
        delivery: "Yes",
    }));

    const list: RoutingOfficeNode[] = [
        ...kandySubOffices,
        {
            id: "kd-sub",
            slug: "kandy-sub-20001",
            name: "Kandy Sub",
            postalCode: "20001",
            type: "Sub Post Office",
            division: "Kandy",
            delivery: "No",
        },
        {
            id: "kd-main",
            slug: "kandy-20000",
            name: "Kandy",
            postalCode: "20000",
            shortCode: "KY",
            type: "Post Office",
            grade: "Supra",
            division: "Kandy",
            delivery: "Yes",
            rmsc: "Kandy RMSC",
        },
        {
            id: "ja-main",
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
    ];

    const kandyResults = searchRoutingOffices(list, "kandy", 10);
    assert.equal(kandyResults[0]?.slug, "kandy-20000");
    assert.equal(kandyResults[1]?.slug, "kandy-sub-20001");

    const typoResults = searchRoutingOffices(list, "jafna", 10);
    assert.equal(typoResults[0]?.slug, "jaffna-40000");
});
