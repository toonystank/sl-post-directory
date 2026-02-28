const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    const jsonPath = 'e:/mm/sl-post-tracker/public/post-offices.json';
    let rawData = [];
    if (fs.existsSync(jsonPath)) {
        rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }

    // Map to easily find by name + postcode
    const jsonMap = {};
    for (const po of rawData) {
        const key = `${po.name.trim().toLowerCase()}-${(po.postcode || '').trim()}`;
        jsonMap[key] = po;
    }

    const offices = await prisma.postOffice.findMany({
        include: { fields: true }
    });

    let addedCount = 0;
    let updatedCount = 0;

    for (const office of offices) {
        const deliveryField = office.fields.find(f => f.name === 'Delivery');

        let desiredDelivery = 'No'; // default
        const key = `${office.name.toLowerCase()}-${office.postalCode}`;
        const jsonPo = jsonMap[key];

        if (jsonPo && jsonPo.delivery) {
            if (jsonPo.delivery.toLowerCase() === 'yes' || jsonPo.delivery === 'Y') {
                desiredDelivery = 'Yes';
            } else if (jsonPo.delivery.toLowerCase() === 'no' || jsonPo.delivery === 'N') {
                desiredDelivery = 'No';
            } else {
                desiredDelivery = 'No'; // default for N/A
            }
        }

        if (!deliveryField) {
            // Add missing field
            await prisma.postOfficeField.create({
                data: {
                    name: 'Delivery',
                    value: desiredDelivery,
                    type: 'TEXT',
                    postOfficeId: office.id
                }
            });
            addedCount++;
        } else {
            // Ensure it is strictly 'Yes' or 'No'
            let currentVal = deliveryField.value.trim().toLowerCase();
            let newDelivery = currentVal === 'yes' ? 'Yes' : 'No';

            if (deliveryField.value !== newDelivery) {
                await prisma.postOfficeField.update({
                    where: { id: deliveryField.id },
                    data: { value: newDelivery }
                });
                updatedCount++;
            }
        }
    }

    console.log(`Added Delivery field to ${addedCount} offices.`);
    console.log(`Updated Delivery field (to strict Yes/No) in ${updatedCount} offices.`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
