/**
 * Resume Agent V1 Model Benchmark Harness
 * Runs synthetic candidate resume across candidate models and captures structured metrics for manual review.
 */

import dotenv from 'dotenv'
import { ResumeAgent } from '../agents/resume/index.js'
import { MODEL_REGISTRY } from '../ai/config/modelRegistry.js'

// Load backend .env if present
dotenv.config()

// Realistic Synthetic Candidate Resume for benchmarking
export const SYNTHETIC_BENCHMARK_RESUME = `
Alex Mercer
alex.mercer.dev@example.com | (555) 345-6789 | San Francisco, CA | github.com/alexmercer

PROFESSIONAL SUMMARY
Full Stack Engineer with 4 years of experience designing and shipping distributed microservices, REST APIs, and responsive React applications. Focused on backend performance, database indexing, and cloud-native workflows.

TECHNICAL SKILLS
Languages: TypeScript, JavaScript, Python, Go, SQL
Frameworks & Libraries: React, Node.js, Express, Next.js, FastAPI
Databases & Cloud: PostgreSQL, MongoDB, Redis, Docker, AWS (S3, EC2, Lambda)
Tools & Practices: Git, GitHub Actions, Jest, REST APIs, GraphQL, Microservices

WORK EXPERIENCE
Senior Software Engineer | Apex Cloud Solutions | Austin, TX
July 2022 – Present
• Architected and deployed a multi-tenant payment processing service using Node.js, TypeScript, and PostgreSQL.
• Reduced database query latency by 42% by redesigning relational indexes and introducing Redis caching layer for read-heavy product catalog.
• Led migration of legacy monolith to containerized Docker services orchestrated on AWS ECS.
• Mentored 3 junior software engineers through bi-weekly architectural design reviews and pairing sessions.
• Built REST APIs using Spring Boot and PostgreSQL.

Software Engineer | BrightPath Interactive | Remote
September 2020 – June 2022
• Developed reusable component library in React and Tailwind CSS used by 4 frontend product teams.
• Implemented OAuth2 and JWT authentication flows across client applications and backend microservices.
• Wrote automated unit and integration tests with Jest, increasing test coverage from 55% to 84%.
• Handled customer bug tickets and maintained weekly deployment scripts.

TECHNICAL PROJECTS
Distributed Task Queue | Go, Redis, Docker
• Implemented an asynchronous background job processing engine with exponential backoff and dead-letter queues.
• Processed simulated load of 15,000 jobs per second with sub-5ms dispatch latency.

EDUCATION
B.S. in Computer Science | University of Texas at Austin | 2016 – 2020
`

const BENCHMARK_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'thinkingmachines/inkling-small:free',
]

export async function runBenchmark() {
  console.log('='.repeat(80))
  console.log('CAREER GPS — RESUME AGENT V1 BENCHMARK RUNNER')
  console.log('='.repeat(80))
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log(`OpenRouter Key Configured: ${Boolean(process.env.OPENROUTER_API_KEY)}`)
  console.log(`Target Models: ${BENCHMARK_MODELS.join(', ')}`)
  console.log('-'.repeat(80))

  const results = []

  for (const modelId of BENCHMARK_MODELS) {
    const modelMeta = MODEL_REGISTRY[modelId]
    console.log(`\n[RUNNING] Model: ${modelId} (${modelMeta?.displayName || 'Unknown'})...`)

    const startTime = Date.now()
    try {
      const evalResult = await ResumeAgent.evaluate({
        resumeText: SYNTHETIC_BENCHMARK_RESUME,
        targetRole: 'Senior Full Stack Engineer',
        model: modelId,
        isSynthetic: true, // Marked synthetic so inkling-small is eligible
      })

      const elapsedMs = Date.now() - startTime

      if (evalResult.success) {
        const issues = evalResult.analysis?.issues || []
        const strengths = evalResult.analysis?.strengths || []
        const rewritesCount = issues.filter((i) => i.correctedText).length
        const highSevCount = issues.filter((i) => i.severity === 'high').length

        console.log(`✓ [SUCCESS] Latency: ${evalResult.telemetry?.latencyMs || elapsedMs}ms`)
        console.log(`  Issues identified: ${issues.length} (${highSevCount} high severity)`)
        console.log(`  Strengths identified: ${strengths.length}`)
        console.log(`  Rewrites proposed: ${rewritesCount}`)
        console.log(`  Warnings/Corrections: ${evalResult.warnings?.length || 0}`)
        if (evalResult.warnings?.length > 0) {
          console.log(`  Warning details: ${evalResult.warnings.join(' | ')}`)
        }

        results.push({
          model: modelId,
          status: 'SUCCESS',
          latencyMs: evalResult.telemetry?.latencyMs || elapsedMs,
          jsonValid: true,
          issueCount: issues.length,
          highSeverityIssues: highSevCount,
          strengthsCount: strengths.length,
          rewritesCount,
          warningsCount: evalResult.warnings?.length || 0,
          sampleOverallReview: evalResult.analysis?.overallReview?.slice(0, 140) + '...',
        })
      } else {
        console.log(`✗ [VALIDATION_OR_AGENT_FAILURE] ${evalResult.error}`)
        results.push({
          model: modelId,
          status: 'AGENT_ERROR',
          latencyMs: elapsedMs,
          jsonValid: false,
          error: evalResult.error,
        })
      }
    } catch (err) {
      const elapsedMs = Date.now() - startTime
      console.log(`✗ [PROVIDER_ERROR] ${err.code || err.name}: ${err.message}`)
      results.push({
        model: modelId,
        status: 'PROVIDER_ERROR',
        latencyMs: elapsedMs,
        errorCode: err.code || err.name,
        error: err.message,
      })
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('BENCHMARK SUMMARY TABLE')
  console.log('='.repeat(80))
  console.table(results)

  return results
}

// Execute directly if run as CLI script
if (process.argv[1]?.endsWith('benchmarkResumeAgent.js')) {
  runBenchmark().then(() => process.exit(0)).catch((e) => {
    console.error('Benchmark fatal error:', e)
    process.exit(1)
  })
}
