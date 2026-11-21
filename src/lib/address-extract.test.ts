import test from "node:test";
import assert from "node:assert/strict";
import {
    extractDestinationFromOcr,
    normalizePlaceName,
    type PlaceDictionary,
    type PlaceRecord,
} from "./address-extract";

function editDistance(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[a.length][b.length];
}

const MOCK_PLACES: PlaceRecord[] = [
    { name: "Kandy", slug: "kandy", postalCode: "20000", division: "Kandy" },
    { name: "Mahaiyawa", slug: "mahaiyawa", postalCode: "20050", division: "Kandy" },
    { name: "Katugastota", slug: "katugastota", postalCode: "20800", division: "Kandy" },
    { name: "Heerassagala", slug: "heerassagala", postalCode: "20000", division: "Kandy" },
    { name: "Nugegoda", slug: "nugegoda", postalCode: "10250", division: "Colombo" },
    { name: "Colombo GPO", slug: "colombo-gpo", postalCode: "00100", division: "Colombo" },
];

const mockDict: PlaceDictionary = {
    findExact(norm: string): PlaceRecord[] {
        return MOCK_PLACES.filter((p) => normalizePlaceName(p.name) === norm);
    },
    findFuzzy(norm: string, maxDist: number) {
        const out: Array<{ record: PlaceRecord; distance: number }> = [];
        for (const p of MOCK_PLACES) {
            const pNorm = normalizePlaceName(p.name);
            if (!pNorm || pNorm.charAt(0) !== norm.charAt(0)) continue;
            const d = editDistance(norm, pNorm);
            if (d <= maxDist) out.push({ record: p, distance: d });
        }
        return out.sort((a, b) => a.distance - b.distance);
    },
    findByPostalCode(code5: string): PlaceRecord[] {
        return MOCK_PLACES.filter((p) => p.postalCode === code5);
    },
};

test("extractDestinationFromOcr resolves town over street name ('100, Katugastota Road, Kandy')", () => {
    const res = extractDestinationFromOcr("100, Katugastota Road, Kandy", mockDict);
    assert.ok(res.length > 0);
    assert.equal(res[0].name, "Kandy");
    assert.equal(res[0].postalCode, "20000");
});

test("extractDestinationFromOcr handles Sample B printed envelope & ignores red postmark stamp", () => {
    const sampleB = [
        "MR RAWIKUMAR WINOTH KUMAR ARJUN",
        "20",
        "A.A DARMASENA MAWATHA",
        "MAHAIYAWA , KANDY",
    ].join("\n");
    const res = extractDestinationFromOcr(sampleB, mockDict);
    assert.ok(res.length > 0);
    assert.equal(res[0].name, "Kandy");

    // With stamp line leaking through OCR
    const withStamp = `${sampleB}\nKANDY BRANCH 20050 19.11.25`;
    const resStamp = extractDestinationFromOcr(withStamp, mockDict);
    assert.ok(resStamp.length > 0);
    assert.equal(resStamp[0].name, "Kandy");
    assert.ok(
        !resStamp.some((c) => c.matchedText.includes("20050")),
        "Stamp postal code 20050 should not be extracted as destination"
    );
});

test("extractDestinationFromOcr handles Sample C with MW abbreviation and trailing commas", () => {
    const sampleC = [
        "ABDUL CADER MOHAMED NAWAS,",
        "3/8 A A DHARMASENA MW,",
        "KANDY,",
    ].join("\n");
    const res = extractDestinationFromOcr(sampleC, mockDict);
    assert.ok(res.length > 0);
    assert.equal(res[0].name, "Kandy");
});

test("extractDestinationFromOcr handles Sample D slip with licence, phone, and reference noise", () => {
    const sampleD = [
        "Licence Number: B4019219",
        "MOHAMED IQBAL",
        "MOHAMED HAKEEM",
        "544/24 A HEERASSAGALA ROAD",
        "KANDY",
        "20000",
        "94714867898",
        "DANNOOT000907 - 7",
    ].join("\n");
    const res = extractDestinationFromOcr(sampleD, mockDict);
    assert.ok(res.length > 0);
    assert.equal(res[0].name, "Kandy");
    assert.equal(res[0].reason, "name+postal_code");

    assert.deepEqual(extractDestinationFromOcr("94714867898\nB4019219", mockDict), []);
});

test("extractDestinationFromOcr respects To:/From: boundaries", () => {
    const text = [
        "To: Mr Perera",
        "45/2 Temple Rd",
        "Nugegoda 10250",
        "From: K. Silva, Colombo",
    ].join("\n");
    const res = extractDestinationFromOcr(text, mockDict);
    assert.ok(res.length > 0);
    assert.equal(res[0].name, "Nugegoda");
    assert.ok(!res.some((c) => c.name === "Colombo GPO"));
});

test("extractDestinationFromOcr matches standalone postal code when town name is absent", () => {
    const res = extractDestinationFromOcr("No 12\n20000", mockDict);
    assert.ok(res.length > 0);
    assert.equal(res[0].name, "Kandy");
    assert.equal(res[0].reason, "postal_code");
});

test("extractDestinationFromOcr repairs OCR character typos (KANDV, NUGEG0DA)", () => {
    const kandyTypo = extractDestinationFromOcr("KANDV", mockDict);
    assert.equal(kandyTypo[0]?.name, "Kandy");
    assert.equal(kandyTypo[0]?.reason, "fuzzy");

    const nugegodaDigit = extractDestinationFromOcr("NUGEG0DA", mockDict);
    assert.equal(nugegodaDigit[0]?.name, "Nugegoda");
});

test("extractDestinationFromOcr resolves Sinhala town alias (මහනුවර -> Kandy)", () => {
    const res = extractDestinationFromOcr("... 70/40 ...,\nමහනුවර.", mockDict);
    assert.ok(res.length > 0);
    assert.equal(res[0].name, "Kandy");
    assert.equal(res[0].reason, "alias");
});

test("extractDestinationFromOcr returns empty list for pure noise or phone numbers", () => {
    assert.deepEqual(extractDestinationFromOcr("0771234567\nhello world", mockDict), []);
});
