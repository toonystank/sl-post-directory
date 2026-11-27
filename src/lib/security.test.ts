import test from "node:test";
import assert from "node:assert/strict";
import {
    clampPagination,
    escapeHtml,
    escapeSqlLike,
    extractUploadcareUuid,
    isSafeExternalHttpUrl,
    isSafePublicImageUrl,
    isUploadcareImageUrl,
    normalizeUploadcareImageUrl,
    safeJsonLd,
} from "./security";
import { sanitizeRichHtml } from "./sanitize-html";
import { blogPostInputSchema } from "./validations";

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
    assert.equal(isSafePublicImageUrl("https://[::1]/secret.png"), false);
    assert.equal(isSafePublicImageUrl("https://[::ffff:127.0.0.1]/secret.png"), false);
    assert.equal(isSafePublicImageUrl("https://[::ffff:169.254.169.254]/latest/meta-data/"), false);
    assert.equal(isSafePublicImageUrl("https://[fe80::1]/link-local.png"), false);
    assert.equal(isSafePublicImageUrl("https://[fc00::1]/ula.png"), false);
    assert.equal(isSafePublicImageUrl("https://100.64.0.1/cgnat.png"), false);
    assert.equal(isSafePublicImageUrl("https://user:pass@ucarecdn.com/img.png"), false);
    assert.equal(isSafePublicImageUrl("https://sub.localhost/img.png"), false);
    assert.equal(isSafePublicImageUrl("not-a-url"), false);
    assert.equal(isSafePublicImageUrl(""), false);

    assert.equal(isSafeExternalHttpUrl("https://slpost.gov.lk/circular"), true);
    assert.equal(isSafeExternalHttpUrl("https://[::1]/admin"), false);
    assert.equal(isSafeExternalHttpUrl("javascript:alert(1)"), false);
    assert.equal(extractUploadcareUuid("https://3q5fhu0dw8.ucarecd.net/8f4c1a2e-9b2d-4c4b-9e6d-1234567890ab/"), "8f4c1a2e-9b2d-4c4b-9e6d-1234567890ab");
    assert.equal(extractUploadcareUuid("https://ucarecdn.com/8f4c1a2e-9b2d-4c4b-9e6d-1234567890ab/../../etc"), null);
    assert.equal(escapeSqlLike("100%_\\admin"), "100\\%\\_\\\\admin");
});

test("isUploadcareImageUrl strictly validates Uploadcare UUID URLs and normalizes trailing slashes", () => {
    const uuid = "8f4c1a2e-9b2d-4c4b-9e6d-1234567890ab";
    assert.equal(isUploadcareImageUrl(`https://ucarecdn.com/${uuid}/`), true);
    assert.equal(isUploadcareImageUrl(`https://3q5fhu0dw8.ucarecd.net/${uuid}`), true);
    assert.equal(
        normalizeUploadcareImageUrl(`https://3q5fhu0dw8.ucarecd.net/${uuid}`),
        `https://3q5fhu0dw8.ucarecd.net/${uuid}/`
    );

    // Rejects arbitrary external domains that would crash next/image
    assert.equal(isUploadcareImageUrl("https://images.unsplash.com/photo-123"), false);
    assert.equal(isUploadcareImageUrl("https://ucarecdn.com/not-a-uuid/"), false);
    assert.equal(isUploadcareImageUrl(`https://ucarecdn.com/${uuid}/?evil=1`), false);
});

test("sanitizeRichHtml strips scripts, event handlers, and javascript: URLs while preserving rich formatting", () => {
    const dirty = `
        <h2>Postal Guide</h2>
        <p onclick="alert(1)" style="background:url(javascript:alert(1))">Send <strong>registered</strong> mail.</p>
        <script>fetch('/api/admin/backup')</script>
        <svg onload="alert(2)"><circle /></svg>
        <a href="javascript:alert(3)">Bad Link</a>
        <a href="https://slpost.gov.lk" target="_blank">Official Site</a>
        <img src="data:image/svg+xml,<svg onload=alert(1)>" alt="bad" />
        <img src="https://ucarecdn.com/8f4c1a2e-9b2d-4c4b-9e6d-1234567890ab/" alt="good" onerror="alert(4)" />
    `;
    const clean = sanitizeRichHtml(dirty);
    assert.equal(clean.includes("<script"), false);
    assert.equal(clean.includes("<svg"), false);
    assert.equal(clean.includes("onclick"), false);
    assert.equal(clean.includes("onerror"), false);
    assert.equal(clean.includes("javascript:"), false);
    assert.equal(clean.includes("data:image"), false);
    assert.equal(clean.includes("<strong>registered</strong>"), true);
    assert.equal(clean.includes('rel="noopener noreferrer"'), true);
    assert.equal(clean.includes('alt="good"'), true);
});

test("safeJsonLd escapes closing script tags and HTML angle brackets", () => {
    const payload = { name: `</script><script>alert("xss")</script>` };
    const serialized = safeJsonLd(payload);
    assert.equal(serialized.includes("</script>"), false);
    assert.deepEqual(JSON.parse(serialized), payload);
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

test("sanitizeRichHtml preserves News Studio figures, Uploadcare preview images, and alert callouts while stripping unsafe payloads", () => {
    const html = `
        <div class="callout-alert" data-callout="alert"><p><strong>Service Advisory:</strong> Counter closes early.</p></div>
        <figure data-figure="true">
            <img src="https://3q5fhu0dw8.ucarecd.net/8f4c1a2e-9b2d-4c4b-9e6d-1234567890ab/-/preview/1000x800/-/quality/smart/" alt="Counter" onerror="alert(1)" />
            <figcaption onclick="alert(2)">Colombo GPO</figcaption>
        </figure>
        <script>alert('xss')</script>
    `;
    const clean = sanitizeRichHtml(html);
    assert.equal(clean.includes('class="callout-alert"'), true);
    assert.equal(clean.includes('data-callout="alert"'), true);
    assert.equal(clean.includes('data-figure="true"'), true);
    assert.equal(clean.includes("<figcaption>Colombo GPO</figcaption>"), true);
    assert.equal(clean.includes("3q5fhu0dw8.ucarecd.net/8f4c1a2e-9b2d-4c4b-9e6d-1234567890ab"), true);
    assert.equal(clean.includes("<script"), false);
    assert.equal(clean.includes("onerror"), false);
    assert.equal(clean.includes("onclick"), false);
});

test("blogPostInputSchema validates categories, normalizes Uploadcare coverImage, and rejects unsafe URLs", () => {
    const uuid = "8f4c1a2e-9b2d-4c4b-9e6d-1234567890ab";
    const valid = blogPostInputSchema.safeParse({
        title: "2026 Tariff Circular",
        slug: "2026-tariff-circular",
        excerpt: "Official rate notice.",
        contentHtml: "<p>Rates updated.</p>",
        category: "ALERT",
        coverImage: `https://3q5fhu0dw8.ucarecd.net/${uuid}`,
        featured: true,
        sourceUrl: "https://slpost.gov.lk/circular",
    });
    assert.equal(valid.success, true);
    if (valid.success) {
        assert.equal(valid.data.category, "ALERT");
        assert.equal(valid.data.coverImage, `https://3q5fhu0dw8.ucarecd.net/${uuid}/`);
    }

    const badCover = blogPostInputSchema.safeParse({
        title: "Bad Cover Post",
        slug: "bad-cover-post",
        contentHtml: "<p>Test</p>",
        category: "NEWS",
        coverImage: "https://evil.example.com/photo.jpg",
    });
    assert.equal(badCover.success, false);

    const badSource = blogPostInputSchema.safeParse({
        title: "Bad Source Post",
        slug: "bad-source-post",
        contentHtml: "<p>Test</p>",
        category: "TARIFF",
        sourceUrl: "javascript:alert(1)",
    });
    assert.equal(badSource.success, false);
});
