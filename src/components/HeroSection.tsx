import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeroSectionProps {
    children?: React.ReactNode;
}

// Pre-generate stable particle data outside the component so it never changes
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    duration: (i % 5) * 0.6 + 3,
    delay: (i * 0.7) % 5,
    size: (i % 3) + 1,
    top: ((i * 17 + 3) % 100),
    left: ((i * 31 + 7) % 100),
}));

export default function HeroSection({ children }: HeroSectionProps) {
    return (
        <section className="relative z-[70] w-full pt-10 pb-8 md:pt-16 md:pb-12 flex items-center justify-center bg-background border-b border-border/50">

            {/* Bright Floating Aurora Background */}
            <div className="absolute inset-0 w-full h-full overflow-hidden overflow-x-clip border-b border-border/50 bg-slate-50 dark:bg-[#020817]">
                {/* Subtle grid base */}
                <div suppressHydrationWarning className="absolute inset-0 w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:3rem_3rem]" />

                {/* Floating glow effects — CSS animations instead of framer-motion */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
                    {/* Red glow */}
                    <div
                        className="hidden md:block absolute -top-[100px] -left-[100px] w-[500px] h-[500px] bg-red-600/10 dark:bg-red-600/40 rounded-full blur-[120px] animate-aurora-1"
                    />

                    {/* Gold glow */}
                    <div
                        className="hidden md:block absolute top-0 right-[-100px] w-[600px] h-[600px] bg-amber-500/10 dark:bg-amber-500/30 rounded-full blur-[130px] animate-aurora-2"
                    />

                    {/* Dark Red center-bottom */}
                    <div
                        className="hidden md:block absolute bottom-[-100px] left-[30%] w-[500px] h-[500px] bg-rose-700/10 dark:bg-rose-700/30 rounded-full blur-[140px] animate-aurora-3"
                    />
                </div>

                {/* Stars/Particles overlay — CSS animations */}
                <div className="absolute inset-0 w-full h-full opacity-60">
                    {PARTICLES.map((p) => (
                        <div
                            key={p.id}
                            className="absolute rounded-full bg-slate-300 dark:bg-white animate-particle"
                            style={{
                                width: p.size + "px",
                                height: p.size + "px",
                                top: p.top + "%",
                                left: p.left + "%",
                                animationDuration: p.duration + "s",
                                animationDelay: p.delay + "s",
                            }}
                        />
                    ))}
                </div>

                {/* Fade ONLY at the bottom where it meets the next section */}
                <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent z-10" />
            </div>

            <div className="relative z-10 container px-4 md:px-6 text-center">
                <h1
                    className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight mb-6 md:mb-4 text-foreground dark:text-white animate-fade-slide-up"
                >
                    Navigate the Island&apos;s <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-amber-500 dark:from-red-500 dark:to-amber-400">
                        Postal Network
                    </span>
                </h1>

                <p
                    className="hidden md:block mx-auto max-w-2xl text-base md:text-lg text-muted-foreground dark:text-white/80 mb-8 animate-fade-slide-up"
                    style={{ animationDelay: "0.1s" }}
                >
                    The most comprehensive directory for finding every post office, contact detail, and location across Sri Lanka.
                </p>
                {children && (
                    <div
                        className="mx-auto max-w-3xl w-full animate-fade-slide-up"
                        style={{ animationDelay: "0.2s" }}
                    >
                        {children}
                    </div>
                )}
            </div>
        </section>
    );
}
