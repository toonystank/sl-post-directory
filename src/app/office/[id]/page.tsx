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

export default async function OfficeDetails({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const office = await prisma.postOffice.findUnique({
        where: { id },
        include: {
            fields: true, // Include any dynamic fields
        }
    });

    if (!office) {
        notFound();
    }

    const typeField = office.fields.find(f => f.name === 'Type');
    const type = typeField?.value;

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl min-h-[calc(100vh-4rem)]">
            <BackButton />

            <Card className="relative overflow-hidden border-border/50 shadow-2xl bg-card/50 backdrop-blur-xl">
                {/* Background Accent */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

                <CardHeader className="relative z-10 pb-8 pt-10 px-8 md:px-12 border-b border-border/40 bg-card/80">
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
                                <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-[10px] bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20">
                                    Official Listing
                                </Badge>
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
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Hash className="w-4 h-4" />
                                </div>
                                <span className="font-medium text-sm">Postal Code</span>
                            </div>
                            <div className="flex w-full justify-between items-center mt-auto">
                                <p className="text-2xl font-bold tracking-tight">{office.postalCode}</p>
                                <CopyButton text={office.postalCode} />
                            </div>
                        </div>



                        {/* Dynamic Fields */}
                        {office.fields.filter(f => f.name !== 'Type').map((field) => (
                            <div key={field.id} className="group bg-background/50 border border-border/50 rounded-2xl p-6 flex flex-col items-start gap-4 hover:border-primary/50 transition-all hover:shadow-md hover:bg-card">
                                <div className="flex items-center gap-3 text-muted-foreground mb-2">
                                    <div className="px-3 py-1 bg-secondary/10 rounded-lg text-secondary text-xs font-semibold uppercase tracking-wider">
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
