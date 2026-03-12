"use client";

import React from "react";
import { Link } from "@/navigation";
import { Building2, Store, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostOffice } from "./types";
import AdBanner from "@/components/ads/AdBanner";
import { useTranslations } from "next-intl";
import { getPostOfficeStatus } from "@/lib/holidays";
import { useLocale } from "next-intl";

const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: string }> = {
    open: {
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/20",
        icon: "🟢",
    },
    closed: {
        color: "text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/20",
        icon: "🔴",
    },
    "counter-only": {
        color: "text-amber-400",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/20",
        icon: "🟡",
    },
    holiday: {
        color: "text-purple-400",
        bgColor: "bg-purple-500/10",
        borderColor: "border-purple-500/20",
        icon: "🟣",
    },
};

interface PostOfficeCardProps {
    office: PostOffice;
    index: number;
}

export default function PostOfficeCard({ office, index }: PostOfficeCardProps) {
    const fieldMap = Object.fromEntries(office.fields.map(f => [f.name, f.value]));
    const type = fieldMap["Type"];
    const phone = fieldMap["Phone"];
    const division = fieldMap["Division"];
    const delivery = fieldMap["Delivery"];
    const isRealPostcode = office.postalCode && office.postalCode.length > 0;

    const locale = useLocale();
    const t = useTranslations("Status");
    const currentStatus = getPostOfficeStatus(locale);
    const style = statusConfig[currentStatus.status];

    // Insert an ad every 6th item (not for the very first item though)
    const showAdAfter = index > 0 && index % 5 === 0;

    return (
        <React.Fragment>
            <Link href={`/office/${office.id}`} className="group h-full">
                <Card className="h-full flex flex-col bg-card/40 backdrop-blur-sm hover:bg-card hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                    <CardHeader className="px-5 pt-4 pb-2">
                        <div className="flex justify-between items-start mb-2.5">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-105 transition-all duration-300 text-primary shadow-inner">
                                {type === "Sub Post office" ? (
                                    <Store className="w-5 h-5" />
                                ) : (
                                    <Building2 className="w-5 h-5" />
                                )}
                            </div>
                            <div className="flex gap-1.5 flex-col items-end">
                                {/* Status Badge */}
                                <div className={`px-2 py-0.5 rounded-md text-xs uppercase tracking-wider font-medium border flex items-center gap-1 ${style.bgColor} ${style.color} ${style.borderColor}`}>
                                    <span className="text-[10px]">{style.icon}</span>
                                    {currentStatus.status === "holiday" ? t("holiday") : t(currentStatus.label)}
                                </div>
                                {isRealPostcode && (
                                    <div className="px-2 py-0.5 rounded-md font-mono text-xs uppercase tracking-wider bg-primary/10 text-primary font-medium border border-primary/20">
                                        {office.postalCode}
                                    </div>
                                )}
                                {delivery === "Yes" && (
                                    <div className="px-2 py-0.5 rounded-md text-xs uppercase tracking-wider bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                                        Delivery
                                    </div>
                                )}
                            </div>
                        </div>
                        <CardTitle className="text-base group-hover:text-primary transition-colors leading-tight line-clamp-2">
                            {office.name}
                        </CardTitle>
                        {type && (
                            <p className="text-xs text-primary/80 mt-1 font-medium">{type}</p>
                        )}
                    </CardHeader>

                    <CardContent className="px-5 pb-4 flex-1">
                        <div className="space-y-2.5 text-sm text-muted-foreground mt-1">
                            {division && (
                                <div className="flex items-center gap-2.5">
                                    <MapPin className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                                    <span className="truncate">{division}</span>
                                </div>
                            )}
                            {phone && (
                                <div className="flex items-center gap-2.5">
                                    <Phone className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                                    <span>{phone}</span>
                                </div>
                            )}
                        </div>
                        {office.services && office.services.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/30">
                                {office.services.map((service, idx) => (
                                    <span key={idx} className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 font-medium">
                                        {service}
                                    </span>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </Link>
            {showAdAfter && <AdBanner position="in-feed" className="col-span-1 sm:col-span-2 xl:col-span-3" />}
        </React.Fragment>
    );
}
