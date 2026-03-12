"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
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
            <div className="absolute inset-0 w-full h-full overflow-hidden overflow-x-clip border-b border-border/50 bg-[#020817]">
                {/* Subtle grid base */}
                <div className="absolute inset-0 w-full h-full bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:3rem_3rem]" />

                {/* Floating glow effects */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
                    {/* Pink/Magenta glow */}
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 0.9, 1],
                            x: ["0%", "20%", "-10%", "0%"],
                            y: ["0%", "15%", "-15%", "0%"],
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -top-[100px] -left-[100px] w-[500px] h-[500px] bg-fuchsia-600/40 rounded-full blur-[120px]"
                    />

                    {/* Blue/Cyan glow */}
                    <motion.div
                        animate={{
                            scale: [0.9, 1.3, 1, 0.9],
                            x: ["0%", "-30%", "10%", "0%"],
                            y: ["0%", "-20%", "20%", "0%"],
                        }}
                        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute top-0 right-[-100px] w-[600px] h-[600px] bg-blue-600/40 rounded-full blur-[130px]"
                    />

                    {/* Teal/Emerald glow in center-bottom */}
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 0.9, 1],
                            x: ["-10%", "20%", "-5%", "-10%"],
                            y: ["10%", "-15%", "5%", "10%"],
                        }}
                        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute bottom-[-100px] left-[30%] w-[500px] h-[500px] bg-teal-500/30 rounded-full blur-[140px]"
                    />
                </div>

                {/* Stars/Particles overlay */}
                <div className="absolute inset-0 w-full h-full opacity-60">
                    {PARTICLES.map((p) => (
                        <motion.div
                            key={p.id}
                            animate={{
                                y: [0, -30, 0],
                                opacity: [0.2, 0.8, 0.2],
                                scale: [1, 1.5, 1],
                            }}
                            transition={{
                                duration: p.duration,
                                repeat: Infinity,
                                delay: p.delay,
                            }}
                            className="absolute rounded-full bg-white"
                            style={{
                                width: p.size + "px",
                                height: p.size + "px",
                                top: p.top + "%",
                                left: p.left + "%",
                            }}
                        />
                    ))}
                </div>

                {/* Fade ONLY at the bottom where it meets the next section */}
                <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent z-10" />
            </div>

            <div className="relative z-10 container px-4 md:px-6 text-center">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight mb-6 md:mb-4 text-white"
                >
                    Navigate the Island&apos;s <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                        Postal Network
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="hidden md:block mx-auto max-w-2xl text-base md:text-lg text-white/80 mb-8"
                >
                    The most comprehensive directory for finding every post office, contact detail, and location across Sri Lanka.
                </motion.p>
                {children && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="mx-auto max-w-3xl w-full"
                    >
                        {children}
                    </motion.div>
                )}
            </div>
        </section>
    );
}
