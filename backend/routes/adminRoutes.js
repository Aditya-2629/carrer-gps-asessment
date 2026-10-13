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
} from '../controllers/adminMarketController.js'
import { adminGuard } from '../utils/adminAuth.js'

const router = Router()

router.post('/login', adminLoginController)

router.use(adminGuard)

router.get('/stats', getStats)
router.get('/agents', getAgentAnalytics)
router.get('/users', listUsers)
router.get('/users/export.csv', exportUsersCsv)
router.get('/users/:id', getUserDetail)
router.get('/users/:id/resume', downloadResume)
router.get('/users/:id/report', downloadReport)
router.delete('/users/:id', deleteUser)

// ── Market Library Operations ─────────────────────────────────────────────────
router.get('/market-library', listMarketBuckets)
router.post('/market-library/refresh', refreshAllMarketBuckets)
router.get('/market-library/refresh/:jobId', getMarketRefreshJobStatus)
router.get('/market-library/:bucketKey', getMarketBucketDetail)
router.post('/market-library/refresh/:bucketKey', refreshSingleMarketBucket)
router.post('/market-library/activate/:bucketKey/:version', activateBucketVersion)

export default router
