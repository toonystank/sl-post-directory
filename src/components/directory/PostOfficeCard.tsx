"use client";

import React, { useState } from "react";
import { Link } from "@/navigation";
import { Building2, Store, MapPin, Phone, Network, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { PostOffice } from "./types";
import AdBanner from "@/components/ads/AdBanner";
import { useTranslations } from "next-intl";
import { getPostOfficeStatus } from "@/lib/holidays";
import { useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";

const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string; dotClass: string }> = {
    open: {
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/30",
        dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
    },
    closed: {
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]",
    },
    "counter-only": {
        color: "text-amber-400",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
        dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
    },
    holiday: {
        color: "text-purple-400",
        bgColor: "bg-purple-500/10",
        borderColor: "border-purple-500/30",
        dotClass: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]",
    },
};

interface PostOfficeCardProps {
    office: PostOffice;
    index: number;
}

export default function PostOfficeCard({ office, index }: PostOfficeCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const fieldMap = Object.fromEntries(office.fields.map(f => [f.name, f.value]));
    const type = fieldMap["Type"];
    const phone = fieldMap["Phone"];
    const division = fieldMap["Division"];
    const delivery = fieldMap["Delivery"];
    const is24Hour = fieldMap["Is24Hour"] === "true";
    const isRealPostcode = office.postalCode && office.postalCode.length > 0;

    const locale = useLocale();
    const t = useTranslations("Status");
    const currentStatus = getPostOfficeStatus(locale, is24Hour);
    const style = statusConfig[currentStatus.status];

    const showAdAfter = index > 0 && index % 5 === 0;
    
    const hasSubOffices = office.controlledOffices && office.controlledOffices.length > 0;

    return (
        <React.Fragment>
            <div className="group relative flex flex-col h-full bg-card/60 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_30px_-5px_rgba(220,38,38,0.15)]">
                {/* Techy top border accent */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
                
                <Link href={`/office/${office.id}`} className="flex-1 flex flex-col p-5 relative z-10">
                    {/* Header Row */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3 items-center">
                            <div className="w-12 h-12 rounded-lg bg-background/80 border border-border/60 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/40 transition-colors shadow-inner">
                                {type === "Sub Post office" ? <Store className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-1">{office.name}</h3>
                                {type && <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{type}</p>}
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1.5">
                            {/* Status Indicator */}
                            <div className={`px-2.5 py-1 rounded-sm text-[10px] uppercase tracking-widest font-bold border flex items-center gap-1.5 ${style.bgColor} ${style.color} ${style.borderColor}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${style.dotClass}`} />
                                {currentStatus.status === "holiday" ? t("holiday") : t(currentStatus.label)}
                            </div>
                            
                            {isRealPostcode && (
                                <div className="px-2 py-0.5 rounded-sm font-mono text-[10px] bg-background border border-border text-foreground tracking-wider">
                                    {office.postalCode}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Meta Info Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {division && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/40 p-2 rounded-md border border-border/30">
                                <MapPin className="w-4 h-4 text-primary/70 shrink-0" />
                                <span className="truncate">{division}</span>
                            </div>
                        )}
                        {phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/40 p-2 rounded-md border border-border/30">
                                <Phone className="w-4 h-4 text-primary/70 shrink-0" />
                                <span className="truncate font-mono text-xs">{phone}</span>
                            </div>
                        )}
                    </div>
                    
                    {/* RMSC & Hierarchy Indicators */}
                    <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-border/40">
                        {office.rmsc && (
                            <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-muted-foreground">RMSC/TPO:</span>
                                <span className="text-secondary tracking-wider font-semibold">{office.rmsc}</span>
                            </div>
                        )}
                        
                        {office.controllingOffice && (
                            <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-muted-foreground">Controlled by:</span>
                                <span className="text-primary tracking-wider truncate max-w-[150px]">{office.controllingOffice.name}</span>
                            </div>
                        )}
                    </div>
                </Link>

                {/* Interactive Sub-Offices Accordion */}
                {hasSubOffices && (
                    <div className="border-t border-border/40 bg-background/30 backdrop-blur-sm z-20">
                        <button 
                            onClick={(e) => { e.preventDefault(); setIsExpanded(!isExpanded); }}
                            className="w-full flex items-center justify-between p-3 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Network className="w-4 h-4" />
                                View {office.controlledOffices!.length} Sub-Offices
                            </span>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-3 pt-0 max-h-[200px] overflow-y-auto scrollbar-hide flex flex-col gap-1.5">
                                        {office.controlledOffices!.map(sub => (
                                            <Link 
                                                key={sub.id} 
                                                href={`/office/${sub.id}`}
                                                className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/40 hover:border-primary/40 hover:bg-primary/10 transition-colors group/sub"
                                            >
                                                <span className="text-xs font-medium text-foreground group-hover/sub:text-primary transition-colors truncate">
                                                    {sub.name}
                                                </span>
                                                <span className="text-[10px] font-mono text-muted-foreground">
                                                    {sub.postalCode}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {showAdAfter && <AdBanner position="in-feed" className="col-span-1 sm:col-span-2 xl:col-span-3" />}
        </React.Fragment>
    );
}
