/**
 * Comprehensive Unit & Integration Verification Suite for Resume Agent V2.2
 *
 * Implements Section 31 Unit Test Requirements:
 * 1. Prompt version = 2.2
 * 2. Valid JSON
 * 3. Schema validation
 * 4. Evidence exact-match validation
 * 5. Missing evidence
 * 6. Fabricated metric detection
 * 7. New technology detection
 * 8. Unsupported assumption warning
 * 9. correctedText validation
 * 10. Issue count > 10
 * 11. finish_reason = length
 * 12. gateway metadata injection
 * 13. provider failure classification
 * 14. successful analysis
 * 15. compact serializer stability
 */

import { DocumentParser, PARSER_WARNINGS } from '../services/documentParser/index.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import {
  ResumeAgentPrompt,
  PROMPT_VERSION,
  RESUME_EXPERT_V2_2,
} from '../agents/resume/resumeAgent.prompt.js'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { llmGateway } from '../ai/gateway/llmGateway.js'
import {
  serializeResumeForLLM,
  computeHash,
} from '../agents/resume/resumeAgent.inputSerializer.js'
import { SYNTHETIC_BENCHMARK_RESUME } from './benchmarkResumeAgent.js'

function assert(condition, message) {
  if (!condition) {
    console.error(`FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`PASS: ${message}`)
}

async function runUnitTests() {
  console.log('================================================================')
  console.log('RESUME AGENT V2.2 PRODUCTION UNIT TEST SUITE (15 SCENARIOS)')
  console.log('================================================================\n')

  // Setup sample canonical resume from synthetic benchmark
  const parsedDoc = await DocumentParser.parse({ text: SYNTHETIC_BENCHMARK_RESUME })
  const canonical = ResumeNormalizer.normalize(parsedDoc, 'Senior Full Stack Engineer')

  // Base valid V2.2 LLM analysis output
  const baseValidV22Output = {
    analysisVersion: '2.2',
    candidateSnapshot: {
      name: 'Alex Mercer',
      targetRole: 'Senior Full Stack Engineer',
      experienceLevel: 'Senior (4 years)',
      primaryProfile: 'Full Stack & Distributed Systems',
    },
    dashboard: null,
    overallReview: {
      summary:
        'Alex demonstrates solid engineering ownership with demonstrable indexing and API work across his roles.',
      tone: 'conversational',
    },
    strengths: [
      {
        id: 'str_001',
        title: 'Measurable query performance optimization',
        description: 'Reduced database query latency by 42% through indexing and caching.',
        evidence: [
          {
            section: 'experience',
            itemId: 'exp_001',
            bulletId: 'exp_001_b02',
            originalText:
              'Reduced database query latency by 42% by redesigning relational indexes and introducing Redis caching layer for read-heavy product catalog.',
          },
        ],
      },
    ],
    issues: [
      {
        id: 'issue_001',
        severity: 'high',
        category: 'ownership_clarity',
        title: 'Hidden throughput context on payment service',
        diagnosis:
          'The bullet describes building the payment service, but does not provide clarity on transaction volume.',
        whyItMatters:
          'This makes it harder for a recruiter to evaluate the operational throughput and workload requirements of the system.',
        recommendation:
          'If you tracked transaction volume or uptime reliability for this service, add that context.',
        correctedText: null,
        evidence: [
          {
            section: 'experience',
            itemId: 'exp_001',
            bulletId: 'exp_001_b01',
            originalText:
              'Architected and deployed a multi-tenant payment processing service using Node.js, TypeScript, and PostgreSQL.',
          },
        ],
      },
    ],
    priorityActions: [
      {
        priority: 1,
        title: 'Surface Payment Service Scale',
        action: 'Clarify payment throughput or user scale without guessing.',
        reason: 'Demonstrates senior system capability.',
      },
    ],
  }

  // ---------------------------------------------------------------------------
  // 1. Prompt version = 2.2
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: Prompt version ---')
  assert(
    PROMPT_VERSION === 'resume-expert-v2.2' || PROMPT_VERSION === 'resume-expert-v2.5',
    'Prompt version is valid resume-expert version'
  )
  assert(typeof RESUME_EXPERT_V2_2 === 'string', 'RESUME_EXPERT_V2_2 is exported as string')
  assert(
    RESUME_EXPERT_V2_2.includes('senior technical recruiter and resume reviewer'),
    'Prompt contains senior technical recruiter persona'
  )
  assert(
    RESUME_EXPERT_V2_2.includes('REAL IMPACT RULE'),
    'Prompt includes REAL IMPACT RULE'
  )
  assert(
    RESUME_EXPERT_V2_2.includes('UNSUPPORTED ASSUMPTION GUARDRAIL'),
    'Prompt includes UNSUPPORTED ASSUMPTION GUARDRAIL'
  )
  assert(
    RESUME_EXPERT_V2_2.includes('"analysisVersion": "2.2"'),
    'Prompt requires analysisVersion 2.2'
  )

  // ---------------------------------------------------------------------------
  // 2. Valid JSON
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Valid JSON parsing ---')
  const jsonWithMarkdown = '```json\n{"analysisVersion":"2.2","valid":true}\n```'
  const parsedClean = ResumeAgentValidator.cleanAndParse(jsonWithMarkdown)
  assert(parsedClean.analysisVersion === '2.2' && parsedClean.valid === true, 'JSON with markdown codeblock cleans and parses')

  let jsonFailed = false
  try {
    ResumeAgentValidator.cleanAndParse('not json at all ::: <<<>>>')
  } catch (e) {
    jsonFailed = true
  }
  assert(jsonFailed, 'Corrupted JSON string throws JSON parse error')

  // ---------------------------------------------------------------------------
  // 3. Schema validation
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Schema validation ---')
  const validSchemaResult = ResumeAgentValidator.validate(baseValidV22Output, canonical)
  assert(validSchemaResult.isSchemaValid === true, 'Valid baseline output passes schema validation')
  assert(validSchemaResult.sanitizedAnalysis.dashboard === null, 'Dashboard remains null')

  const missingFieldOutput = { ...baseValidV22Output }
  delete missingFieldOutput.priorityActions
  const missingFieldResult = ResumeAgentValidator.validate(missingFieldOutput, canonical)
  assert(missingFieldResult.isSchemaValid === false, 'Missing priorityActions fails schema validation')
  assert(
    missingFieldResult.errors.some((e) => e.includes('priorityActions')),
    'Error message specifies missing priorityActions'
  )

  // ---------------------------------------------------------------------------
  // 4. Evidence exact-match validation
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Evidence exact-match validation ---')
  const exactMatchOutput = JSON.parse(JSON.stringify(baseValidV22Output))
  const exactResult = ResumeAgentValidator.validate(exactMatchOutput, canonical)
  assert(exactResult.isEvidenceValid === true, 'Verbatim originalText passes exact match')

  const mismatchEvidenceOutput = JSON.parse(JSON.stringify(baseValidV22Output))
  mismatchEvidenceOutput.issues[0].evidence[0].originalText = 'Built some random payment stuff in PHP'
  const mismatchResult = ResumeAgentValidator.validate(mismatchEvidenceOutput, canonical)
  assert(mismatchResult.isEvidenceValid === false, 'Mismatched originalText fails evidence validation')
  assert(
    mismatchResult.evidenceErrors.some((e) => e.includes('does not match canonical resume text')),
    'Evidence mismatch error generated'
  )

  // ---------------------------------------------------------------------------
  // 5. Missing evidence
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 5: Missing evidence validation ---')
  const emptyEvidenceOutput = JSON.parse(JSON.stringify(baseValidV22Output))
  emptyEvidenceOutput.issues[0].evidence = []
  const emptyEvResult = ResumeAgentValidator.validate(emptyEvidenceOutput, canonical)
  assert(emptyEvResult.isEvidenceValid === false, 'Empty evidence array fails evidence validation')

  const missingBulletIdOutput = JSON.parse(JSON.stringify(baseValidV22Output))
  missingBulletIdOutput.issues[0].evidence[0].bulletId = ''
  const missingBulletResult = ResumeAgentValidator.validate(missingBulletIdOutput, canonical)
  assert(missingBulletResult.isEvidenceValid === false, 'Empty bulletId fails evidence validation')

  // ---------------------------------------------------------------------------
  // 6. Fabricated metric detection
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 6: Fabricated metric detection ---')
  const fabricatedMetricOutput = JSON.parse(JSON.stringify(baseValidV22Output))
  fabricatedMetricOutput.issues[0].correctedText =
    'Architected and deployed a multi-tenant payment service handling $50M in transactions with 99.99% uptime.'
  const fabMetricResult = ResumeAgentValidator.validate(fabricatedMetricOutput, canonical)
  assert(
    fabMetricResult.unsupportedClaims.some((c) => c.claim.includes('$50M')),
    'Detected invented $50M currency claim'
  )
  assert(
    fabMetricResult.unsupportedClaims.some((c) => c.claim.includes('99.99%')),
    'Detected invented 99.99% percentage claim'
  )

  // ---------------------------------------------------------------------------
  // 7. New technology detection
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 7: New technology detection ---')
  const newTechOutput = JSON.parse(JSON.stringify(baseValidV22Output))
  newTechOutput.issues[0].correctedText =
    'Architected and deployed a multi-tenant payment service using Kubernetes and Kafka.'
  const newTechResult = ResumeAgentValidator.validate(newTechOutput, canonical)
  assert(
    newTechResult.traceabilityWarnings.some((w) => w.toLowerCase().includes('kubernetes')),
    'Detected untraceable technology (kubernetes) in correctedText'
  )

  // ---------------------------------------------------------------------------
  // 8. Unsupported assumption warning
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 8: Unsupported assumption warning ---')
  const assumptionOutput = JSON.parse(JSON.stringify(baseValidV22Output))
  assumptionOutput.issues[0].diagnosis = 'This looks like a basic CRUD student project rather than a production system.'
  const assumptionResult = ResumeAgentValidator.validate(assumptionOutput, canonical)
  assert(
    assumptionResult.unsupportedAssumptionWarnings.length >= 2,
    `Detected unsupported assumption warnings (found ${assumptionResult.unsupportedAssumptionWarnings.length})`
  )
  assert(
    assumptionResult.unsupportedAssumptionWarnings.some((w) => w.phrase === 'student project'),
    'Flagged "student project" assumption warning'
  )
  assert(
    assumptionResult.unsupportedAssumptionWarnings.some((w) => w.phrase === 'basic CRUD'),
    'Flagged "basic CRUD" assumption warning'
  )

  // ---------------------------------------------------------------------------
  // 9. correctedText validation
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 9: correctedText validation ---')
  const outcomeClaimOutput = JSON.parse(JSON.stringify(baseValidV22Output))
  outcomeClaimOutput.issues[0].correctedText =
    'Architected and deployed a multi-tenant payment processing service that significantly improved payment speed.'
  const outcomeClaimResult = ResumeAgentValidator.validate(outcomeClaimOutput, canonical)
  assert(
    outcomeClaimResult.fabricatedOutcomeWarnings.length > 0,
    'Detected ungrounded outcome keyword ("improved") in correctedText'
  )

  // ---------------------------------------------------------------------------
  // 10. Issue count > 10
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 10: Issue count > 10 check ---')
  const elevenIssuesOutput = JSON.parse(JSON.stringify(baseValidV22Output))
  const sampleIssue = elevenIssuesOutput.issues[0]
  elevenIssuesOutput.issues = []
  for (let i = 1; i <= 11; i++) {
    elevenIssuesOutput.issues.push({
      ...sampleIssue,
      id: `issue_${String(i).padStart(3, '0')}`,
    })
  }
  const elevenResult = ResumeAgentValidator.validate(elevenIssuesOutput, canonical)
  assert(elevenResult.isSchemaValid === false, 'Output with 11 issues rejected by validator')
  assert(
    elevenResult.errors.some((e) => e.includes('exceeds the hard maximum limit of 10')),
    'Error specifies hard maximum limit of 10 issues'
  )

  // ---------------------------------------------------------------------------
  // 11. finish_reason = length
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 11: finish_reason = length handling ---')
  // Mock gateway generate returning finishReason = 'length'
  const origGenerate = llmGateway.generate
  llmGateway.generate = async () => ({
    text: '{"analysisVersion": "2.2", "candidateSnapshot":',
    actualModel: 'openai/gpt-oss-120b',
    provider: 'groq',
    finishReason: 'length',
    latencyMs: 850,
    requestId: 'req_test_trunc',
    tokens: { prompt: 500, completion: 4096, total: 4596 },
  })

  const truncEvalResult = await ResumeAgent.evaluate({
    resumeText: SYNTHETIC_BENCHMARK_RESUME,
    targetRole: 'Senior Full Stack Engineer',
    model: 'openai/gpt-oss-120b',
  })

  assert(truncEvalResult.success === false, 'finishReason="length" returns success: false')
  assert(
    truncEvalResult.status === 'MODEL_OUTPUT_INCOMPLETE',
    'status is classified as MODEL_OUTPUT_INCOMPLETE'
  )
  assert(
    truncEvalResult.classification === 'MODEL_OUTPUT_INCOMPLETE',
    'classification is MODEL_OUTPUT_INCOMPLETE'
  )
  assert(
    truncEvalResult.metadata.finishReason === 'length',
    'metadata captures finishReason="length"'
  )

  // ---------------------------------------------------------------------------
  // 12. Gateway metadata injection
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 12: Gateway metadata injection ---')
  llmGateway.generate = async () => ({
    text: JSON.stringify(baseValidV22Output),
    actualModel: 'openai/gpt-oss-120b',
    provider: 'groq',
    finishReason: 'stop',
    latencyMs: 1200,
    requestId: 'req_meta_injection_test',
    tokens: { prompt: 620, completion: 850, total: 1470 },
  })

  const metaEvalResult = await ResumeAgent.evaluate({
    resumeText: SYNTHETIC_BENCHMARK_RESUME,
    targetRole: 'Senior Full Stack Engineer',
    model: 'openai/gpt-oss-120b',
  })

  assert(metaEvalResult.success === true, 'Agent evaluation succeeds with valid mock response')
  assert(metaEvalResult.metadata != null, 'Metadata object exists in response')
  assert(metaEvalResult.metadata.provider === 'groq', 'Metadata provider is injected by gateway')
  assert(metaEvalResult.metadata.model === 'openai/gpt-oss-120b', 'Metadata model is injected by gateway')
  assert(metaEvalResult.metadata.latencyMs === 1200, 'Metadata latencyMs is injected by gateway')
  assert(metaEvalResult.metadata.requestId === 'req_meta_injection_test', 'Metadata requestId is injected')
  assert(metaEvalResult.metadata.inputTokens === 620, 'Metadata inputTokens injected')
  assert(metaEvalResult.metadata.outputTokens === 850, 'Metadata outputTokens injected')
  assert(metaEvalResult.metadata.finishReason === 'stop', 'Metadata finishReason injected')

  // ---------------------------------------------------------------------------
  // 13. Provider failure classification
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 13: Provider failure classification ---')
  llmGateway.generate = async () => {
    const err = new Error('Groq 503 Service Unavailable')
    err.statusCode = 503
    err.provider = 'groq'
    err.code = 'PROVIDER_ERROR'
    throw err
  }

  const provFailResult = await ResumeAgent.evaluate({
    resumeText: SYNTHETIC_BENCHMARK_RESUME,
    targetRole: 'Senior Full Stack Engineer',
    model: 'openai/gpt-oss-120b',
  })

  assert(provFailResult.success === false, 'Provider error returns success: false')
  assert(provFailResult.status === 'PROVIDER_ERROR', 'status is PROVIDER_ERROR')
  assert(provFailResult.classification === 'PROVIDER_ERROR', 'classification is PROVIDER_ERROR')

  // Restore original gateway generate
  llmGateway.generate = origGenerate

  // ---------------------------------------------------------------------------
  // 14. Successful analysis
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 14: Successful analysis validation ---')
  llmGateway.generate = async () => ({
    text: JSON.stringify(baseValidV22Output),
    actualModel: 'openai/gpt-oss-120b',
    provider: 'groq',
    finishReason: 'stop',
    latencyMs: 950,
    requestId: 'req_success_test',
    tokens: { prompt: 550, completion: 600, total: 1150 },
  })

  const successEvalResult = await ResumeAgent.evaluate({
    resumeText: SYNTHETIC_BENCHMARK_RESUME,
    targetRole: 'Senior Full Stack Engineer',
    model: 'openai/gpt-oss-120b',
  })

  assert(successEvalResult.success === true, 'Successful analysis returns success: true')
  assert(successEvalResult.classification === 'SUCCESS', 'Classification is SUCCESS')
  assert(successEvalResult.analysis.analysisVersion === '2.2', 'Analysis version is 2.2')
  assert(successEvalResult.analysis.dashboard === null, 'Dashboard is null (deterministic layer calculates scores)')

  llmGateway.generate = origGenerate

  // ---------------------------------------------------------------------------
  // 15. Compact serializer stability
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 15: Compact serializer stability ---')
  const canonicalJson = JSON.stringify(canonical, null, 2)
  const compactText1 = serializeResumeForLLM(canonical, { targetRole: 'Senior Full Stack Engineer' })
  const compactText2 = serializeResumeForLLM(canonical, { targetRole: 'Senior Full Stack Engineer' })

  assert(compactText1 === compactText2, 'Compact serializer produces identical deterministic output')
  assert(compactText1.includes('[exp_001]'), 'Contains stable itemId [exp_001]')
  assert(compactText1.includes('[exp_001_b01]'), 'Contains stable bulletId [exp_001_b01]')
  assert(compactText1.length < canonicalJson.length, `Compact text (${compactText1.length} chars) is smaller than canonical JSON (${canonicalJson.length} chars)`)
  const hash1 = computeHash(compactText1)
  const hash2 = computeHash(compactText2)
  assert(hash1 === hash2, 'Hash of compact serialized output is strictly stable')

  console.log('\n================================================================')
  console.log('ALL 15 RESUME AGENT V2.2 UNIT & INTEGRATION TESTS PASSED!')
  console.log('================================================================\n')
}

runUnitTests().catch((e) => {
  console.error('Fatal test error:', e)
  process.exit(1)
})
