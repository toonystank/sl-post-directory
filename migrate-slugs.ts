import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function generateSlug(name: string, postalCode: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${postalCode}`
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const offices = await prisma.postOffice.findMany();
  
  for (const office of offices) {
    const slug = generateSlug(office.name, office.postalCode);
    console.log(`Updating ${office.name} -> ${slug}`);
    try {
        await prisma.$executeRawUnsafe(`UPDATE "PostOffice" SET slug = $1 WHERE id = $2`, slug, office.id);
    } catch (e) {
        console.error(`Failed to update ${office.name}:`, e);
    }
  }
  
  console.log('Migration complete');
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
