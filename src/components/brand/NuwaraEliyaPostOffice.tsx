"use client";

import React, { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

interface NuwaraEliyaPostOfficeProps {
    className?: string;
    /** Whether the parent search bar is expanded (adjusts veil balance for input legibility). */
    expanded?: boolean;
}

/**
 * Refined palette drawn directly from the 1894 Nuwara Eliya Post Office:
 * warm terracotta brick with crisp white pointing, clay roof tiles, dark timber eaves,
 * white multi-pane sash windows, and misty upcountry hills & foliage.
 */
const P = {
    brick: "#B94437",
    brickShade: "#943227",
    mortar: "#F2DFD5",
    timber: "#5B231C",
    eave: "#3E1F19",
    tile: "#C8673F",
    tileShade: "#A24D2B",
    trim: "#FBF7EF",
    glass: "#5C7185",
    glassReflect: "#8EA5B8",
    porchDepth: "#36201C",
    hillFar: "#D5DFD4",
    hillMid: "#BFCFB9",
    hillNear: "#A8BD9F",
    treeBack: "#5B7A5D",
    treeMid: "#436247",
    treeDark: "#324C37",
    hedge: "#87A652",
    hedgeLight: "#A2BC64",
    hedgeDark: "#69873E",
    lawn: "#94B163",
    stone: "#8F8A80",
    stoneLight: "#B0AAA0",
    flowerA: "#E2643B",
    flowerB: "#EBB038",
    pillarBox: "#C8102E",
};

const GROUND = 186;

/** Organic layered conifer / eucalyptus tree silhouette */
function Conifer({
    x,
    top,
    w,
    fill,
    base = GROUND,
}: {
    x: number;
    top: number;
    w: number;
    fill: string;
    base?: number;
}) {
    const h = base - top;
    const y = (f: number) => (top + h * f).toFixed(1);
    return (
        <path
            fill={fill}
            d={`M${x} ${top}
                C${x + w * 0.16} ${y(0.16)}, ${x + w * 0.34} ${y(0.24)}, ${x + w * 0.24} ${y(0.32)}
                C${x + w * 0.42} ${y(0.44)}, ${x + w * 0.48} ${y(0.54)}, ${x + w * 0.32} ${y(0.60)}
                C${x + w * 0.52} ${y(0.72)}, ${x + w * 0.54} ${y(0.84)}, ${x + w * 0.14} ${y(0.88)}
                L${x + w * 0.08} ${base} L${x - w * 0.08} ${base} L${x - w * 0.14} ${y(0.88)}
                C${x - w * 0.54} ${y(0.84)}, ${x - w * 0.52} ${y(0.72)}, ${x - w * 0.32} ${y(0.60)}
                C${x - w * 0.48} ${y(0.54)}, ${x - w * 0.42} ${y(0.44)}, ${x - w * 0.24} ${y(0.32)}
                C${x - w * 0.34} ${y(0.24)}, ${x - w * 0.16} ${y(0.16)}, ${x} ${top} Z`}
        />
    );
}

/** Soft rounded upcountry canopy cluster */
function Canopy({
    cx,
    cy,
    r,
    fill,
}: {
    cx: number;
    cy: number;
    r: number;
    fill: string;
}) {
    return (
        <g fill={fill}>
            <circle cx={cx} cy={cy} r={r} />
            <circle cx={cx - r * 0.72} cy={cy + r * 0.28} r={r * 0.72} />
            <circle cx={cx + r * 0.72} cy={cy + r * 0.24} r={r * 0.76} />
            <circle cx={cx - r * 0.25} cy={cy - r * 0.42} r={r * 0.65} />
            <circle cx={cx + r * 0.32} cy={cy - r * 0.35} r={r * 0.62} />
        </g>
    );
}

/** Crisp white multi-pane colonial sash window */
function SashWindow({
    x,
    y,
    w,
    h,
    cols = 2,
    rows = 3,
}: {
    x: number;
    y: number;
    w: number;
    h: number;
    cols?: number;
    rows?: number;
}) {
    const pad = 1.6;
    const gx = x + pad;
    const gy = y + pad;
    const gw = w - pad * 2;
    const gh = h - pad * 2;

    const muntins: string[] = [];
    for (let c = 1; c < cols; c++) {
        const mx = (gx + (gw * c) / cols).toFixed(1);
        muntins.push(`M${mx} ${gy} V${gy + gh}`);
    }
    for (let r = 1; r < rows; r++) {
        const my = (gy + (gh * r) / rows).toFixed(1);
        muntins.push(`M${gx} ${my} H${gx + gw}`);
    }

    return (
        <g>
            <rect x={x} y={y} width={w} height={h} rx="0.6" fill={P.trim} />
            <rect x={gx} y={gy} width={gw} height={gh} fill={P.glass} />
            {/* Soft diagonal glass reflection */}
            <polygon
                points={`${gx},${gy} ${gx + gw * 0.55},${gy} ${gx},${gy + gh * 0.55}`}
                fill={P.glassReflect}
                opacity="0.38"
            />
            {muntins.length > 0 && (
                <path d={muntins.join(" ")} stroke={P.trim} strokeWidth="0.95" />
            )}
            <rect x={x - 1} y={y + h} width={w + 2} height="1.8" rx="0.5" fill={P.trim} />
        </g>
    );
}

/** Signature Nuwara Eliya dark-timber gabled entrance porch on red pillars with white king-post truss */
function EntrancePorch({
    cx,
    halfW,
    peakY,
    eaveY,
}: {
    cx: number;
    halfW: number;
    peakY: number;
    eaveY: number;
}) {
    const inner = halfW - 6;
    const innerPeak = peakY + 7;
    const innerEave = eaveY - 2;
    const postW = 4.2;

    return (
        <g>
            {/* Shaded veranda opening */}
            <rect
                x={cx - inner + 3}
                y={innerEave}
                width={(inner - 3) * 2}
                height={GROUND - innerEave}
                fill={P.porchDepth}
                opacity="0.82"
            />
            {/* Warm sunlit doorway/glazing inside */}
            <rect
                x={cx - inner * 0.52}
                y={innerEave + 6}
                width={inner * 1.04}
                height={GROUND - innerEave - 8}
                fill={P.trim}
                opacity="0.72"
            />
            <rect
                x={cx - inner * 0.42}
                y={innerEave + 8}
                width={inner * 0.84}
                height={GROUND - innerEave - 12}
                fill={P.glass}
                opacity="0.65"
            />
            {/* Red-brick porch pillars with white capitals & bases */}
            {[cx - inner + 1, cx + inner - postW - 1].map((px) => (
                <g key={px}>
                    <rect x={px} y={innerEave} width={postW} height={GROUND - innerEave} fill={P.brick} />
                    <rect x={px - 1} y={innerEave} width={postW + 2} height="2.6" fill={P.trim} />
                    <rect x={px - 1} y={GROUND - 4} width={postW + 2} height="4" fill={P.eave} />
                </g>
            ))}
            {/* Pitched terracotta gable roof */}
            <polygon
                points={`${cx - halfW},${eaveY} ${cx},${peakY} ${cx + halfW},${eaveY}`}
                fill={P.tileShade}
            />
            <polygon
                points={`${cx - halfW + 3},${eaveY} ${cx},${peakY + 3} ${cx},${eaveY}`}
                fill={P.tile}
            />
            {/* Recessed dark gable face + iconic white king-post truss */}
            <polygon
                points={`${cx - inner},${innerEave} ${cx},${innerPeak} ${cx + inner},${innerEave}`}
                fill={P.eave}
            />
            <path
                d={`M${cx} ${innerPeak + 1.5} V${innerEave - 1.5}
                    M${cx - inner + 2.5} ${innerEave - 2} H${cx + inner - 2.5}
                    M${cx} ${innerEave - 2} L${cx - inner * 0.45} ${innerEave - 2 - (innerEave - innerPeak) * 0.46}
                    M${cx} ${innerEave - 2} L${cx + inner * 0.45} ${innerEave - 2 - (innerEave - innerPeak) * 0.46}`}
                stroke={P.trim}
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            {/* Crisp bargeboard & ridge finial */}
            <path
                d={`M${cx - halfW} ${eaveY} L${cx} ${peakY} L${cx + halfW} ${eaveY}`}
                fill="none"
                stroke={P.eave}
                strokeWidth="2.2"
                strokeLinejoin="round"
            />
            <line x1={cx} y1={peakY - 4} x2={cx} y2={peakY + 1} stroke={P.eave} strokeWidth="1.4" />
        </g>
    );
}

/** Steep Tudor front-facing gable with terracotta roof, dark bargeboard & half-timbered red brick face */
function TudorGable({
    x,
    w,
    peakY,
    eaveY,
    brickFill,
    tileFill,
}: {
    x: number;
    w: number;
    peakY: number;
    eaveY: number;
    brickFill: string;
    tileFill: string;
}) {
    const cx = x + w / 2;
    const ov = 7;
    const inset = 5;
    const fPeak = peakY + 7;
    const fh = eaveY - fPeak;
    const lx = x + inset + (w / 2 - inset) * 0.46;
    const rx = x + w - inset - (w / 2 - inset) * 0.46;
    const midY = fPeak + fh * 0.54;

    return (
        <g>
            {/* Roof overhang */}
            <polygon points={`${x - ov},${eaveY + 3} ${cx},${peakY} ${x + w + ov},${eaveY + 3}`} fill={tileFill} />
            {/* Gable brick triangle */}
            <polygon points={`${x + inset},${eaveY} ${cx},${fPeak} ${x + w - inset},${eaveY}`} fill={brickFill} />
            {/* Half-timber diagonal & vertical framing */}
            <path
                d={`M${cx} ${fPeak} V${eaveY}
                    M${lx.toFixed(1)} ${midY.toFixed(1)} V${eaveY}
                    M${rx.toFixed(1)} ${midY.toFixed(1)} V${eaveY}
                    M${lx.toFixed(1)} ${eaveY} L${cx} ${midY.toFixed(1)} L${rx.toFixed(1)} ${eaveY}
                    M${x + inset} ${eaveY} H${x + w - inset}`}
                fill="none"
                stroke={P.timber}
                strokeWidth="1.6"
            />
            {/* Dark timber bargeboard */}
            <path
                d={`M${x - ov} ${eaveY + 3} L${cx} ${peakY} L${x + w + ov} ${eaveY + 3}`}
                fill="none"
                stroke={P.eave}
                strokeWidth="2.4"
                strokeLinejoin="round"
            />
        </g>
    );
}

/**
 * Authentic, un-stretched panoramic illustration of the historic 1894 Nuwara Eliya Post Office.
 *
 * Layout math (`viewBox="0 0 1200 200"`, `preserveAspectRatio="xMidYMid slice"`):
 *  - The core Post Office building occupies `x = 418..782` (364×172 → natural 2.1:1 proportions,
 *    never horizontally stretched).
 *  - Upcountry misty hills, eucalyptus/cypress groves, manicured hedges, flowerbeds & stone
 *    retaining wall extend organically from `x = 0` to `x = 1200`, covering the search bar from
 *    start to end in collapsed mode.
 *  - In expanded mode (`414×216` up to `672×180`), `xMidYMid slice` centers the entire Post
 *    Office (clock tower spire, twin porches, main hall, grand right Tudor gable) unclipped.
 */
const NuwaraEliyaPostOffice = React.memo(function NuwaraEliyaPostOffice({
    className,
}: NuwaraEliyaPostOfficeProps) {
    const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const brickId = `ne-brick-${uid}`;
    const tileId = `ne-tile-${uid}`;
    const spireId = `ne-spire-${uid}`;
    const skyId = `ne-sky-${uid}`;
    const veilId = `ne-veil-${uid}`;

    const brickFill = `url(#${brickId})`;
    const tileFill = `url(#${tileId})`;
    const hillsRef = useRef<SVGGElement>(null);

    // Subtle vertical parallax on the distant misty ridges only (building stays centered)
    useEffect(() => {
        let rafId: number | null = null;
        const apply = () => {
            const y = Math.min(Math.max(window.scrollY || 0, 0), 600) * 0.025;
            if (hillsRef.current) {
                hillsRef.current.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
            }
            rafId = null;
        };
        const onScroll = () => {
            if (rafId === null) rafId = window.requestAnimationFrame(apply);
        };
        apply();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, []);

    return (
        <div
            aria-hidden="true"
            data-testid="nuwara-eliya-search-illustration"
            className={cn(
                "pointer-events-none absolute inset-0 overflow-hidden select-none z-0",
                className
            )}
        >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full aspect-[6/1] min-h-full transform-gpu [contain:layout_paint]">
            <svg
                viewBox="0 0 1200 200"
                preserveAspectRatio="xMidYMid slice"
                className="h-full w-full dark:brightness-[0.65] dark:saturate-[0.78]"
            >
                <defs>
                    {/* Authentic red-brick with fine white Nuwara Eliya mortar pointing */}
                    <pattern id={brickId} width="8" height="4.5" patternUnits="userSpaceOnUse">
                        <rect width="8" height="4.5" fill={P.brick} />
                        <path
                            d="M0 2.25 H8 M4 0 V2.25 M0 2.25 V4.5 M8 2.25 V4.5"
                            stroke={P.mortar}
                            strokeWidth="0.45"
                            opacity="0.58"
                        />
                    </pattern>
                    {/* Terracotta Calicut-style roof tiles */}
                    <pattern id={tileId} width="7" height="5" patternUnits="userSpaceOnUse">
                        <rect width="7" height="5" fill={P.tile} />
                        <path d="M0 4.6 H7 M3.5 0 V4.6" stroke={P.tileShade} strokeWidth="0.7" />
                    </pattern>
                    {/* Steep pyramidal spire shingle tiles */}
                    <pattern id={spireId} width="5" height="4.5" patternUnits="userSpaceOnUse">
                        <rect width="5" height="4.5" fill={P.tile} />
                        <path
                            d="M0 4 Q1.25 2.4 2.5 4 Q3.75 2.4 5 4"
                            fill="none"
                            stroke={P.tileShade}
                            strokeWidth="0.65"
                        />
                    </pattern>
                    {/* Soft upcountry sky wash */}
                    <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E6EFF2" stopOpacity="0.55" />
                        <stop offset="65%" stopColor="#F5EFE3" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#EFE6D5" stopOpacity="0.2" />
                    </linearGradient>
                    {/* Static card-coloured readability veil (never mutated on expand so SVG stays cached) */}
                    <linearGradient id={veilId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity={0.62} />
                        <stop offset="48%" stopColor="hsl(var(--card))" stopOpacity={0.54} />
                        <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity={0.46} />
                    </linearGradient>
                </defs>

                {/* Soft sky */}
                <rect width="1200" height="200" fill={`url(#${skyId})`} />

                {/* ── Distant misty Pidurutalagala / Nuwara Eliya ridges (edge-to-edge) ── */}
                <g ref={hillsRef} style={{ willChange: "transform" }}>
                    <path
                        d="M0 200 V106 C130 78 260 94 410 76 C560 58 720 66 880 82 C1020 96 1120 74 1200 84 V200 Z"
                        fill={P.hillFar}
                    />
                    <path
                        d="M0 200 V132 C160 112 310 124 490 108 C670 92 840 106 1020 116 C1110 121 1160 112 1200 118 V200 Z"
                        fill={P.hillMid}
                    />
                    <path
                        d="M0 200 V152 C210 140 420 148 640 140 C860 132 1040 144 1200 140 V200 Z"
                        fill={P.hillNear}
                    />
                </g>

                {/* ── Lush Upcountry Trees & Foliage flanking both sides (edge-to-edge) ── */}
                <g>
                    {/* Left wooded hillside */}
                    <Canopy cx={64} cy={138} r={26} fill={P.treeBack} />
                    <Canopy cx={170} cy={142} r={24} fill={P.treeBack} />
                    <Canopy cx={278} cy={132} r={28} fill={P.treeBack} />
                    <Canopy cx={386} cy={112} r={26} fill={P.treeBack} />
                    <Conifer x={26} top={74} w={38} fill={P.treeMid} />
                    <Conifer x={112} top={64} w={42} fill={P.treeDark} />
                    <Conifer x={218} top={82} w={36} fill={P.treeMid} />
                    <Conifer x={324} top={58} w={44} fill={P.treeDark} />
                    <Conifer x={366} top={86} w={32} fill={P.treeMid} />
                    {/* Tall eucalyptus behind clock tower (seen in reference photos) */}
                    <Canopy cx={496} cy={62} r={20} fill={P.treeBack} />
                    <Canopy cx={554} cy={70} r={24} fill={P.treeMid} />
                    <Canopy cx={630} cy={74} r={22} fill={P.treeBack} />

                    {/* Right wooded hillside */}
                    <Canopy cx={816} cy={104} r={28} fill={P.treeBack} />
                    <Canopy cx={918} cy={128} r={26} fill={P.treeBack} />
                    <Canopy cx={1038} cy={136} r={26} fill={P.treeBack} />
                    <Canopy cx={1144} cy={132} r={28} fill={P.treeBack} />
                    <Conifer x={862} top={62} w={42} fill={P.treeDark} />
                    <Conifer x={968} top={76} w={38} fill={P.treeMid} />
                    <Conifer x={1082} top={60} w={44} fill={P.treeDark} />
                    <Conifer x={1168} top={82} w={36} fill={P.treeMid} />
                </g>

                {/* ═══════════════════════════════════════════════════════════════════════════
                    CORE 1894 NUWARA ELIYA POST OFFICE (x = 418..782, natural ~2.1:1 ratio)
                   ═══════════════════════════════════════════════════════════════════════════ */}

                {/* ── 1. Iconic Slim Pyramidal Clock Tower (left-of-center) ── */}
                <g>
                    {/* Tower shaft */}
                    <rect x="492" y="64" width="32" height="122" fill={brickFill} />
                    <rect x="492" y="64" width="5" height="122" fill={P.brickShade} opacity="0.35" />
                    {/* Eave band under spire */}
                    <rect x="489" y="61" width="38" height="4.5" fill={P.eave} />
                    {/* Signature circular white clock face */}
                    <circle cx="508" cy="80" r="10.2" fill={P.trim} />
                    <circle cx="508" cy="80" r="8.6" fill="none" stroke={P.brickShade} strokeWidth="1.4" />
                    <circle
                        cx="508"
                        cy="80"
                        r="6.4"
                        fill="none"
                        stroke={P.eave}
                        strokeWidth="0.65"
                        strokeDasharray="1.1 2"
                    />
                    <path
                        d="M508 80 V74.5 M508 80 L512.2 81.8"
                        stroke={P.eave}
                        strokeWidth="1.35"
                        strokeLinecap="round"
                    />
                    {/* Steep pyramidal terracotta spire + finial */}
                    <polygon points="486,62 508,16 530,62" fill={`url(#${spireId})`} />
                    <polygon points="508,16 530,62 514,62" fill={P.tileShade} opacity="0.45" />
                    <path
                        d="M486 62 L508 16 L530 62"
                        fill="none"
                        stroke={P.eave}
                        strokeWidth="2"
                        strokeLinejoin="round"
                    />
                    <line x1="508" y1="16" x2="508" y2="9" stroke={P.eave} strokeWidth="1.5" />
                    <circle cx="508" cy="9" r="1.6" fill={P.eave} />
                </g>

                {/* ── 2. Central Two-Storey Hall & Steep Hipped Roof ── */}
                <g>
                    <rect x="524" y="106" width="144" height="80" fill={brickFill} />
                    {/* Subtle half-timber upper band */}
                    <path
                        d="M524 106 H668 M524 128 H668 M556 106 V128 M592 106 V128 M628 106 V128"
                        stroke={P.timber}
                        strokeWidth="1.3"
                    />
                    {/* Upper story windows */}
                    <SashWindow x={568} y={111} w={16} h={14} cols={2} rows={2} />
                    <SashWindow x={604} y={111} w={16} h={14} cols={2} rows={2} />
                    <SashWindow x={638} y={111} w={16} h={14} cols={2} rows={2} />

                    {/* Main terracotta roof */}
                    <polygon points="518,108 552,78 656,78 676,108" fill={tileFill} />
                    <path
                        d="M518 108 L552 78 H656 L676 108"
                        fill="none"
                        stroke={P.eave}
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                    />
                    {/* Small central roof dormer (iconic detail from reference photos 2 & 3) */}
                    <polygon points="586,96 600,79 614,96" fill={P.tileShade} />
                    <polygon points="590,96 600,84 610,96" fill={P.eave} />
                    <SashWindow x={594.5} y={87.5} w={11} h={8} cols={2} rows={1} />
                </g>

                {/* ── 3. Front-Facing Left Tudor Gable (right in front of the clock tower) ── */}
                <g>
                    <rect x="504" y="102" width="58" height="44" fill={brickFill} />
                    <path
                        d="M504 102 V146 M533 102 V146 M562 102 V146 M504 126 H562"
                        stroke={P.timber}
                        strokeWidth="1.4"
                    />
                    <SashWindow x={524} y={107} w={18} h={18} cols={2} rows={3} />
                    <TudorGable
                        x={502}
                        w={62}
                        peakY={66}
                        eaveY={102}
                        brickFill={brickFill}
                        tileFill={tileFill}
                    />
                </g>

                {/* ── 4. Grand Two-Storey Right Tudor Wing (focal right mass) ── */}
                <g>
                    <rect x="646" y="92" width="92" height="94" fill={brickFill} />
                    {/* Rich half-timbering across upper & lower floors */}
                    <path
                        d="M646 92 H738 M646 132 H738 M646 154 H738
                           M668 92 V186 M692 92 V186 M716 92 V186
                           M646 132 L668 92 M738 132 L716 92"
                        fill="none"
                        stroke={P.timber}
                        strokeWidth="1.6"
                    />
                    {/* Tall colonial upper sash windows */}
                    <SashWindow x={656} y={99} w={20} h={28} cols={2} rows={4} />
                    <SashWindow x={708} y={99} w={20} h={28} cols={2} rows={4} />
                    {/* Lower sash windows & entry */}
                    <SashWindow x={654} y={144} w={22} h={28} cols={2} rows={4} />
                    <SashWindow x={708} y={144} w={22} h={28} cols={2} rows={4} />
                    <rect x="683" y="152" width="18" height="34" fill={P.eave} />
                    <rect x="685.5" y="155" width="13" height="29" fill={P.glass} />
                    {/* Steep main Tudor gable */}
                    <TudorGable
                        x={644}
                        w={96}
                        peakY={48}
                        eaveY={92}
                        brickFill={brickFill}
                        tileFill={tileFill}
                    />
                    {/* Gable attic window */}
                    <SashWindow x={683} y={66} w={18} h={20} cols={2} rows={3} />
                </g>

                {/* ── 5. Far-Right Low Side Annex + White-Capped Brick Gate Pillar ── */}
                <g>
                    <rect x="738" y="146" width="44" height="40" fill={brickFill} />
                    <SashWindow x={748} y={154} w={22} h={20} cols={2} rows={3} />
                    <polygon points="736,148 756,126 786,148" fill={tileFill} />
                    <path
                        d="M736 148 L756 126 L786 148"
                        fill="none"
                        stroke={P.eave}
                        strokeWidth="2"
                        strokeLinejoin="round"
                    />
                    {/* Gate pillar (seen in photo 1) */}
                    <rect x="782" y="156" width="7" height="30" fill={P.brick} />
                    <rect x="781" y="154" width="9" height="3" fill={P.trim} />
                    <circle cx="785.5" cy="152.5" r="2.2" fill={P.trim} />
                </g>

                {/* ── 6. Left Single-Storey Veranda Wing ── */}
                <g>
                    <rect x="418" y="150" width="98" height="36" fill={brickFill} />
                    <SashWindow x={428} y={157} w={22} h={22} cols={3} rows={3} />
                    <SashWindow x={456} y={157} w={22} h={22} cols={3} rows={3} />
                    <SashWindow x={484} y={157} w={22} h={22} cols={3} rows={3} />
                    {/* Sloped terracotta veranda roof */}
                    <polygon points="410,152 436,128 524,128 524,152" fill={tileFill} />
                    <path
                        d="M410 152 L436 128 H524"
                        fill="none"
                        stroke={P.eave}
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                    />
                    <rect x="410" y="151" width="114" height="2.4" fill={P.eave} />
                </g>

                {/* ── 7. Front Single-Storey Veranda & Iconic Twin Gabled Porches ── */}
                <g>
                    <rect x="516" y="148" width="136" height="38" fill={brickFill} />
                    <SashWindow x={582} y={156} w={22} h={22} cols={3} rows={3} />
                    <SashWindow x={610} y={156} w={26} h={22} cols={3} rows={3} />
                    <polygon points="512,150 532,126 654,126 660,150" fill={tileFill} />
                    <path
                        d="M512 150 L532 126 H654 L660 150"
                        fill="none"
                        stroke={P.eave}
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                    />
                    <rect x="512" y="149" width="148" height="2.4" fill={P.eave} />

                    {/* Twin gabled entrance porches (signature feature in photos 1–4) */}
                    <EntrancePorch cx={506} halfW={28} peakY={120} eaveY={152} />
                    <EntrancePorch cx={560} halfW={32} peakY={116} eaveY={152} />

                    {/* Iconic Red Sri Lanka Pillar Box */}
                    <rect x="640" y="166" width="7.5" height="20" rx="2.5" fill={P.pillarBox} />
                    <rect x="639" y="164.5" width="9.5" height="3" rx="1.2" fill={P.eave} />
                    <rect x="641.5" y="171" width="4.5" height="1.8" fill={P.trim} />
                </g>

                {/* ── 8. Edge-to-Edge Nuwara Eliya Garden Hedges, Flowers, Retaining Wall & Lawn ── */}
                <g>
                    {/* Low stone retaining wall on flanking garden edges */}
                    <rect x="0" y={GROUND - 4} width="414" height="4" fill={P.stone} opacity="0.65" />
                    <rect x="789" y={GROUND - 4} width="411" height="4" fill={P.stone} opacity="0.65" />

                    {/* Neatly clipped hedges & ornamental shrubs across full 0..1200 width */}
                    {[
                        [24, 34, 15, P.hedgeDark],
                        [68, 40, 14, P.hedge],
                        [124, 46, 16, P.hedgeDark],
                        [182, 38, 13, P.hedgeLight],
                        [238, 48, 16, P.hedge],
                        [298, 42, 15, P.hedgeDark],
                        [354, 44, 17, P.hedge],
                        [400, 34, 14, P.hedgeLight],
                        [454, 38, 13, P.hedge],
                        [598, 34, 12, P.hedgeLight],
                        [628, 28, 11, P.hedge],
                        [758, 32, 13, P.hedgeLight],
                        [812, 42, 16, P.hedge],
                        [868, 46, 15, P.hedgeDark],
                        [928, 40, 14, P.hedgeLight],
                        [986, 48, 16, P.hedge],
                        [1048, 44, 15, P.hedgeDark],
                        [1106, 42, 14, P.hedge],
                        [1168, 48, 17, P.hedgeDark],
                    ].map(([cx, w, h, fill]) => (
                        <ellipse
                            key={cx as number}
                            cx={cx as number}
                            cy={GROUND - (h as number) / 2 + 2}
                            rx={(w as number) / 2}
                            ry={(h as number) / 2}
                            fill={fill as string}
                        />
                    ))}

                    {/* Subtle Nuwara Eliya garden flowerbeds (marigold & crimson) */}
                    {[152, 268, 378, 468, 610, 766, 842, 956, 1076].map((fx) => (
                        <g key={fx}>
                            <circle cx={fx} cy={GROUND - 3} r="1.8" fill={P.flowerA} />
                            <circle cx={fx + 4.5} cy={GROUND - 4.5} r="1.6" fill={P.flowerB} />
                            <circle cx={fx + 9} cy={GROUND - 2.8} r="1.8" fill={P.flowerA} />
                        </g>
                    ))}

                    {/* Manicured green lawn strip */}
                    <rect x="0" y={GROUND} width="1200" height={200 - GROUND} fill={P.lawn} />
                    <line
                        x1="0"
                        y1={GROUND + 0.5}
                        x2="1200"
                        y2={GROUND + 0.5}
                        stroke={P.stoneLight}
                        strokeWidth="1.2"
                        opacity="0.7"
                    />
                </g>

                {/* Smooth card-coloured veil so search text & chips always stay crisp */}
                <rect width="1200" height="200" fill={`url(#${veilId})`} />
            </svg>
            </div>
        </div>
    );
});

export default NuwaraEliyaPostOffice;
