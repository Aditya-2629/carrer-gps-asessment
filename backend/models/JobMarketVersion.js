import mongoose from 'mongoose'

/**
 * JobMarketVersion — Immutable versioned store for a bucket snapshot containing
 * exactly 5 normalized JDs, their aggregated MarketProfile, and provenance metadata.
 */
const jobMarketVersionSchema = new mongoose.Schema(
  {
    bucketKey: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      index: true,
    },
    jobs: [
      {
        sourceJobId: { type: String, default: null },
        title: { type: String, required: true },
        company: { type: String, default: 'Not Disclosed' },
        location: { type: String, default: 'Not Disclosed' },
        description: { type: String, required: true },
        normalizedDescription: { type: String, default: '' },
        skills: [{ type: String }],
        responsibilities: [{ type: String }],
        senioritySignals: [{ type: String }],
        source: { type: String, default: 'apify' },
        sourceUrl: { type: String, default: null },
        scrapedAt: { type: Date, default: Date.now },
        fingerprint: { type: String, required: true },
      },
    ],
    marketProfile: {
      bucketKey: { type: String, required: true },
      sampleSize: { type: Number, default: 5 },
      skills: [
        {
          name: { type: String, required: true },
          frequency: { type: Number, required: true },
          frequencyRatio: { type: Number, required: true },
        },
      ],
      responsibilities: [
        {
          name: { type: String, required: true },
          frequency: { type: Number, required: true },
          frequencyRatio: { type: Number, default: 1 },
        },
      ],
      senioritySignals: [
        {
          name: { type: String, required: true },
          frequency: { type: Number, required: true },
          frequencyRatio: { type: Number, default: 1 },
        },
      ],
      topKeywords: [{ type: String }],
      version: { type: String, default: '1.0' },
      generatedAt: { type: Date, default: Date.now },
    },
    sourceMetadata: {
      actorId: { type: String, default: null },
      totalCandidatesFetched: { type: Number, default: 0 },
      validCandidatesCount: { type: Number, default: 0 },
      duplicatesRemoved: { type: Number, default: 0 },
      refreshDurationMs: { type: Number, default: 0 },
    },
    validationSummary: {
      isValid: { type: Boolean, default: true },
      checkedAt: { type: Date, default: Date.now },
      jobCount: { type: Number, default: 5 },
      errors: [{ type: String }],
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

jobMarketVersionSchema.index({ bucketKey: 1, version: -1 }, { unique: true })
jobMarketVersionSchema.index({ bucketKey: 1, isArchived: 1 })

const JobMarketVersion = mongoose.model('JobMarketVersion', jobMarketVersionSchema)
export default JobMarketVersion
