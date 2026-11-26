/**
 * LlmCallLog — per-call LLM & Apify cost ledger tied to a candidate (User) and pipeline run.
 */

import mongoose from 'mongoose'

const llmCallLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    runId: { type: String, default: null, index: true },
    stage: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    costInr: { type: Number, default: 0 },
    costSource: { type: String, default: 'unknown' },
    costError: { type: String, default: null },
  },
  { timestamps: true }
)

llmCallLogSchema.index({ createdAt: -1 })
llmCallLogSchema.index({ userId: 1, stage: 1, createdAt: -1 })

const LlmCallLog = mongoose.model('LlmCallLog', llmCallLogSchema)
export default LlmCallLog
