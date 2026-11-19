/**
 * One-time database cleanup script:
 * 1. Zero-pads all 1–5 digit Sri Lankan postal codes (e.g. "100" -> "00100", "1200" -> "01200").
 * 2. Formats 9-digit Sri Lankan phone numbers missing their leading zero (e.g. "672250448" -> "067 225-0448").
 * 3. Reports duplicate case-insensitive office entries where one row has no postal code (pass --delete-duplicates to remove).
 *
 * Run with: npx tsx scripts/normalize-postcodes.ts [--apply] [--delete-duplicates]
 */
import { PrismaClient } from "@prisma/client";
import { formatSriLankaPhone, normalizePostalCode } from "../src/lib/site";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const deleteDuplicates = process.argv.includes("--delete-duplicates");

async function main() {
    const offices = await prisma.postOffice.findMany({
        select: { id: true, name: true, slug: true, postalCode: true },
    });

    let codeUpdates = 0;
    const namesWithValidCode = new Set<string>();

    for (const office of offices) {
        const normalized = normalizePostalCode(office.postalCode);
        if (normalized) {
            namesWithValidCode.add(office.name.trim().toLowerCase());
        }
        if (normalized && normalized !== office.postalCode) {
            codeUpdates++;
            if (apply) {
                await prisma.postOffice.update({
                    where: { id: office.id },
                    data: { postalCode: normalized },
                });
            }
        }
    }

    const duplicatesToRemove = offices.filter((office) => {
        const hasCode = Boolean(normalizePostalCode(office.postalCode));
        return !hasCode && namesWithValidCode.has(office.name.trim().toLowerCase());
    });

    if (apply && deleteDuplicates && duplicatesToRemove.length > 0) {
        await prisma.postOffice.deleteMany({
            where: { id: { in: duplicatesToRemove.map((o) => o.id) } },
        });
    }

    const phoneFields = await prisma.postOfficeField.findMany({
        where: { name: { in: ["Phone", "Telephone"] } },
        select: { id: true, value: true },
    });

    let phoneUpdates = 0;
    for (const field of phoneFields) {
        const formatted = formatSriLankaPhone(field.value);
        if (formatted && formatted !== field.value) {
            phoneUpdates++;
            if (apply) {
                await prisma.postOfficeField.update({
                    where: { id: field.id },
                    data: { value: formatted },
                });
            }
        }
    }

    console.log(
        JSON.stringify(
            {
                mode: apply ? "APPLIED" : "DRY_RUN",
                totalOffices: offices.length,
                postalCodesToNormalize: codeUpdates,
                phonesToFormat: phoneUpdates,
                duplicateEmptyCodeOffices: duplicatesToRemove.map((d) => ({
                    id: d.id,
                    name: d.name,
                    slug: d.slug,
                })),
            },
            null,
            2
        )
    );
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
