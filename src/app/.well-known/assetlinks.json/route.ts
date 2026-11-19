import { NextResponse } from "next/server";

const DEFAULT_PACKAGE_NAME = "com.toonystank.slpostdirectory";

/**
 * Digital Asset Links manifest for Google Play Store Trusted Web Activity (TWA).
 * Set `TWA_ANDROID_PACKAGE_NAME` and `TWA_SHA256_CERT_FINGERPRINTS` (comma-separated
 * SHA-256 fingerprints from Play App Signing / upload key) in production env vars
 * to verify domain ownership and launch the TWA full-screen without a browser URL bar.
 */
export async function GET() {
    const packageName =
        process.env.TWA_ANDROID_PACKAGE_NAME?.trim() || DEFAULT_PACKAGE_NAME;

    const fingerprints = (process.env.TWA_SHA256_CERT_FINGERPRINTS || "")
        .split(",")
        .map((fp) => fp.trim().toUpperCase())
        .filter(Boolean);

    const statements =
        fingerprints.length > 0
            ? [
                  {
                      relation: ["delegate_permission/common.handle_all_urls"],
                      target: {
                          namespace: "android_app",
                          package_name: packageName,
                          sha256_cert_fingerprints: fingerprints,
                      },
                  },
              ]
            : [];

    return NextResponse.json(statements, {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
    });
}
