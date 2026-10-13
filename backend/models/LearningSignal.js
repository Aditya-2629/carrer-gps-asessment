import mongoose from 'mongoose'

/**
 * LearningSignal — Long-term evidence-driven improvement observations.
 * Supports:
 * - MARKET_SKILL_TREND
 * - MARKET_RESPONSIBILITY_TREND
 * - REPORT_QUALITY_SIGNAL
 * - CLASSIFICATION_ERROR
 * - RECOMMENDATION_FEEDBACK
 * - HUMAN_REVIEW_SIGNAL
 * - OUTCOME_SIGNAL
 *
 * CRITICAL RULE: Stores observations with confidence and sample size.
 * NEVER automatically modifies prompts or rules without human/admin review.
 */
const learningSignalSchema = new mongoose.Schema(
  {
    signalType: {
      type: String,
      required: true,
      enum: [
        'MARKET_SKILL_TREND',
        'MARKET_RESPONSIBILITY_TREND',
        'REPORT_QUALITY_SIGNAL',
        'CLASSIFICATION_ERROR',
        'RECOMMENDATION_FEEDBACK',
        'HUMAN_REVIEW_SIGNAL',
        'OUTCOME_SIGNAL',
      ],
      index: true,
    },
    roleKey: {
      type: String,
      required: true,
      index: true,
    },
    experienceBucket: {
      type: String,
      required: true,
      index: true,
    },
    signal: {
      type: String,
      required: true, // e.g. "Kafka" or "Missing System Design Signal"
      trim: true,
    },
    observationCount: {
      type: Number,
      default: 1,
    },
    supportingEvidence: {
      type: mongoose.Schema.Types.Mixed,
      default: () => [],
    },
    confidence: {
      type: Number,
      default: 0.8,
      min: 0,
      max: 1,
    },
    source: {
      type: String,
      default: 'market_analysis', // 'market_analysis' | 'user_feedback' | 'admin_review' | 'benchmark'
    },
    status: {
      type: String,
      enum: ['candidate', 'reviewed', 'approved', 'rejected'],
      default: 'candidate',
      index: true,
    },
    firstObservedAt: {
      type: Date,
      default: Date.now,
    },
    lastObservedAt: {
      type: Date,
      default: Date.now,
    },
    version: {
      type: Number,
      default: 1,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

learningSignalSchema.index({ roleKey: 1, experienceBucket: 1, signalType: 1, signal: 1 })
learningSignalSchema.index({ status: 1, confidence: -1 })

const LearningSignal = mongoose.model('LearningSignal', learningSignalSchema)
export default LearningSignal
