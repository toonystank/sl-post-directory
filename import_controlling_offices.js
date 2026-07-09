const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('Loading JSON data...');
  const data10 = JSON.parse(fs.readFileSync('data10.json', 'utf8')).Main;
  const rmscData = JSON.parse(fs.readFileSync('rmsc_offices.json', 'utf8')).Sheet1;

  console.log('Fetching all offices from database...');
  const dbOffices = await prisma.postOffice.findMany();
  
  // Create lookups
  const dbOfficeByPostalCode = new Map();
  const dbOfficeByName = new Map();
  
  for (const office of dbOffices) {
    if (office.postalCode) {
      dbOfficeByPostalCode.set(office.postalCode, office);
    }
    dbOfficeByName.set(office.name.toLowerCase().trim(), office);
    // Also store some variations since names in data10.json can be messy
    const cleanedName = office.name.toLowerCase().replace(/\s+/g, ' ').trim();
    dbOfficeByName.set(cleanedName, office);
  }

  // 1. Process Controlling Offices from data10.json
  console.log('Processing Controlling Offices...');
  let updatedCount = 0;
  
  for (const item of data10) {
    const poCode = item['PO Code'];
    const officeName = item['Office Name'];
    const controllingName = item['controlling Office'];
    
    // Find the target office in DB
    let targetOffice = null;
    if (poCode) {
      targetOffice = dbOfficeByPostalCode.get(poCode.toString());
    }
    if (!targetOffice && officeName) {
      // Try by name (extracting name without postal code which is sometimes appended)
      let cleanName = officeName.replace(/\(.*?\)/g, '').trim().toLowerCase();
      targetOffice = dbOfficeByName.get(cleanName);
    }

    if (targetOffice && controllingName && controllingName !== '#N/A' && controllingName !== '0' && controllingName !== 0) {
      // Find the controlling office in DB
      let cleanCtrlName = controllingName.toString().replace(/\(.*?\)/g, '').trim().toLowerCase();
      let ctrlOffice = dbOfficeByName.get(cleanCtrlName);
      
      // Some fuzzy matching for common issues
      if (!ctrlOffice) {
        if (cleanCtrlName.endsWith(' po')) cleanCtrlName = cleanCtrlName.slice(0, -3);
        if (cleanCtrlName.endsWith(' post office')) cleanCtrlName = cleanCtrlName.slice(0, -12);
        ctrlOffice = dbOfficeByName.get(cleanCtrlName);
      }

      if (ctrlOffice) {
        // Update the relation
        await prisma.postOffice.update({
          where: { id: targetOffice.id },
          data: { controllingOfficeId: ctrlOffice.id }
        });
        updatedCount++;
      } else {
        // console.log(`Could not find controlling office: ${controllingName} for ${officeName}`);
      }
    }
  }
  console.log(`Updated ${updatedCount} controlling office relations.`);

  // 2. Process RMSC from rmsc_offices.json
  console.log('Processing RMSC data...');
  let rmscCount = 0;
  
  const assignedRmsc = new Map();
  
  for (const item of rmscData) {
    const officeStr = item['OFFICE '];
    const rmscStr = item['RMSC / TPO'];
    if (officeStr && rmscStr) {
      let cleanName = officeStr.toLowerCase().trim();
      let targetOffice = dbOfficeByName.get(cleanName);
      
      if (targetOffice) {
        let current = assignedRmsc.get(targetOffice.id) || [];
        const newRmsc = rmscStr.trim();
        if (!current.includes(newRmsc)) {
            current.push(newRmsc);
            assignedRmsc.set(targetOffice.id, current);
        }
      }
    }
  }
  
  for (const [officeId, rmscList] of assignedRmsc.entries()) {
      await prisma.postOffice.update({
          where: { id: officeId },
          data: { rmsc: rmscList.join(' / ') }
      });
      rmscCount++;
  }
  
  console.log(`Updated ${rmscCount} RMSC records.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
