const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// List of known 24-hour post offices. 
// You can add more names to this list and re-run the script safely.
const KNOWN_24H_OFFICES = [
  "Central Mail Exchange",
  "Kandy",
  "Slave Island",
  "Kompannavidiya", // Alternative name for Slave Island
  "Havelock Town",
  "Wellawatte",
  "Borella",
  "Kotahena",
  "Battaramulla",
  "Nugegoda",
  "Dehiwala",
  "Mount Lavinia",
  "Galkissa", // Alternative name for Mount Lavinia
  "Moratuwa",
  "Panadura",
  "Kalutara",
  "Seethawakapura"
];

async function mark24HourOffices() {
  console.log('Starting 24-hour office marking process...');
  let updatedCount = 0;

  for (const queryName of KNOWN_24H_OFFICES) {
    console.log(`Searching for: "${queryName}"`);
    
    // Find candidate offices (fuzzy/contains match)
    const offices = await prisma.postOffice.findMany({
      where: {
        name: {
          equals: queryName,
          mode: 'insensitive'
        }
      },
      include: {
        fields: true
      }
    });

    if (offices.length === 0) {
      console.log(`  -> ⚠️ No match found for "${queryName}"`);
      continue;
    }

    // Usually we want the main one, not necessarily every single matching sub-office, 
    // but in this case, the names are quite specific.
    for (const office of offices) {
      console.log(`  -> Found matching office: [${office.id}] ${office.name}`);

      // 1. Update "Working Hours" text field if it exists, or create it
      const workingHoursField = office.fields.find(f => f.name === 'Working Hours');
      if (workingHoursField) {
        await prisma.postOfficeField.update({
          where: { id: workingHoursField.id },
          data: { value: '24 Hours' }
        });
      } else {
        await prisma.postOfficeField.create({
          data: {
            name: 'Working Hours',
            value: '24 Hours',
            type: 'TEXT',
            postOfficeId: office.id
          }
        });
      }

      // 2. Add or update Is24Hour boolean flag
      const is24HourField = office.fields.find(f => f.name === 'Is24Hour');
      if (is24HourField) {
        await prisma.postOfficeField.update({
          where: { id: is24HourField.id },
          data: { value: 'true' }
        });
      } else {
        await prisma.postOfficeField.create({
          data: {
            name: 'Is24Hour',
            value: 'true',
            type: 'BOOLEAN',
            postOfficeId: office.id
          }
        });
      }

      console.log(`  -> ✅ Marked ${office.name} as 24 Hours`);
      updatedCount++;
    }
  }

  console.log(`\nFinished! Successfully marked ${updatedCount} office records.`);
}

mark24HourOffices()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
