const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const vars = [
        { key: "register_post", value: "50", description: "Registration fee for domestic mail (LKR)" },
        { key: "ordinary_post", value: "15", description: "Base price for ordinary letter (LKR)" },
        { key: "speed_post", value: "1500", description: "Base price for Speed Post / EMS (LKR)" },
        { key: "cod", value: "100", description: "Cash on Delivery fee (LKR)" }
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
