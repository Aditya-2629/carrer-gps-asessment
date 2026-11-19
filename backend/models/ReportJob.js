/**
 * ReportJob — async report generation job (Phase C).
 * The client creates a job, subscribes to its SSE stream, and receives live
 * agent progress + the final report without holding an HTTP request open for
 * 60+ seconds of silence.
 */

import mongoose from 'mongoose'

const reportJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued', index: true },
    events: [
      {
        at: String,
        stage: String,
        message: String,
      },
    ],
    aiReport: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
)

// 24-hour TTL index: automatically purges completed/failed in-flight job documents after 24 hours
// without affecting the permanent User.aiReport stored on the User document.
reportJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

const ReportJob = mongoose.model('ReportJob', reportJobSchema)
export default ReportJob
