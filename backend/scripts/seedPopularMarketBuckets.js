/**
 * seedPopularMarketBuckets.js
 * 
 * One-Time Core Bucket Seeder Script
 * Pre-populates MongoDB once so live users get instant 0ms loads for popular market roles.
 */

import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 1. Load .env before initializing modules
dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config({ path: path.join(__dirname, '../../.env') })
dotenv.config()

// 2. Import modules after env is configured
const mongoose = (await import('mongoose')).default
const { executeBucketRefresh } = await import('../jobs/marketJd/marketJdJobs.js')

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
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI

  if (!mongoUri) {
    console.error('❌ Error: Neither MONGO_URI nor MONGODB_URI found in .env!')
    process.exit(1)
  }

  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}...`)
  await mongoose.connect(mongoUri)
  console.log('✔ Successfully connected to MongoDB Atlas!\n')
  console.log('Seeding core market buckets into MongoDB...\n')

  for (const bucket of CORE_BUCKETS) {
    try {
      console.log(`========================================`)
      console.log(`[Seeder] Scraping & analyzing: "${bucket}"...`)
      console.log(`========================================`)
      const result = await executeBucketRefresh(bucket)
      if (result?.success) {
        console.log(`✔ Successfully cached "${bucket}" in MongoDB! (Version v${result.version}, ${result.jobCount} JDs)\n`)
      } else {
        console.warn(`⚠ ${bucket} refresh ended with: ${result?.reason || result?.error || 'Unknown status'}\n`)
      }
    } catch (err) {
      console.error(`❌ Failed ${bucket}:`, err.message, '\n')
    }
  }

  console.log('🎉 All core buckets seeded! Users will now experience instant 0ms loads.')
  await mongoose.disconnect()
  process.exit(0)
}

// Only execute seed() if invoked directly from CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seed().catch((err) => {
    console.error('Fatal seeding error:', err)
    process.exit(1)
  })
}

export { seed, CORE_BUCKETS }
