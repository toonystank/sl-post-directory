import React from "react";
import { cn } from "@/lib/utils";

interface FlagStop {
    /** Band layout or custom country flag renderer */
    type:
        | "h"
        | "v"
        | "solid"
        | "gb"
        | "us"
        | "jp"
        | "kr"
        | "ch"
        | "gr"
        | "dk"
        | "se"
        | "fi"
        | "no"
        | "is"
        | "il"
        | "mv"
        | "bd"
        | "pk"
        | "lk"
        | "ca"
        | "au"
        | "nz"
        | "br"
        | "za"
        | "my"
        | "sg"
        | "cn"
        | "hk"
        | "tw"
        | "vn"
        | "tr"
        | "qa"
        | "bh"
        | "np"
        | "th"
        | "es"
        | "ph"
        | "sa"
        | "cz"
        | "cl"
        | "cy"
        | "ke"
        | "ma"
        | "la"
        | "kh"
        | "mm";
    colors: string[];
    accent?: string;
}

const FLAG_PATTERNS: Record<string, FlagStop> = {
    // South Asia
    LK: { type: "lk", colors: ["#8D153A", "#FFBE29", "#00534E", "#EB7400"] },
    IN: { type: "h", colors: ["#FF9933", "#FFFFFF", "#138808"], accent: "#000080" },
    MV: { type: "mv", colors: ["#D21034", "#007E3A", "#FFFFFF"] },
    BD: { type: "bd", colors: ["#006A4E", "#F42A41"] },
    PK: { type: "pk", colors: ["#01411C", "#FFFFFF"] },
    NP: { type: "np", colors: ["#DC143C", "#003893", "#FFFFFF"] },
    BT: { type: "h", colors: ["#FFD520", "#FF4E12"] },

    // Middle East & North Africa
    AE: { type: "h", colors: ["#00732F", "#FFFFFF", "#000000"], accent: "#FF0000" },
    QA: { type: "qa", colors: ["#8A1538", "#FFFFFF"] },
    SA: { type: "sa", colors: ["#006C35", "#FFFFFF"] },
    OM: { type: "h", colors: ["#FFFFFF", "#DB161B", "#008000"], accent: "#DB161B" },
    KW: { type: "h", colors: ["#007A3D", "#FFFFFF", "#CE1126"], accent: "#000000" },
    BH: { type: "bh", colors: ["#CE1126", "#FFFFFF"] },
    JO: { type: "h", colors: ["#000000", "#FFFFFF", "#007A3D"], accent: "#CE1126" },
    IL: { type: "il", colors: ["#FFFFFF", "#0038B8"] },
    LB: { type: "h", colors: ["#ED1C24", "#FFFFFF", "#ED1C24"], accent: "#00A651" },
    EG: { type: "h", colors: ["#CE1126", "#FFFFFF", "#000000"], accent: "#C09300" },
    MA: { type: "ma", colors: ["#C1272D", "#006233"] },

    // East & Southeast Asia
    SG: { type: "sg", colors: ["#EF3340", "#FFFFFF"] },
    MY: { type: "my", colors: ["#CC0001", "#FFFFFF", "#010066", "#FFCC00"] },
    TH: { type: "th", colors: ["#A51931", "#F4F5F8", "#2D2A4A"] },
    ID: { type: "h", colors: ["#FF0000", "#FFFFFF"] },
    PH: { type: "ph", colors: ["#0038A8", "#CE1126", "#FFFFFF", "#FCD116"] },
    VN: { type: "vn", colors: ["#DA251D", "#FFFF00"] },
    CN: { type: "cn", colors: ["#EE1C25", "#FFFF00"] },
    HK: { type: "hk", colors: ["#DE2910", "#FFFFFF"] },
    TW: { type: "tw", colors: ["#FE0000", "#000095", "#FFFFFF"] },
    JP: { type: "jp", colors: ["#FFFFFF", "#BC002D"] },
    KR: { type: "kr", colors: ["#FFFFFF", "#CD2E3A", "#0047A0", "#000000"] },
    LA: { type: "la", colors: ["#CE1126", "#002868", "#FFFFFF"] },
    KH: { type: "kh", colors: ["#032EA1", "#E00025", "#FFFFFF"] },
    MM: { type: "mm", colors: ["#FECB00", "#34B233", "#EA2839", "#FFFFFF"] },
    BN: { type: "h", colors: ["#F7E017", "#FFFFFF", "#000000"] },

    // Europe
    GB: { type: "gb", colors: ["#012169", "#FFFFFF", "#C8102E"] },
    DE: { type: "h", colors: ["#000000", "#DD0000", "#FFCE00"] },
    FR: { type: "v", colors: ["#002395", "#FFFFFF", "#ED2939"] },
    IT: { type: "v", colors: ["#009246", "#FFFFFF", "#CE2B37"] },
    NL: { type: "h", colors: ["#AE1C28", "#FFFFFF", "#21468B"] },
    ES: { type: "es", colors: ["#AA151B", "#F1BF00"] },
    BE: { type: "v", colors: ["#000000", "#FDDA24", "#EF3340"] },
    SE: { type: "se", colors: ["#006AA7", "#FECC02"] },
    AT: { type: "h", colors: ["#ED2939", "#FFFFFF", "#ED2939"] },
    PL: { type: "h", colors: ["#FFFFFF", "#DC143C"] },
    CH: { type: "ch", colors: ["#FF0000", "#FFFFFF"] },
    IE: { type: "v", colors: ["#169B62", "#FFFFFF", "#FF883E"] },
    DK: { type: "dk", colors: ["#C8102E", "#FFFFFF"] },
    FI: { type: "fi", colors: ["#FFFFFF", "#003580"] },
    NO: { type: "no", colors: ["#BA0C2F", "#FFFFFF", "#00205B"] },
    IS: { type: "is", colors: ["#02529C", "#FFFFFF", "#DC1E35"] },
    GR: { type: "gr", colors: ["#0D5EAF", "#FFFFFF"] },
    PT: { type: "v", colors: ["#006600", "#FF0000", "#FF0000"], accent: "#FFCC00" },
    TR: { type: "tr", colors: ["#E30A17", "#FFFFFF"] },
    RU: { type: "h", colors: ["#FFFFFF", "#0039A6", "#D52B1E"] },
    UA: { type: "h", colors: ["#0057B7", "#FFDD00"] },
    CY: { type: "cy", colors: ["#FFFFFF", "#D57800", "#4E5B31"] },
    CZ: { type: "cz", colors: ["#FFFFFF", "#D7141A", "#11457E"] },
    HU: { type: "h", colors: ["#CD2A3E", "#FFFFFF", "#436F4D"] },
    RO: { type: "v", colors: ["#002B7F", "#FCD116", "#CE1126"] },
    BG: { type: "h", colors: ["#FFFFFF", "#00966E", "#D62612"] },
    HR: { type: "h", colors: ["#FF0000", "#FFFFFF", "#171796"] },
    SK: { type: "h", colors: ["#FFFFFF", "#0B4EA2", "#EE1C25"] },
    SI: { type: "h", colors: ["#FFFFFF", "#005DA4", "#ED1C24"] },
    EE: { type: "h", colors: ["#0072CE", "#000000", "#FFFFFF"] },
    LV: { type: "h", colors: ["#9E3039", "#FFFFFF", "#9E3039"] },
    LT: { type: "h", colors: ["#FDB913", "#006A44", "#C1272D"] },
    LU: { type: "h", colors: ["#ED2939", "#FFFFFF", "#00A1DE"] },
    MT: { type: "v", colors: ["#FFFFFF", "#CF142B"] },

    // Oceania & Americas & Africa
    AU: { type: "au", colors: ["#00008B", "#FFFFFF", "#FF0000"] },
    NZ: { type: "nz", colors: ["#00247D", "#FFFFFF", "#CC142B"] },
    US: { type: "us", colors: ["#B22234", "#FFFFFF", "#3C3B6E"] },
    CA: { type: "ca", colors: ["#FF0000", "#FFFFFF"] },
    MX: { type: "v", colors: ["#006847", "#FFFFFF", "#CE1126"], accent: "#7A5230" },
    BR: { type: "br", colors: ["#009739", "#FEDD00", "#012169"] },
    AR: { type: "h", colors: ["#74ACDF", "#FFFFFF", "#74ACDF"], accent: "#F6B40E" },
    CL: { type: "cl", colors: ["#0039A6", "#FFFFFF", "#D52B1E"] },
    CO: { type: "h", colors: ["#FCD116", "#FCD116", "#003893", "#CE1126"] },
    PE: { type: "v", colors: ["#D91023", "#FFFFFF", "#D91023"] },
    ZA: { type: "za", colors: ["#E03C31", "#001489", "#007749", "#FFB81C", "#FFFFFF", "#000000"] },
    KE: { type: "ke", colors: ["#000000", "#BB0000", "#006600", "#FFFFFF"] },
    NG: { type: "v", colors: ["#008751", "#FFFFFF", "#008751"] },
    MU: { type: "h", colors: ["#EA2839", "#1A206D", "#FFD500", "#00A551"] },
};

/** Returns true if a dedicated vector SVG flag exists for the given ISO alpha-2 code. */
export function hasCountryFlag(code: string | undefined): boolean {
    const iso = (code || "").trim().toUpperCase();
    return Boolean(FLAG_PATTERNS[iso]);
}

/**
 * Renders a crisp, zero-network SVG flag icon for any ISO 3166-1 alpha-2 country code.
 * Ensures flags render identically across Linux, Android, iOS, Windows, and macOS
 * even when system color emoji fonts are unavailable.
 */
export default function CountryFlag({
    code,
    className,
    title,
    decorative = false,
}: {
    code: string | undefined;
    className?: string;
    title?: string;
    /** When true, marks the flag icon aria-hidden so adjacent visible text is not duplicated for screen readers. */
    decorative?: boolean;
}) {
    const iso = (code || "").trim().toUpperCase();
    const spec = FLAG_PATTERNS[iso];

    if (!spec) {
        return (
            <span
                title={decorative ? undefined : title || iso}
                aria-hidden="true"
                className={cn(
                    "inline-flex items-center justify-center rounded-[3px] border border-foreground/30 bg-muted font-mono text-[9px] font-bold leading-none text-foreground shrink-0",
                    className ?? "w-5 h-3.5"
                )}
            >
                {iso.slice(0, 2) || "INT"}
            </span>
        );
    }

    const renderSvgContent = () => {
        switch (spec.type) {
            case "gb":
                return (
                    <>
                        <rect width="24" height="16" fill="#012169" />
                        <path d="M0,0 L24,16 M24,0 L0,16" stroke="#FFFFFF" strokeWidth="3.2" />
                        <path d="M0,0 L24,16 M24,0 L0,16" stroke="#C8102E" strokeWidth="1.6" />
                        <path d="M12,0 V16 M0,8 H24" stroke="#FFFFFF" strokeWidth="5.2" />
                        <path d="M12,0 V16 M0,8 H24" stroke="#C8102E" strokeWidth="3" />
                    </>
                );
            case "lk":
                return (
                    <>
                        <rect width="24" height="16" fill="#FFBE29" />
                        <rect x="1.5" y="1.5" width="3.5" height="13" fill="#00534E" />
                        <rect x="5" y="1.5" width="3.5" height="13" fill="#EB7400" />
                        <rect x="10" y="1.5" width="12.5" height="13" fill="#8D153A" />
                        <circle cx="16.2" cy="8" r="3" fill="#FFBE29" />
                    </>
                );
            case "np":
                return (
                    <>
                        <rect width="24" height="16" fill="#F8FAFC" />
                        <polygon
                            points="4,1 18,7.5 10.5,7.5 20,15 4,15"
                            fill="#DC143C"
                            stroke="#003893"
                            strokeWidth="1.3"
                            strokeLinejoin="round"
                        />
                        <circle cx="8.2" cy="5.5" r="1.4" fill="#FFFFFF" />
                        <circle cx="8.8" cy="11.6" r="1.8" fill="#FFFFFF" />
                    </>
                );
            case "us":
                return (
                    <>
                        <rect width="24" height="16" fill="#FFFFFF" />
                        {[0, 2, 4, 6, 8, 10, 12].map((i) => (
                            <rect key={i} x="0" y={i * (16 / 13)} width="24" height={16 / 13} fill="#B22234" />
                        ))}
                        <rect x="0" y="0" width="10.5" height="8.6" fill="#3C3B6E" />
                        <circle cx="3" cy="2.5" r="0.7" fill="#FFFFFF" />
                        <circle cx="5.5" cy="2.5" r="0.7" fill="#FFFFFF" />
                        <circle cx="8" cy="2.5" r="0.7" fill="#FFFFFF" />
                        <circle cx="4.2" cy="4.5" r="0.7" fill="#FFFFFF" />
                        <circle cx="6.8" cy="4.5" r="0.7" fill="#FFFFFF" />
                        <circle cx="3" cy="6.5" r="0.7" fill="#FFFFFF" />
                        <circle cx="5.5" cy="6.5" r="0.7" fill="#FFFFFF" />
                        <circle cx="8" cy="6.5" r="0.7" fill="#FFFFFF" />
                    </>
                );
            case "jp":
                return (
                    <>
                        <rect width="24" height="16" fill="#FFFFFF" />
                        <circle cx="12" cy="8" r="4.6" fill="#BC002D" />
                    </>
                );
            case "bd":
                return (
                    <>
                        <rect width="24" height="16" fill="#006A4E" />
                        <circle cx="10.8" cy="8" r="4.4" fill="#F42A41" />
                    </>
                );
            case "kr":
                return (
                    <>
                        <rect width="24" height="16" fill="#FFFFFF" />
                        <circle cx="12" cy="8" r="4" fill="#CD2E3A" />
                        <path d="M8,8 A4,4 0 0,0 16,8 A2,2 0 0,0 12,8 A2,2 0 0,1 8,8 Z" fill="#0047A0" />
                        <path d="M4,4.5 L6.2,2.3 M4.8,5.3 L7,3.1" stroke="#000000" strokeWidth="0.8" />
                        <path d="M17.8,2.3 L20,4.5 M17,3.1 L19.2,5.3" stroke="#000000" strokeWidth="0.8" />
                        <path d="M4,11.5 L6.2,13.7 M4.8,10.7 L7,12.9" stroke="#000000" strokeWidth="0.8" />
                        <path d="M17.8,13.7 L20,11.5 M17,12.9 L19.2,10.7" stroke="#000000" strokeWidth="0.8" />
                    </>
                );
            case "ca":
                return (
                    <>
                        <rect width="24" height="16" fill="#FFFFFF" />
                        <rect x="0" y="0" width="6" height="16" fill="#FF0000" />
                        <rect x="18" y="0" width="6" height="16" fill="#FF0000" />
                        <polygon points="12,3.5 13.5,6.8 16,6.5 14,9.5 15,12 12,10.8 9,12 10,9.5 8,6.5 10.5,6.8" fill="#FF0000" />
                    </>
                );
            case "ch":
                return (
                    <>
                        <rect width="24" height="16" fill="#FF0000" />
                        <rect x="10.2" y="3.2" width="3.6" height="9.6" fill="#FFFFFF" />
                        <rect x="7.2" y="6.2" width="9.6" height="3.6" fill="#FFFFFF" />
                    </>
                );
            case "se":
            case "dk":
            case "fi":
                return (
                    <>
                        <rect width="24" height="16" fill={spec.colors[0]} />
                        <rect x="7" y="0" width="2.8" height="16" fill={spec.colors[1]} />
                        <rect x="0" y="6.6" width="24" height="2.8" fill={spec.colors[1]} />
                    </>
                );
            case "no":
            case "is":
                return (
                    <>
                        <rect width="24" height="16" fill={spec.colors[0]} />
                        <rect x="6.5" y="0" width="3.8" height="16" fill={spec.colors[1]} />
                        <rect x="0" y="6.1" width="24" height="3.8" fill={spec.colors[1]} />
                        <rect x="7.4" y="0" width="2" height="16" fill={spec.colors[2]} />
                        <rect x="0" y="7" width="24" height="2" fill={spec.colors[2]} />
                    </>
                );
            case "au":
            case "nz":
                return (
                    <>
                        <rect width="24" height="16" fill={spec.colors[0]} />
                        <rect x="0" y="0" width="11" height="8" fill="#012169" />
                        <path d="M0,0 L11,8 M11,0 L0,8" stroke="#FFFFFF" strokeWidth="1.6" />
                        <path d="M5.5,0 V8 M0,4 H11" stroke="#FFFFFF" strokeWidth="2.4" />
                        <path d="M5.5,0 V8 M0,4 H11" stroke="#C8102E" strokeWidth="1.4" />
                        <circle cx="17.5" cy="4" r="1" fill={spec.colors[2]} stroke="#FFFFFF" strokeWidth="0.4" />
                        <circle cx="19.5" cy="8" r="1" fill={spec.colors[2]} stroke="#FFFFFF" strokeWidth="0.4" />
                        <circle cx="17.5" cy="12" r="1" fill={spec.colors[2]} stroke="#FFFFFF" strokeWidth="0.4" />
                        <circle cx="6" cy="12" r="1.4" fill="#FFFFFF" />
                    </>
                );
            case "br":
                return (
                    <>
                        <rect width="24" height="16" fill="#009739" />
                        <polygon points="12,2 21.5,8 12,14 2.5,8" fill="#FEDD00" />
                        <circle cx="12" cy="8" r="3.2" fill="#012169" />
                    </>
                );
            case "za":
                return (
                    <>
                        <rect width="24" height="8" fill="#E03C31" />
                        <rect y="8" width="24" height="8" fill="#001489" />
                        <path d="M0,0 L10,8 L0,16" fill="#000000" stroke="#FFB81C" strokeWidth="1.5" />
                        <path d="M0,1.5 L9.5,8 L0,14.5 M9.5,8 H24" fill="none" stroke="#FFFFFF" strokeWidth="4" />
                        <path d="M0,1.5 L9.5,8 L0,14.5 M9.5,8 H24" fill="none" stroke="#007749" strokeWidth="2.4" />
                    </>
                );
            case "cn":
                return (
                    <>
                        <rect width="24" height="16" fill="#EE1C25" />
                        <polygon
                            points="5,2.4 5.8,4.6 8.2,4.6 6.3,6 7,8.2 5,6.8 3,8.2 3.7,6 1.8,4.6 4.2,4.6"
                            fill="#FFFF00"
                        />
                        <circle cx="9.8" cy="2.6" r="0.7" fill="#FFFF00" />
                        <circle cx="11.2" cy="4.3" r="0.7" fill="#FFFF00" />
                        <circle cx="11.2" cy="6.5" r="0.7" fill="#FFFF00" />
                        <circle cx="9.8" cy="8.2" r="0.7" fill="#FFFF00" />
                    </>
                );
            case "vn":
                return (
                    <>
                        <rect width="24" height="16" fill="#DA251D" />
                        <polygon
                            points="12,3.2 13.2,6.8 17,6.8 13.9,9 15.1,12.6 12,10.4 8.9,12.6 10.1,9 7,6.8 10.8,6.8"
                            fill="#FFFF00"
                        />
                    </>
                );
            case "hk":
                return (
                    <>
                        <rect width="24" height="16" fill="#DE2910" />
                        <circle cx="12" cy="5.1" r="1.7" fill="#FFFFFF" />
                        <circle cx="14.7" cy="7.1" r="1.7" fill="#FFFFFF" />
                        <circle cx="13.7" cy="10.3" r="1.7" fill="#FFFFFF" />
                        <circle cx="10.3" cy="10.3" r="1.7" fill="#FFFFFF" />
                        <circle cx="9.3" cy="7.1" r="1.7" fill="#FFFFFF" />
                        <circle cx="12" cy="8" r="1.1" fill="#DE2910" />
                    </>
                );
            case "tw":
                return (
                    <>
                        <rect width="24" height="16" fill="#FE0000" />
                        <rect width="12" height="8" fill="#000095" />
                        <circle cx="6" cy="4" r="2.2" fill="#FFFFFF" />
                    </>
                );
            case "sg":
                return (
                    <>
                        <rect width="24" height="8" fill="#EF3340" />
                        <rect y="8" width="24" height="8" fill="#FFFFFF" />
                        <circle cx="5.2" cy="4" r="2.3" fill="#FFFFFF" />
                        <circle cx="6.1" cy="4" r="2" fill="#EF3340" />
                        <circle cx="7.8" cy="2.7" r="0.55" fill="#FFFFFF" />
                        <circle cx="9" cy="3.6" r="0.55" fill="#FFFFFF" />
                        <circle cx="8.5" cy="5" r="0.55" fill="#FFFFFF" />
                        <circle cx="7" cy="5" r="0.55" fill="#FFFFFF" />
                    </>
                );
            case "my":
                return (
                    <>
                        <rect width="24" height="16" fill="#FFFFFF" />
                        {[0, 2, 4, 6, 8, 10, 12].map((i) => (
                            <rect key={i} x="0" y={i * (16 / 14)} width="24" height={16 / 14} fill="#CC0001" />
                        ))}
                        <rect width="12" height="9" fill="#010066" />
                        <circle cx="5.5" cy="4.5" r="2.4" fill="#FFCC00" />
                        <circle cx="6.4" cy="4.5" r="2" fill="#010066" />
                        <circle cx="8.6" cy="4.5" r="1" fill="#FFCC00" />
                    </>
                );
            case "th":
                return (
                    <>
                        <rect y="0" width="24" height="2.7" fill="#A51931" />
                        <rect y="2.6" width="24" height="2.7" fill="#F4F5F8" />
                        <rect y="5.2" width="24" height="5.6" fill="#2D2A4A" />
                        <rect y="10.7" width="24" height="2.7" fill="#F4F5F8" />
                        <rect y="13.3" width="24" height="2.7" fill="#A51931" />
                    </>
                );
            case "es":
                return (
                    <>
                        <rect y="0" width="24" height="4" fill="#AA151B" />
                        <rect y="3.9" width="24" height="8.2" fill="#F1BF00" />
                        <rect y="12" width="24" height="4" fill="#AA151B" />
                        <rect x="6.5" y="5.8" width="2.8" height="4.4" rx="0.8" fill="#AA151B" />
                        <circle cx="7.9" cy="7.8" r="0.7" fill="#F1BF00" />
                    </>
                );
            case "ph":
                return (
                    <>
                        <rect y="0" width="24" height="8" fill="#0038A8" />
                        <rect y="8" width="24" height="8" fill="#CE1126" />
                        <polygon points="0,0 10.5,8 0,16" fill="#FFFFFF" />
                        <circle cx="3.8" cy="8" r="1.9" fill="#FCD116" />
                    </>
                );
            case "sa":
                return (
                    <>
                        <rect width="24" height="16" fill="#006C35" />
                        <rect x="5" y="4.5" width="14" height="2.4" rx="0.9" fill="#FFFFFF" />
                        <rect x="7" y="8" width="10" height="1.2" rx="0.5" fill="#FFFFFF" />
                        <rect x="5.5" y="10.8" width="13" height="1.1" rx="0.5" fill="#FFFFFF" />
                    </>
                );
            case "tr":
            case "pk":
                return (
                    <>
                        <rect width="24" height="16" fill={spec.colors[0]} />
                        {spec.type === "pk" && <rect width="6" height="16" fill="#FFFFFF" />}
                        <circle cx={spec.type === "pk" ? "14" : "10.5"} cy="8" r="3.8" fill="#FFFFFF" />
                        <circle cx={spec.type === "pk" ? "15.1" : "11.6"} cy="8" r="3.1" fill={spec.colors[0]} />
                        <circle cx={spec.type === "pk" ? "17.2" : "15"} cy="8" r="1.2" fill="#FFFFFF" />
                    </>
                );
            case "mv":
                return (
                    <>
                        <rect width="24" height="16" fill="#D21034" />
                        <rect x="4" y="3" width="16" height="10" fill="#007E3A" />
                        <circle cx="12.8" cy="8" r="2.8" fill="#FFFFFF" />
                        <circle cx="13.8" cy="8" r="2.5" fill="#007E3A" />
                    </>
                );
            case "qa":
            case "bh":
                return (
                    <>
                        <rect width="24" height="16" fill={spec.colors[0]} />
                        <polygon
                            points="0,0 6.5,0 9,1.6 6.5,3.2 9,4.8 6.5,6.4 9,8 6.5,9.6 9,11.2 6.5,12.8 9,14.4 6.5,16 0,16"
                            fill="#FFFFFF"
                        />
                    </>
                );
            case "il":
                return (
                    <>
                        <rect width="24" height="16" fill="#FFFFFF" />
                        <rect y="1.8" width="24" height="2.2" fill="#0038B8" />
                        <rect y="12" width="24" height="2.2" fill="#0038B8" />
                        <polygon points="12,5 14.6,9.8 9.4,9.8" fill="none" stroke="#0038B8" strokeWidth="1.1" />
                        <polygon points="12,11 14.6,6.2 9.4,6.2" fill="none" stroke="#0038B8" strokeWidth="1.1" />
                    </>
                );
            case "gr":
                return (
                    <>
                        <rect width="24" height="16" fill="#0D5EAF" />
                        {[1, 3, 5, 7].map((i) => (
                            <rect key={i} y={i * (16 / 9)} width="24" height={16 / 9} fill="#FFFFFF" />
                        ))}
                        <rect width="9" height="8.9" fill="#0D5EAF" />
                        <rect x="3.6" y="0" width="1.8" height="8.9" fill="#FFFFFF" />
                        <rect x="0" y="3.5" width="9" height="1.8" fill="#FFFFFF" />
                    </>
                );
            case "cz":
                return (
                    <>
                        <rect y="0" width="24" height="8" fill="#FFFFFF" />
                        <rect y="8" width="24" height="8" fill="#D7141A" />
                        <polygon points="0,0 11,8 0,16" fill="#11457E" />
                    </>
                );
            case "cl":
                return (
                    <>
                        <rect y="0" width="24" height="8" fill="#FFFFFF" />
                        <rect y="8" width="24" height="8" fill="#D52B1E" />
                        <rect width="8.5" height="8" fill="#0039A6" />
                        <circle cx="4.25" cy="4" r="1.5" fill="#FFFFFF" />
                    </>
                );
            case "cy":
                return (
                    <>
                        <rect width="24" height="16" fill="#FFFFFF" />
                        <ellipse cx="12" cy="7.5" rx="4.5" ry="2.6" fill="#D57800" />
                        <path d="M8,11.5 Q12,13.5 16,11.5" fill="none" stroke="#4E5B31" strokeWidth="1.3" />
                    </>
                );
            case "ke":
                return (
                    <>
                        <rect y="0" width="24" height="4.8" fill="#000000" />
                        <rect y="4.8" width="24" height="1" fill="#FFFFFF" />
                        <rect y="5.8" width="24" height="4.4" fill="#BB0000" />
                        <rect y="10.2" width="24" height="1" fill="#FFFFFF" />
                        <rect y="11.2" width="24" height="4.8" fill="#006600" />
                        <ellipse cx="12" cy="8" rx="2.2" ry="3.4" fill="#BB0000" stroke="#FFFFFF" strokeWidth="0.7" />
                    </>
                );
            case "ma":
                return (
                    <>
                        <rect width="24" height="16" fill="#C1272D" />
                        <polygon
                            points="12,4.5 13.1,7.6 16.3,7.6 13.7,9.5 14.7,12.6 12,10.7 9.3,12.6 10.3,9.5 7.7,7.6 10.9,7.6"
                            fill="none"
                            stroke="#006233"
                            strokeWidth="1.2"
                        />
                    </>
                );
            case "la":
                return (
                    <>
                        <rect y="0" width="24" height="4" fill="#CE1126" />
                        <rect y="4" width="24" height="8" fill="#002868" />
                        <rect y="12" width="24" height="4" fill="#CE1126" />
                        <circle cx="12" cy="8" r="2.8" fill="#FFFFFF" />
                    </>
                );
            case "kh":
                return (
                    <>
                        <rect y="0" width="24" height="4" fill="#032EA1" />
                        <rect y="4" width="24" height="8" fill="#E00025" />
                        <rect y="12" width="24" height="4" fill="#032EA1" />
                        <polygon points="8,10.5 12,5.5 16,10.5" fill="#FFFFFF" />
                    </>
                );
            case "mm":
                return (
                    <>
                        <rect y="0" width="24" height="5.4" fill="#FECB00" />
                        <rect y="5.3" width="24" height="5.4" fill="#34B233" />
                        <rect y="10.6" width="24" height="5.4" fill="#EA2839" />
                        <polygon
                            points="12,3.5 13.2,7 16.8,7 13.9,9.2 15,12.7 12,10.5 9,12.7 10.1,9.2 7.2,7 10.8,7"
                            fill="#FFFFFF"
                        />
                    </>
                );
            case "solid":
                return (
                    <>
                        <rect width="24" height="16" fill={spec.colors[0]} />
                        <rect x="5" y="7" width="14" height="2" rx="1" fill={spec.colors[1] ?? "#FFFFFF"} />
                    </>
                );
            case "v": {
                const n = spec.colors.length;
                const w = 24 / n;
                return (
                    <>
                        {spec.colors.map((c, idx) => (
                            <rect key={idx} x={idx * w} y="0" width={w + 0.2} height="16" fill={c} />
                        ))}
                        {spec.accent && (
                            <circle
                                cx={iso === "MX" ? "12" : "9.6"}
                                cy="8"
                                r={iso === "MX" ? "1.9" : "2.2"}
                                fill={spec.accent}
                            />
                        )}
                    </>
                );
            }
            case "h":
            default: {
                const n = spec.colors.length;
                const h = 16 / n;
                return (
                    <>
                        {spec.colors.map((c, idx) => (
                            <rect key={idx} x="0" y={idx * h} width="24" height={h + 0.2} fill={c} />
                        ))}
                        {(iso === "AE" || iso === "OM") && (
                            <rect x="0" y="0" width="6.2" height="16" fill={spec.accent ?? "#FF0000"} />
                        )}
                        {iso === "IN" && (
                            <circle cx="12" cy="8" r="2" fill="none" stroke="#000080" strokeWidth="1" />
                        )}
                        {iso === "LB" && (
                            <polygon points="12,5.3 14.3,10.5 9.7,10.5" fill="#00A651" />
                        )}
                        {iso === "EG" && (
                            <circle cx="12" cy="8" r="1.6" fill="#C09300" />
                        )}
                        {iso === "AR" && (
                            <circle cx="12" cy="8" r="1.7" fill="#F6B40E" />
                        )}
                        {iso === "KW" && (
                            <polygon points="0,0 6.5,5.3 6.5,10.7 0,16" fill="#000000" />
                        )}
                        {iso === "JO" && (
                            <>
                                <polygon points="0,0 9.5,8 0,16" fill="#CE1126" />
                                <circle cx="3.3" cy="8" r="1" fill="#FFFFFF" />
                            </>
                        )}
                    </>
                );
            }
        }
    };

    return (
        <svg
            viewBox="0 0 24 16"
            role={decorative ? undefined : "img"}
            aria-hidden={decorative ? "true" : undefined}
            aria-label={decorative ? undefined : title || `${iso} flag`}
            className={cn(
                "inline-block shrink-0 rounded-[3px] border border-foreground/25 shadow-2xs overflow-hidden",
                className ?? "w-5 h-3.5"
            )}
        >
            {renderSvgContent()}
        </svg>
    );
}
