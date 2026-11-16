const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const vars = [
        { key: "register_post", value: "60", description: "Registration fee for domestic mail (LKR)" },
        { key: "ordinary_post", value: "70", description: "Base price for ordinary letter up to 30g (LKR)" },
        { key: "slp_courier", value: "200", description: "Base price for SLP Courier (formerly Speed Post) up to 250g (LKR)" },
        { key: "cod", value: "50", description: "Cash on Delivery fixed service fee (LKR)" }
    ];

    for (const v of vars) {
        await prisma.siteVariable.upsert({
            where: { key: v.key },
            update: {},
            create: v
        });
    }
    console.log("Seeded default variables");
}

main().catch(console.error).finally(() => prisma.$disconnect());
