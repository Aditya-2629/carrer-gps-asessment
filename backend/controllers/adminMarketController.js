/**
 * Admin Market Library Controller — Career GPS Resume Agent V3
 *
 * Handles admin operations for the Role × Experience Job Market Library:
 * - Stats and listing of all buckets
 * - Single bucket details and version history
 * - Global "Update JD Library" trigger
 * - Single-bucket refresh trigger
 * - Refresh job progress status
 * - Atomic version rollback/activation
 */

import JobMarketBucket from '../models/JobMarketBucket.js'
import JobMarketVersion from '../models/JobMarketVersion.js'
import {
  enqueueBucketRefresh,
  enqueueAllBucketsRefresh,
  getJobStatus,
  getMarketLibraryStats,
} from '../jobs/marketJd/marketJdQueue.js'
import { activateMarketVersion, getMarketVersionHistory } from '../agents/resume/market/marketVersions.js'
import { ensureConfiguredBucketsExist } from '../jobs/marketJd/marketJdJobs.js'
import { filterJdsByDomainRelevance } from '../integrations/apify/apifyJdScraper.js'
import { normalizeCanonicalSkill } from '../agents/resume/market/llmJdSkillAnalyzer.js'
import { isConcreteTechSkill, BANNED_CROSS_DOMAIN_JUNK, sanitizeSkillToken } from '../agents/resume/market/dynamicSkillExtractor.js'

/**
 * GET /api/admin/market-library
 * Returns summary stats and list of all buckets.
 */
export async function listMarketBuckets(req, res) {
  try {
    await ensureConfiguredBucketsExist()
    const stats = await getMarketLibraryStats()
    return res.status(200).json({
      success: true,
      ...stats,
    })
  } catch (err) {
    console.error('[AdminMarket] listMarketBuckets error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/admin/market-library/:bucketKey
 * Returns detailed state, active 5 JDs, market profile, and version history.
 */
export async function getMarketBucketDetail(req, res) {
  try {
    const { bucketKey } = req.params
    const bucket = await JobMarketBucket.findOne({ bucketKey }).lean()
    if (!bucket) {
      return res.status(404).json({ success: false, message: 'Bucket not found.' })
    }

    let activeVersion = null
    if (bucket.activeVersion > 0) {
      activeVersion = await JobMarketVersion.findOne({
        bucketKey,
        version: bucket.activeVersion,
      }).lean()
    }

    const history = await getMarketVersionHistory(bucketKey, 10)

    const jobs = activeVersion?.jobs || []
    const totalJds = jobs.length
    const jobTextCache = jobs.map((j) => {
      const skillSet = new Set((j.skills || []).map((sk) => String(sk || '').toLowerCase().trim()))
      const text = `${j.title || ''} ${j.normalizedDescription || j.description || ''}`.toLowerCase()
      return { skillSet, text }
    })

    const rawSkills = activeVersion?.marketProfile?.skills || []
    const skills = rawSkills
      .map((s) => {
        const skillName = String(s.name || '').trim()
        const needle = skillName.toLowerCase()
        let jdMatchCount = 0
        if (needle && totalJds > 0) {
          for (const jc of jobTextCache) {
            if (jc.skillSet.has(needle) || jc.text.includes(needle)) {
              jdMatchCount += 1
            }
          }
        } else {
          jdMatchCount = s.count || s.frequency || 0
        }

        const isOverridden = Boolean(s.isCustomWeight || s.isPinned)
        const computedWeight = totalJds > 0
          ? Math.min(100, Math.round((jdMatchCount / totalJds) * 100))
          : (typeof s.percentage === 'number' ? s.percentage : 0)
        const weight = isOverridden
          ? Math.min(100, Math.max(0, Number(s.percentage ?? computedWeight)))
          : computedWeight

        const cat = s.category === 'core' || s.category === 'bonus'
          ? s.category
          : (s.isCore || s.priority === 'HIGH' || weight >= 50 ? 'core' : 'bonus')

        return {
          skill: skillName,
          name: skillName,
          category: cat,
          jdMatchCount,
          totalJds,
          weight,
          percentage: weight,
          count: jdMatchCount,
          isCustomWeight: isOverridden,
          priority: s.priority || (cat === 'core' ? 'HIGH' : 'LOW'),
        }
      })
      .sort((a, b) => b.weight - a.weight || b.jdMatchCount - a.jdMatchCount)

    const jds = (activeVersion?.jobs || []).map((j) => ({
      _id: String(j._id),
      title: j.title,
      company: j.company || 'Not Disclosed',
      location: j.location || 'Not Disclosed',
      snippet: String(j.description || j.normalizedDescription || '').slice(0, 280),
      scrapedAt: j.scrapedAt,
      source: j.source || 'apify',
      sourceUrl: j.sourceUrl || null,
    }))

    return res.status(200).json({
      success: true,
      bucket,
      activeVersion,
      skills,
      jds,
      history,
    })
  } catch (err) {
    console.error('[AdminMarket] getMarketBucketDetail error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/refresh
 * Global "Update JD Library" operation.
 * Refreshes every configured bucket with 5 fresh JDs and atomically activates.
 */
export async function refreshAllMarketBuckets(req, res) {
  try {
    const job = await enqueueAllBucketsRefresh()
    return res.status(202).json({
      success: true,
      message: 'Global JD Library refresh enqueued.',
      jobId: job.jobId,
      totalBuckets: job.totalBuckets,
    })
  } catch (err) {
    console.error('[AdminMarket] refreshAllMarketBuckets error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/refresh/:bucketKey
 * Single-bucket refresh operation.
 */
export async function refreshSingleMarketBucket(req, res) {
  try {
    const { bucketKey } = req.params
    const job = await enqueueBucketRefresh(bucketKey)
    return res.status(202).json({
      success: true,
      message: `Refresh enqueued for bucket ${bucketKey}.`,
      jobId: job.jobId,
      bucketKey,
    })
  } catch (err) {
    console.error('[AdminMarket] refreshSingleMarketBucket error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/admin/market-library/refresh/:jobId
 * Retrieves status/progress of a background refresh job.
 */
export async function getMarketRefreshJobStatus(req, res) {
  try {
    const { jobId } = req.params
    const job = getJobStatus(jobId)
    if (!job) {
      return res.status(404).json({ success: false, message: 'Refresh job not found or expired.' })
    }
    return res.status(200).json({
      success: true,
      job,
    })
  } catch (err) {
    console.error('[AdminMarket] getMarketRefreshJobStatus error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/activate/:bucketKey/:version
 * Atomically activates a specific historical version for rollback/switch.
 */
export async function activateBucketVersion(req, res) {
  try {
    const { bucketKey, version } = req.params
    const versionNum = parseInt(version, 10)
    if (isNaN(versionNum)) {
      return res.status(400).json({ success: false, message: 'Invalid version number.' })
    }

    const result = await activateMarketVersion(bucketKey, versionNum)
    return res.status(200).json({
      success: true,
      message: `Version ${versionNum} activated for ${bucketKey}.`,
      ...result,
    })
  } catch (err) {
    console.error('[AdminMarket] activateBucketVersion error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/admin/market-library/:bucketKey/skills
 * Returns all skills extracted in the active version with live frequency counts and percentages.
 */
export async function getBucketSkillsTaxonomy(req, res) {
  try {
    const { bucketKey } = req.params
    const bucket = await JobMarketBucket.findOne({ bucketKey }).lean()
    if (!bucket || bucket.activeVersion === 0) {
      return res.status(200).json({ success: true, skills: [], sampleSize: 0 })
    }

    const versionDoc = await JobMarketVersion.findOne({
      bucketKey,
      version: bucket.activeVersion,
    }).lean()

    const skills = versionDoc?.marketProfile?.skills || []
    return res.status(200).json({
      success: true,
      bucketKey,
      roleName: bucket.roleName,
      specialization: bucket.specialization,
      experienceBucket: bucket.experienceBucket,
      version: bucket.activeVersion,
      sampleSize: versionDoc?.marketProfile?.sampleSize || versionDoc?.jobs?.length || 0,
      skills,
    })
  } catch (err) {
    console.error('[AdminMarket] getBucketSkillsTaxonomy error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/:bucketKey/skills
 * Adds or overrides a specific skill in the active market profile.
 */
export async function upsertBucketSkill(req, res) {
  try {
    const { bucketKey } = req.params
    const { name, percentage, count, priority = 'HIGH', category = 'tools', isPinned = false } = req.body || {}

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid skill name required.' })
    }

    const bucket = await JobMarketBucket.findOne({ bucketKey })
    if (!bucket || bucket.activeVersion === 0) {
      return res.status(404).json({ success: false, message: 'Active bucket version not found.' })
    }

    const versionDoc = await JobMarketVersion.findOne({
      bucketKey,
      version: bucket.activeVersion,
    })

    if (!versionDoc) {
      return res.status(404).json({ success: false, message: 'Version snapshot not found.' })
    }

    const cleanName = name.trim()
    const sampleSize = versionDoc.marketProfile?.sampleSize || 35
    const finalPct = typeof percentage === 'number' ? Math.min(100, Math.max(1, percentage)) : 50
    const finalCount = typeof count === 'number' ? count : Math.round((finalPct / 100) * sampleSize)

    if (!versionDoc.marketProfile) {
      versionDoc.marketProfile = { sampleSize, skills: [] }
    }

    const curSkills = versionDoc.marketProfile.skills || []
    const existingIdx = curSkills.findIndex((s) => s.name?.toLowerCase() === cleanName.toLowerCase())

    const skillPayload = {
      name: cleanName,
      category,
      count: finalCount,
      frequency: finalCount,
      percentage: finalPct,
      frequencyRatio: Math.round((finalPct / 100) * 100) / 100,
      priority,
      isPinned: Boolean(isPinned),
    }

    if (existingIdx !== -1) {
      curSkills[existingIdx] = { ...curSkills[existingIdx], ...skillPayload }
    } else {
      curSkills.unshift(skillPayload)
    }

    // Sort descending by percentage, pinned first
    curSkills.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.percentage - a.percentage)

    versionDoc.marketProfile.skills = curSkills
    versionDoc.markModified('marketProfile')
    await versionDoc.save()

    return res.status(200).json({
      success: true,
      message: `Skill "${cleanName}" (${finalPct}%) saved to bucket.`,
      skill: skillPayload,
    })
  } catch (err) {
    console.error('[AdminMarket] upsertBucketSkill error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * DELETE /api/admin/market-library/:bucketKey/skills/:skillName
 * Deletes a skill token from the active market profile (1-click noise removal).
 */
export async function deleteBucketSkill(req, res) {
  try {
    const { bucketKey, skillName } = req.params
    const bucket = await JobMarketBucket.findOne({ bucketKey })
    if (!bucket || bucket.activeVersion === 0) {
      return res.status(404).json({ success: false, message: 'Bucket not found.' })
    }

    const versionDoc = await JobMarketVersion.findOne({
      bucketKey,
      version: bucket.activeVersion,
    })

    if (!versionDoc) {
      return res.status(404).json({ success: false, message: 'Version not found.' })
    }

    const cleanTarget = decodeURIComponent(skillName).trim().toLowerCase()
    const filtered = (versionDoc.marketProfile?.skills || []).filter(
      (s) => s.name?.toLowerCase() !== cleanTarget
    )

    if (!versionDoc.marketProfile) {
      versionDoc.marketProfile = { skills: [] }
    }
    versionDoc.marketProfile.skills = filtered
    versionDoc.markModified('marketProfile')
    await versionDoc.save()

    return res.status(200).json({
      success: true,
      message: `Skill "${skillName}" deleted from bucket ${bucketKey}.`,
      remainingCount: filtered.length,
    })
  } catch (err) {
    console.error('[AdminMarket] deleteBucketSkill error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * DELETE /api/admin/market-library/:bucketKey
 * Cascades deletion of the JobMarketBucket and all historical JobMarketVersion snapshots.
 */
export async function deleteBucketCascade(req, res) {
  try {
    const { bucketKey } = req.params
    const bucket = await JobMarketBucket.findOne({ bucketKey })
    if (!bucket) {
      return res.status(404).json({ success: false, message: 'Bucket not found.' })
    }

    // Cascade delete versions
    const versionsDeleted = await JobMarketVersion.deleteMany({ bucketKey })
    await JobMarketBucket.deleteOne({ bucketKey })

    return res.status(200).json({
      success: true,
      message: `Bucket "${bucketKey}" and ${versionsDeleted.deletedCount} version snapshots permanently deleted.`,
    })
  } catch (err) {
    console.error('[AdminMarket] deleteBucketCascade error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/bulk-delete
 * Bulk deletes multiple JobMarketBuckets and cascade-deletes all their JobMarketVersion snapshots.
 */
export async function bulkDeleteBuckets(req, res) {
  try {
    const { bucketKeys } = req.body || {}
    if (!Array.isArray(bucketKeys) || bucketKeys.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of bucketKeys is required.' })
    }

    const [deletedBuckets, deletedVersions] = await Promise.all([
      JobMarketBucket.deleteMany({ bucketKey: { $in: bucketKeys } }),
      JobMarketVersion.deleteMany({ bucketKey: { $in: bucketKeys } }),
    ])

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${deletedBuckets.deletedCount} bucket(s) and ${deletedVersions.deletedCount} historical version snapshots.`,
      deletedBucketsCount: deletedBuckets.deletedCount,
      deletedVersionsCount: deletedVersions.deletedCount,
      bucketKeys,
    })
  } catch (err) {
    console.error('[AdminMarket] bulkDeleteBuckets error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/scrape-all
 * Triggers safe staggered refresh across all active buckets.
 */
export async function scrapeAllActiveBuckets(req, res) {
  try {
    const activeBuckets = await JobMarketBucket.find({ activeVersion: { $gt: 0 } }).select('bucketKey roleName').lean()
    if (activeBuckets.length === 0) {
      return res.status(200).json({ success: true, message: 'No active buckets to refresh.' })
    }

    // Enqueue staggered jobs with 3-minute safety interval
    activeBuckets.forEach((b, idx) => {
      setTimeout(() => {
        enqueueBucketRefresh(b.bucketKey, { source: 'admin_manual_scrape_all' }).catch((e) =>
          console.error(`[ScrapeAll] Failed for ${b.bucketKey}:`, e.message)
        )
      }, idx * 180000)
    })

    return res.status(200).json({
      success: true,
      message: `Enqueued refresh for ${activeBuckets.length} active buckets with 3-minute staggered safety interval.`,
      bucketCount: activeBuckets.length,
    })
  } catch (err) {
    console.error('[AdminMarket] scrapeAllActiveBuckets error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/create-specialized
 * Creates a specialized bucket for a role and specialization focus.
 */
export async function createSpecializedBucket(req, res) {
  try {
    const { roleName, specialization = 'general', experienceBucket = '3-5' } = req.body || {}
    if (!roleName) {
      return res.status(400).json({ success: false, message: 'roleName is required.' })
    }

    const slug = roleName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const specSlug = specialization && specialization !== 'general'
      ? `-${specialization.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
      : ''
    const bucketKey = `${slug}${specSlug}::${experienceBucket}`

    let bucket = await JobMarketBucket.findOne({ bucketKey })
    if (!bucket) {
      bucket = await JobMarketBucket.create({
        bucketKey,
        roleName: roleName.trim(),
        experienceBucket,
        specialization: specialization.trim(),
        activeVersion: 0,
        status: 'pending',
      })
    }

    return res.status(200).json({
      success: true,
      message: `Specialized bucket ready: ${bucketKey}`,
      bucketKey,
      bucket,
    })
  } catch (err) {
    console.error('[AdminMarket] createSpecializedBucket error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/admin/market-library/:bucketKey/re-sanitize
 * Purges cross-domain contamination (eDiscovery, Pharma wet labs, Annotators),
 * unifies synonyms into canonical families, re-calculates frequency using purified denominator,
 * and anchors foundational role tools as HIGH core priority.
 */
export async function reSanitizeBucketTaxonomy(req, res) {
  try {
    const { bucketKey } = req.params
    const bucket = await JobMarketBucket.findOne({ bucketKey })
    if (!bucket) return res.status(404).json({ success: false, message: 'Bucket not found.' })

    const versionDoc = await JobMarketVersion.findOne({
      bucketKey,
      version: bucket.activeVersion,
    })

    if (!versionDoc || !versionDoc.marketProfile) {
      return res.status(404).json({ success: false, message: 'Active version market profile not found.' })
    }

    let totalSample = versionDoc.marketProfile.sampleSize || 50
    const canonicalMap = new Map()

    if (Array.isArray(versionDoc.jobs) && versionDoc.jobs.length > 0) {
      const purifiedJobs = filterJdsByDomainRelevance(versionDoc.jobs, bucket.roleKey || bucketKey)
      totalSample = Math.max(1, purifiedJobs.length)

      for (const job of purifiedJobs) {
        const jobSkills = new Set(
          (job.skills || [])
            .map((s) => normalizeCanonicalSkill(s))
            .filter((s) => s && isConcreteTechSkill(s) && !BANNED_CROSS_DOMAIN_JUNK.has(s.toLowerCase()))
        )

        const descText = String(job.description || job.text || job.normalizedDescription || '').toLowerCase()
        if (/\bsql\b/i.test(descText)) jobSkills.add('SQL')
        if (/\b(?:ms\s+)?excel\b/i.test(descText)) jobSkills.add('Excel')
        if (/\bpython\b/i.test(descText)) jobSkills.add('Python')
        if (/\btableau\b/i.test(descText)) jobSkills.add('Tableau')
        if (/\bpower\s+bi\b/i.test(descText)) jobSkills.add('Power BI')

        for (const skill of jobSkills) {
          const lower = skill.toLowerCase()
          if (!canonicalMap.has(lower)) {
            canonicalMap.set(lower, { name: skill, count: 0 })
          }
          canonicalMap.get(lower).count += 1
        }
      }
    } else {
      if (totalSample >= 40) {
        totalSample = Math.max(15, Math.round(totalSample * 0.65))
      }

      for (const s of (versionDoc.marketProfile.skills || [])) {
        const rawName = s.name || s.skill || ''
        const sanitized = sanitizeSkillToken(rawName)
        if (!sanitized || !isConcreteTechSkill(sanitized) || BANNED_CROSS_DOMAIN_JUNK.has(sanitized.toLowerCase())) continue

        const canonical = normalizeCanonicalSkill(sanitized) || sanitized
        const lower = canonical.toLowerCase()
        if (BANNED_CROSS_DOMAIN_JUNK.has(lower)) continue

        const count = s.count || s.frequency || 1
        if (!canonicalMap.has(lower)) {
          canonicalMap.set(lower, { name: canonical, count: 0 })
        }
        canonicalMap.get(lower).count += count
      }
    }

    const CORE_ROLE_ANCHORS = {
      'data-analyst': ['sql', 'excel', 'python', 'power bi', 'tableau'],
      'software-engineer': ['git', 'system design', 'unit / integration testing', 'docker', 'ci/cd'],
      'product-manager': ['product strategy', 'roadmapping', 'user research', 'agile / scrum'],
      'healthcare': ['patient care', 'electronic health records (ehr)', 'clinical assessment'],
      'finance-accounting': ['financial modeling', 'budgeting & forecasting', 'excel', 'financial reporting'],
    }
    const roleClean = String(bucket.roleKey || bucketKey.split('::')[0] || '').toLowerCase()
    const roleAnchorList = CORE_ROLE_ANCHORS[roleClean] || (roleClean.includes('analyst') ? CORE_ROLE_ANCHORS['data-analyst'] : (roleClean.includes('engineer') || roleClean.includes('developer') ? CORE_ROLE_ANCHORS['software-engineer'] : []))

    const sortedList = Array.from(canonicalMap.values()).sort((a, b) => b.count - a.count)

    const sanitizedSkills = sortedList.map((item, idx) => {
      const percentage = Math.min(100, Math.round((item.count / totalSample) * 100))
      const isAnchor = roleAnchorList.includes(item.name.toLowerCase())
      const isTopThree = idx < 3 && percentage >= 25 && item.count >= 2

      let priority = 'LOW'
      if (percentage >= 30 || isTopThree || (isAnchor && percentage >= 20)) {
        priority = 'HIGH'
      } else if (percentage >= 15 || idx < 8 || (isAnchor && percentage >= 10)) {
        priority = 'MEDIUM'
      }

      return {
        name: item.name,
        category: 'tool',
        count: item.count,
        frequency: item.count,
        percentage,
        frequencyRatio: Math.round((item.count / totalSample) * 100) / 100,
        priority,
        isCore: priority === 'HIGH',
      }
    })

    versionDoc.marketProfile.sampleSize = totalSample
    versionDoc.marketProfile.totalAnalyzed = totalSample
    versionDoc.marketProfile.skills = sanitizedSkills
    versionDoc.marketProfile.topKeywords = sanitizedSkills.slice(0, 20).map((s) => s.name)
    versionDoc.markModified('marketProfile')
    await versionDoc.save()

    return res.status(200).json({
      success: true,
      message: 'Taxonomy re-sanitized successfully.',
      bucketKey,
      sampleSize: totalSample,
      skills: sanitizedSkills,
      coreSkillsCount: sanitizedSkills.filter((s) => s.isCore).length,
    })
  } catch (err) {
    console.error('[AdminMarket] reSanitizeBucketTaxonomy error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function createMarketBucket(req, res) {
  try {
    const rawRole = req.body?.roleTitle || req.body?.roleName || ''
    const exp = ['0-2', '3-5', '6-8', '8+'].includes(req.body?.experienceTier || req.body?.experienceBucket)
      ? (req.body?.experienceTier || req.body?.experienceBucket)
      : '3-5'
    const spec = String(req.body?.specialization || 'general').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') || 'general'

    if (!rawRole || String(rawRole).trim().length < 2) {
      return res.status(400).json({ success: false, message: 'roleTitle is required.' })
    }

    const roleName = String(rawRole).trim()
    const roleKey = roleName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const bucketKey = req.body?.bucketKey
      ? String(req.body.bucketKey).trim()
      : (spec !== 'general' ? `${roleKey}::${spec}::${exp}` : `${roleKey}::${exp}`)

    let bucket = await JobMarketBucket.findOne({ bucketKey })
    if (bucket) {
      return res.status(200).json({ success: true, bucket, message: 'Bucket already exists.' })
    }

    bucket = await JobMarketBucket.create({
      bucketKey,
      roleKey,
      roleName,
      specialization: spec,
      experienceBucket: exp,
      activeVersion: 0,
      status: 'empty',
      jobCount: 0,
    })

    return res.status(201).json({ success: true, bucket })
  } catch (err) {
    console.error('[AdminMarket] createMarketBucket error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function updateBucketSkillsBulk(req, res) {
  try {
    const { bucketKey } = req.params
    const bucket = await JobMarketBucket.findOne({ bucketKey })
    if (!bucket) {
      return res.status(404).json({ success: false, message: 'Bucket not found.' })
    }

    let versionDoc = null
    if (bucket.activeVersion > 0) {
      versionDoc = await JobMarketVersion.findOne({ bucketKey, version: bucket.activeVersion })
    }
    if (!versionDoc) {
      bucket.activeVersion = 1
      bucket.status = 'healthy'
      await bucket.save()
      versionDoc = await JobMarketVersion.create({
        bucketKey,
        version: 1,
        jobs: [],
        marketProfile: { bucketKey, sampleSize: 15, skills: [] },
      })
    }

    if (!versionDoc.marketProfile) {
      versionDoc.marketProfile = { bucketKey, sampleSize: 15, skills: [] }
    }
    const sampleSize = versionDoc.marketProfile.sampleSize || 15

    if (Array.isArray(req.body?.skills)) {
      versionDoc.marketProfile.skills = req.body.skills
        .filter((s) => s && (s.skill || s.name))
        .map((s) => {
          const name = String(s.skill || s.name).trim()
          const weight = Math.min(100, Math.max(1, Number(s.weight ?? s.percentage ?? 50)))
          const cat = s.category === 'bonus' ? 'bonus' : 'core'
          const count = Math.round((weight / 100) * sampleSize)
          return {
            name,
            category: cat,
            count,
            frequency: count,
            percentage: weight,
            frequencyRatio: Math.round((weight / 100) * 100) / 100,
            priority: cat === 'core' ? 'HIGH' : 'LOW',
            isCore: cat === 'core',
            isCustomWeight: true,
          }
        })
    } else {
      const action = req.body?.action || 'edit'
      const skillName = String(req.body?.skill || req.body?.name || '').trim()
      if (!skillName) {
        return res.status(400).json({ success: false, message: 'skills array or skill name required.' })
      }
      const cur = versionDoc.marketProfile.skills || []
      if (action === 'delete') {
        versionDoc.marketProfile.skills = cur.filter((s) => s.name?.toLowerCase() !== skillName.toLowerCase())
      } else {
        const weight = Math.min(100, Math.max(1, Number(req.body?.weight ?? req.body?.percentage ?? 50)))
        const cat = req.body?.category === 'bonus' ? 'bonus' : 'core'
        const count = Math.round((weight / 100) * sampleSize)
        const entry = {
          name: skillName,
          category: cat,
          count,
          frequency: count,
          percentage: weight,
          frequencyRatio: Math.round((weight / 100) * 100) / 100,
          priority: cat === 'core' ? 'HIGH' : 'LOW',
          isCore: cat === 'core',
        }
        const idx = cur.findIndex((s) => s.name?.toLowerCase() === skillName.toLowerCase())
        if (idx >= 0) cur[idx] = entry
        else cur.push(entry)
        versionDoc.marketProfile.skills = cur
      }
    }

    versionDoc.markModified('marketProfile')
    await versionDoc.save()

    return res.status(200).json({
      success: true,
      skills: versionDoc.marketProfile.skills,
    })
  } catch (err) {
    console.error('[AdminMarket] updateBucketSkillsBulk error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

export async function deleteBucketJd(req, res) {
  try {
    const { bucketKey, jdId } = req.params
    const bucket = await JobMarketBucket.findOne({ bucketKey })
    if (!bucket || bucket.activeVersion === 0) {
      return res.status(404).json({ success: false, message: 'Active bucket not found.' })
    }
    const versionDoc = await JobMarketVersion.findOne({ bucketKey, version: bucket.activeVersion })
    if (!versionDoc) {
      return res.status(404).json({ success: false, message: 'Version snapshot not found.' })
    }
    const before = versionDoc.jobs?.length || 0
    versionDoc.jobs = (versionDoc.jobs || []).filter((j) => String(j._id) !== String(jdId))
    if (versionDoc.jobs.length === before) {
      return res.status(404).json({ success: false, message: 'JD not found in active version.' })
    }
    await versionDoc.save()
    bucket.jobCount = versionDoc.jobs.length
    await bucket.save()
    return res.status(200).json({ success: true, remainingJds: versionDoc.jobs.length })
  } catch (err) {
    console.error('[AdminMarket] deleteBucketJd error:', err)
    return res.status(500).json({ success: false, message: err.message })
  }
}

export default {
  listMarketBuckets,
  getMarketBucketDetail,
  refreshAllMarketBuckets,
  refreshSingleMarketBucket,
  getMarketRefreshJobStatus,
  activateBucketVersion,
  getBucketSkillsTaxonomy,
  upsertBucketSkill,
  deleteBucketSkill,
  deleteBucketCascade,
  bulkDeleteBuckets,
  scrapeAllActiveBuckets,
  createSpecializedBucket,
  reSanitizeBucketTaxonomy,
  createMarketBucket,
  updateBucketSkillsBulk,
  deleteBucketJd,
}
