import { cn } from "@/lib/utils";

interface StampLogoProps {
    className?: string;
    /** Show "Lanka Post Directory" wordmark next to the stamp */
    withWordmark?: boolean;
    size?: number;
}

/**
 * Brand mark: a small red perforated postage stamp with an envelope + flight line.
 * Deliberately NOT the Sri Lanka Post logo (this project is independent).
 */
export function StampMark({ size = 36, className }: { size?: number; className?: string }) {
    const holes = [];
    // perforations every 4 units on a 40x40 stamp
    for (let i = 2; i <= 38; i += 4) {
        holes.push(<circle key={`t${i}`} cx={i} cy={0} r={1.6} />);
        holes.push(<circle key={`b${i}`} cx={i} cy={40} r={1.6} />);
        holes.push(<circle key={`l${i}`} cx={0} cy={i} r={1.6} />);
        holes.push(<circle key={`r${i}`} cx={40} cy={i} r={1.6} />);
    }
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 40 40"
            aria-hidden="true"
            className={cn("shrink-0", className)}
        >
            <defs>
                <mask id="stamp-perf">
                    <rect width="40" height="40" fill="#fff" />
                    <g fill="#000">{holes}</g>
                </mask>
            </defs>
            <g mask="url(#stamp-perf)">
                <rect width="40" height="40" fill="hsl(var(--primary))" />
                <rect x="4.5" y="4.5" width="31" height="31" fill="none" stroke="hsl(var(--primary-foreground))" strokeOpacity=".55" strokeWidth=".8" />
                {/* envelope */}
                <rect x="10" y="14" width="20" height="13" rx="1" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="1.8" />
                <path d="M10.5 14.8 20 21.5l9.5-6.7" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="1.8" strokeLinejoin="round" />
                {/* yellow flight line */}
                <path d="M7 31c6-1 10-3 14-6" fill="none" stroke="hsl(var(--secondary))" strokeWidth="1.8" strokeLinecap="round" />
            </g>
        </svg>
    );
}

export default function StampLogo({ className, withWordmark = true, size = 36 }: StampLogoProps) {
    return (
        <span className={cn("inline-flex items-center gap-2.5", className)}>
            <StampMark size={size} />
            {withWordmark && (
                <span className="flex flex-col leading-none">
                    <span className="font-heading text-[1.05rem] font-extrabold tracking-tight [font-stretch:82%]">
                        Lanka Post
                    </span>
                    <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
                        Directory
                    </span>
                </span>
            )}
        </span>
    );
}
