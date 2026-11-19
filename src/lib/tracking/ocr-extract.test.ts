import test from "node:test";
import assert from "node:assert/strict";
import { extractPostalCodesFromOcr, tryParseOcrToken } from "./ocr-extract";

test("extractPostalCodesFromOcr extracts clean printed barcodes (BD, NA, BF, RA, BG)", () => {
    const text = `
        SRI LANKA POST - COD RECEIPT
        Barcode: BD070817564LK
        SLP Courier: NA055922175LK
        Ref: BF009065544LK
    `;
    const codes = extractPostalCodesFromOcr(text).map((c) => c.code);
    assert.deepEqual(codes, ["BD070817564LK", "NA055922175LK", "BF009065544LK"]);
});

test("extractPostalCodesFromOcr handles spaced and hyphenated printed/written codes", () => {
    const text = "Receipt No: NA 055 922 175 LK and BD - 070817564 - LK";
    const codes = extractPostalCodesFromOcr(text).map((c) => c.code);
    assert.deepEqual(codes, ["NA055922175LK", "BD070817564LK"]);
});

test("tryParseOcrToken corrects positional handwriting & OCR character confusions", () => {
    // 8D -> BD, O -> 0, I -> 1, S -> 5, 1K -> LK
    const corrected = tryParseOcrToken("8D07O8I7S641K");
    assert.ok(corrected);
    assert.equal(corrected.code, "BD070817564LK");
    assert.equal(corrected.wasCorrected, true);

    // N4 -> NA, O -> 0, l -> 1, |K -> LK
    const slpCorrected = tryParseOcrToken("N4O55922l75|K");
    assert.ok(slpCorrected);
    assert.equal(slpCorrected.code, "NA055922175LK");
    assert.equal(slpCorrected.wasCorrected, true);

    // B0 -> BD
    const b0Corrected = tryParseOcrToken("B0006749309LK");
    assert.ok(b0Corrected);
    assert.equal(b0Corrected.code, "BD006749309LK");
});

test("tryParseOcrToken recovers missing trailing LK when prefix is a known SL Post code", () => {
    const partial = tryParseOcrToken("BD070817564");
    assert.ok(partial);
    assert.equal(partial.code, "BD070817564LK");
    assert.equal(partial.wasCorrected, true);
});

test("extractPostalCodesFromOcr ignores ordinary English words and addresses", () => {
    const noise = "Nuwara Eliya Post Office 22200 Kandy Road Colombo Sri Lanka Telephone 0112326203";
    const codes = extractPostalCodesFromOcr(noise);
    assert.equal(codes.length, 0);
});
