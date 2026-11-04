/**
 * seedPopularMarketBuckets.js
 * 
 * One-Time Core Bucket Seeder Script
 * Pre-populates MongoDB once so live users get instant 0ms loads for popular market roles.
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { executeBucketRefresh } from '../jobs/marketJd/marketJdJobs.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config()

const CORE_BUCKETS = [
  'software-engineer::0-2',
  'software-engineer::3-5',
  'software-engineer::6-8',
  'data-analyst::0-2',
  'data-analyst::3-5',
  'product-manager::3-5',
  'devops-engineer::3-5',
  'ai-ml-engineer::3-5',
]

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/career-gps'
  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}...`)
  await mongoose.connect(mongoUri)
  console.log('Seeding core market buckets into MongoDB...\n')

  for (const bucket of CORE_BUCKETS) {
    try {
      console.log(`Scraping and analyzing ${bucket}...`)
      const result = await executeBucketRefresh(bucket)
      if (result?.success) {
        console.log(`✔ Successfully cached ${bucket} in MongoDB! (Version v${result.version}, ${result.jobCount} JDs)\n`)
      } else {
        console.warn(`⚠ ${bucket} refresh ended with: ${result?.reason || 'Unknown status'}\n`)
      }
    } catch (err) {
      console.error(`Failed ${bucket}:`, err.message, '\n')
    }
  }

  console.log('All core buckets seeded! Users will now experience instant 0ms loads.')
  await mongoose.disconnect()
  process.exit(0)
}

// Allow direct execution or export for programmatic tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().catch((err) => {
    console.error('Fatal seeding error:', err)
    process.exit(1)
  })
}

export { seed, CORE_BUCKETS }
