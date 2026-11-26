/**
 * Admin Panel routes — /api/admin
 * Login is public; everything else sits behind the adminGuard.
 */

import { Router } from 'express'
import {
  adminLoginController,
  listUsers,
  getUserDetail,
  downloadResume,
  downloadReport,
  deleteUser,
  bulkDeleteUsers,
  getStats,
  exportUsersCsv,
  getAgentAnalytics,
} from '../controllers/adminController.js'
import {
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
} from '../controllers/adminMarketController.js'
import {
  listLeads,
  getLeadStats,
  updateLeadStage,
  deleteLead,
  exportLeadsCsv,
  getCandidateDossier,
  overrideBulletRewrite,
  getAppSettings,
  updateAppSettings,
  toggleLeadUnlock,
  deliverFullReport,
} from '../controllers/adminLeadController.js'
import {
  getEngineConfig,
  createDynamicRole,
  updateScrapeSlider,
  injectDynamicKey,
  deleteDynamicKey,
  testDynamicKey,
  getEngineKeys,
  toggleEngineKey,
  triggerLiveBucketScrape,
  updateEngineConfig,
  getAdminHealth,
} from '../controllers/adminDynamicController.js'
import {
  getFallbackAndErrorAnalytics,
  getLlmCallsAndQuotas,
  purgeKeyCooldowns,
  resetCooldowns,
  pingJevDecisions,
  getSelfLearningInsights,
  getOpenRouterBalance,
  getOpenRouterModels,
  getAnalyticsOverview,
  getSystemStorage,
  cleanupStaleSessions,
  getAttributionAnalytics,
  getSkillGapHeatmap,
} from '../controllers/adminTelemetryController.js'
import { adminGuard } from '../utils/adminAuth.js'

const router = Router()

// Public admin login
router.post('/login', adminLoginController)

// Protected behind admin token guard
router.use(adminGuard)

// ── Lead Intelligence & CRM Pipeline ─────────────────────────────────────────
router.get('/leads/stats', getLeadStats)
router.get('/leads/export.csv', exportLeadsCsv)
router.get('/leads', listLeads)
router.get('/leads/:id/dossier', getCandidateDossier)
router.patch('/leads/:id', updateLeadStage)
router.delete('/leads/:id', deleteLead)
router.patch('/leads/:id/unlock', toggleLeadUnlock)
router.post('/leads/:id/unlock', toggleLeadUnlock)
router.post('/leads/:id/deliver', deliverFullReport)
router.post('/leads/:id/deliver-full', deliverFullReport)
router.post('/leads/:id/override-bullet', overrideBulletRewrite)

// ── Global App Settings (50% Teaser Mode & CTAs) ─────────────────────────────
router.get('/settings', getAppSettings)
router.patch('/settings', updateAppSettings)

// ── Zero-Restart Dynamic Engine & SmartKeyPool ──────────────────────────────
router.get('/health', getAdminHealth)
router.get('/engine/config', getEngineConfig)
router.patch('/engine/config', updateEngineConfig)
router.post('/engine/roles', createDynamicRole)
router.post('/engine/scrape-slider', updateScrapeSlider)
router.get('/engine/keys', getEngineKeys)
router.post('/engine/keys', injectDynamicKey)
router.delete('/engine/keys', deleteDynamicKey)
router.post('/engine/keys/test', testDynamicKey)
router.post('/engine/keys/toggle', toggleEngineKey)
router.post('/engine/scrape/:bucketKey', triggerLiveBucketScrape)

// ── Observability Hub, LLM Telemetry & Fallback Analytics ────────────────────
router.get('/telemetry/fallbacks-and-errors', getFallbackAndErrorAnalytics)
router.get('/telemetry/llm-calls-and-quotas', getLlmCallsAndQuotas)
router.get('/telemetry/openrouter-balance', getOpenRouterBalance)
router.get('/telemetry/openrouter-models', getOpenRouterModels)
router.get('/analytics/overview', getAnalyticsOverview)
router.get('/analytics/attribution', getAttributionAnalytics)
router.get('/analytics/skill-gaps', getSkillGapHeatmap)
router.get('/system/storage', getSystemStorage)
router.post('/system/cleanup-sessions', cleanupStaleSessions)
router.post('/telemetry/purge-cooldowns', purgeKeyCooldowns)
router.post('/telemetry/reset-cooldowns', resetCooldowns)
router.post('/telemetry/ping-jev', pingJevDecisions)
router.get('/telemetry/ping-jev', pingJevDecisions)
router.get('/learning/insights', getSelfLearningInsights)

// ── User Management & Cascade Cleanup ───────────────────────────────────────
router.get('/stats', getStats)
router.get('/agents', getAgentAnalytics)
router.get('/users', listUsers)
router.get('/users/export.csv', exportUsersCsv)
router.post('/users/bulk-delete', bulkDeleteUsers)
router.delete('/users/bulk', bulkDeleteUsers)
router.get('/users/:id', getUserDetail)
router.get('/users/:id/resume', downloadResume)
router.get('/users/:id/report', downloadReport)
router.delete('/users/:id', deleteUser)

// ── Market Library Operations & Taxonomy CRUD ─────────────────────────────────
router.get('/market-library', listMarketBuckets)
router.post('/market-library', createMarketBucket)
router.post('/market-library/bulk-delete', bulkDeleteBuckets)
router.post('/market-library/refresh', refreshAllMarketBuckets)
router.post('/market-library/scrape-all', scrapeAllActiveBuckets)
router.post('/market-library/create-specialized', createSpecializedBucket)
router.get('/market-library/refresh/:jobId', getMarketRefreshJobStatus)
router.get('/market-library/:bucketKey/skills', getBucketSkillsTaxonomy)
router.patch('/market-library/:bucketKey/skills', updateBucketSkillsBulk)
router.post('/market-library/:bucketKey/re-sanitize', reSanitizeBucketTaxonomy)
router.post('/market-library/:bucketKey/skills', upsertBucketSkill)
router.delete('/market-library/:bucketKey/skills/:skillName', deleteBucketSkill)
router.delete('/market-library/:bucketKey/jds/:jdId', deleteBucketJd)
router.delete('/market-library/:bucketKey', deleteBucketCascade)
router.get('/market-library/:bucketKey', getMarketBucketDetail)
router.post('/market-library/refresh/:bucketKey', refreshSingleMarketBucket)
router.post('/market-library/activate/:bucketKey/:version', activateBucketVersion)

export default router
