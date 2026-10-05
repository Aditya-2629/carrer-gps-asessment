/**
 * Structured Output Runner — bounded validate→retry loop around the LLM
 * gateway.
 *
 * Best practice (structured-output guides + Anthropic): never regex-parse
 * free-form output; always validate against the agent's schema and retry with
 * the validation errors injected as a repair instruction — but bound the
 * retries (cost/latency budget) instead of looping forever.
 *
 * The gateway already forces JSON mode (`responseFormat: 'json_object'`) and
 * the validators already use jsonrepair as a last resort — this layer adds
 * the *policy* on top: how many attempts, what to tell the model when it
 * failed, and when to give up.
 */

import { llmGateway } from '../../ai/gateway/llmGateway.js'

const REPAIR_INSTRUCTION = `Your previous response failed validation. Return the COMPLETE corrected JSON object only. Fix these problems and change nothing that was already valid:
{{ERRORS}}`

/**
 * Runs a generation with bounded validation retries.
 *
 * @param {Object} params
 * @param {string} params.contractId    - agent id, for telemetry/purpose
 * @param {Array}  params.messages      - [{role, content}]
 * @param {Function} params.validate    - (text) => { valid, errors: string[] };
 *                                      receives RAW text (validator owns JSON
 *                                      parsing/repair)
 * @param {Function} [params.onRetry]  - (attempt, errors) => void
 * @param {number}  [params.maxAttempts] - default 2 (initial + 1 repair)
 * @param {Object}  [params.generation]  - { model, temperature, topP, maxTokens, isSynthetic, isBenchmark, signal }
 * @param {Function} [params.onAttempt]  - (attempt, rawText) => void — capture hooks
 * @returns {Promise<{ text, response, attempts, allErrors }>}
 * @throws {Error} ENVELOPE_VALIDATION_FAILED when all attempts fail
 */
export async function generateStructured({
  contractId = 'unknown',
  purpose = 'resume_analysis',
  messages,
  validate,
  onRetry,
  onAttempt,
  maxAttempts = 2,
  generation = {},
}) {
  if (typeof validate !== 'function') throw new Error('generateStructured requires a validate(text) function')

  const allErrors = []
  let lastResponse = null
  let lastText = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptMessages =
      attempt === 1
        ? messages
        : [...messages, { role: 'user', content: REPAIR_INSTRUCTION.replace('{{ERRORS}}', allErrors.join('\n- ')) }]

    const response = await llmGateway.generate({
      purpose,
      messages: attemptMessages,
      responseFormat: 'json_object',
      ...generation,
    })

    lastResponse = response
    lastText = response.text

    if (onAttempt) onAttempt(attempt, response.text, response)

    const verdict = validate(response.text)
    if (verdict.valid) {
      return { text: response.text, response, attempts: attempt, allErrors }
    }

    allErrors.push(...(verdict.errors || ['Unknown validation failure']))

    // Fatal problems (e.g. truncated output) won't improve on retry — stop now.
    if (verdict.fatal) {
      const err = new Error(`Structured output failed fatally: ${allErrors.slice(0, 3).join('; ')}`)
      err.code = 'ENVELOPE_VALIDATION_FAILED'
      err.agent = contractId
      err.attempts = attempt
      err.lastResponse = response
      err.rawOutput = response.text
      err.fatal = true
      throw err
    }

    if (onRetry) onRetry(attempt, verdict.errors || [])
  }

  const err = new Error(
    `Structured output failed validation after ${maxAttempts} attempt(s): ${allErrors.slice(0, 5).join('; ')}`
  )
  err.code = 'ENVELOPE_VALIDATION_FAILED'
  err.agent = contractId
  err.attempts = maxAttempts
  err.lastResponse = lastResponse
  err.rawOutput = lastText
  throw err
}

export default { generateStructured }
