import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CopyButton } from "@/components/CopyButton";
import { BackButton } from "@/components/BackButton";
import { Building2, Store, Hash, PenLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import PhotoUpload from "@/components/office/PhotoUpload";
import PhotoGallery from "@/components/office/PhotoGallery";
import { PhotoUploadClient } from "./PhotoUploadClient";

export const revalidate = 86400; // Cache the post office page for 24 hours

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    
    const office = await prisma.postOffice.findUnique({
        where: { id },
        include: { fields: true }
    });

    if (!office) {
        return {
            title: "Post Office Not Found",
        }
    }

    const typeField = office.fields.find(f => f.name === 'Type')?.value || 'Post Office';
    const description = `Details, contact information, and operating hours for ${office.name} (${typeField}) - Postal Code ${office.postalCode}, Sri Lanka.`;

    return {
        title: office.name,
        description,
        alternates: {
            canonical: `/office/${office.id}`,
        },
        openGraph: {
            title: office.name,
            description,
            url: `https://postagedirectory.vercel.app/office/${office.id}`,
        },
    }
}

export default async function OfficeDetails({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const office = await prisma.postOffice.findUnique({
        where: { id },
        include: {
            fields: true, // Include any dynamic fields
            photos: {
                where: { status: "APPROVED" },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!office) {
        notFound();
    }

    const typeField = office.fields.find(f => f.name === 'Type');
    const type = typeField?.value;

    const is24HourField = office.fields.find(f => f.name === 'Is24Hour');
    const is24Hour = is24HourField?.value === 'true';

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "GovernmentOffice",
        "name": office.name,
        "address": {
            "@type": "PostalAddress",
            "postalCode": office.postalCode,
            "addressCountry": "LK"
        },
        "url": `https://postagedirectory.vercel.app/office/${office.id}`,
        "telephone": office.fields.find(f => f.name === 'Telephone' || f.name === 'Phone')?.value,
        "openingHours": is24Hour ? "Mo-Su 00:00-23:59" : undefined,
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl min-h-[calc(100vh-4rem)]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <BackButton />

            <Card className="relative overflow-hidden border-border/50 shadow-2xl bg-card/50 backdrop-blur-xl">
                {/* Background Accent */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

                <CardHeader className="relative z-10 pb-8 pt-10 px-8 md:px-12 border-b border-border/40">
                    <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-primary/10 text-primary rounded-2xl ring-1 ring-primary/20">
                                {type === "Sub Post office" ? (
                                    <Store className="w-10 h-10" />
                                ) : (
                                    <Building2 className="w-10 h-10" />
                                )}
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <Badge variant="outline" className="uppercase tracking-wider text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                                        Official Listing
                                    </Badge>
                                    {is24Hour && (
                                        <Badge variant="outline" className="uppercase tracking-wider text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 px-2 py-0.5 rounded-md font-semibold">
                                            Open 24 Hours
                                        </Badge>
                                    )}
                                </div>
                                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2">
                                    {office.name}
                                </h1>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="relative z-10 p-8 md:p-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Core Info Cards */}
                        <div className="group bg-background/50 border border-border/50 rounded-2xl p-6 flex flex-col items-start gap-4 hover:border-primary/50 transition-all hover:shadow-md hover:bg-card">
                            <div className="flex items-center gap-3 text-muted-foreground mb-2">
                                <div className="px-3 py-1 bg-primary/10 rounded-lg text-primary text-xs font-semibold uppercase tracking-wider border border-primary/20">
                                    <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Postal Code</span>
                                </div>
                            </div>
                            <div className="flex w-full justify-between items-center mt-auto">
                                <p className="text-2xl font-bold tracking-tight">{office.postalCode}</p>
                                <CopyButton text={office.postalCode} />
                            </div>
                        </div>



                        {/* Dynamic Fields */}
                        {office.fields.filter(f => f.name !== 'Type' && f.name !== 'Is24Hour').map((field) => (
                            <div key={field.id} className="group bg-background/50 border border-border/50 rounded-2xl p-6 flex flex-col items-start gap-4 hover:border-primary/50 transition-all hover:shadow-md hover:bg-card">
                                <div className="flex items-center gap-3 text-muted-foreground mb-2">
                                    <div className="px-3 py-1 bg-blue-500/10 rounded-lg text-blue-400 text-xs font-semibold uppercase tracking-wider border border-blue-500/20">
                                        {field.name}
                                    </div>
                                </div>
                                <div className="flex w-full justify-between items-center mt-auto">
                                    <p className="text-lg font-bold tracking-tight">{field.value}</p>
                                    <CopyButton text={field.value} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Community Photos Section */}
                    <Separator className="my-12 opacity-50" />
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight mb-1">Community Photos</h2>
                                <p className="text-sm text-muted-foreground">Photos uploaded by people visiting this post office.</p>
                            </div>
                        </div>
                        
                        <PhotoGallery 
                            photos={office.photos.map(p => ({ ...p, caption: p.caption ?? undefined }))} 
                            officeName={office.name} 
                        />
                        
                        <div className="mt-8 pt-8 border-t border-border/30">
                            <h3 className="text-lg font-semibold mb-4">Add a Photo</h3>
                            <PhotoUploadClient officeId={office.id} />
                        </div>
                    </div>

                    {/* Suggestion Section */}
                    <Separator className="my-12 opacity-50" />

                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-primary/5 p-6 rounded-2xl border border-primary/10">
                        <div>
                            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                                <PenLine className="w-5 h-5 text-primary" /> Do you work here?
                            </h3>
                            <p className="text-muted-foreground text-sm">Help keep this directory accurate by suggesting edits to the information above.</p>
                        </div>
                        <Button asChild size="lg" className="shrink-0 w-full md:w-auto rounded-xl">
                            <Link href={`/suggest/${office.id}`}>
                                Suggest an Edit
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
