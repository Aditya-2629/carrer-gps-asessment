/**
 * AgentRun — one row per agent execution. The platform's audit trail:
 * caching (inputHash), per-agent cost/latency/quality analytics, and the
 * "why did this report say X" answer live here.
 */

import mongoose from 'mongoose'

const agentRunSchema = new mongoose.Schema(
  {
    agent: { type: String, required: true, index: true }, // 'resume' | 'linkedin' | 'overall' | 'judge'
    agentVersion: { type: String, required: true },
    inputHash: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    status: { type: String, required: true, default: 'SUCCESS' }, // SUCCESS | AGENT_FAILED | CACHED
    cached: { type: Boolean, default: false },
    output: { type: mongoose.Schema.Types.Mixed, default: null },
    cost: {
      inputTokens: { type: Number, default: null },
      outputTokens: { type: Number, default: null },
      estimatedUsd: { type: Number, default: null },
    },
    latencyMs: { type: Number, default: 0 },
    attempts: { type: Number, default: 1 },
    judgeScore: { type: Number, default: null }, // Phase D
    model: { type: String, default: null },
    error: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
)

agentRunSchema.index({ agent: 1, createdAt: -1 })
agentRunSchema.index({ inputHash: 1, agent: 1, createdAt: -1 })

const AgentRun = mongoose.model('AgentRun', agentRunSchema)
export default AgentRun
