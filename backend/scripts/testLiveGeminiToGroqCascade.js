import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { aiConfig } from '../ai/config/aiConfig.js'
import { LLMGateway } from '../ai/gateway/llmGateway.js'
import { ProviderError, PROVIDER_ERROR_CODES } from '../ai/gateway/providerErrors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function testLiveFallbackCascade() {
  const fixturePath = path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt')
  const resumeText = fs.readFileSync(fixturePath, 'utf8')

  console.log('Testing Live Gemini -> Groq Fallback Cascade on ResumeAgent.evaluate...')
  
  // Temporarily force Gemini provider in the gateway instance to throw a 429 quota exhaustion
  // while letting Groq make the REAL, live network call to openai/gpt-oss-120b:
  const originalGetGateway = ResumeAgent.prototype?.gateway
  
  const start = Date.now()
  // We can pass a custom gateway or run ResumeAgent.evaluate where Gemini fails:
  // In ResumeAgent.evaluate, it uses `new LLMGateway(aiConfig)`.
  // Let's test gateway.generate directly with live Groq, after Gemini 429:
  const gateway = new LLMGateway(aiConfig)
  
  // Mock ONLY Gemini to simulate 429 quota exhaustion:
  gateway.providers.gemini = {
    name: 'gemini',
    generate: async () => {
      console.log('[Mocked Gemini] Throwing 429 Quota Exhaustion...')
      throw new ProviderError({
        code: PROVIDER_ERROR_CODES.RATE_LIMIT,
        message: 'All configured Gemini API keys are currently exhausted due to quota/rate limits (HTTP 429).',
        provider: 'gemini',
        model: 'gemini-3.6-flash',
        statusCode: 429,
        isRetryable: true,
      })
    }
  }
  
  // Groq is the REAL live provider (gateway.providers.groq is unchanged!)
  console.log('Executing LLMGateway.generate with Gemini (429) -> Live Groq...')
  const prompt = fs.readFileSync(path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt'), 'utf8')
  
  const res = await gateway.generate({
    purpose: 'resume_analysis',
    messages: [
      { role: 'system', content: 'You are a technical recruiter. Return valid JSON: {"analysisVersion": "2.2", "overallReview": {"summary": "Great", "topPriority": "None"}, "scores": {"impact": 80, "brevity": 80, "structure": 80, "skills": 80}, "strengths": [], "issues": []}' },
      { role: 'user', content: 'Analyze this resume: ' + prompt.slice(0, 500) }
    ],
    model: 'gemini-3.6-flash',
    isBenchmark: false,
  })

  console.log('Cascade Result:', {
    provider: res.provider,
    actualModel: res.actualModel,
    tokens: res.tokens,
    durationMs: Date.now() - start,
  })
}

testLiveFallbackCascade().catch(console.error)
