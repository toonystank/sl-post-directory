"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface NuwaraEliyaPostOfficeProps {
    className?: string;
}

/**
 * Panoramic Tudor-revival architectural illustration of the historic 1894
 * Nuwara Eliya Post Office embedded inside the Home search bar.
 * Reacts smoothly to page scroll (`window.scrollY`) via direct DOM refs
 * (zero React state re-renders on scroll frames for 60fps mobile performance).
 */
export default function NuwaraEliyaPostOffice({ className }: NuwaraEliyaPostOfficeProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const bgGroupRef = useRef<SVGGElement>(null);
    const fgGroupRef = useRef<SVGGElement>(null);

    useEffect(() => {
        let rafId: number | null = null;
        const applyParallax = () => {
            const rawScroll = window.scrollY || 0;
            const clamped = Math.min(Math.max(rawScroll, 0), 700);
            const bgShiftX = -(clamped * 0.08);
            const bgShiftY = clamped * 0.035;
            const fgShiftX = -(clamped * 0.16);
            const fgShiftY = -(clamped * 0.05);

            if (containerRef.current) {
                containerRef.current.setAttribute("data-scroll-offset", String(Math.round(clamped)));
            }
            if (bgGroupRef.current) {
                bgGroupRef.current.style.transform = `translate3d(${bgShiftX.toFixed(1)}px, ${bgShiftY.toFixed(1)}px, 0)`;
            }
            if (fgGroupRef.current) {
                fgGroupRef.current.style.transform = `translate3d(${fgShiftX.toFixed(1)}px, ${fgShiftY.toFixed(1)}px, 0)`;
            }
            rafId = null;
        };

        const onScroll = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(applyParallax);
        };

        applyParallax();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            aria-hidden="true"
            data-testid="nuwara-eliya-search-illustration"
            data-scroll-offset="0"
            className={cn(
                "pointer-events-none absolute inset-0 overflow-hidden select-none z-0",
                className
            )}
        >
            <svg
                viewBox="0 0 920 116"
                preserveAspectRatio="xMidYMid slice"
                className="h-full w-full"
            >
                <defs>
                    <linearGradient id="ne-sky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FBF6EC" stopOpacity="0.95" />
                        <stop offset="60%" stopColor="#F5EBD8" stopOpacity="0.88" />
                        <stop offset="100%" stopColor="#EFE1C6" stopOpacity="0.92" />
                    </linearGradient>
                    <linearGradient id="ne-sky-dark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#161924" stopOpacity="0.96" />
                        <stop offset="55%" stopColor="#1E212E" stopOpacity="0.92" />
                        <stop offset="100%" stopColor="#26211F" stopOpacity="0.94" />
                    </linearGradient>
                    <pattern id="ne-brick" width="12" height="6" patternUnits="userSpaceOnUse">
                        <rect width="12" height="6" fill="#B83B2B" />
                        <path d="M0 3 H12 M6 0 V3 M0 3 V6 M12 3 V6" stroke="#8F2619" strokeWidth="0.7" />
                    </pattern>
                    <pattern id="ne-roof" width="8" height="5" patternUnits="userSpaceOnUse">
                        <rect width="8" height="5" fill="#7C2D12" />
                        <path d="M0 2.5 H8 M4 0 V5" stroke="#451A03" strokeWidth="0.65" />
                    </pattern>
                </defs>

                {/* Soft parchment sky (Day Post) & Upcountry twilight sky (Night Mail) */}
                <rect width="920" height="116" fill="url(#ne-sky)" className="dark:hidden" />
                <rect width="920" height="116" fill="url(#ne-sky-dark)" className="hidden dark:block" />

                {/* Distant Hakgala & Pidurutalagala misty hill silhouettes + clouds (slow parallax layer) */}
                <g
                    ref={bgGroupRef}
                    style={{
                        transform: "translate3d(0px, 0px, 0)",
                        willChange: "transform",
                    }}
                    className="opacity-75 dark:opacity-80"
                >
                    <path
                        d="M-40 116 L-40 68 Q70 32 180 62 T390 50 T610 58 T820 44 L980 66 L980 116 Z"
                        className="fill-[#D8CEBE] dark:fill-[#252836]"
                    />
                    <path
                        d="M-20 116 L-20 82 Q120 54 260 76 T530 64 T790 70 L960 80 L960 116 Z"
                        className="fill-[#C6B9A5] dark:fill-[#2D2A32]"
                    />
                    {/* Upcountry mist bands */}
                    <rect x="40" y="42" width="170" height="5" rx="2.5" className="fill-white opacity-65 dark:fill-[#94A3B8] dark:opacity-20" />
                    <rect x="640" y="34" width="190" height="5" rx="2.5" className="fill-white opacity-65 dark:fill-[#94A3B8] dark:opacity-20" />
                </g>

                {/* Foreground Nuwara Eliya 1894 Tudor Post Office & Cypress Trees (faster scroll-linked layer) */}
                <g
                    ref={fgGroupRef}
                    style={{
                        transform: "translate3d(0px, 0px, 0)",
                        willChange: "transform",
                    }}
                    className="opacity-85 dark:opacity-80"
                >
                    {/* Left upcountry pine & cypress trees */}
                    <g fill="#2F5233" stroke="#1A1714" strokeWidth="1.1">
                        <polygon points="95,114 110,54 125,114" />
                        <polygon points="100,88 110,46 120,88" fill="#3B693F" />
                        <polygon points="130,114 143,62 156,114" />
                        <polygon points="160,114 170,72 180,114" fill="#3B693F" />
                    </g>

                    {/* Left Annex Wing */}
                    <rect x="184" y="68" width="92" height="46" fill="url(#ne-brick)" stroke="#1A1714" strokeWidth="1.4" />
                    <polygon points="178,68 230,38 282,68" fill="url(#ne-roof)" stroke="#1A1714" strokeWidth="1.4" />
                    {/* Tudor half-timbered gable on left wing */}
                    <polygon points="202,68 230,44 258,68" className="fill-[#FAF6EE] dark:fill-[#D6CCC0]" stroke="#1A1714" strokeWidth="1.3" />
                    <path d="M230 44 V68 M216 56 V68 M244 56 V68 M208 62 H252" stroke="#1A1714" strokeWidth="1.2" />
                    {/* Left wing mullioned windows (warm lantern glow in dark mode) */}
                    <rect x="198" y="78" width="16" height="20" rx="1" className="fill-[#FAF6EE] dark:fill-[#FCD34D]" stroke="#1A1714" strokeWidth="1.2" />
                    <path d="M206 78 V98 M198 88 H214" stroke="#1A1714" strokeWidth="0.9" />
                    <rect x="222" y="78" width="16" height="20" rx="1" className="fill-[#FAF6EE] dark:fill-[#FCD34D]" stroke="#1A1714" strokeWidth="1.2" />
                    <path d="M230 78 V98 M222 88 H238" stroke="#1A1714" strokeWidth="0.9" />
                    <rect x="246" y="78" width="16" height="20" rx="1" className="fill-[#FAF6EE] dark:fill-[#FCD34D]" stroke="#1A1714" strokeWidth="1.2" />
                    <path d="M254 78 V98 M246 88 H262" stroke="#1A1714" strokeWidth="0.9" />

                    {/* Iconic 1894 Clock Tower (Left-Center Focal Spire) */}
                    <rect x="276" y="34" width="46" height="80" fill="url(#ne-brick)" stroke="#1A1714" strokeWidth="1.5" />
                    {/* White corner quoins on clock tower */}
                    <path
                        d="M276 40 H282 M276 48 H282 M276 56 H282 M276 64 H282 M276 72 H282 M276 80 H282 M316 40 H322 M316 48 H322 M316 56 H322 M316 64 H322 M316 72 H322 M316 80 H322"
                        className="stroke-[#FAF6EE] dark:stroke-[#D6CCC0]"
                        strokeWidth="2.2"
                    />
                    {/* Steep pyramidal slate spire + finial */}
                    <polygon points="271,34 299,4 327,34" fill="#334155" stroke="#1A1714" strokeWidth="1.5" />
                    <polygon points="292,26 299,14 306,26" className="fill-[#FAF6EE] dark:fill-[#D6CCC0]" stroke="#1A1714" strokeWidth="1.1" />
                    <line x1="299" y1="0" x2="299" y2="5" stroke="#1A1714" strokeWidth="1.5" />
                    {/* Clock face (illuminated warm amber dial in dark mode) */}
                    <circle cx="299" cy="49" r="10.5" className="fill-[#FAF6EE] dark:fill-[#FDE68A]" stroke="#1A1714" strokeWidth="1.5" />
                    <circle cx="299" cy="49" r="8" fill="none" stroke="#1A1714" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
                    <path d="M299 49 L299 43 M299 49 L304 51" stroke="#1A1714" strokeWidth="1.4" strokeLinecap="round" />
                    {/* Tower arched window & entrance */}
                    <path d="M291 74 A8 8 0 0 1 307 74 V86 H291 Z" className="fill-[#FAF6EE] dark:fill-[#FCD34D]" stroke="#1A1714" strokeWidth="1.2" />
                    <path d="M290 114 V96 A9 9 0 0 1 308 96 V114 Z" fill="#451A03" stroke="#1A1714" strokeWidth="1.3" />

                    {/* Central Main Postal Hall */}
                    <rect x="322" y="56" width="168" height="58" fill="url(#ne-brick)" stroke="#1A1714" strokeWidth="1.5" />
                    <polygon points="318,56 345,32 495,32 512,56" fill="url(#ne-roof)" stroke="#1A1714" strokeWidth="1.5" />
                    {/* Central Dormer Gable */}
                    <polygon points="384,56 404,36 424,56" className="fill-[#FAF6EE] dark:fill-[#D6CCC0]" stroke="#1A1714" strokeWidth="1.3" />
                    <rect x="398" y="45" width="12" height="11" className="fill-[#334155] dark:fill-[#F59E0B]" stroke="#1A1714" strokeWidth="1.1" />
                    {/* Brick Chimneys */}
                    <rect x="352" y="20" width="10" height="16" fill="#991B1B" stroke="#1A1714" strokeWidth="1.3" />
                    <rect x="456" y="18" width="12" height="18" fill="#991B1B" stroke="#1A1714" strokeWidth="1.3" />

                    {/* Upper floor windows + white stone lintels */}
                    {[336, 366, 396, 426, 456].map((x) => (
                        <g key={x}>
                            <rect x={x} y="64" width="16" height="16" rx="1" className="fill-[#FAF6EE] dark:fill-[#FCD34D]" stroke="#1A1714" strokeWidth="1.2" />
                            <path d={`M${x + 8} 64 V80 M${x} 72 H${x + 16}`} stroke="#1A1714" strokeWidth="0.9" />
                        </g>
                    ))}

                    {/* Ground-floor arched colonnade (signature Nuwara Eliya Post Office arcade) */}
                    {[334, 368, 402, 436].map((x) => (
                        <g key={x}>
                            <path
                                d={`M${x} 114 V96 A11 10 0 0 1 ${x + 22} 96 V114 Z`}
                                className="fill-[#FAF6EE] dark:fill-[#D6CCC0]"
                                stroke="#1A1714"
                                strokeWidth="1.3"
                            />
                            <path
                                d={`M${x + 3} 114 V97 A8 7 0 0 1 ${x + 19} 97 V114 Z`}
                                className="fill-[#334155] dark:fill-[#F59E0B]/85"
                            />
                        </g>
                    ))}

                    {/* Grand Right Tudor Gable Wing */}
                    <rect x="490" y="52" width="118" height="62" fill="url(#ne-brick)" stroke="#1A1714" strokeWidth="1.5" />
                    <polygon points="482,58 549,14 616,58" fill="url(#ne-roof)" stroke="#1A1714" strokeWidth="1.5" />
                    {/* Decorative Tudor white & black half-timbered main gable */}
                    <polygon points="494,58 549,21 604,58" className="fill-[#FAF6EE] dark:fill-[#D6CCC0]" stroke="#1A1714" strokeWidth="1.4" />
                    <path
                        d="M549 21 V58 M528 35 V58 M570 35 V58 M512 46 H586 M528 46 L549 33 L570 46"
                        stroke="#1A1714"
                        strokeWidth="1.5"
                    />
                    {/* Twin Gable Windows */}
                    <rect x="531" y="47" width="14" height="11" className="fill-[#334155] dark:fill-[#F59E0B]" stroke="#1A1714" strokeWidth="1.1" />
                    <rect x="553" y="47" width="14" height="11" className="fill-[#334155] dark:fill-[#F59E0B]" stroke="#1A1714" strokeWidth="1.1" />
                    {/* Right Wing Ground Archway & Bay Windows */}
                    <rect x="504" y="72" width="22" height="24" rx="1" className="fill-[#FAF6EE] dark:fill-[#FCD34D]" stroke="#1A1714" strokeWidth="1.2" />
                    <path d="M515 72 V96 M504 84 H526" stroke="#1A1714" strokeWidth="1" />
                    <path d="M536 114 V88 A13 12 0 0 1 562 88 V114 Z" fill="#7C2D12" stroke="#1A1714" strokeWidth="1.4" />
                    <rect x="572" y="72" width="22" height="24" rx="1" className="fill-[#FAF6EE] dark:fill-[#FCD34D]" stroke="#1A1714" strokeWidth="1.2" />
                    <path d="M583 72 V96 M572 84 H594" stroke="#1A1714" strokeWidth="1" />

                    {/* Far-Right Low Pavilion + Miniature Red Pillar Box outside the entrance */}
                    <rect x="608" y="74" width="68" height="40" fill="url(#ne-brick)" stroke="#1A1714" strokeWidth="1.4" />
                    <polygon points="604,74 642,48 682,74" fill="url(#ne-roof)" stroke="#1A1714" strokeWidth="1.4" />
                    <rect x="624" y="84" width="16" height="18" className="fill-[#FAF6EE] dark:fill-[#FCD34D]" stroke="#1A1714" strokeWidth="1.2" />
                    <rect x="648" y="84" width="16" height="18" className="fill-[#FAF6EE] dark:fill-[#FCD34D]" stroke="#1A1714" strokeWidth="1.2" />

                    {/* Red Pillar Box standing in front of the Post Office */}
                    <rect x="472" y="94" width="10" height="20" rx="2" fill="#DC2626" stroke="#1A1714" strokeWidth="1.2" />
                    <rect x="474" y="99" width="6" height="3" fill="#FAF6EE" />

                    {/* Right upcountry cypress & pine trees */}
                    <g fill="#2F5233" stroke="#1A1714" strokeWidth="1.1">
                        <polygon points="688,114 702,52 716,114" />
                        <polygon points="712,114 726,44 740,114" fill="#3B693F" />
                        <polygon points="742,114 755,60 768,114" />
                        <polygon points="774,114 786,68 798,114" fill="#3B693F" />
                    </g>

                    {/* Ground baseline */}
                    <line x1="0" y1="114.5" x2="920" y2="114.5" stroke="#1A1714" strokeWidth="1.5" />
                </g>

                {/* Soft parchment/night veil so un-stroked foreground text has clean, effortless contrast */}
                <rect
                    width="920"
                    height="116"
                    fill="hsl(var(--card))"
                    className="opacity-[0.64] dark:opacity-[0.58]"
                />
            </svg>
        </div>
    );
}
