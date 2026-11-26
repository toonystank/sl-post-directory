/**
 * Safe idempotent PostgreSQL enrichment importer.
 * Reads `post-office-enriched-2026-11-26.json` and upserts offices + fields in 2 passes
 * without disturbing existing Review, CommunityPhoto, EditRequest, or User relations.
 *
 * Run dry-run: npx tsx scripts/apply-postal-enrichment.ts
 * Apply to DB: npx tsx scripts/apply-postal-enrichment.ts --apply
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

interface EnrichedOffice {
    id: string;
    slug: string;
    name: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
    operatingHours: string | null;
    services: string[];
    controllingOfficeId: string | null;
    rmsc: string | null;
    fields: { name: string; value: string; type?: string }[];
}

const apply = process.argv.includes("--apply");

async function main() {
    const filePath = path.join(process.cwd(), "post-office-enriched-2026-11-26.json");
    if (!fs.existsSync(filePath)) {
        console.error("Missing post-office-enriched-2026-11-26.json. Run merge-postal-data.ts first.");
        process.exit(1);
    }

    const offices = JSON.parse(fs.readFileSync(filePath, "utf8")) as EnrichedOffice[];

    if (!process.env.DATABASE_URL) {
        console.log(
            JSON.stringify(
                {
                    mode: "DRY_RUN_NO_DATABASE_URL",
                    recordsReady: offices.length,
                    withControllingOffice: offices.filter((o) => o.controllingOfficeId).length,
                    withOperatingHours: offices.filter((o) => o.operatingHours).length,
                    withRmsc: offices.filter((o) => o.rmsc).length,
                },
                null,
                2
            )
        );
        return;
    }

    const prisma = new PrismaClient();
    try {
        const existing = await prisma.postOffice.findMany({
            select: { id: true, slug: true },
        });
        const existingIds = new Set(existing.map((e) => e.id));
        const existingBySlug = new Map(existing.map((e) => [e.slug, e.id]));

        let toUpdate = 0;
        let toCreate = 0;
        for (const o of offices) {
            if (existingIds.has(o.id) || existingBySlug.has(o.slug)) toUpdate++;
            else toCreate++;
        }

        if (!apply) {
            console.log(
                JSON.stringify(
                    {
                        mode: "DRY_RUN",
                        existingInDb: existing.length,
                        totalEnriched: offices.length,
                        toUpdate,
                        toCreate,
                    },
                    null,
                    2
                )
            );
            return;
        }

        console.log(`Pass 1/2: Upserting ${offices.length} offices and fields...`);
        const BATCH = 50;
        const resolvedIdMap = new Map<string, string>();

        for (let i = 0; i < offices.length; i += BATCH) {
            const batch = offices.slice(i, i + BATCH);
            await prisma.$transaction(async (tx) => {
                for (const o of batch) {
                    const targetId = existingIds.has(o.id)
                        ? o.id
                        : existingBySlug.get(o.slug) || o.id;
                    resolvedIdMap.set(o.id, targetId);

                    await tx.postOffice.upsert({
                        where: { id: targetId },
                        create: {
                            id: targetId,
                            slug: o.slug,
                            name: o.name,
                            postalCode: o.postalCode,
                            latitude: o.latitude,
                            longitude: o.longitude,
                            operatingHours: o.operatingHours,
                            services: o.services,
                            rmsc: o.rmsc,
                        },
                        update: {
                            name: o.name,
                            postalCode: o.postalCode,
                            latitude: o.latitude,
                            longitude: o.longitude,
                            operatingHours: o.operatingHours,
                            services: o.services,
                            rmsc: o.rmsc,
                        },
                    });

                    await tx.postOfficeField.deleteMany({ where: { postOfficeId: targetId } });
                    if (o.fields.length > 0) {
                        await tx.postOfficeField.createMany({
                            data: o.fields.map((f) => ({
                                postOfficeId: targetId,
                                name: f.name,
                                value: f.value,
                                type: f.type || "TEXT",
                            })),
                        });
                    }
                }
            });
            if ((i + BATCH) % 500 === 0 || i + BATCH >= offices.length) {
                console.log(`  Pass 1 progress: ${Math.min(i + BATCH, offices.length)}/${offices.length}`);
            }
        }

        console.log("Pass 2/2: Linking controllingOfficeId relations...");
        const withParent = offices.filter((o) => o.controllingOfficeId);
        for (let i = 0; i < withParent.length; i += BATCH) {
            const batch = withParent.slice(i, i + BATCH);
            await prisma.$transaction(
                batch.map((o) => {
                    const id = resolvedIdMap.get(o.id) || o.id;
                    const parentId = resolvedIdMap.get(o.controllingOfficeId!) || o.controllingOfficeId!;
                    return prisma.postOffice.update({
                        where: { id },
                        data: { controllingOfficeId: parentId },
                    });
                })
            );
        }

        console.log("Enrichment import completed successfully.");
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
});
