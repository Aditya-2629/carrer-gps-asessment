import { LLMGateway, PRODUCTION_FALLBACK_CHAIN } from '../ai/gateway/llmGateway.js'
import { ProviderError } from '../ai/gateway/providerErrors.js'

async function runFallbackTest() {
  console.log('Testing LLMGateway Production Fallback Chain...')
  
  // 1. Benchmark mode: MUST NOT fallback
  const gwBenchmark = new LLMGateway({ fallbackEnabled: true, defaultResumeModel: 'openai/gpt-oss-120b', defaultProvider: 'groq' })
  let benchmarkCalls = []
  gwBenchmark.providers.groq = {
    generate: async ({ model }) => {
      benchmarkCalls.push(model)
      throw new ProviderError({ code: 'RATE_LIMIT', statusCode: 429, message: 'Simulated 429', isRetryable: true })
    }
  }

  try {
    await gwBenchmark.generate({
      messages: [{ role: 'user', content: 'test' }],
      isBenchmark: true,
    })
    console.error('FAIL: Benchmark mode should have thrown immediately!')
  } catch (err) {
    if (benchmarkCalls.length === 1 && benchmarkCalls[0] === 'openai/gpt-oss-120b') {
      console.log('PASS: Benchmark mode called ONLY requested model (1 call, zero fallback).')
    } else {
      console.error('FAIL: Benchmark mode calls:', benchmarkCalls)
    }
  }

  // 2. Production fallback mode: MUST fallback on retryable error
  const gwProd = new LLMGateway({ fallbackEnabled: true, defaultResumeModel: 'openai/gpt-oss-120b', defaultProvider: 'groq' })
  let prodCalls = []
  gwProd.providers.groq = {
    generate: async ({ model }) => {
      prodCalls.push(model)
      if (model === 'openai/gpt-oss-120b') {
        throw new ProviderError({ code: 'RATE_LIMIT', statusCode: 429, message: 'Simulated 429', isRetryable: true })
      }
      return { text: '{"success": true}', actualModel: model, tokens: {} }
    }
  }

  const prodResult = await gwProd.generate({
    messages: [{ role: 'user', content: 'test' }],
    isBenchmark: false,
  })

  if (prodCalls.length === 2 && prodCalls[0] === 'openai/gpt-oss-120b' && prodCalls[1] === 'openai/gpt-oss-20b' && prodResult.actualModel === 'openai/gpt-oss-20b') {
    console.log('PASS: Production fallback successfully chained from 120B -> 20B!')
  } else {
    console.error('FAIL: Production calls:', prodCalls, 'Result:', prodResult)
  }
}

runFallbackTest().catch(console.error)
