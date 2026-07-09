const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const office = await prisma.postOffice.findFirst({
    where: { name: "Kandy Courts" },
    include: { controllingOffice: true }
  });
  console.log(JSON.stringify(office, null, 2));
}

main().finally(() => prisma.$disconnect());
