import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 3D-perspective Sri Lankan hexagonal concrete pillar postbox.
 * Modeled with low-pitched faceted cap, crisp architectural ink edges,
 * projecting hooded slot, heraldic postal horn medallion, collection schedule,
 * tall hinged DQ-2 door, embossed maker plaque, and hexagonal plinth.
 */
export default function PillarBox({ className }: { className?: string }) {
    const pen = "#1A1714";
    const rawId = React.useId();
    const id = "pb-" + rawId.replace(/[^a-zA-Z0-9-]/g, "");

    return (
        <svg viewBox="0 0 240 330" className={cn("h-auto", className)} aria-hidden="true">
            <defs>
                <linearGradient id={`${id}-front-red`} x1="0" y1="0" x2="1" y2="0.9">
                    <stop offset="0%" stopColor="#D42126" />
                    <stop offset="60%" stopColor="#C1181D" />
                    <stop offset="100%" stopColor="#A61217" />
                </linearGradient>
                <linearGradient id={`${id}-left-red`} x1="0" y1="0" x2="1" y2="0.4">
                    <stop offset="0%" stopColor="#770A0F" />
                    <stop offset="100%" stopColor="#941016" />
                </linearGradient>
                <linearGradient id={`${id}-right-red`} x1="0" y1="0" x2="1" y2="0.8">
                    <stop offset="0%" stopColor="#E6362F" />
                    <stop offset="55%" stopColor="#D3221E" />
                    <stop offset="100%" stopColor="#B8161B" />
                </linearGradient>
                <linearGradient id={`${id}-roof-front`} x1="0.2" y1="0" x2="0.8" y2="1">
                    <stop offset="0%" stopColor="#EA463E" />
                    <stop offset="100%" stopColor="#C81B20" />
                </linearGradient>
                <linearGradient id={`${id}-roof-right`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F55F55" />
                    <stop offset="100%" stopColor="#DF2E2A" />
                </linearGradient>
                <linearGradient id={`${id}-roof-left`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#AD171C" />
                    <stop offset="100%" stopColor="#800C11" />
                </linearGradient>
                <linearGradient id={`${id}-plinth-front`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#26221F" />
                    <stop offset="100%" stopColor="#181513" />
                </linearGradient>
                <linearGradient id={`${id}-plinth-right`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3B3530" />
                    <stop offset="100%" stopColor="#27231F" />
                </linearGradient>
            </defs>

            {/* 3D concrete pad & contact drop shadow */}
            <polygon
                points="20,298 44,282 186,281 220,298 164,321 58,321"
                fill="hsl(var(--muted))"
                opacity="0.82"
                stroke="hsl(var(--frame))"
                strokeOpacity="0.45"
                strokeWidth="1.3"
            />
            <polygon
                points="38,298 63,309 157,309 197,297 192,303 156,314 62,314 34,301"
                fill="#0B0908"
                opacity="0.42"
            />

            {/* 3D Hexagonal Black Base Plinth */}
            <g strokeLinejoin="round">
                <polygon points="41,252 63,262 63,307 41,296" fill="#181513" />
                <polygon points="63,262 157,262 157,307 63,307" fill={`url(#${id}-plinth-front)`} />
                <polygon points="157,262 194,252 194,296 157,307" fill={`url(#${id}-plinth-right)`} />

                {/* Outer ink & subtle dark-mode rim */}
                <polyline
                    points="41,252 41,296 63,307 157,307 194,296 194,252"
                    fill="none"
                    stroke="hsl(var(--frame))"
                    strokeOpacity="0.85"
                    strokeWidth="1.4"
                />
                {/* 3D vertical corner highlights */}
                <line x1="63" y1="262" x2="63" y2="307" stroke="#0B0908" strokeWidth="1.1" />
                <line x1="157" y1="262" x2="157" y2="307" stroke="#5E564E" strokeWidth="1.2" />
                <polyline points="41,252 63,262 157,262 194,252" fill="none" stroke="#4D463F" strokeWidth="1.1" />

                {/* Embossed cast-iron maker plaque on front face (no blurry micro-text) */}
                <rect x="73" y="270" width="74" height="27" rx="1.2" fill="#171412" stroke="#423C36" strokeWidth="1.1" />
                <polyline points="73,297 73,270 147,270" fill="none" stroke="#0A0908" strokeWidth="1.4" />
                <polyline points="74,296 146,296 146,271" fill="none" stroke="#4E4740" strokeWidth="0.9" opacity="0.8" />
                {/* Corner rivets */}
                <circle cx="77" cy="274" r="1.2" fill="#524B43" />
                <circle cx="143" cy="274" r="1.2" fill="#524B43" />
                <circle cx="77" cy="293" r="1.2" fill="#524B43" />
                <circle cx="143" cy="293" r="1.2" fill="#524B43" />
                {/* Raised cast-iron relief lines */}
                <line x1="92" y1="278" x2="128" y2="278" stroke="#554E46" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                <line x1="84" y1="283.5" x2="136" y2="283.5" stroke="#554E46" strokeWidth="2" strokeLinecap="round" opacity="0.82" />
                <line x1="96" y1="289" x2="124" y2="289" stroke="#554E46" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
            </g>

            {/* 3D Stepped Chamfered Red Base Collar */}
            <g strokeLinejoin="round">
                <polygon points="41,245 63,255 63,262 41,252" fill="#7D0C11" />
                <polygon points="63,255 157,255 157,262 63,262" fill="#BC161B" />
                <polygon points="157,255 194,245 194,252 157,262" fill="#DA2824" />

                <polygon points="49,237 67,246 63,255 41,245" fill="#991116" />
                <polygon points="67,246 153,246 157,255 63,255" fill="#E83A33" />
                <polygon points="153,246 186,237 194,245 157,255" fill="#F4554C" />

                <polyline points="41,245 63,255 157,255 194,245" fill="none" stroke="#FF877D" strokeWidth="0.9" opacity="0.65" />
                <line x1="153" y1="246" x2="157" y2="255" stroke="#FF9B91" strokeWidth="1" opacity="0.7" />
                <polyline points="41,245 49,237" fill="none" stroke={pen} strokeWidth="1.4" opacity="0.75" />
                <line x1="194" y1="245" x2="186" y2="237" stroke={pen} strokeWidth="1.2" opacity="0.5" />
            </g>

            {/* 3D Hexagonal Pillar Shaft */}
            <g strokeLinejoin="round">
                <polygon points="49,52 67,61 67,246 49,237" fill={`url(#${id}-left-red)`} />
                <polygon points="67,61 153,61 153,246 67,246" fill={`url(#${id}-front-red)`} />
                <polygon points="153,61 186,52 186,237 153,246" fill={`url(#${id}-right-red)`} />

                {/* Outer ink contours & vertical bevel lines */}
                <line x1="49" y1="52" x2="49" y2="237" stroke={pen} strokeWidth="1.6" opacity="0.82" />
                <line x1="186" y1="52" x2="186" y2="237" stroke={pen} strokeWidth="1.5" opacity="0.65" />
                <line x1="67" y1="61" x2="67" y2="246" stroke="#5A070A" strokeWidth="1.3" />
                <line x1="153" y1="61" x2="153" y2="246" stroke="#FF786E" strokeWidth="1.3" opacity="0.52" />
            </g>

            {/* Front Face Relief Details (POST OFFICE, Hooded Slot, Medallion, Hours, DQ-2 Door) */}
            <g>
                {/* Upper "POST OFFICE" recessed plaque — widened to give clear horizontal margin */}
                <rect x="72" y="68" width="76" height="17" rx="1.2" fill="#9D0F14" />
                <polyline points="72,85 72,68 148,68" fill="none" stroke="#4A0508" strokeWidth="1.3" />
                <polyline points="72,85 148,85 148,68" fill="none" stroke="#F2524B" strokeWidth="1" opacity="0.85" />
                <text
                    x="110"
                    y="80"
                    textAnchor="middle"
                    textLength="58"
                    lengthAdjust="spacingAndGlyphs"
                    fill="#FAF4EC"
                    fontFamily="var(--font-archivo), sans-serif"
                    fontWeight="800"
                    fontSize="9.2"
                >
                    POST OFFICE
                </text>

                {/* 3D Protruding Hooded Mail Slot */}
                <polygon points="74,115 144,115 148,119 77,119" fill="#520609" opacity="0.6" />
                <polygon points="144,89 149,93 149,113 144,115" fill="#7D0A0F" />
                <polygon points="71,89 144,89 149,93 75,93" fill="#EF463E" />
                <rect x="74" y="93" width="70" height="22" rx="1" fill="#BF161B" stroke="#7A0B0F" strokeWidth="0.8" />
                <line x1="74" y1="93" x2="144" y2="93" stroke="#FF857D" strokeWidth="1" opacity="0.72" />
                {/* Deep dark aperture slot with inner depth ledge */}
                <rect x="81" y="97" width="58" height="12" rx="1" fill="#130506" />
                <polygon points="81,109 85,105 139,105 139,109" fill="#3B0B0D" />
                <line x1="81" y1="97" x2="139" y2="97" stroke="#080203" strokeWidth="1.2" />

                {/* Recessed Square Emblem Panel */}
                <rect x="74" y="121" width="72" height="49" rx="1.2" fill="#AD1217" />
                <polyline points="74,170 74,121 146,121" fill="none" stroke="#64070B" strokeWidth="1.3" />
                <polyline points="74,170 146,170 146,121" fill="none" stroke="#EA423C" strokeWidth="0.9" opacity="0.72" />

                {/* Raised roundel + crisp postal horn medallion */}
                <circle cx="110" cy="147" r="20" fill="#C7191E" stroke="#780A0E" strokeWidth="1.2" />
                <circle cx="110" cy="147" r="19" fill="none" stroke="#F04E47" strokeWidth="0.8" opacity="0.55" />
                {/* Embossed top crown in cream-white */}
                <path
                    d="M 104 132.5 C 103 128, 108 127, 110 129.5 C 112 127, 117 128, 116 132.5 Z"
                    fill="#FAF4EC"
                    opacity="0.94"
                />
                <rect x="103.5" y="132.7" width="13" height="1.8" rx="0.7" fill="#FAF4EC" opacity="0.92" />
                {/* Inner cream-white enamel disc */}
                <circle cx="110" cy="147" r="11.5" fill="#FAF4EC" stroke="#850E13" strokeWidth="1" />
                <circle cx="110" cy="147" r="9.4" fill="none" stroke="#C1181D" strokeWidth="0.7" opacity="0.45" />
                {/* Crisp vector postal horn emblem inside white disc */}
                <g fill="none" stroke="#201A17" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="110" cy="148.2" r="3.4" />
                    <path d="M 103.5 144.8 L 116.5 144.8" />
                    <path d="M 103 143.6 L 103 146" />
                    <polygon points="116.5,144.8 119.2,142.8 119.2,146.8" fill="#201A17" />
                    <path d="M 108.5 141.5 L 111.5 141.5" strokeWidth="1.2" />
                </g>
                {/* Lower arched motto ribbon ticks */}
                <path d="M 96.5 157 A 15 15 0 0 0 123.5 157" fill="none" stroke="#FAF4EC" strokeWidth="1.4" strokeDasharray="2 1.6" opacity="0.88" />

                {/* Clean Stencil Collection Hours */}
                <g fill="#FAF4EC" fontFamily="var(--font-plex), monospace" fontWeight="600" fontSize="6.5" opacity="0.94">
                    <text x="82" y="180" textLength="46" lengthAdjust="spacingAndGlyphs">AM - 10.30</text>
                    <text x="82" y="189.5" textLength="46" lengthAdjust="spacingAndGlyphs">PM - 14.00</text>
                </g>

                {/* 3D Projecting Drip Hood above Collection Door */}
                <polygon points="76,201 144,201 146,204 77,204" fill="#4D0508" opacity="0.65" />
                <polygon points="73,194 145,194 148,197 76,197" fill="#F14E47" />
                <rect x="75" y="196.5" width="70" height="5" rx="1" fill="#C4171C" />
                <polygon points="145,194 148,197 148,201 145,201" fill="#820B10" />

                {/* Tall Recessed Vertical Hinged Door ("DQ-2") */}
                <rect x="78" y="202" width="64" height="42" rx="1.2" fill="#AF1217" stroke="#6E090D" strokeWidth="1.2" />
                <rect x="81" y="204.5" width="58" height="37" rx="0.8" fill="none" stroke="#E73F39" strokeWidth="0.9" opacity="0.6" />
                <rect x="83" y="206.5" width="54" height="33" rx="0.6" fill="none" stroke="#6E090D" strokeWidth="0.9" />

                {/* Top-right square keyhole */}
                <rect x="121" y="208" width="7.5" height="6" rx="0.6" fill="#180809" />
                <line x1="121" y1="214" x2="128.5" y2="214" stroke="#EF4841" strokeWidth="0.7" />

                {/* Left raised oval turn-latch with shadow */}
                <ellipse cx="86.8" cy="225.8" rx="2.7" ry="4.6" fill="#560609" opacity="0.65" />
                <ellipse cx="86" cy="225" rx="2.4" ry="4.2" fill="#9E1015" stroke="#560609" strokeWidth="0.8" />
                <ellipse cx="85.4" cy="224.5" rx="1.7" ry="3.2" fill="#DE2A30" />

                {/* Right-edge 3D door barrel hinges */}
                <rect x="137.5" y="210" width="3.2" height="6" rx="1" fill="#8E0E13" stroke="#560609" strokeWidth="0.7" />
                <rect x="137.5" y="230" width="3.2" height="6" rx="1" fill="#8E0E13" stroke="#560609" strokeWidth="0.7" />

                {/* Crisp white "DQ-2" stencil */}
                <text
                    x="110"
                    y="227"
                    textAnchor="middle"
                    textLength="20"
                    lengthAdjust="spacingAndGlyphs"
                    fill="#FAF4EC"
                    fontFamily="var(--font-plex), monospace"
                    fontWeight="700"
                    fontSize="7.2"
                    opacity="0.94"
                >
                    DQ-2
                </text>
            </g>

            {/* Low-Pitched 3D Pyramidal Cap & Overhanging Eaves */}
            <g strokeLinejoin="round">
                {/* Dark recessed underside soffit where eaves overhang the shaft */}
                <polygon points="38,49 61,59 67,61 49,52" fill="#4A0508" />
                <polygon points="61,59 159,59 153,61 67,61" fill="#56070B" />
                <polygon points="159,59 196,49 186,52 153,61" fill="#7D0C12" />

                {/* Thick projecting 3-faceted eave fascia */}
                <polygon points="37,42 61,51 61,59 38,49" fill="#8E0F14" />
                <polygon points="61,51 159,51 159,59 61,59" fill="#CE1C21" />
                <polygon points="159,51 197,41 196,49 159,59" fill="#E83730" />

                {/* Eave corner ridges & ink contour */}
                <polyline points="37,42 38,49 61,59 159,59 196,49 197,41" fill="none" stroke={pen} strokeWidth="1.4" opacity="0.7" />
                <line x1="61" y1="51" x2="61" y2="59" stroke="#5E080C" strokeWidth="1.2" />
                <line x1="159" y1="51" x2="159" y2="59" stroke="#FF877E" strokeWidth="1.3" opacity="0.72" />

                {/* Three sloped pyramidal roof planes converging to low-pitched apex (112, 22) */}
                <polygon points="112,22 37,42 61,51" fill={`url(#${id}-roof-left)`} />
                <polygon points="112,22 61,51 159,51" fill={`url(#${id}-roof-front)`} />
                <polygon points="112,22 159,51 197,41" fill={`url(#${id}-roof-right)`} />

                {/* Crisp outer roof contour & ridge bevels */}
                <polyline points="37,42 112,22 197,41" fill="none" stroke={pen} strokeWidth="1.5" opacity="0.72" />
                <line x1="112" y1="22" x2="61" y2="51" stroke="#6E090D" strokeWidth="1.1" opacity="0.65" />
                <line x1="112" y1="22" x2="159" y2="51" stroke="#FF9B91" strokeWidth="1.3" opacity="0.78" />
                <polyline points="37,42 61,51 159,51 197,41" fill="none" stroke="#FF8D84" strokeWidth="1" opacity="0.65" />
                <ellipse cx="120" cy="40" rx="16" ry="4.5" transform="rotate(-7 120 40)" fill="#FF897F" opacity="0.18" />
            </g>
        </svg>
    );
}
