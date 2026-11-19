import test from "node:test";
import assert from "node:assert/strict";
import {
    encodeOfficeIndex,
    decodeOfficeRowToPostOffice,
    isValidCompactOfficeIndex,
    LocalOfficeSearchEngine,
    type OfficeIndexSourceRecord,
} from "./office-index";

const sampleRecords: OfficeIndexSourceRecord[] = [
    {
        id: "off-1",
        slug: "colombo-gpo",
        name: "Colombo GPO",
        postalCode: "00100",
        services: ["postal complex", "Foreign parcel unit"],
        fields: [
            { name: "Type", value: "General Post Office" },
            { name: "Division", value: "Colombo" },
            { name: "Phone", value: "011-2328301" },
            { name: "Is24Hour", value: "true" },
        ],
    },
    {
        id: "off-2",
        slug: "kandy",
        name: "Kandy",
        postalCode: "20000",
        services: ["regional sorting unit"],
        fields: [
            { name: "Type", value: "Post Office" },
            { name: "Division", value: "Kandy" },
            { name: "Telephone", value: "081-2222222" },
        ],
    },
    {
        id: "off-3",
        slug: "nuwara-eliya",
        name: "Nuwara Eliya",
        postalCode: "22200",
        services: [],
        fields: [
            { name: "Type", value: "Post Office" },
            { name: "Division", value: "Nuwara Eliya" },
        ],
    },
    {
        id: "off-4",
        slug: "nugegoda",
        name: "Nugegoda",
        postalCode: "10250",
        services: ["postal complex"],
        fields: [
            { name: "Type", value: "Post Office" },
            { name: "Division", value: "Colombo" },
        ],
    },
];

test("encodeOfficeIndex and decodeOfficeRowToPostOffice round-trip fields, flags, and services compactly", () => {
    const encoded = encodeOfficeIndex(sampleRecords);
    assert.equal(isValidCompactOfficeIndex(encoded), true);
    assert.equal(encoded.count, 4);
    assert.equal(encoded.r.length, 4);

    // Default "Post Office" type is omitted from type dictionary to shrink payload
    assert.equal(encoded.t.includes("Post Office"), false);
    assert.equal(encoded.t.includes("General Post Office"), true);

    const colomboRow = encoded.r.find((row) => row[1] === "colombo-gpo");
    assert.ok(colomboRow);
    const decoded = decodeOfficeRowToPostOffice(encoded, colomboRow);
    assert.equal(decoded.name, "Colombo GPO");
    assert.equal(decoded.postalCode, "00100");
    assert.deepEqual(decoded.services, ["postal complex", "Foreign parcel unit"]);
    assert.equal(decoded.fields.find((f) => f.name === "Type")?.value, "General Post Office");
    assert.equal(decoded.fields.find((f) => f.name === "Division")?.value, "Colombo");
    assert.equal(decoded.fields.find((f) => f.name === "Phone")?.value, "011-2328301");
    assert.equal(decoded.fields.find((f) => f.name === "Is24Hour")?.value, "true");
});

test("LocalOfficeSearchEngine supports exact, prefix, postcode, division, letter, service, and typo-tolerant queries", () => {
    const engine = new LocalOfficeSearchEngine(encodeOfficeIndex(sampleRecords));

    // Exact postcode
    const byCode = engine.query({ q: "22200" });
    assert.equal(byCode.total, 1);
    assert.equal(byCode.offices[0].slug, "nuwara-eliya");

    // Typo-tolerant fuzzy match ("colobo" -> Colombo GPO)
    const fuzzy = engine.query({ q: "colobo" });
    assert.equal(fuzzy.offices[0]?.slug, "colombo-gpo");

    // Compact space-insensitive match ("nuwaraeliya")
    const compact = engine.query({ q: "nuwaraeliya" });
    assert.equal(compact.offices[0]?.slug, "nuwara-eliya");

    // Division filter
    const byDivision = engine.query({ q: "Colombo", mode: "division" });
    assert.equal(byDivision.total, 2);

    // Letter + Service combined filter
    const byLetterAndService = engine.query({ letter: "N", service: "postal complex" });
    assert.equal(byLetterAndService.total, 1);
    assert.equal(byLetterAndService.offices[0].slug, "nugegoda");

    // Autocomplete formats numeric postcode queries cleanly
    const autoNumeric = engine.autocomplete("20000", "all");
    assert.deepEqual(autoNumeric, ["Kandy (20000)"]);

    // O(1) slug lookup
    assert.equal(engine.getBySlug("kandy")?.postalCode, "20000");
});

test("LocalOfficeSearchEngine searches 4,158 offices in under 25ms per query", () => {
    const synthetic: OfficeIndexSourceRecord[] = [];
    const divisions = ["Colombo", "Kandy", "Galle", "Matara", "Jaffna", "Kurunegala", "Gampaha", "Ratnapura"];
    for (let i = 0; i < 4158; i++) {
        const code = String(10000 + i).padStart(5, "0");
        synthetic.push({
            id: `id-${i}`,
            slug: `office-${i}`,
            name: i === 2048 ? "Nuwara Eliya Main" : `Town Office ${i}`,
            postalCode: i === 2048 ? "22200" : code,
            services: i % 10 === 0 ? ["postal complex"] : [],
            fields: [
                { name: "Type", value: i % 5 === 0 ? "Sub Post Office" : "Post Office" },
                { name: "Division", value: divisions[i % divisions.length] },
            ],
        });
    }

    const encoded = encodeOfficeIndex(synthetic);
    const engine = new LocalOfficeSearchEngine(encoded);

    const start = performance.now();
    const res1 = engine.query({ q: "nuwara eliya" });
    const res2 = engine.query({ q: "22200" });
    const res3 = engine.autocomplete("nuwara", "all");
    const elapsedMs = performance.now() - start;

    assert.equal(res1.offices[0]?.slug, "office-2048");
    assert.equal(res2.offices[0]?.slug, "office-2048");
    assert.equal(res3[0], "Nuwara Eliya Main");
    assert.ok(elapsedMs < 50, `Expected 3 full-index queries to run in <50ms, took ${elapsedMs.toFixed(2)}ms`);
});

test("LocalOfficeSearchEngine normalizes unpadded 00100 codes, deduplicates empty lowercase rows, and filters by division/type/24h", () => {
    const dirtyRecords: OfficeIndexSourceRecord[] = [
        {
            id: "gpo",
            slug: "colombo-gpo--100",
            name: "Colombo G. P. O.",
            postalCode: "100",
            fields: [
                { name: "Type", value: "General Post Office" },
                { name: "Division", value: "Colombo" },
                { name: "Phone", value: "112328301" },
                { name: "Is24Hour", value: "true" },
            ],
        },
        {
            id: "dup-bad",
            slug: "kabagamuwa-bad",
            name: "kabagamuwa",
            postalCode: "",
            fields: [{ name: "Division", value: "Kegalle" }],
        },
        {
            id: "dup-good",
            slug: "kabagamuwa-71202",
            name: "Kabagamuwa",
            postalCode: "71202",
            fields: [
                { name: "Type", value: "Sub Post Office" },
                { name: "Division", value: "Kegalle" },
            ],
        },
    ];

    const engine = new LocalOfficeSearchEngine(encodeOfficeIndex(dirtyRecords));
    // Duplicate empty-code lowercase entry was removed
    assert.equal(engine.totalCount, 2);

    // Searching "00100" finds Colombo G. P. O. and returns normalized "00100" + formatted phone
    const res00100 = engine.query({ q: "00100" });
    assert.equal(res00100.total, 1);
    assert.equal(res00100.offices[0].postalCode, "00100");
    assert.equal(res00100.offices[0].fields.find((f) => f.name === "Phone")?.value, "011 232-8301");

    // Searching legacy "100" still finds Colombo G. P. O.
    assert.equal(engine.query({ q: "100" }).total, 1);

    // Rich autocomplete includes postalCode and division
    const rich = engine.autocompleteRich("00100", "all");
    assert.equal(rich[0]?.postalCode, "00100");
    assert.equal(rich[0]?.division, "Colombo");

    // Division, type, and 24-hour filters work cleanly
    assert.equal(engine.query({ division: "Kegalle" }).total, 1);
    assert.equal(engine.query({ officeType: "Sub Post Office" }).total, 1);
    assert.equal(engine.query({ is24Hour: true }).total, 1);
});
