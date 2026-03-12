import { prisma } from "@/lib/prisma";
import { Info, ArrowLeft, Send, Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import SuggestForm from "./SuggestForm";

export default async function SuggestEditPage({ params }: { params: Promise<{ officeId: string }> }) {
    const { officeId } = await params;

    const office = await prisma.postOffice.findUnique({
        where: { id: officeId },
        include: {
            fields: true,
        }
    });

    if (!office) {
        notFound();
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl min-h-[calc(100vh-4rem)]">
            <Button variant="ghost" asChild className="mb-8 hover:bg-primary/10 hover:text-primary transition-colors -ml-4">
                <Link href={`/office/${office.id}`}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to {office.name}
                </Link>
            </Button>

            <Card className="shadow-2xl border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden">
                <CardHeader className="border-b border-border/40 bg-card/80 px-8 pt-8 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20">
                            <Edit className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl md:text-3xl font-extrabold tracking-tight">Suggest Edits</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">For: {office.name}</p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-2 md:p-8">
                    <SuggestForm office={office} />
                </CardContent>
            </Card>
        </div>
    );
}
