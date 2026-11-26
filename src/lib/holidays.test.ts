import test from "node:test";
import assert from "node:assert/strict";
import { getColomboTimeParts, getPostOfficeStatus, parseOperatingHours } from "./holidays";

test("getColomboTimeParts converts UTC timestamps strictly to Asia/Colombo (+05:30)", () => {
    // 2026-11-26 04:00:00 UTC = 2026-11-26 09:30:00 AM Asia/Colombo (Thursday)
    const utcMorning = new Date("2026-11-26T04:00:00Z");
    const colombo = getColomboTimeParts(utcMorning);
    assert.equal(colombo.todayKey, "11-26");
    assert.equal(colombo.hour, 9);
    assert.equal(colombo.minute, 30);
    assert.equal(colombo.dayOfWeek, 4); // Thursday
});

test("parseOperatingHours handles 24h, extended hours, and standard schedules", () => {
    const extended = parseOperatingHours("Mon–Sat 7:00 AM – 9:00 PM", false);
    assert.equal(extended.is24Hour, false);
    assert.equal(extended.weekday?.open24h, "07:00");
    assert.equal(extended.weekday?.close24h, "21:00");
    assert.equal(extended.saturday?.close24h, "21:00");
    assert.equal(extended.saturdayCounterOnly, false);

    const cme = parseOperatingHours("Mon–Fri 8:00 AM – 9:00 PM · Sat–Sun 8:00 AM – 4:00 PM", false);
    assert.equal(cme.weekday?.close24h, "21:00");
    assert.equal(cme.sunday?.open24h, "08:00");
    assert.equal(cme.sunday?.close24h, "16:00");

    const spo = parseOperatingHours(null, false, "Sub Post Office");
    assert.equal(spo.weekday?.open24h, "08:30");
    assert.equal(spo.weekday?.close24h, "16:00");
    assert.equal(spo.saturday?.close24h, "12:30");
    assert.equal(spo.saturdayCounterOnly, true);
});

test("getPostOfficeStatus evaluates open, closed, counter-only, and holiday accurately in Colombo time", () => {
    // Thursday 2026-11-26 19:30 Colombo = 14:00 UTC
    const colomboEvening = new Date("2026-11-26T14:00:00Z");
    assert.equal(
        getPostOfficeStatus("en", false, "Mon–Fri 8:30 AM – 4:30 PM · Sat 8:30 AM – 1:00 PM", colomboEvening).status,
        "closed"
    );
    assert.equal(
        getPostOfficeStatus("en", false, "Mon–Sat 7:00 AM – 9:00 PM", colomboEvening).status,
        "open"
    );

    // Saturday 2026-11-28 10:00 Colombo = 04:30 UTC
    const colomboSatMorning = new Date("2026-11-28T04:30:00Z");
    assert.equal(
        getPostOfficeStatus("en", false, "Mon–Fri 8:30 AM – 4:30 PM · Sat 8:30 AM – 1:00 PM", colomboSatMorning).status,
        "counter-only"
    );

    // Christmas Day 2026-12-25 10:00 Colombo = 04:30 UTC
    const xmas = new Date("2026-12-25T04:30:00Z");
    assert.equal(getPostOfficeStatus("en", true, "Open 24 Hours", xmas).status, "holiday");
});
