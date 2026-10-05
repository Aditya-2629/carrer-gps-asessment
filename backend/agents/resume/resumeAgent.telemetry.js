/**
 * Resume Agent Telemetry Helper
 * Wraps AI telemetry with domain-specific metrics (page counts, issues found, confidence).
 */

import { AITelemetry } from '../../ai/telemetry/aiTelemetry.js'

export class ResumeAgentTelemetry {
  static createSpan({ targetRole, model }) {
    const span = AITelemetry.startSpan({
      purpose: 'resume_analysis',
      provider: 'gateway',
      model,
    })

    return {
      requestId: span.requestId,
      finish: (params) => {
        return span.finish(params)
      },
    }
  }
}

export default ResumeAgentTelemetry
