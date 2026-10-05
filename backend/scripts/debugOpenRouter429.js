/**
 * Debug Script: Single Test Request Diagnostic Runner
 * Runs ONE request to google/gemma-4-26b-a4b-it:free and logs safe diagnostics.
 */

import dotenv from 'dotenv'
dotenv.config()

import { ResumeAgentTestService } from '../services/resumeAgentTestService.js'
import { SYNTHETIC_BENCHMARK_RESUME } from './benchmarkResumeAgent.js'

async function debugSingleRequest() {
  console.log('--- EXECUTING SINGLE TEST REQUEST ---')
  console.log('Target Model: google/gemma-4-26b-a4b-it:free')
  console.log('Provider: openrouter')
  console.log('Key Present:', Boolean(process.env.OPENROUTER_API_KEY))

  const result = await ResumeAgentTestService.runSingleTest({
    resumeText: SYNTHETIC_BENCHMARK_RESUME,
    targetRole: 'Senior Full Stack Engineer',
    model: 'google/gemma-4-26b-a4b-it:free',
    isSynthetic: true,
  })

  // Format safe response according to user request
  const output = {
    status: result.status || (result.success ? 'success' : 'failure'),
    httpStatus: result.httpStatus || 200,
    provider: result.provider || 'openrouter',
    model: result.model || 'google/gemma-4-26b-a4b-it:free',
    errorCode: result.errorCode || (result.success ? null : 'ERROR'),
    errorMessage: result.errorMessage || (result.success ? 'Success' : result.error),
    requestId: result.requestId || result.testRun?.runId,
    rateLimitHeaders: result.rateLimitHeaders || {},
    calledUrl: result.errorDetails?.calledUrl || 'https://openrouter.ai/api/v1/chat/completions',
    responseFormatSent: result.errorDetails?.responseFormatSent ?? false,
    rawProviderError: result.errorDetails?.rawError || null,
  }

  console.log('\n--- EXACT DIAGNOSTIC OUTPUT ---')
  console.log(JSON.stringify(output, null, 2))
}

debugSingleRequest().catch((err) => {
  console.error('Diagnostic error:', err)
  process.exit(1)
})
