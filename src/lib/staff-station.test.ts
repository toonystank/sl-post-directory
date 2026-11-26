import test from "node:test";
import assert from "node:assert/strict";
import {
    buildRoutingHref,
    parseSingleSidedRouteQuery,
    parseStaffStation,
    serializeStaffStation,
    type StaffStation,
} from "./staff-station";

test("parseStaffStation and serializeStaffStation round-trip and preserve leading-zero postcodes", () => {
    const station: StaffStation = {
        id: "cme-1",
        slug: "colombo-gpo-00100",
        name: "Colombo G. P. O.",
        postalCode: "100",
        shortCode: "GPO",
        division: "Colombo",
        type: "Post Office",
        rmsc: "Colombo CME",
        controllingOfficeId: null,
        delivery: "Yes",
    };

    const serialized = serializeStaffStation(station);
    const parsed = parseStaffStation(serialized);
    assert.ok(parsed);
    assert.equal(parsed.id, "cme-1");
    assert.equal(parsed.slug, "colombo-gpo-00100");
    assert.equal(parsed.name, "Colombo G. P. O.");
    assert.equal(parsed.postalCode, "00100");
    assert.equal(parsed.shortCode, "GPO");
    assert.equal(parsed.controllingOfficeId, null);

    assert.equal(parseStaffStation(null), null);
    assert.equal(parseStaffStation("not-json{"), null);
    assert.equal(parseStaffStation(JSON.stringify({ id: "1", slug: "", name: "Test" })), null);
});

test("buildRoutingHref includes from=station only when station differs from destination", () => {
    const kandy: StaffStation = {
        id: "k1",
        slug: "kandy-20000",
        name: "Kandy",
        postalCode: "20000",
    };

    assert.equal(buildRoutingHref("jaffna-40000", null), "/routing?to=jaffna-40000");
    assert.equal(
        buildRoutingHref("jaffna-40000", kandy),
        "/routing?from=kandy-20000&to=jaffna-40000"
    );
    assert.equal(buildRoutingHref("kandy-20000", kandy), "/routing?to=kandy-20000");
});

test("parseSingleSidedRouteQuery extracts destination tokens for staff 'to ...' queries", () => {
    assert.equal(parseSingleSidedRouteQuery("to jafna"), "jafna");
    assert.equal(parseSingleSidedRouteQuery("-> 40000"), "40000");
    assert.equal(parseSingleSidedRouteQuery("→ matara."), "matara");
    assert.equal(parseSingleSidedRouteQuery("jaffna"), null);
    assert.equal(parseSingleSidedRouteQuery("kandy to jafna"), null);
    assert.equal(parseSingleSidedRouteQuery("to a"), null);
    assert.equal(parseSingleSidedRouteQuery("-> a to b"), null);
});
