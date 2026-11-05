import assert from 'node:assert/strict'
import {
  buildBatchJdExtractionPrompt,
  extractSkillsFromBatch1Shot,
  analyzeAndAggregateJdCorpus,
} from '../agents/resume/market/llmJdSkillAnalyzer.js'
import {
  buildLeanSynthesisPrompt,
} from '../agents/resume/synthesis/resumeSynthesis.prompt.js'
import {
  buildChatbotSystemPrompt,
} from '../controllers/chatController.js'

console.log('=== RUNNING LEAN PROMPTS & 1-SHOT BATCH EXTRACTION VERIFICATION ===\n')

// -------------------------------------------------------------
// TEST 1: Lean 1-Shot Batch JD Extraction Prompt
// -------------------------------------------------------------
console.log('Test 1: Verifying buildBatchJdExtractionPrompt...')
const sampleJds = [
  'Senior Data Engineer needed with strong Apache Spark, Kafka, AWS, and Python experience.',
  'Looking for a Data Engineer proficient in Python, SQL, Snowflake, and Apache Airflow pipelines.',
]
const batchPrompt = buildBatchJdExtractionPrompt('Data Engineer', sampleJds)
assert.ok(batchPrompt.includes('Target Role: "Data Engineer"'), 'Prompt must include target role')
assert.ok(batchPrompt.includes('Analyze the following 2 Job Descriptions'), 'Prompt must include JD count')
assert.ok(batchPrompt.includes('"totalJdsAnalyzed": 2'), 'Prompt schema must specify totalJdsAnalyzed')
assert.ok(batchPrompt.includes('--- JD #1 ---'), 'Prompt must enumerate JD #1')
assert.ok(batchPrompt.includes('--- JD #2 ---'), 'Prompt must enumerate JD #2')
assert.ok(batchPrompt.includes('Extract ONLY concrete hard skills'), 'Prompt must enforce hard skills')
console.log('✔ Test 1 Passed: buildBatchJdExtractionPrompt builds clean, structured 1-shot prompt.\n')

// -------------------------------------------------------------
// TEST 2: Lean Resume Synthesis Prompt
// -------------------------------------------------------------
console.log('Test 2: Verifying buildLeanSynthesisPrompt...')
const leanSynthesis = buildLeanSynthesisPrompt({
  candidateName: 'John Doe',
  role: 'Full Stack Engineer',
  experienceYears: 5,
  parsedFacts: {
    workBullets: ['Engineered high-throughput GraphQL APIs reducing latency by 35%.'],
    skillsList: ['React', 'Node.js', 'PostgreSQL', 'Docker'],
  },
  marketDemandSkills: ['TypeScript', 'Kubernetes', 'AWS', 'Next.js'],
})

assert.ok(leanSynthesis.includes('Analyze Candidate: John Doe | Target: Full Stack Engineer (5 yrs exp).'))
assert.ok(leanSynthesis.includes('Verified Experience Points: ["Engineered high-throughput GraphQL APIs reducing latency by 35%."]'))
assert.ok(leanSynthesis.includes('Candidate Stated Skills: ["React","Node.js","PostgreSQL","Docker"]'))
assert.ok(leanSynthesis.includes('Live Market Demand Skills: ["TypeScript","Kubernetes","AWS","Next.js"]'))
assert.ok(leanSynthesis.includes('"overallScore": <number 0-100>'))
assert.ok(leanSynthesis.includes('"verdict": "<2-sentence executive summary>"'))
assert.ok(leanSynthesis.includes('"criticalGaps"'))
assert.ok(leanSynthesis.includes('"bulletImprovements"'))
console.log('✔ Test 2 Passed: buildLeanSynthesisPrompt strips boilerplate and injects precise structural facts.\n')

// -------------------------------------------------------------
// TEST 3: High-Speed Chatbot System Prompt
// -------------------------------------------------------------
console.log('Test 3: Verifying buildChatbotSystemPrompt...')
const chatPrompt = buildChatbotSystemPrompt({
  role: 'DevOps Engineer',
  overallScore: 82,
  verifiedSkills: ['Kubernetes', 'Terraform', 'CI/CD'],
  missingSkills: ['ArgoCD', 'Prometheus'],
  primaryBottleneck: 'Lack of GitOps scale evidence',
})

assert.ok(chatPrompt.includes('Target Role: DevOps Engineer'))
assert.ok(chatPrompt.includes('Overall Score: 82/100'))
assert.ok(chatPrompt.includes('Verified Skills: Kubernetes, Terraform, CI/CD'))
assert.ok(chatPrompt.includes('Missing Market Skills: ArgoCD, Prometheus'))
assert.ok(chatPrompt.includes('Primary Bottleneck: Lack of GitOps scale evidence'))
assert.ok(!chatPrompt.includes('Max 3-4 sentences per response'), 'Prompt must eliminate obsolete sentence limits')
assert.ok(chatPrompt.includes('[Action Verb] + [Context/Tech Stack] + [Measurable Business Outcome]'))
console.log('✔ Test 3 Passed: buildChatbotSystemPrompt minimizes context tokens and enforces high-leverage coaching.\n')

// -------------------------------------------------------------
// TEST 4: extractSkillsFromBatch1Shot Safe Edge-Case Handling
// -------------------------------------------------------------
console.log('Test 4: Verifying extractSkillsFromBatch1Shot safety...')
const emptyBatch = await extractSkillsFromBatch1Shot({ jdsTextList: [] })
assert.equal(emptyBatch.totalJdsAnalyzed, 0)
assert.deepEqual(emptyBatch.skills, [])
console.log('✔ Test 4 Passed: extractSkillsFromBatch1Shot handles empty inputs safely.\n')

// -------------------------------------------------------------
// TEST 5: analyzeAndAggregateJdCorpus Resilience
// -------------------------------------------------------------
console.log('Test 5: Verifying analyzeAndAggregateJdCorpus fallback & execution...')
const corpus = [
  { title: 'Data Engineer', description: 'Experience with Python, SQL, Apache Kafka, and AWS.' },
  { title: 'Data Engineer', description: 'Must know SQL, Python, Apache Spark, and Docker.' },
]
const corpusResult = await analyzeAndAggregateJdCorpus(corpus, 'data-engineer::3-5')
assert.equal(corpusResult.totalAnalyzed, 2)
assert.ok(Array.isArray(corpusResult.marketSkills))
assert.ok(corpusResult.marketSkills.length > 0)
assert.ok(corpusResult.marketSkills.some((s) => s.name === 'SQL' || s.name === 'Python'))
console.log('✔ Test 5 Passed: analyzeAndAggregateJdCorpus executes cleanly.\n')

console.log('ALL LEAN PROMPTS & BATCH EXTRACTION TESTS PASSED SUCCESSFULLY! 🚀')
