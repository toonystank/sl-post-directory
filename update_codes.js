const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const fields = await prisma.postOfficeField.findMany({
        where: {
            name: { in: ['Short Code', 'DistCode'] }
        }
    });

    // Group by postOfficeId
    const byOffice = {};
    for (const f of fields) {
        byOffice[f.postOfficeId] = byOffice[f.postOfficeId] || [];
        byOffice[f.postOfficeId].push(f);
    }

    let updatedCount = 0;
    let deletedCount = 0;

    for (const [officeId, officeFields] of Object.entries(byOffice)) {
        if (officeFields.length > 1) {
            // It has both 'Short Code' and 'DistCode', or multiple of the same
            // Keep one, delete the rest, and rename the kept one to 'Code'

            const toKeep = officeFields[0];
            await prisma.postOfficeField.update({
                where: { id: toKeep.id },
                data: { name: 'Code' }
            });
            updatedCount++;

            for (let i = 1; i < officeFields.length; i++) {
                await prisma.postOfficeField.delete({
                    where: { id: officeFields[i].id }
                });
                deletedCount++;
            }
        } else {
            // It just has one
            await prisma.postOfficeField.update({
                where: { id: officeFields[0].id },
                data: { name: 'Code' }
            });
            updatedCount++;
        }
    }

    console.log(`Updated ${updatedCount} fields to 'Code'. Deleted ${deletedCount} duplicate fields.`);
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
