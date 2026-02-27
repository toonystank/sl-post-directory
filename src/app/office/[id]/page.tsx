import { PrismaClient } from "@prisma/client";
import { CopyButton } from "@/components/CopyButton";
import { Building2, MapPin, Phone, Hash, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const prisma = new PrismaClient();

// Required for static export (Capacitor)
export async function generateStaticParams() {
    const offices = await prisma.postOffice.findMany({ select: { id: true } });
    return offices.map((office) => ({
        id: office.id.toString(),
    }));
}

export default async function OfficeDetails({ params }: { params: { id: string } }) {
    // Await the params object before accessing properties, required in Newer Next.js Server Components
    const { id } = await params;

    const office = await prisma.postOffice.findUnique({
        where: { id: parseInt(id) },
        include: {
            fields: true, // Include any dynamic fields
        }
    });

    if (!office) {
        notFound();
    }

    // Pre-define some known standard fields from the old dataset if they exist dynamically,
    // or we render them simply as key value pairs.
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Link href="/" className="inline-flex items-center text-sm text-[var(--text-muted)] hover:text-[var(--primary)] mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Directory
            </Link>

            <div className="glass-panel rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
                {/* Background Accent */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-4 bg-[var(--primary)]/10 text-[var(--primary)] rounded-2xl">
                            <Building2 className="w-8 h-8 md:w-10 md:h-10" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-5xl font-bold mb-2">{office.name}</h1>
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--surface-border)] text-[var(--text-muted)] text-sm font-medium">
                                Post Office
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">

                        {/* Core Info Cards */}
                        <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-2xl p-6 flex flex-col items-start gap-4 hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3 text-[var(--text-muted)] mb-2">
                                <Hash className="w-5 h-5 text-[var(--primary)]" />
                                <span className="font-medium">Postal Code</span>
                            </div>
                            <div className="flex w-full justify-between items-end">
                                <p className="text-2xl font-bold">{office.postalCode}</p>
                                <CopyButton text={office.postalCode} />
                            </div>
                        </div>

                        <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-2xl p-6 flex flex-col items-start gap-4 hover:border-[var(--primary)]/30 transition-colors">
                            <div className="flex items-center gap-3 text-[var(--text-muted)] mb-2">
                                <Building2 className="w-5 h-5 text-[var(--primary)]" />
                                <span className="font-medium">Office Name</span>
                            </div>
                            <div className="flex w-full justify-between items-end">
                                <p className="text-2xl font-bold">{office.name}</p>
                                <CopyButton text={office.name} />
                            </div>
                        </div>

                        {/* Dynamic Fields */}
                        {office.fields.map((field) => (
                            <div key={field.id} className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-2xl p-6 flex flex-col items-start gap-4 hover:border-[var(--primary)]/30 transition-colors">
                                <div className="flex items-center gap-3 text-[var(--text-muted)] mb-2">
                                    <span className="font-medium">{field.name}</span>
                                </div>
                                <div className="flex w-full justify-between items-end">
                                    <p className="text-xl font-bold">{field.value}</p>
                                    <CopyButton text={field.value} />
                                </div>
                            </div>
                        ))}

                    </div>

                    {/* Employee Section */}
                    <div className="mt-16 pt-8 border-t border-[var(--surface-border)] flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-1">Are you an employee here?</h3>
                            <p className="text-[var(--text-muted)] text-sm">Help keep this directory accurate by suggesting edits.</p>
                        </div>
                        <Link href={`/employee/suggest/${office.id}`} className="btn btn-secondary whitespace-nowrap">
                            Suggest an Edit
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    );
}
