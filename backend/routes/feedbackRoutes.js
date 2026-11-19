/**
 * Candidate feedback routes — /api/feedback (Phase E).
 * Lightweight, userId-based (same trust level as the rest of the candidate
 * flow). Rate-limit friendly: one row per (user, agent, finding) via upsert.
 * Connects directly to PromptExample for dynamic few-shot learning.
 */

import { Router } from 'express'
import mongoose from 'mongoose'
import FindingFeedback from '../models/FindingFeedback.js'
import PromptExample from '../models/PromptExample.js'

function stripPii(text = '') {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
    .replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[phone]')
    .replace(/https?:\/\/[^\s]+/g, '[link]')
    .trim()
}

const router = Router()

router.post('/', async (req, res) => {
  try {
    const {
      userId,
      agent,
      findingId,
      rating,
      comment,
      roleKey,
      sectionType,
      beforeText,
      afterText,
    } = req.body || {}

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

    // Dynamic Few-Shot Upsert
    if (rating === 'up' && afterText) {
      const cleanRole = (roleKey || 'software-engineer').toLowerCase().trim()
      const cleanSection = ['bullet_rewrite', 'linkedin_headline', 'linkedin_about'].includes(sectionType)
        ? sectionType
        : (agent === 'linkedin' ? 'linkedin_headline' : 'bullet_rewrite')

      const cleanBefore = stripPii(beforeText || '')
      const cleanAfter = stripPii(afterText)

      await PromptExample.findOneAndUpdate(
        { roleKey: cleanRole, sectionType: cleanSection, anonymizedAfter: cleanAfter },
        {
          $setOnInsert: {
            roleKey: cleanRole,
            sectionType: cleanSection,
            anonymizedBefore: cleanBefore,
            anonymizedAfter: cleanAfter,
          },
          $inc: { upVotes: 1 },
          $set: { lastVotedAt: new Date() },
        },
        { upsert: true, new: true }
      )
    } else if (rating === 'down' && afterText) {
      const cleanAfter = stripPii(afterText)
      await PromptExample.findOneAndUpdate(
        { anonymizedAfter: cleanAfter },
        {
          $inc: { downVotes: 1 },
          $set: { lastVotedAt: new Date() },
        }
      )
    }

    return res.status(200).json({ success: true, message: 'Feedback recorded.' })
  } catch (err) {
    console.error('[Feedback] failed:', err)
    return res.status(500).json({ success: false, message: 'Failed to record feedback.' })
  }
})

export default router
