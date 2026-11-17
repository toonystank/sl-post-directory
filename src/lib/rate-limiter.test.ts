import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySlidingWindow, getClientIp, rateLimitHeaders } from "./rate-limiter";

test("InMemorySlidingWindow enforces limit, blocks overflow, and resets after windowMs", () => {
    const limiter = new InMemorySlidingWindow(100);
    const t0 = 1_700_000_000_000;

    const r1 = limiter.limit("rl:test:1.2.3.4", 2, 60_000, t0);
    assert.equal(r1.isRateLimited, false);
    assert.equal(r1.remaining, 1);

    const r2 = limiter.limit("rl:test:1.2.3.4", 2, 60_000, t0 + 1000);
    assert.equal(r2.isRateLimited, false);
    assert.equal(r2.remaining, 0);

    const r3 = limiter.limit("rl:test:1.2.3.4", 2, 60_000, t0 + 2000);
    assert.equal(r3.isRateLimited, true);
    assert.equal(r3.remaining, 0);

    // After sliding window expires from t0, next request succeeds
    const r4 = limiter.limit("rl:test:1.2.3.4", 2, 60_000, t0 + 60_001);
    assert.equal(r4.isRateLimited, false);
    assert.equal(r4.remaining, 0);
});

test("InMemorySlidingWindow bounds bucket map size via oldest-bucket eviction", () => {
    const limiter = new InMemorySlidingWindow(3);
    const t0 = 1_700_000_000_000;

    limiter.limit("k1", 5, 60_000, t0);
    limiter.limit("k2", 5, 60_000, t0 + 1);
    limiter.limit("k3", 5, 60_000, t0 + 2);
    assert.equal(limiter.size, 3);

    limiter.limit("k4", 5, 60_000, t0 + 3);
    assert.equal(limiter.size, 3);
});

test("getClientIp prefers Vercel/Cloudflare proxy headers cleanly", () => {
    const reqVercel = new Request("https://example.com", {
        headers: {
            "x-vercel-forwarded-for": "203.0.113.9, 10.0.0.1",
            "x-forwarded-for": "198.51.100.2",
        },
    });
    assert.equal(getClientIp(reqVercel), "203.0.113.9");

    const reqCf = new Request("https://example.com", {
        headers: {
            "cf-connecting-ip": "198.51.100.42",
        },
    });
    assert.equal(getClientIp(reqCf), "198.51.100.42");

    const reqFallback = new Request("https://example.com");
    assert.equal(getClientIp(reqFallback), "unknown");
});

test("rateLimitHeaders includes Retry-After only when rate-limited", () => {
    const allowedHeaders = rateLimitHeaders({
        isRateLimited: false,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 30_000,
    });
    assert.equal(allowedHeaders["X-RateLimit-Limit"], "10");
    assert.equal(allowedHeaders["X-RateLimit-Remaining"], "9");
    assert.equal(allowedHeaders["Retry-After"], undefined);

    const blockedHeaders = rateLimitHeaders({
        isRateLimited: true,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 15_000,
    });
    assert.equal(blockedHeaders["X-RateLimit-Remaining"], "0");
    assert.ok(Number(blockedHeaders["Retry-After"]) >= 1);
});
