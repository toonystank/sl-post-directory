import * as React from "react";
import { cn } from "@/lib/utils";

interface PostmarkProps {
    code: string;
    size?: "sm" | "md" | "lg";
    /** Optional explicit pixel size override (maintains 1:1 aspect ratio) */
    boxSize?: number;
    /** ink = foreground colour, red = postal red */
    tone?: "ink" | "red";
    /** Draw the wavy cancellation lines to the right */
    waves?: boolean;
    rotate?: number;
    /** Top curved ring inscription (Post Office name) */
    label?: string;
    /** Bottom curved ring inscription (Country / Trilingual title) */
    bottomLabel?: string;
    /** Date line rendered in upper inner crescent (e.g. "17 NOV 26") */
    date?: string;
    /** Clearance / dispatch time rendered in lower inner crescent (e.g. "AM 10.30") */
    time?: string;
    /** Counter / sorting bay letter rendered at base of lower crescent (e.g. "A", "C") */
    bay?: string;
    className?: string;
}

const SIZES = {
    sm: { box: 52 },
    md: { box: 76 },
    lg: { box: 138 },
};

/** 5-point postal star centered at (cx, cy) with outer radius r */
function starPoints(cx: number, cy: number, r: number): string {
    const inner = r * 0.42;
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? r : inner;
        pts.push(`${(cx + Math.cos(angle) * rad).toFixed(2)},${(cy + Math.sin(angle) * rad).toFixed(2)}`);
    }
    return pts.join(" ");
}

/**
 * Sri Lanka Post Circular Date Stamp (CDS).
 * Modeled after authentic Sri Lankan postal handstamps: double concentric
 * outer rim, 5-point postal stars, curved post office & bilingual country ring,
 * double horizontal bridge bars, central postcode, date slug, and sorting bay.
 */
export default function Postmark({
    code,
    size = "md",
    boxSize,
    tone = "ink",
    waves = false,
    rotate = -8,
    label = "SRI LANKA",
    bottomLabel = "ශ්‍රී ලංකා · SRI LANKA",
    date = "17 NOV 26",
    time,
    bay,
    className,
}: PostmarkProps) {
    const box = boxSize ?? SIZES[size].box;
    const color = tone === "red" ? "hsl(var(--primary))" : "hsl(var(--foreground))";
    const width = waves ? box * 1.75 : box;
    const rawId = React.useId();
    const unique = rawId.replace(/[^a-zA-Z0-9-]/g, "");
    const id = `pm-${size}-${code}-${unique}`.replace(/[^a-zA-Z0-9-]/g, "");
    const filterId = `${id}-ink`;
    const coreClipId = `${id}-core`;

    const centerFontSize =
        code.length > 6 ? 10 : code.length > 4 ? 12.2 : 14;

    const topInscription = label.length > 10 ? label : `${label} · POST`;
    const topFontSize = topInscription.length > 15 ? 5.6 : 6.3;
    const bottomFontSize = bottomLabel.length > 16 ? 5.4 : 6.0;

    return (
        <svg
            width={width}
            height={box}
            viewBox={`0 0 ${waves ? 175 : 100} 100`}
            role="img"
            aria-label={`Postal stamp ${label} ${code}`}
            className={cn("shrink-0 overflow-visible", className)}
            style={{ transform: `rotate(${rotate}deg)` }}
        >
            <defs>
                {/* Top clockwise arc inside double rim */}
                <path id={`${id}-top`} d="M 15.5,50 A 34.5,34.5 0 1,1 84.5,50" />
                {/* Bottom counter-clockwise arc reading upright left-to-right */}
                <path id={`${id}-bot`} d="M 11.5,50 A 38.5,38.5 0 0,0 88.5,50" />
                {/* Clip inner bridge bars cleanly to the inner core circle */}
                <clipPath id={coreClipId}>
                    <circle cx="50" cy="50" r="28.1" />
                </clipPath>
                {size === "lg" && (
                    <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.065" numOctaves="2" seed="7" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.75" xChannelSelector="R" yChannelSelector="G" />
                    </filter>
                )}
            </defs>

            <g filter={size === "lg" ? `url(#${filterId})` : undefined}>
                {/* Concentric double outer rim, inner core ring, stars & obliterator waves */}
                <g fill="none" stroke={color} opacity={tone === "red" ? 0.92 : 0.88}>
                    {/* Heavy outer border ring */}
                    <circle cx="50" cy="50" r="47" strokeWidth="2.35" />
                    {/* Fine inner rim border */}
                    <circle cx="50" cy="50" r="44" strokeWidth="0.9" opacity="0.76" />
                    {/* Outer cardinal micro-ticks at top & bottom */}
                    <line x1="50" y1="3" x2="50" y2="6" strokeWidth="0.9" opacity="0.55" />
                    <line x1="50" y1="94" x2="50" y2="97" strokeWidth="0.9" opacity="0.55" />
                    {/* Inner core circle */}
                    <circle cx="50" cy="50" r="28.3" strokeWidth="1.45" />
                    {/* Subtle dotted inner guide arc in upper crescent */}
                    <path d="M 27.5 34 A 26.2 26.2 0 0 1 72.5 34" strokeWidth="0.65" strokeDasharray="1.8 1.6" opacity="0.5" />
                    {!bay && (
                        <path d="M 27.5 66 A 26.2 26.2 0 0 0 72.5 66" strokeWidth="0.65" strokeDasharray="1.8 1.6" opacity="0.5" />
                    )}

                    {/* Double horizontal steel-handstamp bridge bars clipped cleanly to inner core */}
                    <g clipPath={`url(#${coreClipId})`}>
                        <line x1="20" y1="39.2" x2="80" y2="39.2" strokeWidth="1.45" />
                        <line x1="20" y1="41.1" x2="80" y2="41.1" strokeWidth="0.6" opacity="0.68" />
                        <line x1="20" y1="58.9" x2="80" y2="58.9" strokeWidth="0.6" opacity="0.68" />
                        <line x1="20" y1="60.8" x2="80" y2="60.8" strokeWidth="1.45" />
                    </g>

                    {/* Optional killer wave cancellation lines */}
                    {waves && (
                        <g strokeWidth="2.5" strokeLinecap="round">
                            {[30, 42, 54, 66].map((y) => (
                                <path key={y} d={`M92 ${y} q10 -7 20 0 t20 0 t20 0 t20 0`} />
                            ))}
                        </g>
                    )}
                </g>

                {/* 5-point postal stars at 9 o'clock & 3 o'clock dividers */}
                <g fill={color} opacity={tone === "red" ? 0.9 : 0.85}>
                    <polygon points={starPoints(13.6, 50, 2.7)} />
                    <polygon points={starPoints(86.4, 50, 2.7)} />
                </g>

                {/* Curved top post office inscription */}
                <text
                    fill={color}
                    fontFamily="var(--font-plex), monospace"
                    fontSize={topFontSize}
                    fontWeight="700"
                    letterSpacing="1.15"
                    opacity={tone === "red" ? 0.94 : 0.9}
                >
                    <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
                        {topInscription}
                    </textPath>
                </text>

                {/* Curved bottom bilingual SRI LANKA inscription (zero letter-spacing preserves Sinhala shaping) */}
                <text
                    fill={color}
                    fontFamily="'Noto Sans Sinhala', var(--font-plex), sans-serif"
                    fontSize={bottomFontSize}
                    fontWeight="700"
                    letterSpacing="0"
                    opacity={tone === "red" ? 0.92 : 0.86}
                >
                    <textPath href={`#${id}-bot`} startOffset="50%" textAnchor="middle">
                        {bottomLabel}
                    </textPath>
                </text>

                {/* Upper crescent: stamped chronological date line */}
                {date && (
                    <text
                        x="50"
                        y="34.2"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={color}
                        fontFamily="var(--font-plex), monospace"
                        fontWeight="700"
                        fontSize="5.2"
                        letterSpacing="0.45"
                        opacity={tone === "red" ? 0.92 : 0.88}
                    >
                        {date}
                    </text>
                )}

                {/* Central bridge band: primary postal code */}
                <text
                    x="50"
                    y="50.2"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={color}
                    fontFamily="var(--font-plex), monospace"
                    fontWeight="700"
                    fontSize={centerFontSize}
                    letterSpacing="0.7"
                >
                    {code}
                </text>

                {/* Lower crescent: dispatch time + sorting bay code */}
                <g fill={color} fontFamily="var(--font-plex), monospace" opacity={tone === "red" ? 0.9 : 0.84}>
                    {time ? (
                        <text
                            x="50"
                            y="65.2"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontWeight="600"
                            fontSize="4.4"
                            letterSpacing="0.3"
                        >
                            {time}
                        </text>
                    ) : (
                        <text
                            x="50"
                            y="66.2"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontWeight="600"
                            fontSize="4.6"
                            letterSpacing="0.5"
                        >
                            SL POST
                        </text>
                    )}

                    {bay && (
                        <text
                            x="50"
                            y="71.6"
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontWeight="700"
                            fontSize="4.9"
                            letterSpacing="0.7"
                        >
                            {`· ${bay} ·`}
                        </text>
                    )}
                </g>
            </g>
        </svg>
    );
}
