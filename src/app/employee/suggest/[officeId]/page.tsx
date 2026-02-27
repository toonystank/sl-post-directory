import { PrismaClient } from "@prisma/client";
import { Info, ArrowLeft, Send, Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const prisma = new PrismaClient();

// Required for static export (Capacitor)
export async function generateStaticParams() {
    const offices = await prisma.postOffice.findMany({ select: { id: true } });
    return offices.map((office) => ({
        officeId: office.id.toString(),
    }));
}

export default async function SuggestEditPage({ params }: { params: { officeId: string } }) {
    // Await params object
    const { officeId } = await params;

    const office = await prisma.postOffice.findUnique({
        where: { id: parseInt(officeId) },
        include: {
            fields: true,
        }
    });

    if (!office) {
        notFound();
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <Link href={`/office/${office.id}`} className="inline-flex items-center text-sm text-[var(--text-muted)] hover:text-[var(--primary)] mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to {office.name}
            </Link>

            <div className="glass-panel rounded-3xl p-8 md:p-12 shadow-xl">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-[var(--primary)]/10 text-[var(--primary)] rounded-xl">
                        <Edit className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold">Suggest Edits</h1>
                </div>

                <div className="mb-8 p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl flex gap-3 text-sm text-[var(--text-muted)]">
                    <Info className="w-5 h-5 flex-shrink-0 text-[var(--primary)]" />
                    <p>
                        Please enter your updated information below. All changes are subject to moderation by the admin team before they are published to the public directory.
                    </p>
                </div>

                {/* Prototype: Just a standard GET form submission since server actions require un-exportable dynamic routes */}
                <form action={`/office/${office.id}`} method="GET" className="space-y-6">
                    <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-2xl p-6 space-y-4">
                        <h3 className="font-semibold border-b border-[var(--surface-border)] pb-2 mb-4">Basic Information</h3>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Office Name</label>
                            <input type="text" name="name" defaultValue={office.name} className="w-full bg-[var(--background)] border border-[var(--surface-border)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Postal Code</label>
                            <input type="text" name="postalCode" defaultValue={office.postalCode} className="w-full bg-[var(--background)] border border-[var(--surface-border)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]" />
                        </div>
                    </div>

                    <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-2xl p-6 space-y-4">
                        <h3 className="font-semibold border-b border-[var(--surface-border)] pb-2 mb-4">Additional Fields</h3>

                        {office.fields.map(field => (
                            <div key={field.id}>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">{field.name}</label>
                                <input type="text" name={`field_${field.id}`} defaultValue={field.value} className="w-full bg-[var(--background)] border border-[var(--surface-border)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]" />
                            </div>
                        ))}

                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">New Field Name (e.g. Phone Number)</label>
                            <div className="flex gap-2">
                                <input type="text" name="newFieldName" placeholder="Field name" className="flex-1 bg-[var(--background)] border border-[var(--surface-border)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]" />
                                <input type="text" name="newFieldValue" placeholder="Value" className="flex-1 bg-[var(--background)] border border-[var(--surface-border)] rounded-xl px-4 py-2.5 outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]" />
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full btn btn-primary py-3 rounded-xl flex items-center justify-center gap-2 text-lg">
                        <Send className="w-5 h-5" /> Submit for Review
                    </button>
                </form>
            </div>
        </div>
    );
}
