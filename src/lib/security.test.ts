import test from "node:test";
import assert from "node:assert/strict";
import { clampPagination, escapeHtml, isSafePublicImageUrl } from "./security";

test("isSafePublicImageUrl accepts public HTTPS asset URLs and rejects XSS/SSRF inputs", () => {
    assert.equal(isSafePublicImageUrl("https://ucarecdn.com/8f4c1a2e-9b2d-4c4b-9e6d-1234567890ab/photo.jpg"), true);
    assert.equal(isSafePublicImageUrl("https://images.unsplash.com/photo-123?w=800"), true);

    assert.equal(isSafePublicImageUrl("http://ucarecdn.com/photo.jpg"), false);
    assert.equal(isSafePublicImageUrl("javascript:alert(1)"), false);
    assert.equal(isSafePublicImageUrl("data:image/svg+xml,<svg onload=alert(1)>"), false);
    assert.equal(isSafePublicImageUrl("file:///etc/passwd"), false);
    assert.equal(isSafePublicImageUrl("https://localhost/admin.png"), false);
    assert.equal(isSafePublicImageUrl("https://127.0.0.1/secret.png"), false);
    assert.equal(isSafePublicImageUrl("https://169.254.169.254/latest/meta-data/"), false);
    assert.equal(isSafePublicImageUrl("https://192.168.1.10/router.png"), false);
    assert.equal(isSafePublicImageUrl("https://10.0.0.5/internal.png"), false);
    assert.equal(isSafePublicImageUrl("https://172.16.0.1/vpc.png"), false);
    assert.equal(isSafePublicImageUrl("https://service.internal/img.png"), false);
    assert.equal(isSafePublicImageUrl("not-a-url"), false);
    assert.equal(isSafePublicImageUrl(""), false);
});

test("escapeHtml encodes dangerous HTML characters", () => {
    assert.equal(
        escapeHtml(`<script>alert("xss" & 'test')</script>`),
        "&lt;script&gt;alert(&quot;xss&quot; &amp; &#039;test&#039;)&lt;/script&gt;"
    );
});

test("clampPagination bounds negative, non-numeric, and oversized parameters", () => {
    assert.deepEqual(clampPagination(undefined, undefined), { cursor: 0, limit: 12 });
    assert.deepEqual(clampPagination("-5", "500"), { cursor: 0, limit: 100 });
    assert.deepEqual(clampPagination("abc", "0"), { cursor: 0, limit: 1 });
    assert.deepEqual(clampPagination("25", "24"), { cursor: 25, limit: 24 });
    assert.deepEqual(clampPagination("9999999", "50"), { cursor: 100_000, limit: 50 });
});
