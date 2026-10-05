/**
 * Standardized Provider Error Codes and Custom Error Classes
 */

export const PROVIDER_ERROR_CODES = {
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  CONTEXT_LIMIT: 'CONTEXT_LIMIT',
  EMPTY_CONTENT: 'EMPTY_CONTENT',
  INVALID_JSON: 'INVALID_JSON',
  SCHEMA_VALIDATION_ERROR: 'SCHEMA_VALIDATION_ERROR',
  DATA_PRIVACY_ERROR: 'DATA_PRIVACY_ERROR',
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
}

export class ProviderError extends Error {
  constructor({
    code,
    message,
    provider = 'unknown',
    model = 'unknown',
    statusCode = 500,
    details = null,
    isRetryable = false,
  }) {
    super(message || `Provider error: ${code}`)
    this.name = 'ProviderError'
    this.code = code || PROVIDER_ERROR_CODES.SERVER_ERROR
    this.provider = provider
    this.model = model
    this.statusCode = statusCode
    this.details = details
    this.isRetryable = isRetryable
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      provider: this.provider,
      model: this.model,
      statusCode: this.statusCode,
      details: this.details,
      isRetryable: this.isRetryable,
    }
  }
}
