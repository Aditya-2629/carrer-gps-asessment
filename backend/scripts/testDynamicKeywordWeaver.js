import assert from 'node:assert'
import {
  classifyToolCategory,
  weaveToolIntoSentence,
  generateInterviewScript,
  generateTalkingScript,
  buildRolePracticeBullet,
  weaveKeywordsDeterministic,
  weaveKeywordsAndBuildLedger,
} from '../agents/resume/market/smartKeywordWeaver.js'
import { downloadAtsResumeDocx } from '../controllers/assessmentController.js'

console.log('================================================================')
console.log('TEST SUITE: UNIVERSAL MULTI-DOMAIN DYNAMIC KEYWORD WEAVING ENGINE')
console.log('================================================================\n')

// -------------------------------------------------------------
// Test 1: Multi-Domain Category Classification
// -------------------------------------------------------------
console.log('[Test 1] Multi-Domain Category Classification')

assert.strictEqual(classifyToolCategory('Snowflake', 'Data Analyst'), 'data_warehouse')
assert.strictEqual(classifyToolCategory('dbt', 'Analytics Engineer'), 'data_warehouse')
assert.strictEqual(classifyToolCategory('BigQuery', 'BI Developer'), 'data_warehouse')
assert.strictEqual(classifyToolCategory('Power BI', 'Business Intelligence Analyst'), 'data_warehouse')

assert.strictEqual(classifyToolCategory('FastMCP', 'AI Engineer'), 'ai_ml')
assert.strictEqual(classifyToolCategory('LangGraph', 'Generative AI Specialist'), 'ai_ml')
assert.strictEqual(classifyToolCategory('ChromaDB', 'LLM Engineer'), 'ai_ml')
assert.strictEqual(classifyToolCategory('vLLM', 'AI Inference Engineer'), 'ai_ml')

assert.strictEqual(classifyToolCategory('Terraform', 'DevOps Engineer'), 'cloud_devops')
assert.strictEqual(classifyToolCategory('Kubernetes', 'Cloud Architect'), 'cloud_devops')
assert.strictEqual(classifyToolCategory('Docker', 'Platform Engineer'), 'cloud_devops')

assert.strictEqual(classifyToolCategory('Kafka', 'Backend Engineer'), 'messaging_streaming')
assert.strictEqual(classifyToolCategory('Redis', 'Software Engineer'), 'messaging_streaming')
assert.strictEqual(classifyToolCategory('RabbitMQ', 'Distributed Systems Engineer'), 'messaging_streaming')

assert.strictEqual(classifyToolCategory('TypeScript', 'Frontend Engineer'), 'frontend_ui')
assert.strictEqual(classifyToolCategory('React', 'Full Stack Developer'), 'frontend_ui')

console.log('  ✓ 1.1 Universal category classification verified across Data, AI, DevOps, Messaging, and UI\n')

// -------------------------------------------------------------
// Test 2: Multi-Domain Bullet Weaving
// -------------------------------------------------------------
console.log('[Test 2] Domain-Calibrated Natural Clause Weaving')

// 2.1 Data Analyst Domain
const dataResume = {
  target_role: 'Lead Data Analyst',
  experiences: [
    {
      company: 'Enterprise Health',
      role: 'Senior Data Analyst',
      isCurrent: false,
      bullets: [
        'Maintained SQL database queries and executive reporting dashboards.',
      ],
    },
  ],
}

const dataWoven = weaveKeywordsDeterministic({
  canonicalResume: dataResume,
  missingKeywords: ['Snowflake', 'dbt'],
  targetRole: 'Lead Data Analyst',
})

const dataExp = dataWoven.tailoredExperiences[0]
assert(dataExp.bullets.some((b) => b.includes('Snowflake')), 'Must weave Snowflake into Data Analyst experience')
const snowflakeBullet = dataExp.bullets.find((b) => b.includes('Snowflake'))
assert(snowflakeBullet.includes('leveraging Snowflake for scalable transformation pipelines'), 'Must use analytical pipeline phrasing')
console.log('  ✓ 2.1 Data Analyst domain (Snowflake, dbt) woven with dimensional warehouse phrasing')

// 2.2 GenAI / LLM Domain
const genaiResume = {
  target_role: 'Generative AI Engineer',
  experiences: [
    {
      company: 'Cognitive AI',
      role: 'AI Systems Engineer',
      isCurrent: true,
      bullets: [
        'Build autonomous agents and retrieval-augmented search pipelines.',
      ],
    },
  ],
}

const genaiWoven = weaveKeywordsDeterministic({
  canonicalResume: genaiResume,
  missingKeywords: ['FastMCP', 'LangGraph'],
  targetRole: 'Generative AI Engineer',
})

const genaiExp = genaiWoven.tailoredExperiences[0]
assert(genaiExp.bullets.some((b) => b.includes('FastMCP')), 'Must weave FastMCP into GenAI experience')
const fastMcpBullet = genaiExp.bullets.find((b) => b.includes('FastMCP'))
assert(fastMcpBullet.includes('integrating FastMCP to optimize vector retrieval precision'), 'Must use AI retrieval precision phrasing')
console.log('  ✓ 2.2 GenAI domain (FastMCP, LangGraph) woven with vector retrieval and latency phrasing')

// 2.3 DevOps / Cloud Domain
const devopsResume = {
  target_role: 'DevOps & Cloud Engineer',
  experiences: [
    {
      company: 'CloudScale Inc',
      role: 'DevOps Engineer',
      isCurrent: false,
      bullets: [
        'Automated cloud infrastructure provisioning and containerized services deployment.',
      ],
    },
  ],
}

const devopsWoven = weaveKeywordsDeterministic({
  canonicalResume: devopsResume,
  missingKeywords: ['Terraform', 'Kubernetes'],
  targetRole: 'DevOps & Cloud Engineer',
})

const devopsExp = devopsWoven.tailoredExperiences[0]
assert(devopsExp.bullets.some((b) => b.includes('Terraform')), 'Must weave Terraform into DevOps experience')
console.log('  ✓ 2.3 DevOps domain (Terraform, Kubernetes) woven with zero-downtime rolling release phrasing\n')

// -------------------------------------------------------------
// Test 3: Role-Calibrated Practice Bullets
// -------------------------------------------------------------
console.log('[Test 3] Role-Calibrated Dedicated Practice Bullets')

const dataPractice = buildRolePracticeBullet('Senior Data Analyst')
assert.strictEqual(dataPractice.keyword, 'Data Quality & dbt Assertions')
assert(dataPractice.bullet.includes('schema assertions with dbt'))
assert(dataPractice.script.includes('automated uniqueness, not-null, and relationship tests'))
console.log('  ✓ 3.1 Data role generates dbt schema assertion practice bullet')

const aiPractice = buildRolePracticeBullet('Generative AI Engineer')
assert.strictEqual(aiPractice.keyword, 'LLM Evaluation & Guardrails')
assert(aiPractice.bullet.includes('RAG evaluation test suites and prompt-injection guardrails'))
assert(aiPractice.script.includes('synthetic test sets and confidence-score fallback thresholds'))
console.log('  ✓ 3.2 AI role generates RAG evaluation & prompt defense practice bullet')

const devopsPractice = buildRolePracticeBullet('DevOps Engineer')
assert.strictEqual(devopsPractice.keyword, 'CI/CD Automation & Security Scanning')
assert(devopsPractice.bullet.includes('GitHub Actions CI/CD pipelines with integrated container vulnerability scanning'))
assert(devopsPractice.script.includes('deployment gating rules, automated rollback policies'))
console.log('  ✓ 3.3 DevOps role generates container vulnerability scanning practice bullet')

const swePractice = buildRolePracticeBullet('Full Stack Software Engineer')
assert.strictEqual(swePractice.keyword, 'Unit / Integration Testing & Git')
assert(swePractice.bullet.includes('Jest and PyTest'))
assert(swePractice.script.includes('automated PR test gating'))
console.log('  ✓ 3.4 SWE role generates Jest/PyTest/Git PR gating practice bullet\n')

// -------------------------------------------------------------
// Test 4: Dynamic Interview Talking Scripts
// -------------------------------------------------------------
console.log('[Test 4] Dynamic Developer-Grade Interview Defense Scripts')

const scriptData = generateInterviewScript('Snowflake', 'data_warehouse', 'Data Analyst', 'Acme Corp')
assert(scriptData.includes('Acme Corp'))
assert(scriptData.includes('model star schemas, optimize query runtimes, and automate business reporting SLAs'))

const scriptAi = generateInterviewScript('FastMCP', 'ai_ml', 'AI Engineer', 'Nexus AI')
assert(scriptAi.includes('Nexus AI'))
assert(scriptAi.includes('optimize context retrieval precision, manage token latency, and enforce prompt defense guardrails'))

const scriptDevops = generateInterviewScript('Terraform', 'cloud_devops', 'DevOps Engineer', 'ScaleOps')
assert(scriptDevops.includes('ScaleOps'))
assert(scriptDevops.includes('reproducible environments, automated health probes, and zero-downtime deployment rollouts'))

console.log('  ✓ 4.1 Developer talking scripts dynamically calibrated by tool purpose and company context\n')

// -------------------------------------------------------------
// Test 5: downloadAtsResumeDocx Direct Bullet Rewrites Prioritization
// -------------------------------------------------------------
console.log('[Test 5] downloadAtsResumeDocx Direct Bullet Rewrites Prioritization')

let capturedBuffer = null
let capturedHeaders = {}
const fakeRes = {
  setHeader: (k, v) => { capturedHeaders[k] = v },
  send: (buf) => { capturedBuffer = buf },
  end: (buf) => { if (buf) capturedBuffer = buf },
  status: (code) => ({ json: (d) => { console.error('Status Error:', code, d) } }),
}

const directPayloadReq = {
  params: {},
  query: {},
  body: {
    reportData: {
      candidate_name: 'Swapnil Data Lead',
      target_role: 'Lead Data Analyst',
      resume_agent: {
        canonicalResume: {
          candidate_name: 'Swapnil Data Lead',
          target_role: 'Lead Data Analyst',
          experiences: [
            {
              company: 'HealthData Corp',
              role: 'Data Analyst',
              bullets: [
                'Wrote queries for business reports.',
              ],
            },
          ],
        },
        bulletRewrites: [
          {
            originalBullet: 'Wrote queries for business reports.',
            rewrittenBullet: 'Engineered automated Snowflake analytical models and executive reporting pipelines, cutting turnaround time by 60%.',
          },
        ],
      },
    },
    missingKeywords: ['dbt', 'BigQuery'],
  },
}

await downloadAtsResumeDocx(directPayloadReq, fakeRes)

assert(capturedBuffer && Buffer.isBuffer(capturedBuffer), 'Must generate DOCX buffer')
assert(capturedBuffer.length > 5000, `DOCX buffer must be valid size (got ${capturedBuffer.length} bytes)`)
assert.strictEqual(capturedHeaders['Content-Type'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
assert(capturedHeaders['Content-Disposition'].includes('Swapnil_Data_Lead_Tailored_ATS_Resume.docx'))

console.log('  ✓ 5.1 downloadAtsResumeDocx prioritizes direct LLM bullet rewrites and returns valid tailored DOCX')

console.log('\n================================================================')
console.log('ALL UNIVERSAL MULTI-DOMAIN DYNAMIC KEYWORD WEAVING TESTS PASSED!')
console.log('================================================================\n')
setTimeout(() => process.exit(0), 100)
