import mongoose from 'mongoose'

/**
 * JobMarketBucket — Canonical metadata and status pointer for a Role × Experience bucket.
 * The activeVersion points to the currently active JobMarketVersion document.
 */
const jobMarketBucketSchema = new mongoose.Schema(
  {
    bucketKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    }, // e.g. "software-engineer::6-8" or "data-analyst::3-5"
    roleKey: {
      type: String,
      required: true,
      index: true,
      trim: true,
    }, // e.g. "software-engineer"
    roleName: {
      type: String,
      required: true,
      trim: true,
    }, // e.g. "Software Engineer"
    specialization: {
      type: String,
      default: 'general',
      trim: true,
    }, // e.g. "backend", "frontend", "general"
    experienceBucket: {
      type: String,
      required: true,
      enum: ['0-2', '3-5', '6-8', '8+'],
      index: true,
    },
    activeVersion: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['healthy', 'needs_refresh', 'refreshing', 'empty', 'failed'],
      default: 'empty',
      index: true,
    },
    jobCount: {
      type: Number,
      default: 0,
    },
    lastSuccessfulRefreshAt: {
      type: Date,
      default: null,
    },
    lastAttemptedRefreshAt: {
      type: Date,
      default: null,
    },
    refreshError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

jobMarketBucketSchema.index({ roleKey: 1, experienceBucket: 1 })
jobMarketBucketSchema.index({ status: 1, updatedAt: -1 })

const JobMarketBucket = mongoose.model('JobMarketBucket', jobMarketBucketSchema)
export default JobMarketBucket
