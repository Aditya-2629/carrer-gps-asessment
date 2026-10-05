/**
 * AI Gateway Telemetry
 * Records request metrics, latency, token consumption, and validation fidelity.
 * Strictly avoids logging candidate PII, raw resume text, or secret API keys.
 */

import crypto from 'crypto'

export class AITelemetry {
  static createRequestId() {
    return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  }

  static startSpan({ purpose, provider, model }) {
    const requestId = this.createRequestId()
    const startTime = Date.now()
    return {
      requestId,
      purpose,
      provider,
      requestedModel: model,
      startTime,
      finish: ({
        actualModel = null,
        success = true,
        error = null,
        promptTokens = null,
        completionTokens = null,
        totalTokens = null,
        schemaValid = null,
        evidenceValidationValid = null,
        issueCount = 0,
      } = {}) => {
        const endTime = Date.now()
        const latencyMs = endTime - startTime

        const record = {
          requestId,
          purpose,
          provider,
          requestedModel: model,
          actualModel: actualModel || model,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          latencyMs,
          tokens: {
            prompt: promptTokens,
            completion: completionTokens,
            total: totalTokens || (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null),
          },
          success,
          errorType: error ? (error.code || error.name || 'UNKNOWN_ERROR') : null,
          schemaValid,
          evidenceValidationValid,
          issueCount,
        }

        // Sanitized console log for observability without leaking PII or raw prompts
        console.log(
          `[AITelemetry] ${record.requestId} | ${record.provider} (${record.actualModel}) | ${latencyMs}ms | success=${success} | issues=${issueCount} | schemaValid=${schemaValid} | evidenceValid=${evidenceValidationValid}`
        )

        return record
      },
    }
  }
}

export default AITelemetry
