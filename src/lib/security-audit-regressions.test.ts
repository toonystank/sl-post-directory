import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { verifySameOrigin } from "./csrf";
import {
    computePasswordVersion,
    consumeBackupCodeAtomically,
    decryptTotpSecret,
    encryptTotpSecret,
    generateRecoveryCodes,
    isEncryptedTotpSecret,
    matchRecoveryCode,
} from "./two-factor-crypto";
import { sanitizeRichHtml } from "./sanitize-html";
import { replacePlaceholders } from "./variables";
import { extractValidatedDynamicFields, siteVariableSchema } from "./validations";
import { safeJsonLd } from "./security";
import {
    createUploadcareSignature,
    signUploadTicket,
    verifyUploadTicket,
} from "./uploadcare";
import {
    consumeUpstreamSessionCookie,
    signUpstreamSessionCookie,
} from "./tracking/session-token";
import { validateOcrImageMagicBytes } from "@/app/api/ocr/extract/route";

test("2FA TOTP secrets encrypt with AES-256-GCM, reject tampering, and support legacy plaintext", () => {
    const master = "unit-test-master-secret-32-chars-min";
    const plain = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptTotpSecret(plain, master);

    assert.equal(isEncryptedTotpSecret(encrypted), true);
    assert.notEqual(encrypted, plain);
    assert.equal(decryptTotpSecret(encrypted, master), plain);

    // Tampered ciphertext/tag must fail GCM authentication
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("AA") ? "BB" : "AA");
    assert.throws(() => decryptTotpSecret(tampered, master));

    // Legacy plaintext Base32 continues to work during rolling migration
    assert.equal(isEncryptedTotpSecret(plain), false);
    assert.equal(decryptTotpSecret(plain, master), plain);
});

test("2FA recovery codes are 64-bit high-entropy, stored as salted scrypt hashes, and consumed atomically", async () => {
    const { plaintextCodes, hashedCodes } = generateRecoveryCodes(10);
    assert.equal(plaintextCodes.length, 10);
    assert.equal(hashedCodes.length, 10);

    for (let i = 0; i < plaintextCodes.length; i++) {
        assert.match(plaintextCodes[i], /^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/);
        assert.equal(hashedCodes[i].startsWith("scrypt:v1:"), true);
        assert.equal(hashedCodes[i].includes(plaintextCodes[i].replace(/-/g, "")), false);
    }

    // Matches formatted or hyphenless candidate
    const targetCode = plaintextCodes[3];
    const matched = matchRecoveryCode(hashedCodes, targetCode.replace(/-/g, "").toUpperCase());
    assert.equal(matched, hashedCodes[3]);
    assert.equal(matchRecoveryCode(hashedCodes, "0000-0000-0000-0000"), undefined);

    // Legacy plaintext backup codes remain supported
    assert.equal(matchRecoveryCode(["a1b2c3d4"], "a1b2c3d4"), "a1b2c3d4");

    // Atomic CAS simulation: two concurrent login requests trying the SAME backup code
    let storedCodes = [...hashedCodes];
    const atomicCasUpdate = async (_userId: string, entry: string): Promise<number> => {
        if (!storedCodes.includes(entry)) return 0;
        storedCodes = storedCodes.filter((c) => c !== entry);
        return 1;
    };

    const [firstAttempt, secondAttempt] = await Promise.all([
        consumeBackupCodeAtomically("user-1", matched!, atomicCasUpdate),
        consumeBackupCodeAtomically("user-1", matched!, atomicCasUpdate),
    ]);
    assert.equal(Number(firstAttempt) + Number(secondAttempt), 1);
    assert.equal(storedCodes.length, 9);
});

test("computePasswordVersion rotates immediately when password hash changes", () => {
    const v1 = computePasswordVersion("$2b$10$hashVersionOneAAAAAAAAAAAAAAAAAAAA");
    const v2 = computePasswordVersion("$2b$10$hashVersionTwoBBBBBBBBBBBBBBBBBBBB");
    assert.notEqual(v1, v2);
    assert.equal(v1.length, 16);
});

test("verifySameOrigin blocks cross-site/null origins and allows same-origin & Capacitor origins", () => {
    const allowedReq = new Request("https://lankapost.vercel.app/api/admin/users", {
        method: "POST",
        headers: {
            origin: "https://lankapost.vercel.app",
            "sec-fetch-site": "same-origin",
        },
    });
    assert.equal(verifySameOrigin(allowedReq, {}).ok, true);

    const crossOriginReq = new Request("https://lankapost.vercel.app/api/admin/users", {
        method: "POST",
        headers: {
            origin: "https://attacker.example",
            "sec-fetch-site": "cross-site",
        },
    });
    assert.equal(verifySameOrigin(crossOriginReq, {}).ok, false);

    const nullOriginReq = new Request("https://lankapost.vercel.app/api/admin/users", {
        method: "POST",
        headers: { origin: "null" },
    });
    assert.equal(verifySameOrigin(nullOriginReq, {}).ok, false);

    const crossSiteNoOriginReq = new Request("https://lankapost.vercel.app/api/ocr/extract", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
    });
    assert.equal(verifySameOrigin(crossSiteNoOriginReq, {}).ok, false);

    const capacitorReq = new Request("https://lankapost.vercel.app/api/ocr/extract", {
        method: "POST",
        headers: { origin: "capacitor://localhost" },
    });
    assert.equal(verifySameOrigin(capacitorReq, {}).ok, true);
});

test("XSS, DOM clobbering, and prototype-pollution guards block injection vectors", () => {
    const polluted = replacePlaceholders(
        "Hello {{cfg.__proto__}} {{cfg.constructor}} {{cfg.safe}}",
        { cfg: JSON.stringify({ safe: "LKR 50" }) }
    );
    assert.equal(polluted, "Hello {{cfg.__proto__}} {{cfg.constructor}} LKR 50");

    const dirtyHtml = `
        <!-- hidden comment -->
        <h2 id="section-1">Heading</h2>
        <a id="location" href="/\\evil.example" class="btn bad!class">Clobber</a>
        <a href="java\tscript:alert(1)">Tab JS</a>
        <a href="https://slpost.gov.lk">Official</a>
    `;
    const cleanHtml = sanitizeRichHtml(dirtyHtml);
    assert.equal(cleanHtml.includes("<!--"), false);
    assert.equal(cleanHtml.includes('id="section-1"'), true);
    assert.equal(cleanHtml.includes('id="location"'), false);
    assert.equal(cleanHtml.includes("/\\evil.example"), false);
    assert.equal(cleanHtml.includes("script:alert"), false);
    assert.equal(cleanHtml.includes('rel="noopener noreferrer"'), true);

    const serialized = safeJsonLd({ text: "\u2028</script>\u2029" });
    assert.equal(serialized.includes("\u2028"), false);
    assert.equal(serialized.includes("\u2029"), false);
    assert.equal(serialized.includes("</script>"), false);
});

test("Dynamic field extraction & siteVariableSchema enforce mass-assignment and key bounds", () => {
    const manyFields: Record<string, string> = {};
    for (let i = 0; i < 55; i++) {
        manyFields[`field_Key${i}`] = "val";
    }
    assert.throws(() => extractValidatedDynamicFields(manyFields, 50));

    assert.equal(
        siteVariableSchema.safeParse({ key: "__proto__", value: "123" }).success,
        false
    );
    assert.equal(
        siteVariableSchema.safeParse({ key: "register_post_price", value: "50 LKR" }).success,
        true
    );
});

test("OCR magic-byte validation rejects spoofed/non-image payloads before Gemini API calls", () => {
    const validJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
    const validPng = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(64),
    ]);
    const validWebp = Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.from([0, 0, 0, 0]),
        Buffer.from("WEBP"),
        Buffer.alloc(64),
    ]);
    const fakeSvgPayload = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");

    assert.equal(validateOcrImageMagicBytes(validJpeg, "image/jpeg"), true);
    assert.equal(validateOcrImageMagicBytes(validPng, "image/png"), true);
    assert.equal(validateOcrImageMagicBytes(validWebp, "image/webp"), true);
    assert.equal(validateOcrImageMagicBytes(fakeSvgPayload, "image/jpeg"), false);
    assert.equal(validateOcrImageMagicBytes(validPng, "image/jpeg"), false);
});

test("Uploadcare signature and community upload tickets bind to officeId, IP, and TTL", () => {
    const sig = createUploadcareSignature("uc-secret-key", 120, 1_700_000_000);
    assert.equal(sig.expire, 1_700_000_120);
    assert.match(sig.signature, /^[0-9a-f]{64}$/);

    const secret = "ticket-secret-32-bytes-minimum-test";
    const ticket = signUploadTicket({ officeId: "office-1", ip: "203.0.113.10" }, secret, 1_000);
    assert.ok(ticket);
    assert.equal(
        verifyUploadTicket(ticket!, { officeId: "office-1", ip: "203.0.113.10" }, secret, 2_000),
        true
    );
    assert.equal(
        verifyUploadTicket(ticket!, { officeId: "office-2", ip: "203.0.113.10" }, secret, 2_000),
        false
    );
    assert.equal(
        verifyUploadTicket(ticket!, { officeId: "office-1", ip: "198.51.100.5" }, secret, 2_000),
        false
    );
    assert.equal(
        verifyUploadTicket(ticket!, { officeId: "office-1", ip: "203.0.113.10" }, secret, 400_000),
        false
    );
});

test("SLP CAPTCHA session token is strictly single-use and rejects replay", async () => {
    const token = signUpstreamSessionCookie("PHPSESSID=abc123def456ghi789; path=/; HttpOnly");
    assert.ok(token);

    const first = await consumeUpstreamSessionCookie(token!);
    assert.equal(first, "PHPSESSID=abc123def456ghi789");

    const replay = await consumeUpstreamSessionCookie(token!);
    assert.equal(replay, null);
});

test("Service Worker excludes sensitive authenticated routes and private responses from caching", () => {
    const swContent = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
    const sensitivePathMatch = swContent.match(/const SENSITIVE_PATH_RE = (\/.*\/[gimsuy]*);/);
    assert.ok(sensitivePathMatch, "SENSITIVE_PATH_RE must exist in public/sw.js");

    const regexBody = sensitivePathMatch[1];
    const lastSlash = regexBody.lastIndexOf("/");
    const sensitiveRe = new RegExp(regexBody.slice(1, lastSlash), regexBody.slice(lastSlash + 1));

    for (const p of ["/dashboard", "/si/dashboard/users", "/ta/dashboard/profile", "/login", "/register", "/suggest/123"]) {
        assert.equal(sensitiveRe.test(p), true, `Expected SW to exclude ${p}`);
    }
    for (const p of ["/", "/calculator", "/browse", "/si/rates", "/track"]) {
        assert.equal(sensitiveRe.test(p), false, `Expected SW to allow public shell ${p}`);
    }

    assert.equal(swContent.includes('cc.includes("private")'), true);
    assert.equal(swContent.includes('res.headers.has("set-cookie")'), true);
});

test("Blog post slug lookup filters published posts only", () => {
    const blogSrc = fs.readFileSync(path.join(process.cwd(), "src", "lib", "blog.ts"), "utf8");
    assert.match(blogSrc, /where:\s*\{\s*slug,\s*published:\s*true\s*\}/);
});
