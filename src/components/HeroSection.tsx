"use client";

import { motion } from "framer-motion";
import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeroSectionProps {
    children?: React.ReactNode;
}

export default function HeroSection({ children }: HeroSectionProps) {
    return (
        <section className="relative z-[70] w-full pt-10 pb-8 md:pt-16 md:pb-12 flex items-center justify-center bg-background border-b border-border/50">

            {/* Background Container for clipping orbs */}
            <div className="absolute inset-0 w-full h-full overflow-hidden overflow-x-clip border-b border-border/50">
                {/* Animated Abstract Background */}
                <div className="absolute inset-0 w-full h-full bg-grid-white/[0.02] bg-[size:60px_60px]" />

                <div className="absolute top-0 flex items-center justify-center w-full h-full overflow-hidden">
                    {/* Glow Orb 1 - Cyan/Primary */}
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.5, 0.3],
                            x: [0, 50, 0],
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen"
                    />

                    {/* Glow Orb 2 - Deep Blue/Secondary */}
                    <motion.div
                        animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.2, 0.4, 0.2],
                            x: [0, -50, 0],
                            y: [0, 30, 0],
                        }}
                        transition={{
                            duration: 10,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: 1
                        }}
                        className="absolute w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[120px] bottom-[-10%] right-[-10%] mix-blend-screen"
                    />
                </div>
            </div>

            <div className="relative z-10 container px-4 md:px-6 text-center">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight mb-6 md:mb-4"
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
                    className="hidden md:block mx-auto max-w-2xl text-base md:text-lg text-muted-foreground mb-8"
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
