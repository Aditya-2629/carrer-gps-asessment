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
} from '../controllers/adminController.js'
import { adminGuard } from '../utils/adminAuth.js'

const router = Router()

router.post('/login', adminLoginController)

router.use(adminGuard)

router.get('/stats', getStats)
router.get('/users', listUsers)
router.get('/users/export.csv', exportUsersCsv)
router.get('/users/:id', getUserDetail)
router.get('/users/:id/resume', downloadResume)
router.get('/users/:id/report', downloadReport)
router.delete('/users/:id', deleteUser)

export default router
