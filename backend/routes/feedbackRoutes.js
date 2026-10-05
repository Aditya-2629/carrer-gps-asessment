/**
 * Candidate feedback routes — /api/feedback (Phase E).
 * Lightweight, userId-based (same trust level as the rest of the candidate
 * flow). Rate-limit friendly: one row per (user, agent, finding) via upsert.
 */

import { Router } from 'express'
import mongoose from 'mongoose'
import FindingFeedback from '../models/FindingFeedback.js'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { userId, agent, findingId, rating, comment } = req.body || {}

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Valid userId is required.' })
    }
    if (!agent || !findingId || !['up', 'down'].includes(rating)) {
      return res.status(400).json({ success: false, message: 'agent, findingId and rating (up|down) are required.' })
    }

    await FindingFeedback.findOneAndUpdate(
      { userId, agent, findingId },
      { userId, agent, findingId, rating, comment: comment || null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    return res.status(200).json({ success: true, message: 'Feedback recorded.' })
  } catch (err) {
    console.error('[Feedback] failed:', err)
    return res.status(500).json({ success: false, message: 'Failed to record feedback.' })
  }
})

export default router
