import Link from "next/link";
import { Search, MapPin, Building2 } from "lucide-react";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function Home() {
  const postOffices = await prisma.postOffice.findMany({
    take: 12,
    orderBy: { name: 'asc' }
  });

  return (
    <div className="flex flex-col gap-12 pb-12">
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 text-center border-b border-[var(--surface-border)] overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[var(--primary)]/5 to-[var(--background)] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-[var(--primary)]/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Find Any <span className="text-[var(--primary)]">Post Office</span> in Sri Lanka
          </h1>
          <p className="text-lg md:text-xl text-[var(--text-muted)] max-w-2xl mx-auto">
            Search by name, postal code, or district to quickly find contact information and details.
          </p>

          {/* Search Bar */}
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="glass-panel flex flex-col md:flex-row p-2 rounded-2xl gap-2 shadow-lg">
              <div className="flex-1 flex items-center bg-[var(--background)] rounded-xl px-4 py-3 border border-[var(--surface-border)] focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/20 transition-all">
                <Search className="w-5 h-5 text-[var(--text-muted)] mr-3" />
                <input
                  type="text"
                  placeholder="Search by name, city, or postal code..."
                  className="w-full bg-transparent border-none outline-none text-[var(--foreground)] placeholder:text-[var(--text-muted)]"
                />
              </div>
              <button className="btn btn-primary rounded-xl px-8 py-3 text-lg whitespace-nowrap hidden md:flex">
                Search
              </button>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] text-sm hover:border-[var(--primary)] transition-colors">
                <Building2 className="w-4 h-4" /> Post Offices
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] text-sm hover:border-[var(--primary)] transition-colors">
                <Building2 className="w-4 h-4" /> Sub Post Offices
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] text-sm hover:border-[var(--primary)] transition-colors">
                <MapPin className="w-4 h-4" /> Western Province
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Directory</h2>
          <span className="text-sm text-[var(--text-muted)]">Showing {postOffices.length} results</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {postOffices.map((po) => (
            <Link href={`/office/${po.id}`} key={po.id} className="group block h-full">
              <div className="glass-panel h-full flex flex-col rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-[var(--primary)]/50">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-[var(--primary)]/10 text-[var(--primary)] rounded-lg">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--surface-border)] text-[var(--text-muted)]">
                    {po.postalCode}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-1 group-hover:text-[var(--primary)] transition-colors">{po.name}</h3>

                <div className="border-t border-[var(--surface-border)] pt-4 mt-auto">
                  <span className="text-sm text-[var(--primary)] font-medium group-hover:underline">View details →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
