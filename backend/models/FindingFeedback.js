/**
 * FindingFeedback — the candidate's verdict on every agent finding.
 * 👍/👎 per issue/check card. This is what turns the platform into a learning
 * system: admin analytics show which agents earn their cost, and which
 * findings feel generic to real users.
 */

import mongoose from 'mongoose'

const findingFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    agent: { type: String, required: true, index: true }, // 'resume' | 'linkedin' | 'overall'
    findingId: { type: String, required: true }, // issue id / check id
    rating: { type: String, enum: ['up', 'down'], required: true },
    comment: { type: String, default: null },
  },
  { timestamps: true }
)

findingFeedbackSchema.index({ agent: 1, createdAt: -1 })
findingFeedbackSchema.index({ userId: 1, agent: 1, findingId: 1 }, { unique: false })

const FindingFeedback = mongoose.model('FindingFeedback', findingFeedbackSchema)
export default FindingFeedback
