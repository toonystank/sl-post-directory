import test from "node:test";
import assert from "node:assert/strict";
import {
    buildCombinedSearchQuery,
    extractTrackingTokensOnDelimiter,
    getNextBulkExampleCode,
    isCompleteTrackingCode,
    predictSearchCompletion,
    splitPastedTrackingText,
} from "./search-predictor";
import { detectTrackingQuery } from "./tracking/classifier";

test("isCompleteTrackingCode & detectTrackingQuery support both 13-char UPU and shorter domestic codes like BD00000LK", () => {
    assert.equal(isCompleteTrackingCode("BD00000lk"), true);
    assert.equal(isCompleteTrackingCode("BD070817564LK"), true);
    assert.equal(isCompleteTrackingCode("NA055922175LK"), true);
    assert.equal(isCompleteTrackingCode("EE123456789US"), true);
    assert.equal(isCompleteTrackingCode("20000"), false);
    assert.equal(isCompleteTrackingCode("Taiwan"), false);
    assert.equal(isCompleteTrackingCode("BD070817564"), false);

    assert.deepEqual(detectTrackingQuery("BD00000lk"), ["BD00000LK"]);
    assert.deepEqual(detectTrackingQuery("BD00000lk, NA055922175LK"), ["BD00000LK", "NA055922175LK"]);
});

test("predictSearchCompletion shows inline bulk example code next to a complete tracking number (e.g. BD00000lk)", () => {
    const pred = predictSearchCompletion({
        draftText: "BD00000lk",
        committedCodes: [],
    });
    assert.equal(pred.isTrackingMode, true);
    assert.equal(pred.isBulkHint, true);
    assert.equal(pred.trackingCount, 1);
    assert.ok(pred.bulkExampleCode && !pred.bulkExampleCode.startsWith("BD"));
    assert.equal(pred.ghostSuffix, `, ${pred.bulkExampleCode}`);
    assert.ok(pred.bulkHintLabel?.includes("bulk"));
    assert.ok(pred.chips.some((c) => c.applyKind === "commit_bulk_slot"));
});

test("predictSearchCompletion predicts LK suffix for partial tracking numbers", () => {
    const partial = predictSearchCompletion({
        draftText: "BD070817564",
        committedCodes: [],
    });
    assert.equal(partial.isTrackingMode, true);
    assert.equal(partial.ghostSuffix, "LK");
    assert.equal(partial.ghostAcceptDraft, "BD070817564LK");

    const partialL = predictSearchCompletion({
        draftText: "BD070817564L",
        committedCodes: [],
    });
    assert.equal(partialL.ghostSuffix, "K");
    assert.equal(partialL.ghostAcceptDraft, "BD070817564LK");
});

test("extractTrackingTokensOnDelimiter commits codes on comma or space and ignores normal queries", () => {
    // Space after complete code commits chip
    const bySpace = extractTrackingTokensOnDelimiter("BD00000lk ", []);
    assert.equal(bySpace.didCommit, true);
    assert.deepEqual(bySpace.committed, ["BD00000LK"]);
    assert.equal(bySpace.remainingDraft, "");

    // Comma after second code commits second chip and deduplicates
    const byComma = extractTrackingTokensOnDelimiter("NA055922175LK,", bySpace.committed);
    assert.equal(byComma.didCommit, true);
    assert.deepEqual(byComma.committed, ["BD00000LK", "NA055922175LK"]);
    assert.equal(byComma.remainingDraft, "");

    // Duplicate is ignored cleanly
    const dup = extractTrackingTokensOnDelimiter("bd00000lk ", byComma.committed);
    assert.equal(dup.didCommit, true);
    assert.deepEqual(dup.committed, ["BD00000LK", "NA055922175LK"]);

    // Normal text with space ("Taiwan ") must NOT be tokenized
    const normal = extractTrackingTokensOnDelimiter("Taiwan ", []);
    assert.equal(normal.didCommit, false);
    assert.deepEqual(normal.committed, []);
    assert.equal(normal.remainingDraft, "Taiwan ");
});

test("splitPastedTrackingText extracts multi-line / comma / space tracking batches and ignores normal text", () => {
    const pasted = splitPastedTrackingText("BD00000lk, NA055922175LK\nBF009065544LK", []);
    assert.ok(pasted);
    assert.deepEqual(pasted.committed, ["BD00000LK", "NA055922175LK", "BF009065544LK"]);
    assert.equal(pasted.addedCount, 3);

    const normalPaste = splitPastedTrackingText("Taiwan 5kg", []);
    assert.equal(normalPaste, null);
});

test("predictSearchCompletion predicts next words for countries, COD, domestic weights, and post offices", () => {
    // Country + trailing space -> predicts weight + tappable weight chips
    const countrySpace = predictSearchCompletion({
        draftText: "Taiwan ",
        committedCodes: [],
    });
    assert.equal(countrySpace.isTrackingMode, false);
    assert.equal(countrySpace.ghostSuffix, "5kg");
    assert.equal(countrySpace.ghostAcceptDraft, "Taiwan 5kg");
    assert.ok(countrySpace.chips.some((c) => c.label === "5kg"));
    assert.ok(countrySpace.chips.some((c) => c.label === "250g"));

    // Country prefix -> inline completion
    const countryPrefix = predictSearchCompletion({
        draftText: "Taiw",
        committedCodes: [],
    });
    assert.equal(countryPrefix.ghostSuffix, "an");

    // COD next words
    const cod = predictSearchCompletion({
        draftText: "cod ",
        committedCodes: [],
    });
    assert.equal(cod.ghostSuffix, "5000 1kg");
    assert.ok(cod.chips.some((c) => c.label === "5000"));

    // Weight next words
    const weight = predictSearchCompletion({
        draftText: "500g ",
        committedCodes: [],
    });
    assert.equal(weight.ghostSuffix, "registered letter");
    assert.ok(weight.chips.some((c) => c.label === "parcel"));

    // Post office prefix completion from local index
    const office = predictSearchCompletion({
        draftText: "Nuw",
        committedCodes: [],
        officeSuggestions: [
            {
                label: "Nuwara Eliya (22200)",
                queryValue: "Nuwara Eliya",
                slug: "nuwara-eliya",
                postalCode: "22200",
                kind: "office",
            },
        ],
    });
    assert.equal(office.ghostSuffix, "ara Eliya");
    assert.equal(office.ghostAcceptDraft, "Nuwara Eliya");
    assert.equal(office.chips[0]?.meta, "22200");
});

test("buildCombinedSearchQuery & getNextBulkExampleCode keep bulk queries synchronized", () => {
    assert.equal(buildCombinedSearchQuery(["BD00000LK", "NA055922175LK"], ""), "BD00000LK, NA055922175LK");
    assert.equal(buildCombinedSearchQuery(["BD00000LK"], "BF009065544LK"), "BD00000LK, BF009065544LK");
    assert.notEqual(getNextBulkExampleCode(["NA055922175LK"]).slice(0, 2), "NA");
});
