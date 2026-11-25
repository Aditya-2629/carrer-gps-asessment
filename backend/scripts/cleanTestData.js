/**
 * Safe One-Time Database Cleanup Script
 *
 * Wipes test/historical candidate, traffic, and telemetry collections while
 * strictly PRESERVING all Market Job Buckets, Market Library, Knowledge Base,
 * Prompt Examples, Skill Decision Cache, and AppSettings.
 *
 * Usage:
 *   node backend/scripts/cleanTestData.js --dry-run
 *   node backend/scripts/cleanTestData.js --confirm
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const args = new Set(process.argv.slice(2))
const isDryRun = args.has('--dry-run') || !args.has('--confirm')
const isConfirm = args.has('--confirm')

// Explicit allowlist of collections to WIPE (everything else defaults to [KEEP])
const WIPE_COLLECTIONS = new Set([
  'users',
  'assessments',
  'leads',
  'reportjobs',
  'resumes',
  'chathistories',
  'visitorsessions',
  'dailyanalyticssummaries',
  'agentruns',
  'findingfeedbacks',
  'learningsignals',
  'llmcalllogs',
  'costlogs',
  'telemetrylogs',
  'otps',
])

// Explicit safeguard: NEVER wipe any of these even if accidentally listed
const NEVER_WIPE = new Set([
  'jobmarketbuckets',
  'jobmarketversions',
  'marketbuckets',
  'jobbuckets',
  'marketlibrary',
  'jobdescriptions',
  'scrapedjobs',
  'knowledgebases',
  'kbdocuments',
  'promptexamples',
  'skilldecisioncaches',
  'appsettings',
  'admins',
  'adminusers',
])

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  if (!uri) {
    console.error('ERROR: MONGO_URI / MONGODB_URI is not set in .env')
    process.exit(1)
  }

  await mongoose.connect(uri)
  const db = mongoose.connection.db
  const collections = await db.listCollections().toArray()
  const names = collections.map((c) => c.name).sort()

  console.log(`\nConnected to MongoDB: ${db.databaseName}`)
  console.log(`Mode: ${isConfirm ? 'EXECUTE (--confirm)' : 'DRY RUN (--dry-run)'}\n`)

  const plan = []
  for (const name of names) {
    const lower = name.toLowerCase()
    const count = await db.collection(name).countDocuments({})
    const shouldWipe = WIPE_COLLECTIONS.has(lower) && !NEVER_WIPE.has(lower)
    plan.push({ name, count, action: shouldWipe ? '[WIPE]' : '[KEEP]' })
  }

  console.log('Pre-cleanup collection counts:')
  for (const item of plan) {
    console.log(`  ${item.action} ${item.name.padEnd(28)} : ${item.count}`)
  }

  if (isDryRun) {
    console.log('\nDry run complete. No documents were deleted.')
    console.log('Re-run with --confirm to wipe only [WIPE] collections.')
    await mongoose.disconnect()
    return
  }

  console.log('\nWiping [WIPE] collections...')
  for (const item of plan) {
    if (item.action === '[WIPE]') {
      const res = await db.collection(item.name).deleteMany({})
      console.log(`  Deleted ${res.deletedCount} docs from ${item.name}`)
    }
  }

  console.log('\nPost-cleanup verification counts:')
  for (const item of plan) {
    const afterCount = await db.collection(item.name).countDocuments({})
    console.log(`  ${item.action} ${item.name.padEnd(28)} : ${afterCount}`)
  }

  await mongoose.disconnect()
  console.log('\nCleanup complete.')
}

main().catch(async (err) => {
  console.error('Cleanup failed:', err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
