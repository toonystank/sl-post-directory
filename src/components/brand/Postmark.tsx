import { cn } from "@/lib/utils";

interface PostmarkProps {
    code: string;
    size?: "sm" | "md" | "lg";
    /** ink = foreground colour, red = postal red */
    tone?: "ink" | "red";
    /** Draw the wavy cancellation lines to the right */
    waves?: boolean;
    rotate?: number;
    label?: string;
    className?: string;
}

const SIZES = {
    sm: { box: 52 },
    md: { box: 76 },
    lg: { box: 138 },
};

/**
 * A postcode rendered as an authentic rubber cancellation stamp.
 * Pure SVG, scales crisply and inherits colours from theme tokens.
 */
export default function Postmark({
    code,
    size = "md",
    tone = "ink",
    waves = false,
    rotate = -8,
    label = "SRI LANKA",
    className,
}: PostmarkProps) {
    const { box } = SIZES[size];
    const color = tone === "red" ? "hsl(var(--primary))" : "hsl(var(--foreground))";
    const width = waves ? box * 1.75 : box;
    const showRingText = size !== "sm";
    const id = `pm-${size}-${code}-${label}`.replace(/[^a-zA-Z0-9-]/g, "");
    const filterId = `${id}-ink`;

    const centerFontSize = showRingText
        ? code.length > 6
            ? 10
            : code.length > 4
                ? 12
                : 14.5
        : code.length > 4
            ? 17.5
            : 20.5;

    return (
        <svg
            width={width}
            height={box}
            viewBox={`0 0 ${waves ? 175 : 100} 100`}
            role="img"
            aria-label={`Postal code ${code}`}
            className={cn("shrink-0 overflow-visible", className)}
            style={{ transform: `rotate(${rotate}deg)` }}
        >
            {showRingText && (
                <defs>
                    {/* Top clockwise arc: baseline inside outer double rim */}
                    <path id={`${id}-top`} d="M 16.5,50 A 33.5,33.5 0 1,1 83.5,50" />
                    {/* Bottom counter-clockwise arc: reads upright left-to-right */}
                    <path id={`${id}-bot`} d="M 11,50 A 39,39 0 0,0 89,50" />
                    {size === "lg" && (
                        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.065" numOctaves="2" seed="7" result="noise" />
                            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.9" xChannelSelector="R" yChannelSelector="G" />
                        </filter>
                    )}
                </defs>
            )}

            <g filter={size === "lg" ? `url(#${filterId})` : undefined}>
                <g fill="none" stroke={color} opacity={tone === "red" ? 0.92 : 0.86}>
                    <circle cx="50" cy="50" r="46.5" strokeWidth={showRingText ? 2.4 : 3} />
                    {showRingText ? (
                        <>
                            <circle cx="50" cy="50" r="43.2" strokeWidth="0.9" opacity="0.7" />
                            <circle cx="50" cy="50" r="28.5" strokeWidth="1.5" />
                            {/* Bridge bars framing central postcode */}
                            <line x1="23.5" y1="39" x2="76.5" y2="39" strokeWidth="1.3" />
                            <line x1="23.5" y1="61" x2="76.5" y2="61" strokeWidth="1.3" />
                            {/* Inner segment crescent accents */}
                            <path d="M 35 33 Q 50 27 65 33" strokeWidth="0.95" opacity="0.7" />
                            <path d="M 35 67 Q 50 73 65 67" strokeWidth="0.95" opacity="0.7" />
                        </>
                    ) : (
                        <circle cx="50" cy="50" r="38" strokeWidth="1.5" />
                    )}
                    {waves && (
                        <g strokeWidth="2.6" strokeLinecap="round">
                            {[30, 42, 54, 66].map((y) => (
                                <path key={y} d={`M92 ${y} q10 -7 20 0 t20 0 t20 0 t20 0`} />
                            ))}
                        </g>
                    )}
                </g>

                {showRingText && (
                    <>
                        <text
                            fill={color}
                            fontFamily="var(--font-plex), monospace"
                            fontSize="7"
                            fontWeight="700"
                            letterSpacing="1.35"
                            opacity={tone === "red" ? 0.92 : 0.88}
                        >
                            <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
                                {`★ ${label} · POST ★`}
                            </textPath>
                        </text>
                        <text
                            fill={color}
                            fontFamily="var(--font-plex), monospace"
                            fontSize="7"
                            fontWeight="600"
                            letterSpacing="1.6"
                            opacity={tone === "red" ? 0.9 : 0.82}
                        >
                            <textPath href={`#${id}-bot`} startOffset="50%" textAnchor="middle">
                                {"· SRI LANKA ·"}
                            </textPath>
                        </text>
                    </>
                )}

                <text
                    x="50"
                    y="50"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={color}
                    fontFamily="var(--font-plex), monospace"
                    fontWeight="700"
                    fontSize={centerFontSize}
                    letterSpacing="0.8"
                >
                    {code}
                </text>
            </g>
        </svg>
    );
}
