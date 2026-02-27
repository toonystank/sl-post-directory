import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting to seed Post Office database...')

  // Path to the post-offices.json file
  const jsonPath = path.join(__dirname, '../../../../sl-post-tracker/public/post-offices.json')
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`Dataset not found at: ${jsonPath}`)
    return
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8')
  const postOffices = JSON.parse(rawData)

  let insertedCount = 0
  let skippedCount = 0

  for (const po of postOffices) {
    // Skip if it doesn't have a valid postcode as per user request
    if (!po.postcode || po.postcode === 'N/A' || po.postcode.trim() === '') {
      skippedCount++
      continue
    }

    try {
      await prisma.postOffice.upsert({
        where: { postalCode: po.postcode.trim() },
        update: {
          name: po.name.trim(),
        },
        create: {
          name: po.name.trim(),
          postalCode: po.postcode.trim()
        }
      })
      insertedCount++
    } catch (e) {
      console.error(`Failed to insert ${po.name} (Postcode: ${po.postcode}):`, e)
    }
  }

  console.log(`\nSeed completed!`)
  console.log(`- Inserted/Updated: ${insertedCount}`)
  console.log(`- Skipped (No Postcode): ${skippedCount}`)

  // Create default admin user
  const adminEmail = 'admin@slpost.directory'
  const adminExists = await prisma.user.findUnique({
    where: { email: adminEmail }
  })

  if (!adminExists) {
    // In a real app we'd hash this. Just for seeding simple testing logic right now.
    // The actual login will use bcrypt as installed earlier.
    const bcrypt = require('bcrypt')
    const passwordHash = await bcrypt.hash('admin123', 10)
    
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: adminEmail,
        passwordHash: passwordHash,
        role: 'ADMIN' // We changed role to String in schema
      }
    })
    console.log(`\nDefault Admin Created:\nEmail: ${adminEmail}\nPassword: admin123\n`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
