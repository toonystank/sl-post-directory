import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { getLocalOfficeById } from "@/lib/local-sqlite";
import { ArrowLeft, Edit } from "lucide-react";
import { Link } from "@/navigation";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import SuggestForm from "./SuggestForm";

async function findOfficeForSuggest(officeId: string) {
    if (!hasDatabaseUrl) {
        return getLocalOfficeById(officeId);
    }
    try {
        return await prisma.postOffice.findUnique({
            where: { id: officeId },
            include: {
                fields: true,
            }
        });
    } catch {
        return getLocalOfficeById(officeId);
    }
}

export default async function SuggestEditPage({ params }: { params: Promise<{ officeId: string }> }) {
    const { officeId } = await params;

    const office = await findOfficeForSuggest(officeId);

    if (!office) {
        notFound();
    }

    return (
        <div className="container mx-auto px-4 py-6 md:py-12 max-w-3xl min-h-[calc(100vh-4rem)]">
            <Button variant="ghost" asChild className="hidden md:inline-flex mb-6 -ml-3 text-muted-foreground hover:text-foreground">
                <Link href={`/office/${office.slug}`}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to {office.name}
                </Link>
            </Button>

            <div className="border-2 border-foreground bg-card rounded-md overflow-hidden shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                <div className="airmail-stripe h-1.5" aria-hidden="true" />
                <div className="border-b-2 border-foreground px-6 py-5 md:px-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-secondary/40 border border-foreground rounded-md text-foreground">
                            <Edit className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="display text-2xl md:text-3xl">Suggest Edits</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">For: {office.name}</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 md:p-8">
                    <SuggestForm office={office} />
                </div>
            </div>
        </div>
    );
}
