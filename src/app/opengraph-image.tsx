import { ImageResponse } from "next/og";
import { getSiteHostname } from "@/lib/site";

export const alt = "Lanka Post Directory — Sri Lanka Post Offices, Postal Codes, 2026 Rates & Tracking";
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    backgroundColor: "#FBF7EF",
                    color: "#1B1613",
                    padding: "56px 64px",
                    border: "14px solid #1B1613",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                }}
            >
                {/* Top Airmail Accent & Brand */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
                        <div
                            style={{
                                width: "64px",
                                height: "64px",
                                borderRadius: "12px",
                                backgroundColor: "#B91C1C",
                                border: "4px solid #1B1613",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#FBF7EF",
                                fontSize: "30px",
                                fontWeight: 900,
                            }}
                        >
                            LP
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: "30px", fontWeight: 900, letterSpacing: "-0.02em" }}>
                                Lanka Post Directory
                            </span>
                            <span style={{ fontSize: "18px", color: "#6B5E53", fontWeight: 600 }}>
                                {getSiteHostname()}
                            </span>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 20px",
                            borderRadius: "999px",
                            backgroundColor: "#FACC15",
                            border: "3px solid #1B1613",
                            fontSize: "18px",
                            fontWeight: 800,
                        }}
                    >
                        EN · සිංහල · தமிழ்
                    </div>
                </div>

                {/* Main Headline */}
                <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "960px" }}>
                    <div
                        style={{
                            fontSize: "20px",
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            color: "#B91C1C",
                            textTransform: "uppercase",
                        }}
                    >
                        SRI LANKA POSTAL GUIDE · 2026 TARIFFS
                    </div>
                    <div
                        style={{
                            fontSize: "64px",
                            fontWeight: 900,
                            lineHeight: 1.06,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        Postage rates, post offices &amp; postal codes.
                    </div>
                    <div
                        style={{
                            fontSize: "26px",
                            color: "#4F463E",
                            lineHeight: 1.35,
                        }}
                    >
                        Search 4,000+ Sri Lanka post offices, calculate EMS, COD &amp; local rates, and track parcels in one place.
                    </div>
                </div>

                {/* Bottom Feature Pills */}
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    {[
                        { label: "4,024+ Post Offices", bg: "#FFFFFF" },
                        { label: "2026 EMS & COD Rates", bg: "#FEF3C7" },
                        { label: "Live Parcel Tracking", bg: "#FEE2E2" },
                    ].map((pill) => (
                        <div
                            key={pill.label}
                            style={{
                                display: "flex",
                                padding: "12px 22px",
                                borderRadius: "10px",
                                backgroundColor: pill.bg,
                                border: "3px solid #1B1613",
                                fontSize: "20px",
                                fontWeight: 800,
                            }}
                        >
                            {pill.label}
                        </div>
                    ))}
                </div>
            </div>
        ),
        { ...size }
    );
}
