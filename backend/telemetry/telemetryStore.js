/**
 * Telemetry Ring Buffer Store — Career GPS In-Memory Observability
 *
 * Implements a bounded, high-speed ring buffer for real-time telemetry:
 * - Granular LLM invocations (model, stage, tokens, latency, cost)
 * - Fallback occurrences (from, to, reason, latency delta)
 * - User error patterns and pipeline drop-offs
 */

class TelemetryRingBuffer {
  constructor(maxSize = 250) {
    this.maxSize = maxSize
    this.calls = []
    this.fallbacks = []
    this.userErrors = []
    this.cursor = 0
  }

  recordCall(call) {
    const entry = {
      id: call.id || `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      agent: call.agent || 'resume',
      stage: call.stage || 'General Synthesis',
      model: call.model || 'google/gemini-3.5-flash-lite',
      inputTokens: call.inputTokens || 0,
      outputTokens: call.outputTokens || 0,
      totalTokens: (call.inputTokens || 0) + (call.outputTokens || 0),
      latencyMs: call.latencyMs || 0,
      latencySec: Number(((call.latencyMs || 0) / 1000).toFixed(2)),
      costUsd: call.costUsd || 0,
      costInr: Number(((call.costUsd || 0) * 86.5).toFixed(3)),
      status: call.status || 'SUCCESS',
      timestamp: call.timestamp || new Date().toISOString(),
    }

    if (this.calls.length < this.maxSize) {
      this.calls.unshift(entry)
    } else {
      this.calls.pop()
      this.calls.unshift(entry)
    }
    return entry
  }

  recordFallback(fb) {
    const entry = {
      from: fb.from,
      to: fb.to,
      reason: fb.reason,
      hitRate: fb.hitRate || '100%',
      latencyDelta: fb.latencyDelta || '0ms',
      status: fb.status || 'ACTIVE_HEALTHY_FALLBACK',
      timestamp: new Date().toISOString(),
    }
    this.fallbacks.unshift(entry)
    if (this.fallbacks.length > 50) this.fallbacks.pop()
    return entry
  }

  recordUserError(err) {
    const entry = {
      type: err.type || 'PARSING_ERROR',
      email: err.email || 'anonymous',
      message: err.message || 'Unknown bottleneck',
      timestamp: new Date().toISOString(),
    }
    this.userErrors.unshift(entry)
    if (this.userErrors.length > 50) this.userErrors.pop()
    return entry
  }

  getCalls(limit = 60) {
    return this.calls.slice(0, limit)
  }

  getFallbacks() {
    return this.fallbacks
  }

  getUserErrors() {
    return this.userErrors
  }
}

export const telemetryStore = new TelemetryRingBuffer(250)
export default telemetryStore
