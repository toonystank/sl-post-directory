const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('Cleaning up previously marked 24-hour offices...');
  
  // 1. Delete all Is24Hour fields
  const delResult = await prisma.postOfficeField.deleteMany({
    where: {
      name: 'Is24Hour'
    }
  });
  console.log(`Deleted ${delResult.count} Is24Hour fields.`);

  // 2. We can't easily revert "Working Hours" to their exact previous state if they varied, 
  // but most of them either didn't exist or were the default '8:00 AM - 4:00 PM (Weekdays)'.
  // For the sake of data integrity, the simplest is to reset 'Working Hours' to the default 
  // for those that currently have '24 Hours'.
  const updateResult = await prisma.postOfficeField.updateMany({
    where: {
      name: 'Working Hours',
      value: '24 Hours'
    },
    data: {
      value: '8:00 AM - 4:00 PM (Weekdays)'
    }
  });
  console.log(`Reset ${updateResult.count} Working Hours fields to default.`);

  console.log('Cleanup complete.');
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
