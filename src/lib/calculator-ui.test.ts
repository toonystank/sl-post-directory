import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
    getCountryFlagEmoji,
    getLocalizedCountryName,
    getLocalizedZoneName,
    getServiceTagline,
    stepCodAmount,
    stepWeight,
} from "./calculator-ui";
import {
    DEFAULT_RATE_CONFIG,
    calculateAllInternationalServices,
    calculateCodPostage,
    calculatePostage,
} from "./postage-rates";
import {
    DEFAULT_CURRENCY,
    convertLkrToCurrency,
    formatCurrencyAmount,
    splitCurrencyPrice,
} from "./currency";

test("getCountryFlagEmoji converts ISO alpha-2 codes to regional indicator flags", () => {
    assert.equal(getCountryFlagEmoji("GB"), "🇬🇧");
    assert.equal(getCountryFlagEmoji("lk"), "🇱🇰");
    assert.equal(getCountryFlagEmoji("JP"), "🇯🇵");
    assert.equal(getCountryFlagEmoji(""), "🌐");
    assert.equal(getCountryFlagEmoji("INVALID"), "🌐");
});

test("getServiceTagline provides plain-language explanations in English, Sinhala, and Tamil", () => {
    const emsEn = getServiceTagline("ems", "en");
    assert.equal(emsEn.shortTag, "Express Courier");
    assert.ok(emsEn.cardHint.toLowerCase().includes("express"));

    const emsSi = getServiceTagline("ems", "si");
    assert.equal(emsSi.shortTag, "අධිවේගී කුරියර්");
    assert.ok(emsSi.name.includes("EMS"));

    const emsTa = getServiceTagline("ems", "ta");
    assert.equal(emsTa.shortTag, "விரைவு கூரியர்");
    assert.ok(emsTa.name.includes("EMS"));

    const tds = getServiceTagline("tds", "en");
    assert.equal(tds.shortTag, "Priority Tracked");
    assert.ok(tds.cardHint.toLowerCase().includes("tracked"));

    const uPacket = getServiceTagline("u_packet", "en");
    assert.equal(uPacket.shortTag, "Tracked Packet");
    assert.ok(uPacket.cardHint.toLowerCase().includes("tracked"));
});

test("getLocalizedCountryName and getLocalizedZoneName translate into Sinhala and Tamil", () => {
    assert.equal(getLocalizedCountryName("GB", "United Kingdom", "en"), "United Kingdom");
    assert.equal(getLocalizedCountryName("GB", "United Kingdom", "si"), "එක්සත් රාජධානිය");
    assert.equal(getLocalizedCountryName("GB", "United Kingdom", "ta"), "ஐக்கிய இராச்சியம்");

    const zoneCSi = getLocalizedZoneName("zone_c", "Zone C - Europe & UK", "si");
    assert.equal(zoneCSi.short, "කලාපය C");

    const zoneCTa = getLocalizedZoneName("zone_c", "Zone C - Europe & UK", "ta");
    assert.equal(zoneCTa.short, "வலயம் C");
});

test("messages/en.json, messages/si.json, and messages/ta.json have matching translation keys", () => {
    const root = process.cwd();
    const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf8"));
    const si = JSON.parse(fs.readFileSync(path.join(root, "messages/si.json"), "utf8"));
    const ta = JSON.parse(fs.readFileSync(path.join(root, "messages/ta.json"), "utf8"));

    assert.deepEqual(Object.keys(si).sort(), Object.keys(en).sort());
    assert.deepEqual(Object.keys(ta).sort(), Object.keys(en).sort());

    for (const ns of Object.keys(en)) {
        assert.deepEqual(
            Object.keys(si[ns]).sort(),
            Object.keys(en[ns]).sort(),
            `Sinhala namespace ${ns} keys must match English`
        );
        assert.deepEqual(
            Object.keys(ta[ns]).sort(),
            Object.keys(en[ns]).sort(),
            `Tamil namespace ${ns} keys must match English`
        );
    }
});

test("stepWeight increments and decrements smoothly across postal weight tiers", () => {
    assert.equal(stepWeight(20, "up"), 30);
    assert.equal(stepWeight(20, "down"), 10);
    assert.equal(stepWeight(10, "down"), 10);
    assert.equal(stepWeight(95, "up"), 100);
    assert.equal(stepWeight(100, "up"), 150);
    assert.equal(stepWeight(100, "down"), 90);
    assert.equal(stepWeight(500, "up"), 750);
    assert.equal(stepWeight(500, "down"), 450);
    assert.equal(stepWeight(2000, "up"), 2500);
    assert.equal(stepWeight(40000, "up"), 40000);
});

test("stepCodAmount increments and decrements cleanly within Rs. 100,000 limit", () => {
    assert.equal(stepCodAmount(2500, "up"), 3000);
    assert.equal(stepCodAmount(2500, "down"), 2000);
    assert.equal(stepCodAmount(500, "down"), 500);
    assert.equal(stepCodAmount(100000, "up"), 100000);
});

test("international and domestic calculations match official tariff values", () => {
    const gbQuotes = calculateAllInternationalServices(DEFAULT_RATE_CONFIG, "GB", 20);
    const emsGb = gbQuotes.find((q) => q.service.id === "ems");
    const tdsGb = gbQuotes.find((q) => q.service.id === "tds");
    const airLetterGb = gbQuotes.find((q) => q.service.id === "air_letter");

    assert.equal(emsGb?.result.totalCost, 7750);
    assert.equal(tdsGb?.result.totalCost, 1740);
    assert.equal(airLetterGb?.result.totalCost, 150);

    const domesticLetter = calculatePostage(DEFAULT_RATE_CONFIG, "domestic", "letter", 30);
    assert.equal(domesticLetter.totalCost, 70);

    const codQuote = calculateCodPostage(DEFAULT_RATE_CONFIG, 250, 2500);
    assert.equal(codQuote.courierFee, 200);
    assert.equal(codQuote.codServiceFee, 50);
    assert.equal(codQuote.totalCost, 300);
});

test("currency conversion defaults to LKR and formats LKR/USD prices with explicit symbols", () => {
    assert.equal(DEFAULT_CURRENCY, "LKR");
    assert.equal(convertLkrToCurrency(7750, "LKR", 333), 7750);
    assert.equal(convertLkrToCurrency(7750, "USD", 333), 23.27);

    assert.equal(formatCurrencyAmount(7750, "LKR", 333), "Rs. 7,750");
    assert.equal(formatCurrencyAmount(7750, "USD", 333), "$23.27");
    assert.equal(formatCurrencyAmount(60, "LKR", 333, { plus: true }), "+Rs. 60");
    assert.equal(formatCurrencyAmount(60, "USD", 333, { plus: true }), "+$0.18");

    assert.deepEqual(splitCurrencyPrice(150, "LKR", 333), { symbol: "Rs.", value: "150", code: "LKR" });
    assert.deepEqual(splitCurrencyPrice(150, "USD", 333), { symbol: "$", value: "0.45", code: "USD" });
});
