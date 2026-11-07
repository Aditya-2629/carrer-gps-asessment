/**
 * Automated Verification Suite for Zero-Syntax Dynamic Admin Operations & Skills Taxonomy CRUD
 */
import assert from 'assert'
import mongoose from 'mongoose'
import JobMarketBucket from '../models/JobMarketBucket.js'
import JobMarketVersion from '../models/JobMarketVersion.js'
import User from '../models/User.js'
import ReportJob from '../models/ReportJob.js'
import AgentRun from '../models/AgentRun.js'
import {
  getBucketSkillsTaxonomy,
  upsertBucketSkill,
  deleteBucketSkill,
  deleteBucketCascade,
  scrapeAllActiveBuckets,
} from '../controllers/adminMarketController.js'
import { deleteUser, bulkDeleteUsers } from '../controllers/adminController.js'
import { buildHarvestActorInput } from '../integrations/apify/apifyJdScraper.js'

async function runTestSuite() {
  console.log('================================================================')
  console.log('RUNNING ZERO-SYNTAX ADMIN & TAXONOMY CRUD VERIFICATION TESTS')
  console.log('================================================================\n')

  // ── TEST 1: Apify Specialization & Seniority Query Injection ──
  console.log('[Test 1] Testing Apify Specialization Linkage & Seniority Prefixes...')
  const specHarvest = buildHarvestActorInput({
    role: 'Data Analyst',
    specialization: 'Healthcare & EHR',
    experienceBucket: '6-8',
    maxItems: 40,
  })
  assert.strictEqual(specHarvest.jobTitles[0], 'Senior Data Analyst Healthcare & EHR', 'Senior prefix & specialization injected')
  assert.strictEqual(specHarvest.maxItems, 40)

  const juniorSpec = buildHarvestActorInput({
    role: 'Software Engineer',
    specialization: 'Fintech React',
    experienceBucket: '0-2',
    maxItems: 80,
  })
  assert.strictEqual(juniorSpec.jobTitles[0], 'Junior Software Engineer Fintech React', 'Junior prefix & specialization injected')
  assert.strictEqual(juniorSpec.maxItems, 75, 'Capped at 75')
  console.log('  ✓ 1.1 Specialization and seniority queries verified.')

  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/career-gps'
  try {
    await mongoose.connect(mongoUri)
    console.log('\n[Test 2] Connected to MongoDB for In-Memory/Local Database Tests...')
  } catch (err) {
    console.warn('MongoDB connection unavailable, testing in isolation:', err.message)
    console.log('ALL SYNTAX & STATIC VERIFICATIONS PASSED!')
    return
  }

  const testBucketKey = 'test-qa-spec::3-5'
  try {
    // Cleanup any prior test residue
    await JobMarketBucket.deleteOne({ bucketKey: testBucketKey })
    await JobMarketVersion.deleteMany({ bucketKey: testBucketKey })

    // Create test bucket
    await JobMarketBucket.create({
      bucketKey: testBucketKey,
      roleKey: 'test-qa-spec',
      roleName: 'QA Automation Engineer',
      specialization: 'Playwright & Cypress',
      experienceBucket: '3-5',
      activeVersion: 1,
      status: 'healthy',
      jobCount: 35,
    })

    // Create version snapshot
    await JobMarketVersion.create({
      bucketKey: testBucketKey,
      version: 1,
      jobs: [{ fingerprint: 'test_fp_001', title: 'QA Engineer', company: 'TestCorp', description: 'Test job description with 100+ chars...' }],
      marketProfile: {
        bucketKey: testBucketKey,
        sampleSize: 35,
        skills: [
          { name: 'Selenium', count: 25, percentage: 71, priority: 'HIGH', isPinned: false },
          { name: 'Python', count: 20, percentage: 57, priority: 'HIGH', isPinned: false },
        ],
      },
    })

    // ── TEST 2: Skills Taxonomy GET ──
    console.log('\n[Test 3] Testing getBucketSkillsTaxonomy...')
    let taxonomyResData = null
    const mockRes1 = {
      status(code) {
        assert.strictEqual(code, 200)
        return {
          json(d) {
            taxonomyResData = d
          },
        }
      },
    }
    await getBucketSkillsTaxonomy({ params: { bucketKey: testBucketKey } }, mockRes1)
    assert.strictEqual(taxonomyResData.success, true)
    assert.strictEqual(taxonomyResData.skills.length, 2)
    assert.strictEqual(taxonomyResData.specialization, 'Playwright & Cypress')
    console.log('  ✓ 3.1 Taxonomy fetched with initial 2 skills and active version metadata.')

    // ── TEST 3: Skills Taxonomy POST (Upsert & Pin) ──
    console.log('\n[Test 4] Testing upsertBucketSkill (Add Manual Skill & Pin)...')
    let upsertResData = null
    const mockRes2 = {
      status(code) {
        assert.strictEqual(code, 200)
        return {
          json(d) {
            upsertResData = d
          },
        }
      },
    }
    await upsertBucketSkill(
      {
        params: { bucketKey: testBucketKey },
        body: { name: 'Playwright', percentage: 90, priority: 'CORE', isPinned: true },
      },
      mockRes2
    )
    assert.strictEqual(upsertResData.success, true)
    assert.strictEqual(upsertResData.skill.name, 'Playwright')
    assert.strictEqual(upsertResData.skill.isPinned, true)

    // Check version document
    const updatedVersion = await JobMarketVersion.findOne({ bucketKey: testBucketKey, version: 1 }).lean()
    assert.strictEqual(updatedVersion.marketProfile.skills.length, 3)
    assert.strictEqual(updatedVersion.marketProfile.skills[0].name, 'Playwright', 'Pinned skill sorted to top')
    console.log('  ✓ 4.1 Skill "Playwright" added, pinned, and sorted to top.')

    // ── TEST 4: Skills Taxonomy DELETE ──
    console.log('\n[Test 5] Testing deleteBucketSkill...')
    let deleteSkillData = null
    const mockRes3 = {
      status(code) {
        assert.strictEqual(code, 200)
        return {
          json(d) {
            deleteSkillData = d
          },
        }
      },
    }
    await deleteBucketSkill(
      { params: { bucketKey: testBucketKey, skillName: 'Selenium' } },
      mockRes3
    )
    assert.strictEqual(deleteSkillData.success, true)
    assert.strictEqual(deleteSkillData.remainingCount, 2)
    console.log('  ✓ 5.1 Skill "Selenium" deleted cleanly from active version.')

    // ── TEST 5: Cascade Bucket Delete ──
    console.log('\n[Test 6] Testing deleteBucketCascade...')
    let cascadeDeleteData = null
    const mockRes4 = {
      status(code) {
        assert.strictEqual(code, 200)
        return {
          json(d) {
            cascadeDeleteData = d
          },
        }
      },
    }
    await deleteBucketCascade({ params: { bucketKey: testBucketKey } }, mockRes4)
    assert.strictEqual(cascadeDeleteData.success, true)

    const bucketAfter = await JobMarketBucket.findOne({ bucketKey: testBucketKey })
    const versionsAfter = await JobMarketVersion.find({ bucketKey: testBucketKey })
    assert.strictEqual(bucketAfter, null, 'Bucket removed')
    assert.strictEqual(versionsAfter.length, 0, 'All version snapshots cascade-deleted')
    console.log('  ✓ 6.1 Bucket and all associated version snapshots permanently deleted.')

    // ── TEST 6: User Cascade & Bulk Cleanup ──
    console.log('\n[Test 7] Testing User Cascade & Bulk Cleanup...')
    await User.deleteMany({ email: { $in: ['test_cleanup_1@crafture.local', 'test_cleanup_2@crafture.local'] } })
    const u1 = await User.create({ email: 'test_cleanup_1@crafture.local', isVerified: true })
    const u2 = await User.create({ email: 'test_cleanup_2@crafture.local', isVerified: true })
    await ReportJob.create({ userId: u1._id, status: 'done' })
    await AgentRun.create({
      agent: 'resume',
      agentVersion: 'v2.5',
      inputHash: 'test_hash_001',
      userId: u2._id,
      status: 'SUCCESS',
    })

    let bulkData = null
    const mockRes5 = {
      status(code) {
        assert.strictEqual(code, 200)
        return {
          json(d) {
            bulkData = d
          },
        }
      },
    }
    await bulkDeleteUsers({ body: { userIds: [u1._id, u2._id] } }, mockRes5)
    assert.strictEqual(bulkData.deletedCount, 2)

    const remainingUsers = await User.find({ _id: { $in: [u1._id, u2._id] } })
    const remainingJobs = await ReportJob.find({ userId: u1._id })
    const remainingRuns = await AgentRun.find({ userId: u2._id })
    assert.strictEqual(remainingUsers.length, 0)
    assert.strictEqual(remainingJobs.length, 0)
    assert.strictEqual(remainingRuns.length, 0)
    console.log('  ✓ 7.1 Bulk deletion cascaded across Users, ReportJobs, and AgentRuns.')

    console.log('\n================================================================')
    console.log('ALL ZERO-SYNTAX ADMIN & TAXONOMY TESTS PASSED! 🚀')
    console.log('================================================================\n')
  } finally {
    await mongoose.disconnect()
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})
