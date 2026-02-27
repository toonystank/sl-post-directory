import Link from "next/link";
import { Search, MapPin, Building2, ChevronRight, Landmark } from "lucide-react";
import { PrismaClient } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const prisma = new PrismaClient();

export default async function Home() {
  const postOffices = await prisma.postOffice.findMany({
    take: 12,
    orderBy: { name: 'asc' }
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-40 flex items-center justify-center overflow-hidden border-b bg-background">
        {/* Abstract Background Effects */}
        <div className="absolute inset-0 w-full h-full bg-grid-white/[0.02] bg-[size:60px_60px]" />
        <div className="absolute top-0 flex items-center justify-center w-full h-full">
          <div className="w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-50 mix-blend-screen" />
          <div className="absolute w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px] opacity-40 bottom-10 right-10 mix-blend-screen" />
        </div>

        <div className="relative z-10 container px-4 md:px-6 text-center">
          <Badge variant="secondary" className="mb-6 py-1.5 px-4 text-sm rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 border-secondary/20 transition-colors">
            <Landmark className="w-4 h-4 mr-2" /> V2.0 Redesign Live
          </Badge>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-8">
            Navigate Sri Lanka's <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              Postal Network
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground mb-12">
            The most comprehensive, unified directory for finding every post office, contact detail, and location across the island.
          </p>

          {/* Search Bar Component */}
          <div className="mx-auto max-w-2xl bg-card border shadow-2xl rounded-2xl p-2 flex items-center gap-2 transition-all hover:border-primary/50 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            <div className="flex-1 flex items-center pl-4 bg-transparent">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <Input
                type="text"
                placeholder="Search by city, name, or postal code..."
                className="border-0 shadow-none focus-visible:ring-0 text-base py-6 w-full placeholder:text-muted-foreground"
              />
            </div>
            <Button size="lg" className="rounded-xl px-8 h-12 text-md font-semibold hidden sm:flex shadow-md">
              Search
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {["Colombo", "Kandy", "Galle", "Sub Post Offices"].map((tag) => (
              <Badge key={tag} variant="outline" className="px-4 py-1.5 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Directory Section */}
      <section className="container mx-auto px-4 py-20 relative z-20">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">Explore the Directory</h2>
            <p className="text-muted-foreground">Showing 12 recently updated locations</p>
          </div>
          <Button variant="outline" className="rounded-full">
            View All Map <MapPin className="ml-2 w-4 h-4" />
          </Button>
        </div>

        <Separator className="mb-10 opacity-50" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {postOffices.map((po) => (
            <Link key={po.id} href={`/office/${po.id}`} className="group h-full">
              <Card className="h-full flex flex-col hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-primary">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <Badge variant="secondary" className="font-mono bg-secondary/10 text-secondary border-none">
                      {po.postalCode}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {po.name}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pb-6 flex-1">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span>Sri Lanka</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-4 border-t border-border/40 pb-4">
                  <div className="flex items-center text-sm font-medium text-primary w-full justify-between">
                    View Details
                    <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-16 flex justify-center">
          <Button variant="secondary" size="lg" className="rounded-full px-8 shadow-sm">
            Load More Locations
          </Button>
        </div>
      </section>
    </div>
  );
}
