import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const offices = await prisma.$queryRawUnsafe<any[]>(`SELECT id, name FROM "PostOffice" WHERE slug IS NULL`);
    console.log(offices);
    for (let office of offices) {
        const slug = office.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 10000);
        await prisma.$executeRawUnsafe(`UPDATE "PostOffice" SET slug = $1 WHERE id = $2`, slug, office.id);
    }
}
main();
