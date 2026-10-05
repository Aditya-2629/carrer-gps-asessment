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

const ReportJob = mongoose.model('ReportJob', reportJobSchema)
export default ReportJob
