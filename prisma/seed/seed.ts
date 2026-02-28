import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface RawPostOffice {
  id: number
  name: string
  type: string
  postcode: string
  phone: string
  fax: string
  division: string
  shortCode: string
  distCode?: string
  delivery: string
  slug: string
  [key: string]: any
}

async function main() {
  console.log('Starting to seed Post Office database...')

  const jsonPath = path.join(__dirname, '../../../../sl-post-tracker/public/post-offices.json')

  if (!fs.existsSync(jsonPath)) {
    console.error(`Dataset not found at: ${jsonPath}`)
    return
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8')
  const postOffices: RawPostOffice[] = JSON.parse(rawData)

  console.log(`Found ${postOffices.length} post offices to import`)

  // Clear existing data (fresh import)
  console.log('Clearing existing data...')
  await prisma.postOfficeField.deleteMany()
  await prisma.editRequest.deleteMany()
  await prisma.postOffice.deleteMany()
  console.log('Done clearing.')

  let insertedCount = 0
  let errorCount = 0

  const BATCH_SIZE = 50
  for (let i = 0; i < postOffices.length; i += BATCH_SIZE) {
    const batch = postOffices.slice(i, i + BATCH_SIZE)

    for (const po of batch) {
      const postalCode = (po.postcode && po.postcode !== 'N/A' && po.postcode.trim() !== '')
        ? po.postcode.trim()
        : ''

      const name = po.name.trim()

      try {
        // Create the post office (cuid ID auto-generated)
        const office = await prisma.postOffice.create({
          data: { name, postalCode },
        })

        // Build fields
        const fields: { name: string; value: string; type: string; postOfficeId: string }[] = []

        const addField = (fieldName: string, rawValue: string | null | undefined) => {
          if (rawValue && rawValue !== 'N/A' && rawValue.trim() !== '') {
            fields.push({ name: fieldName, value: rawValue.trim(), type: 'TEXT', postOfficeId: office.id })
          }
        }

        addField('Type', po.type)
        addField('Phone', po.phone)
        addField('Fax', po.fax)
        addField('Division', po.division)
        addField('Short Code', po.shortCode)
        addField('DistCode', po.distCode)
        addField('Delivery', po.delivery)
        // Default working hours
        fields.push({ name: 'Working Hours', value: '8:00 AM - 4:00 PM (Weekdays)', type: 'TEXT', postOfficeId: office.id })

        if (fields.length > 0) {
          await prisma.postOfficeField.createMany({ data: fields })
        }

        insertedCount++
      } catch (e: any) {
        errorCount++
        console.error(`Failed: ${name} (${postalCode}): ${e.message}`)
      }
    }

    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= postOffices.length) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, postOffices.length)} / ${postOffices.length}`)
    }
  }

  console.log(`\nSeed completed!`)
  console.log(`- Inserted: ${insertedCount}`)
  console.log(`- Errors: ${errorCount}`)

  // Create default admin user
  const adminEmail = 'admin@slpost.directory'
  const bcrypt = require('bcrypt')
  const passwordHash = await bcrypt.hash('admin123', 10)

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN'
      }
    })
    console.log(`Admin: ${adminEmail} / admin123`)
  } else {
    console.log(`Admin user already exists.`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
