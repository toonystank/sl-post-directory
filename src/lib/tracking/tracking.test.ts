import test from "node:test";
import assert from "node:assert/strict";
import {
    classifyBarcode,
    detectTrackingQuery,
    parseBarcodes,
} from "./classifier";
import {
    classifyCodStatus,
    parseCodDetailsHtml,
    parseCodSummaryHtml,
    parseSlpHtml,
} from "./parsers";
import { normalizeCodTrackingResult } from "./status";
import {
    signUpstreamSessionCookie,
    verifyUpstreamSessionCookie,
} from "./session-token";
import { parseSmartSearchIntent } from "../smart-search";

test("parseBarcodes handles single, comma/space-separated, lowercase, and deduplication", () => {
    const parsed = parseBarcodes("na055922175lk, BF009065544LK BD070817564LK na055922175lk");
    assert.deepEqual(parsed, ["NA055922175LK", "BF009065544LK", "BD070817564LK"]);
});

test("classifyBarcode routes BD, NA/BF, RA/BG, and foreign suffixes accurately", () => {
    assert.equal(classifyBarcode("BD070817564LK"), "cod_only");
    assert.equal(classifyBarcode("BD006749309LK"), "cod_only");
    assert.equal(classifyBarcode("NA055922175LK"), "slp_likely");
    assert.equal(classifyBarcode("BF009065544LK"), "slp_likely");
    assert.equal(classifyBarcode("RA083556964LK"), "cod_then_slp");
    assert.equal(classifyBarcode("BG123456789LK"), "cod_then_slp");
    assert.equal(classifyBarcode("EE123456789US"), "international");
});

test("detectTrackingQuery and parseSmartSearchIntent detect barcodes without colliding with postal codes or countries", () => {
    assert.deepEqual(detectTrackingQuery("BD070817564LK"), ["BD070817564LK"]);
    assert.deepEqual(detectTrackingQuery("track na055922175lk"), ["NA055922175LK"]);
    assert.deepEqual(detectTrackingQuery("20000"), []);
    assert.deepEqual(detectTrackingQuery("Kandy"), []);
    assert.deepEqual(detectTrackingQuery("taiwan 5kg"), []);

    const bdIntent = parseSmartSearchIntent("BD070817564LK");
    assert.ok(bdIntent);
    assert.equal(bdIntent.kind, "tracking");
    assert.equal(bdIntent.primaryBarcode, "BD070817564LK");
    assert.equal(bdIntent.classification, "cod_only");
    assert.equal(bdIntent.trackHref, "/track/BD070817564LK");

    const multiIntent = parseSmartSearchIntent("NA055922175LK, BF009065544LK");
    assert.ok(multiIntent);
    assert.equal(multiIntent.kind, "tracking");
    assert.equal(multiIntent.barcodes.length, 2);
    assert.equal(multiIntent.trackHref, "/track?q=NA055922175LK%2CBF009065544LK");
});

test("parseCodSummaryHtml parses found and not-found rows from New_serch_barcode.php", () => {
    const html = `
    <table class='result-table'>
      <tr><th>Barcode</th><th>Status</th><th>View Details</th></tr>
      <tr>
        <td>BD070817564LK</td>
        <td><span class='status-settled'>Settled</span></td>
        <td>
          <form method='post'>
            <input type='hidden' name='csrf_token' value='tok123'>
            <input type='hidden' name='details_barcode' value='BD070817564LK'>
            <button type='submit'>Details</button>
          </form>
        </td>
      </tr>
      <tr><td>NA055922175LK</td><td colspan='2'>Error: No record found for barcode: NA055922175LK</td></tr>
    </table>`;

    const summary = parseCodSummaryHtml(html);
    assert.equal(summary.rateLimited, false);
    assert.equal(summary.rows.length, 2);
    assert.equal(summary.rows[0].barcode, "BD070817564LK");
    assert.equal(summary.rows[0].found, true);
    assert.equal(summary.rows[0].statusText, "Settled");
    assert.equal(summary.rows[0].detailsCsrfToken, "tok123");
    assert.equal(summary.rows[1].barcode, "NA055922175LK");
    assert.equal(summary.rows[1].found, false);
});

test("parseCodDetailsHtml parses live settled COD detail table", () => {
    const html = `
    <h2 style='text-align:center;'>Details for: BD070817564LK</h2>
    <table class='result-table'>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>Barcode</td><td>BD070817564LK</td></tr>
      <tr><td>Status</td><td><span class='status-settled'>Settled</span></td></tr>
      <tr><td>AcceptingPO</td><td>PO Badulla</td></tr>
      <tr><td>DateAccepted</td><td>2026-11-09 16:51:26</td></tr>
      <tr><td>DeliveryPO</td><td>PO Kandy</td></tr>
      <tr><td>ReceivedDate</td><td>2026-11-11 14:32:37</td></tr>
      <tr><td>POSettled</td><td>PO Badulla</td></tr>
      <tr><td>SettledDate</td><td>2026-11-13 14:20:34</td></tr>
    </table>`;

    const res = parseCodDetailsHtml(html, "BD070817564LK");
    assert.ok(res);
    assert.equal(res.service, "cod");
    assert.equal(res.barcode, "BD070817564LK");
    assert.equal(res.statusCategory, "settled");
    assert.equal(res.acceptingOffice, "Badulla Post Office");
    assert.equal(res.acceptingOfficeQuery, "Badulla");
    assert.equal(res.deliveryOffice, "Kandy Post Office");
    assert.equal(res.deliveryOfficeQuery, "Kandy");
    assert.equal(res.settledDate, "2026-11-13 14:20:34");
    assert.equal(res.steps[3].label, "Settled");
    assert.equal(res.steps[3].state, "completed");
});

test("parseCodDetailsHtml and classifyCodStatus never mark PENDING DELIVERY or undelivered items as delivered", () => {
    const pendingDeliveryHtml = `
    <table class='result-table'>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>Barcode</td><td>BD003579778LK</td></tr>
      <tr><td>Status</td><td>PENDING DELIVERY</td></tr>
      <tr><td>AcceptingPO</td><td>PO Kotagala</td></tr>
      <tr><td>DateAccepted</td><td>2026-11-19 10:12:00</td></tr>
      <tr><td>DeliveryPO</td><td>PO Kandy</td></tr>
      <tr><td>ReceivedDate</td><td>2026-11-20 04:14:00</td></tr>
    </table>`;

    const res = parseCodDetailsHtml(pendingDeliveryHtml, "BD003579778LK");
    assert.ok(res);
    assert.equal(res.statusLabel, "PENDING DELIVERY");
    assert.equal(res.statusCategory, "arrived");
    assert.equal(res.steps[0].state, "completed"); // Accepted
    assert.equal(res.steps[1].state, "completed"); // In Transit
    assert.equal(res.steps[2].state, "active");    // Arrived (awaiting delivery)
    assert.equal(res.steps[3].label, "Delivered");
    assert.equal(res.steps[3].state, "upcoming");  // NOT delivered yet!
    assert.ok(res.deliveryEstimate);

    // Exhaustive status string checks
    assert.equal(classifyCodStatus("PENDING DELIVERY", true), "arrived");
    assert.equal(classifyCodStatus("PENDING DELIVERY", false), "pending");
    assert.equal(classifyCodStatus("Awaiting Delivery", true), "arrived");
    assert.equal(classifyCodStatus("Ready for Delivery", true), "arrived");
    assert.equal(classifyCodStatus("Out for Delivery", true), "out_for_delivery");
    assert.equal(classifyCodStatus("Undelivered", true), "returned");
    assert.equal(classifyCodStatus("Not Delivered", true), "returned");
    assert.equal(classifyCodStatus("Delivery Failed", true), "returned");
    assert.equal(classifyCodStatus("Returned to Sender", true), "returned");
    assert.equal(classifyCodStatus("Delivered", true), "delivered");
    assert.equal(classifyCodStatus("Item Delivered", true), "delivered");
    assert.equal(classifyCodStatus("Settled", true), "settled");

    // Stale localStorage history self-healing
    const staleCached = {
        ...res,
        statusCategory: "delivered" as const,
        steps: res.steps.map((s) => ({ ...s, state: "completed" as const })),
    };
    const healed = normalizeCodTrackingResult(staleCached);
    assert.equal(healed.statusCategory, "arrived");
    assert.equal(healed.steps[2].state, "active");
    assert.equal(healed.steps[3].state, "upcoming");
});

test("parseSlpHtml parses 5-column SLP Courier tracking table", () => {
    const html = `
    <table>
      <tr><td>ID</td><td>Identification No:</td><td>Event</td><td>Data/Time</td><td>Location</td></tr>
      <tr><td>1</td><td>NA055922175LK</td><td>Receive item from customer</td><td>2026-11-14 13:09:59</td><td>Malambe (CO)</td></tr>
      <tr><td>2</td><td>NA055922175LK</td><td>Send Item To Delivery Office</td><td>2026-11-14 14:08:28</td><td>Malambe (CO)</td></tr>
      <tr><td>3</td><td>NA055922175LK</td><td>Receive item at delivery office</td><td>2026-11-16 03:36:26</td><td>Kandy (KY)</td></tr>
      <tr><td>4</td><td>NA055922175LK</td><td>Handed over to post man</td><td>2026-11-16 07:36:57</td><td>Kandy (KY)</td></tr>
      <tr><td>5</td><td>NA055922175LK</td><td>Item Delivered</td><td>2026-11-16 16:26:00</td><td>Kandy (KY)</td></tr>
    </table>`;

    const parsed = parseSlpHtml(html, "NA055922175LK");
    assert.equal(parsed.status, "ok");
    assert.ok(parsed.result);
    assert.equal(parsed.result.service, "slp");
    assert.equal(parsed.result.statusCategory, "delivered");
    assert.equal(parsed.result.statusLabel, "Delivered");
    assert.equal(parsed.result.events.length, 5);
    assert.equal(parsed.result.acceptingOffice, "Malambe (CO)");
    assert.equal(parsed.result.acceptingOfficeQuery, "Malambe");
    assert.equal(parsed.result.deliveryOffice, "Kandy (KY)");
    assert.equal(parsed.result.deliveryOfficeQuery, "Kandy");
    assert.equal(parsed.result.steps.length, 5);
    assert.equal(parsed.result.steps[4].state, "completed");
});

test("parseSlpHtml detects invalid CAPTCHA and no record found", () => {
    const invalidRes = parseSlpHtml("<body><div class='error'>Invalid Code</div></body>", "NA055922175LK");
    assert.equal(invalidRes.status, "invalid_captcha");

    const notFoundRes = parseSlpHtml("<body><p>No Record Found</p></body>", "NA055922175LK");
    assert.equal(notFoundRes.status, "not_found");
});

test("signUpstreamSessionCookie and verifyUpstreamSessionCookie round-trip and reject tampering", () => {
    const token = signUpstreamSessionCookie("PHPSESSID=e56iqdgimeleg5p4ahhe2rmj5c; path=/");
    assert.ok(token);
    assert.equal(verifyUpstreamSessionCookie(token), "PHPSESSID=e56iqdgimeleg5p4ahhe2rmj5c");
    assert.equal(verifyUpstreamSessionCookie(`${token}tampered`), null);
    assert.equal(signUpstreamSessionCookie("EVIL=12345"), null);
});
