/**
 * Market Learning Service — Career GPS Resume Agent V3
 *
 * Implements Section 22 & 23: Versioned, evidence-driven learning signals.
 *
 * CRITICAL RULE: Stores observations with confidence and sample size.
 * NEVER automatically modifies prompts, rules, or system models.
 * Any adjustments require human/admin review and explicit configuration updates.
 */

import mongoose from 'mongoose'
import LearningSignal from '../../../models/LearningSignal.js'

const MONGO_CONNECTED = () => mongoose.connection?.readyState === 1

/**
 * Records an observed learning signal or increments its count if already observed.
 *
 * @param {Object} params
 * @param {'MARKET_SKILL_TREND'|'MARKET_RESPONSIBILITY_TREND'|'REPORT_QUALITY_SIGNAL'|'CLASSIFICATION_ERROR'|'RECOMMENDATION_FEEDBACK'|'HUMAN_REVIEW_SIGNAL'|'OUTCOME_SIGNAL'} params.signalType
 * @param {string} params.roleKey
 * @param {string} params.experienceBucket
 * @param {string} params.signal
 * @param {*} [params.evidence]
 * @param {number} [params.confidence=0.8]
 * @param {string} [params.source='market_analysis']
 * @returns {Promise<Object|null>}
 */
export async function recordLearningSignal({
  signalType,
  roleKey,
  experienceBucket,
  signal,
  evidence = null,
  confidence = 0.8,
  source = 'market_analysis',
}) {
  if (!signalType || !roleKey || !signal) return null

  if (!MONGO_CONNECTED()) {
    return {
      signalType,
      roleKey,
      experienceBucket,
      signal: signal.trim(),
      observationCount: 1,
      confidence: Number(confidence.toFixed(2)),
      source,
      status: 'candidate',
      firstObservedAt: new Date(),
      lastObservedAt: new Date(),
      version: 1,
    }
  }

  try {
    const existing = await LearningSignal.findOne({
      signalType,
      roleKey,
      experienceBucket,
      signal: signal.trim(),
    })

    if (existing) {
      existing.observationCount += 1
      existing.lastObservedAt = new Date()
      existing.confidence = Number(
        Math.min(0.99, existing.confidence + 0.02).toFixed(2)
      )
      if (evidence) {
        existing.supportingEvidence = existing.supportingEvidence || []
        if (existing.supportingEvidence.length < 20) {
          existing.supportingEvidence.push(evidence)
        }
      }
      await existing.save()
      return existing.toObject()
    }

    const created = await LearningSignal.create({
      signalType,
      roleKey,
      experienceBucket,
      signal: signal.trim(),
      observationCount: 1,
      supportingEvidence: evidence ? [evidence] : [],
      confidence: Number(confidence.toFixed(2)),
      source,
      status: 'candidate',
      firstObservedAt: new Date(),
      lastObservedAt: new Date(),
      version: 1,
    })

    return created.toObject()
  } catch (err) {
    console.warn('[MarketLearning] Record signal failed (non-fatal):', err.message)
    return null
  }
}

/**
 * Lists learning signals for admin review.
 * @param {Object} filter
 * @param {number} [limit=50]
 * @returns {Promise<Array<Object>>}
 */
export async function listLearningSignals(filter = {}, limit = 50) {
  if (!MONGO_CONNECTED()) return []
  try {
    return await LearningSignal.find(filter)
      .sort({ observationCount: -1, lastObservedAt: -1 })
      .limit(limit)
      .lean()
  } catch (_e) {
    return []
  }
}

/**
 * Updates status of a signal after human/admin review.
 * @param {string} signalId
 * @param {'candidate'|'reviewed'|'approved'|'rejected'} status
 * @param {Object} [metadata]
 * @returns {Promise<Object|null>}
 */
export async function updateSignalReview(signalId, status, metadata = {}) {
  if (!MONGO_CONNECTED() || !signalId) return null
  try {
    return await LearningSignal.findByIdAndUpdate(
      signalId,
      {
        $set: {
          status,
          'metadata.reviewedAt': new Date(),
          'metadata.reviewNotes': metadata.notes || null,
        },
      },
      { new: true }
    ).lean()
  } catch (_e) {
    return null
  }
}

/**
 * Extracts candidate market signals from a deterministic profile for tracking.
 * Signals are marked as 'candidate' and strictly require admin review.
 * @param {Object} marketProfile
 * @returns {Array<Object>}
 */
export function extractMarketSignalsFromProfile(marketProfile) {
  if (!marketProfile) return []
  const signals = []
  const [roleKey, experienceBucket] = (marketProfile.bucketKey || 'general::3-5').split('::')

  // Top skills appearing in >= 3 of 5 JDs (ratio >= 0.6)
  for (const s of marketProfile.skills || []) {
    if (s.frequencyRatio >= 0.6) {
      signals.push({
        signalType: 'MARKET_SKILL_TREND',
        roleKey: roleKey || 'general',
        experienceBucket: experienceBucket || '3-5',
        signal: s.name,
        observationCount: s.frequency,
        confidence: Number((0.7 + (s.frequencyRatio * 0.25)).toFixed(2)),
        status: 'candidate',
        requiresAdminReview: true,
      })
    }
  }

  // Top responsibilities
  for (const r of marketProfile.responsibilities || []) {
    if (r.frequency >= 3) {
      signals.push({
        signalType: 'MARKET_RESPONSIBILITY_TREND',
        roleKey: roleKey || 'general',
        experienceBucket: experienceBucket || '3-5',
        signal: r.name,
        observationCount: r.frequency,
        confidence: 0.8,
        status: 'candidate',
        requiresAdminReview: true,
      })
    }
  }

  return signals
}

export default {
  recordLearningSignal,
  listLearningSignals,
  updateSignalReview,
  extractMarketSignalsFromProfile,
}
