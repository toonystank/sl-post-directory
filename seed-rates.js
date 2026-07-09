const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const domesticServices = [
    {
        id: "oletter",
        name: "Ordinary and Business Letters",
        tiers: [
            { maxWeight: 30, price: 70 },
            { maxWeight: 40, price: 80 },
            { maxWeight: 50, price: 90 },
            { maxWeight: 60, price: 100 },
            { maxWeight: 70, price: 110 },
            { maxWeight: 80, price: 120 },
            { maxWeight: 90, price: 130 },
            { maxWeight: 100, price: 140 },
            { maxWeight: 200, price: 160 },
            { maxWeight: 300, price: 180 },
            { maxWeight: 400, price: 200 },
            { maxWeight: 500, price: 220 },
            { maxWeight: 1000, price: 320 },
            { maxWeight: 2000, price: 440 },
        ]
    },
    {
        id: "sp",
        name: "SLP Courier (Speed Post)",
        tiers: [
            { maxWeight: 250, price: 200 },
            { maxWeight: 500, price: 250 },
            { maxWeight: 1000, price: 350 },
            { maxWeight: 2000, price: 400 },
            { maxWeight: 3000, price: 450 },
            { maxWeight: 4000, price: 500 },
            { maxWeight: 5000, price: 550 },
            { maxWeight: 10000, price: 800 },
            { maxWeight: 20000, price: 1600 },
        ]
    },
    {
        id: "lop",
        name: "L.O. Parcels",
        tiers: [
            { maxWeight: 250, price: 150 },
            { maxWeight: 500, price: 200 },
            { maxWeight: 1000, price: 250 },
            { maxWeight: 2000, price: 300 },
            { maxWeight: 3000, price: 350 },
            { maxWeight: 5000, price: 500 },
            { maxWeight: 10000, price: 700 },
            { maxWeight: 20000, price: 900 },
        ]
    }
];

const emsZones = [
    {
        id: "zone1",
        name: "Zone 1 (South Asia)",
        tiers: [
            { maxWeight: 500, price: 3500 },
            { maxWeight: 1000, price: 4500 },
            { maxWeight: 2000, price: 6000 },
            { maxWeight: 5000, price: 10000 },
            { maxWeight: 10000, price: 15000 },
        ]
    },
    {
        id: "zone4",
        name: "Zone 4 (North America)",
        tiers: [
            { maxWeight: 500, price: 5500 },
            { maxWeight: 1000, price: 7500 },
            { maxWeight: 2000, price: 10000 },
            { maxWeight: 5000, price: 18000 },
            { maxWeight: 10000, price: 28000 },
        ]
    }
];

const emsCountries = [
    { code: "IN", name: "India", zoneId: "zone1" },
    { code: "BD", name: "Bangladesh", zoneId: "zone1" },
    { code: "MV", name: "Maldives", zoneId: "zone1" },
    { code: "US", name: "United States", zoneId: "zone4" },
    { code: "CA", name: "Canada", zoneId: "zone4" },
];

const extraFees = {
    registeredPost: 60,
    cod: 50
};

async function main() {
    const vars = [
        { key: "rates_domestic_services", value: JSON.stringify(domesticServices, null, 2), description: "JSON mapping for Domestic Postal Services" },
        { key: "rates_ems_zones", value: JSON.stringify(emsZones, null, 2), description: "JSON mapping for EMS Zones and their price tiers" },
        { key: "rates_ems_countries", value: JSON.stringify(emsCountries, null, 2), description: "JSON mapping for Countries to EMS Zones" },
        { key: "rates_extra_fees", value: JSON.stringify(extraFees, null, 2), description: "JSON mapping for extra fees like COD, Registered" },
    ];

    for (const v of vars) {
        await prisma.siteVariable.upsert({
            where: { key: v.key },
            update: { value: v.value, description: v.description },
            create: v
        });
    }
    console.log("Seeded complex JSON rates");
}

main().catch(console.error).finally(() => prisma.$disconnect());
