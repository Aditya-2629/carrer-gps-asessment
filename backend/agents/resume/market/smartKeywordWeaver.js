import crypto from 'crypto'
import { jsonrepair } from 'jsonrepair'
import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { toPresentTense } from '../signals/patterns.js'
import { isConcreteTechSkill, isGenuineTechnicalSkill } from './dynamicSkillExtractor.js'

// In-memory cache for rewritten bullets (hash -> rewritten result)
export const BULLET_REWRITE_CACHE = new Map()
const MAX_CACHE_SIZE = 1000

export function getRewriteHash(bulletId, originalText, skills = []) {
  const normSkills = [...skills].map((s) => (typeof s === 'string' ? s : s?.skill || s?.keyword || s?.name || '').toLowerCase().trim()).filter(Boolean).sort().join('|')
  return crypto
    .createHash('sha256')
    .update(`${bulletId}:${(originalText || '').trim()}:${normSkills}`)
    .digest('hex')
    .slice(0, 24)
}

export const BATCH_WEAVER_SYSTEM_PROMPT = `You are a Principal Technical Interviewer, FAANG Bar Raiser, and Executive Resume Architect.
Your task is twofold for each candidate experience bullet:
1. NATURALLY RE-ENGINEER THE BULLET to weave the target skills using Google XYZ impact framing (Accomplished [X] measured by [Y] by doing [Z]).
2. GENERATE AN ELITE TECHNICAL INTERVIEW DEFENSE SCRIPT so the candidate can defend every woven tool convincingly in technical rounds.

CRITICAL RULES:
- NATURAL COMPLEMENTARY PAIRING: When cohesive, weave up to 2 complementary tools into a single bullet (e.g. "Docker & Kubernetes", "React & TypeScript", "Kafka & Redis", "FastAPI & Python", "PostgreSQL & SQL") so technical depth is maximized without sounding stuffed.
- DISTRIBUTE ACROSS EXPERIENCES: Do not overload a single job. Balance woven tools across current and previous roles/projects.
- PRESERVE AND ANCHOR TO CANDIDATE DATA: Reference their real company, real metrics (e.g. percentages, turnaround times, record counts), and real domain scope.
- ACTION VERB LEAD: Start every bullet with a strong past-tense active verb (e.g. "Architected", "Engineered", "Orchestrated", "Automated", "Standardized").
- LENGTH FLOOR: Each rewritten bullet must be 18 to 32 words (punchy, clean, 1 to 2 lines in Word/PDF).
- TECHNICAL MECHANISMS: Provide concrete technical implementations:
  - If Snowflake/BigQuery: mention partitioning, clustering keys, or query cost reduction.
  - If dbt: mention modular DAG staging/marts models or schema test assertions.
  - If Power BI/Tableau: mention DAX measures, row-level security (RLS), or star-schemas.
  - If Airflow/Spark: mention DAG orchestration, idempotent tasks, or PySpark partitions.
  - If Kafka/RabbitMQ: mention consumer offsets, event streaming, or decoupled worker queues.

SPOKEN INTERVIEW CADENCE & 3-SENTENCE SPOKEN FORMULA:
- Spoken Cadence: Use natural first-person spoken English with conversational contractions ("we'd", "wasn't", "I've", "we're").
- The 3-Sentence Spoken Interview Formula:
  1. The Practical Problem: "In our microservices layer at [Company], we ran into a bottleneck where [specific issue]."
  2. The Technical Trade-off: "I evaluated [Tool A] vs [Tool B], and we chose [Tool A] specifically because [concrete technical reason, e.g. lower memory overhead / better concurrency support]."
  3. The Verified Result: "That brought our [latency/build time/query time] down to [metric] and kept the deployment stable."
- Banned in Spoken Scripts: Purge phrases like "integrated into our operational workflows to deliver measurable efficiency gains", "spearheaded", "leveraged", "synergistic", "cutting-edge".

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "rewrittenBullets": [
    {
      "bulletId": "exp_001_b01",
      "wovenSkills": ["Docker", "Kubernetes"],
      "wovenSkill": "Docker, Kubernetes",
      "rewrittenText": "Orchestrated multi-stage Docker container builds and automated Kubernetes deployments across production clusters, cutting release turnaround by 45% and ensuring zero-downtime rollouts.",
      "interviewDefense": {
        "interviewerQuestion": "How did you manage container lifecycle and cluster resource limits using Docker and Kubernetes?",
        "talkingScript": "In our microservices layer at my company, we ran into a bottleneck where manual VM deployments caused inconsistent builds and slow release cycles. I evaluated standalone containers versus Kubernetes orchestration, and we chose Kubernetes specifically because horizontal pod autoscaling and rolling updates handled peak spikes without manual intervention. That brought our release turnaround down by 45% and kept our production uptime at 99.99%.",
        "tradeOffJustification": "We adopted Kubernetes container orchestration over standalone VM instances to automate self-healing replicas and ensure rapid, deterministic rollback during bad releases."
      }
    }
  ]
}`

/**
 * Single-Batch Natural Bullet Re-Weaver
 * Re-engineers candidate experience bullets in 1 single fast LLM request.
 */
export async function batchWeaveBulletsWithLLM({
  experiences = [],
  targetSkills = [],
  targetRole = 'Data Analyst',
  company = '',
  timeoutMs = 30000,
}) {
  const cleanSkills = Array.from(new Set(targetSkills)).filter(isGenuineTechnicalSkill)
  if (cleanSkills.length === 0 || !Array.isArray(experiences) || experiences.length === 0) {
    return deterministicWeave(experiences, targetSkills, targetRole)
  }

  // Flatten candidate bullets into indexable batch
  const candidateBullets = []
  experiences.forEach((exp, expIdx) => {
    const compName = exp.company || company || `Company ${expIdx + 1}`
    ;(exp.bullets || []).forEach((b, bIdx) => {
      const bId = (typeof b === 'object' && b?.id) ? b.id : `exp_${String(expIdx + 1).padStart(3, '0')}_b${String(bIdx + 1).padStart(2, '0')}`
      const text = typeof b === 'string' ? b : (b?.text || '')
      if (text && text.length >= 15) {
        candidateBullets.push({
          bulletId: bId,
          originalText: text,
          company: compName,
          expIdx,
          bIdx,
        })
      }
    })
  })

  if (candidateBullets.length === 0) {
    return deterministicWeave(experiences, targetSkills, targetRole)
  }

  // 1. Check Cache First (0ms, 0 cost)
  const bulletsToRewrite = []
  const cachedRewrites = new Map()

  candidateBullets.forEach((item) => {
    const hash = getRewriteHash(item.bulletId, item.originalText, cleanSkills)
    if (BULLET_REWRITE_CACHE.has(hash)) {
      cachedRewrites.set(item.bulletId, BULLET_REWRITE_CACHE.get(hash))
    } else {
      bulletsToRewrite.push(item)
    }
  })

  // If all bullets are cached, assemble and return instantly!
  if (bulletsToRewrite.length === 0) {
    console.log('[SmartKeywordWeaver] Delivered tailored experiences in 0ms via lru_cache.')
    const tailored = JSON.parse(JSON.stringify(experiences))
    const ledger = []
    candidateBullets.forEach((item) => {
      const res = cachedRewrites.get(item.bulletId)
      if (res && res.rewrittenText) {
        if (typeof tailored[item.expIdx].bullets[item.bIdx] === 'string') {
          tailored[item.expIdx].bullets[item.bIdx] = res.rewrittenText
        } else if (tailored[item.expIdx].bullets[item.bIdx]) {
          tailored[item.expIdx].bullets[item.bIdx].text = res.rewrittenText
        }
        const defense = res.interviewDefense || {}
        const skillsList = Array.isArray(res.wovenSkills) && res.wovenSkills.length > 0
          ? res.wovenSkills
          : (res.wovenSkill ? res.wovenSkill.split(/[,/]/).map(s => s.trim()) : ['Core Tech'])

        skillsList.filter(Boolean).forEach((skill) => {
          const fallbackPoint = buildHumanizedTalkingPoint(skill, item.company, targetRole)
          ledger.push({
            keyword: String(skill).trim(),
            company: item.company,
            exactBullet: res.rewrittenText,
            interviewerQuestion: defense.interviewerQuestion || res.interviewerQuestion || fallbackPoint.targetInterviewQuestion,
            talkingScript: defense.talkingScript || res.talkingScript || res.interviewTalkingScript || fallbackPoint.wordForWordTalkingScript,
            interviewTalkingScript: defense.talkingScript || res.talkingScript || res.interviewTalkingScript || fallbackPoint.wordForWordTalkingScript,
            tradeOffJustification: defense.tradeOffJustification || res.tradeOffJustification || fallbackPoint.engineeringTradeOff,
          })
        })
      }
    })
    return {
      tailoredExperiences: tailored,
      interviewLedger: ledger,
      totalKeywordsWoven: ledger.length,
      source: 'lru_cache',
    }
  }

  // 2. Single-Batch LLM Call (OpenRouter Paid Gemini Primary)
  // Dynamic capacity: scale skills proportionally with candidate's available bullets
  const totalAvailableBullets = bulletsToRewrite.length
  const maxSkillsCapacity = Math.min(
    cleanSkills.length,
    Math.max(6, Math.min(12, totalAvailableBullets * 2))
  )
  const maxBulletsCapacity = Math.min(totalAvailableBullets, 10)

  const batchPromptInput = {
    targetRole,
    // Top 10-12 missing & stranded skills dynamically selected
    targetSkillsToWeave: cleanSkills.slice(0, maxSkillsCapacity),
    // Up to 10 bullets distributed across experience and projects
    bulletsToReengineer: bulletsToRewrite.slice(0, maxBulletsCapacity).map((b) => ({
      bulletId: b.bulletId,
      company: b.company,
      currentText: b.originalText,
    })),
  }

  try {
    const startTime = Date.now()
    const response = await llmGateway.generate({
      purpose: 'bullet_batch_weave',
      preferredProvider: 'openrouter',
      model: 'google/gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: BATCH_WEAVER_SYSTEM_PROMPT },
        { role: 'user', content: `Re-engineer these experience bullets naturally:\n\n${JSON.stringify(batchPromptInput, null, 2)}` },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.2,
      maxTokens: 3500, // Increased token budget for 10-12 rewrites
      timeoutMs: timeoutMs || 30000,
    })

    const elapsed = Date.now() - startTime
    const usedModel = response?.actualModel || response?.model || 'google/gemini-3.5-flash-lite'
    const usedProv = response?.provider || 'openrouter'
    console.log(`[SmartKeywordWeaver] Single-batch LLM re-weaver executed in ~${elapsed}ms via ${usedProv} (${usedModel}).`)

    const raw = response?.text || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = JSON.parse(jsonrepair(raw))
    }

    const rewrittenMap = new Map()
    if (Array.isArray(parsed?.rewrittenBullets)) {
      parsed.rewrittenBullets.forEach((item) => {
        if (item?.bulletId && item?.rewrittenText && item.rewrittenText.length >= 20) {
          rewrittenMap.set(item.bulletId, item)

          // Store in LRU Cache
          const original = bulletsToRewrite.find((b) => b.bulletId === item.bulletId)?.originalText || ''
          const hash = getRewriteHash(item.bulletId, original, cleanSkills)
          if (BULLET_REWRITE_CACHE.size >= MAX_CACHE_SIZE) {
            const firstKey = BULLET_REWRITE_CACHE.keys().next().value
            BULLET_REWRITE_CACHE.delete(firstKey)
          }
          BULLET_REWRITE_CACHE.set(hash, item)
        }
      })
    }

    // 3. Assemble Tailored Experiences
    const tailored = JSON.parse(JSON.stringify(experiences))
    const interviewLedger = []

    candidateBullets.forEach((item) => {
      const rewrite = rewrittenMap.get(item.bulletId) || cachedRewrites.get(item.bulletId)
      if (rewrite && rewrite.rewrittenText) {
        if (typeof tailored[item.expIdx].bullets[item.bIdx] === 'string') {
          tailored[item.expIdx].bullets[item.bIdx] = rewrite.rewrittenText
        } else if (tailored[item.expIdx].bullets[item.bIdx]) {
          tailored[item.expIdx].bullets[item.bIdx].text = rewrite.rewrittenText
        }

        const defense = rewrite.interviewDefense || {}
        const skillsList = Array.isArray(rewrite.wovenSkills) && rewrite.wovenSkills.length > 0
          ? rewrite.wovenSkills
          : (rewrite.wovenSkill ? rewrite.wovenSkill.split(/[,/]/).map(s => s.trim()) : ['Core Tech'])

        skillsList.filter(Boolean).forEach((skill) => {
          const fallbackPoint = buildHumanizedTalkingPoint(skill, item.company, targetRole)
          interviewLedger.push({
            keyword: String(skill).trim(),
            company: item.company,
            exactBullet: rewrite.rewrittenText,
            interviewerQuestion: defense.interviewerQuestion || fallbackPoint.targetInterviewQuestion,
            talkingScript: defense.talkingScript || fallbackPoint.wordForWordTalkingScript,
            interviewTalkingScript: defense.talkingScript || fallbackPoint.wordForWordTalkingScript,
            tradeOffJustification: defense.tradeOffJustification || fallbackPoint.engineeringTradeOff,
          })
        })
      }
    })

    return {
      tailoredExperiences: tailored,
      interviewLedger,
      totalKeywordsWoven: interviewLedger.length,
      source: 'single_batch_llm',
    }
  } catch (err) {
    console.warn('[SmartKeywordWeaver] Single-batch LLM re-weaver failed or timed out. Falling back to deterministic weaver:', err.message)
    // 4. Zero-Failure Fallback: Clean Deterministic Weaver
    return deterministicWeave(experiences, targetSkills, targetRole)
  }
}

export function isRoleCurrent(exp = {}) {
  return Boolean(
    exp?.isCurrent === true ||
    /present|current|now/i.test(exp?.duration || '') ||
    /present|current|now/i.test(exp?.endDate || '') ||
    /present|current|now/i.test(exp?.dates || '')
  )
}

export function cleanBoilerplateAndTense(bullets = [], isCurrent = false) {
  return bullets.map((b) => {
    let text = typeof b === 'string' ? b : (b?.text || '')
    if (!text) return text

    text = text.replace(/,?\s*by establishing decoupled microservice boundaries and resilient caching(?:,\s*enhancing operational throughput,\s*reducing execution latency,\s*and ensuring continuous production uptime)?\.?/gi, '.')
    text = text.replace(/,?\s*enhancing operational throughput,\s*reducing execution latency,\s*and ensuring continuous production uptime\.?/gi, '.')
    text = text.replace(/\s{2,}/g, ' ').replace(/\.+$/, '.').trim()

    if (isCurrent) {
      const m = text.match(/^(\*{0,2})([A-Za-z]+)(\*{0,2})(.*)$/s)
      if (m) {
        const pres = toPresentTense(m[2])
        if (pres && pres.toLowerCase() !== m[2].toLowerCase()) {
          text = `${m[1]}${pres}${m[3]}${m[4]}`
        }
      }
    }
    return text
  })
}

/**
 * Universal Category Detector for ANY technology across ALL domains
 */
export function classifyToolCategory(kw, targetRole = '') {
  const low = String(kw || '').toLowerCase().trim()
  const isDataRole = /data|analyst|analytics|bi\b|sql|tableau/i.test(targetRole)

  // 1. Data, Analytics & Warehouses
  if (
    /snowflake|bigquery|dbt|redshift|spark|databricks|hadoop|airflow|power\s*bi|tableau|looker|excel|metabase|pandas|numpy|sql|postgresql|mysql/i.test(low) ||
    (isDataRole && /warehouse|pipeline|dashboard|modeling/i.test(low))
  ) {
    return 'data_warehouse'
  }
  // 2. AI, LLM & Machine Learning
  if (/fastmcp|langchain|langgraph|rag|llm|chromadb|pinecone|weaviate|pytorch|tensorflow|huggingface|ollama|vllm|openai|vector/i.test(low)) {
    return 'ai_ml'
  }
  // 3. Cloud, Containers & DevOps
  if (/aws|azure|gcp|docker|kubernetes|k8s|terraform|ansible|helm|jenkins|ci\/cd|github actions|gitlab|ecs|eks|linux|git\b|github/i.test(low)) {
    return 'cloud_devops'
  }
  // 4. Messaging & Event Streaming
  if (/kafka|rabbitmq|sqs|sns|redis|pub\/sub|celery|eventbridge|activemq|streaming/i.test(low)) {
    return 'messaging_streaming'
  }
  // 5. Testing & Quality
  if (/jest|pytest|cypress|selenium|playwright|junit|mocha|tdd|bdd|sonarqube|trivy|unit test/i.test(low)) {
    return 'testing_qa'
  }
  // 6. Modern Frontend / UI
  if (/typescript|javascript|react|next\.?js|vue|angular|tailwind|redux|graphql/i.test(low)) {
    return 'frontend_ui'
  }
  // Default: Backend / Services API
  return 'backend_api'
}

/**
 * Universal Natural Clause Weaver
 * Injects ANY tool into an existing bullet using grammatically sound technical phrasing
 * based on dynamic semantic category without hardcoding specific tools.
 */
export function weaveToolIntoSentence(text, kw, category) {
  const clean = text.replace(/[.!?]+$/, '').trim()
  const kwRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  if (kwRegex.test(clean)) return text

  // Universal dynamic category weaving for ANY technology across ALL domains
  switch (category) {
    case 'data_warehouse':
      if (/(?:sql|query|queries|data|pipeline|report|dashboard|analytics|warehouse)/i.test(clean)) {
        return `${clean}, using ${kw} for scalable transformation pipelines, dimensional modeling, and automated reporting refresh.`
      }
      return `${clean}, using ${kw} for scalable analytical data processing.`

    case 'ai_ml':
      if (/(?:ai|model|search|query|chat|assistant|retrieval|nlp|agent)/i.test(clean)) {
        return `${clean}, integrating ${kw} to optimize vector retrieval precision and sustain sub-second query latency.`
      }
      return `${clean}, powered by ${kw} for automated contextual intelligence.`

    case 'messaging_streaming':
      if (/(?:event|stream|queue|sync|message|worker|async|transaction|ingestion|database|queries)/i.test(clean)) {
        return `${clean}, using ${kw} event streams to decouple asynchronous workers and eliminate message drops during high-volume spikes.`
      }
      return `${clean}, with ${kw} message queues for decoupled asynchronous processing.`

    case 'cloud_devops':
      if (/(?:deploy|cloud|pipeline|build|infrastructure|cluster|service|release)/i.test(clean)) {
        return `${clean}, containerized and automated via ${kw} for zero-downtime rolling releases.`
      }
      return `${clean}, deployed across modern ${kw} infrastructure.`

    case 'frontend_ui':
      if (/(?:ui|frontend|component|page|view|interface|dashboard|client|web|react|node|service|api|backend)/i.test(clean)) {
        return `${clean}, adopting ${kw} to enforce strict payload contracts and eliminate runtime errors across service boundaries.`
      }
      return `${clean}, using ${kw} for modular, responsive interface delivery.`

    case 'testing_qa':
      if (/(?:test|quality|ci|pipeline|release|coverage|code|defect|review)/i.test(clean)) {
        return `${clean}, verified through automated test suites using ${kw} to prevent production regressions.`
      }
      return `${clean}, validated with ${kw} test suites to ensure production reliability.`

    case 'backend_api':
      if (/(?:services?|endpoints?|microservices?|backend|api)/i.test(clean)) {
        return `${clean}, architected with ${kw} to support high-throughput transactions and sub-second response times.`
      }
      return `${clean}, engineered with ${kw} for enhanced production reliability.`

    default:
      if (/(?:using|with|via)\s+([^,.;]+)/i.test(clean)) {
        return clean.replace(/(using|with|via)\s+([^,.;]+)/i, `$1 $2 and ${kw}`) + '.'
      }
      return `${clean}, applying ${kw} to enhance production execution and reliability.`
  }
}

/**
 * Spoken Interview Talking Point Generator
 * Follows the 3-Sentence Spoken Interview Formula (Problem -> Trade-off -> Result).
 */
export function buildHumanizedTalkingPoint(skill, company, role) {
  const comp = company || 'my organization'
  const targetRole = role || 'Full Stack Developer'
  return {
    targetInterviewQuestion: `How did you apply ${skill} in production at ${comp}, and what architectural challenges did you solve?`,
    wordForWordTalkingScript: `When scaling our ${targetRole} deliverables at ${comp}, we needed ${skill} to handle reliable data exchange between distributed services. The main trade-off was avoiding unindexed query bottlenecks under peak loads, so I implemented strict schema boundaries and connection pooling to keep p99 latency predictable. That kept our deployment stable and gave us measurable throughput gains without service regressions.`,
    engineeringTradeOff: `Selected ${skill} over custom in-memory alternatives to ensure standardized team maintainability and resilient horizontal scalability.`
  }
}

/**
 * Dynamic Interview Talking Script Generator
 * Quotes the tool directly and explains its real-world operational impact
 * following the 3-Sentence Spoken Interview Formula (Problem -> Trade-off -> Result).
 */
export function generateInterviewScript(kw, category = '', targetRole = '', company = '') {
  const comp = company || 'my organization'
  const cat = category || classifyToolCategory(kw, targetRole)

  switch (cat) {
    case 'data_warehouse':
      return `In our analytics layer at ${comp}, unindexed queries were slowing down dashboard refreshes and missing SLAs. I chose ${kw} to model star schemas, optimize query runtimes, and automate business reporting SLAs without manual intervention. That cut our reporting query latency by 40% and kept daily delivery consistent.`
    case 'ai_ml':
      return `In our AI pipeline at ${comp}, our early prototypes struggled with token latency and context drift across multi-step prompts. I integrated ${kw} specifically to optimize context retrieval precision, manage token latency, and enforce prompt defense guardrails. That brought our response latency down to sub-second levels while keeping factual accuracy dependable.`
    case 'messaging_streaming':
      return `In our event pipeline at ${comp}, synchronous HTTP endpoints were bottlenecking during peak traffic spikes. I implemented ${kw} to configure partitions, retention policies, and consumer offset handling for decoupled event streaming. That eliminated message drops under heavy load and kept our p99 latency flat.`
    case 'cloud_devops':
      return `In our deployment workflow at ${comp}, manual server provisioning caused configuration drift and slowed down releases. I introduced ${kw} for reproducible environments, automated health probes, and zero-downtime deployment rollouts. That cut our release turnaround time in half and kept our clusters resilient.`
    case 'frontend_ui':
      return `In our client application at ${comp}, untyped API payloads were causing subtle runtime regressions across views. I adopted ${kw} to define strict interfaces, enforce static typing, and ensure interface state predictability, eliminating runtime errors. That wiped out unexpected null exceptions and made refactoring significantly faster.`
    case 'testing_qa':
      return `In our release cycle at ${comp}, regression bugs were slipping into staging because test runs were manual and inconsistent. I established comprehensive unit and integration test coverage using ${kw} with automated PR test gating to maintain code quality. That caught defects before merging and gave the team confidence to deploy daily.`
    case 'backend_api':
      return `In our backend services at ${comp}, our monolithic endpoints were struggling with concurrency under increasing traffic. I implemented ${kw} to handle enterprise backend services, optimize throughput, and sustain resilient integrations. That kept response times under 200ms and prevented cascading failures during load spikes.`
    default:
      return `When scaling our deliverables at ${comp}, we ran into bottlenecks coordinating data exchange across distributed services. I brought in ${kw} with strict schema boundaries and connection pooling to keep p99 latency predictable. That kept our deployment stable and gave us measurable throughput gains without service regressions.`
  }
}

export function generateTalkingScript(kw, company = '', targetRole = '') {
  return generateInterviewScript(kw, '', targetRole, company)
}

/**
 * Role-Calibrated Production Practice Bullet
 * Dynamically calibrated to candidate's actual domain without hardcoding SWE testing tools.
 */
export function buildRolePracticeBullet(targetRole = '') {
  const isData = /data\s*(?:analyst|analytics|specialist|bi\b|science|scientist)|business\s+analyst|analytics\b|bi\s+(?:developer|analyst|specialist)|tableau|power\s*bi/i.test(targetRole) || (/data|analyst|analytics|bi\b/i.test(targetRole) && !/software\s+developer|swe|sde/i.test(targetRole))
  const isProductOrNonTech = /product\s*(?:manager|owner|lead)|program\s*manager|project\s*manager|scrum\s*master|operations|business\s*(?:operations|lead)|strategy|marketing|sales|customer\s*success|recruiter|hr\b/i.test(targetRole)
  const isAi = !isData && !isProductOrNonTech && /ai\b|machine learning|ml\b|llm|agent/i.test(targetRole)
  const isDevops = !isData && !isProductOrNonTech && /devops|cloud|sre|platform|infra/i.test(targetRole)
  const isSwe = !isData && !isProductOrNonTech && !isAi && !isDevops && /software|developer|swe|sde|full stack|backend|frontend/i.test(targetRole)

  if (isData) {
    return {
      keyword: 'Data Quality & dbt Assertions',
      bullet: 'Established automated data testing, reconciliation routines, and schema assertions with dbt, eliminating cross-system reporting discrepancies and ensuring 100% metric SLA compliance.',
      script: 'Explain how you set up automated uniqueness, not-null, and relationship tests to stop corrupted raw data from poisoning executive dashboards.',
    }
  }

  if (isProductOrNonTech) {
    return {
      keyword: 'Operational Excellence & Quality Governance',
      bullet: 'Drove operational excellence and quality governance across cross-functional initiatives, establishing standard review gates and delivery benchmarks.',
      script: 'Discuss your methodology for establishing standard review gates, metric tracking, and stakeholder alignment to maintain delivery rigor.',
    }
  }

  if (isAi) {
    return {
      keyword: 'LLM Evaluation & Guardrails',
      bullet: 'Architected automated RAG evaluation test suites and prompt-injection guardrails, ensuring 99%+ factual response consistency across production query sets.',
      script: 'Discuss your evaluation methodology using synthetic test sets and confidence-score fallback thresholds to prevent hallucinated answers.',
    }
  }

  if (isDevops) {
    return {
      keyword: 'CI/CD Automation & Security Scanning',
      bullet: 'Maintained production cluster reliability by engineering automated GitHub Actions CI/CD pipelines with integrated container vulnerability scanning and Grafana alerting.',
      script: 'Highlight your deployment gating rules, automated rollback policies, and container security compliance scanning.',
    }
  }

  if (isSwe) {
    return {
      keyword: 'Unit / Integration Testing & Git',
      bullet: 'Maintained production reliability by establishing comprehensive unit and integration test coverage, driving peer code reviews and Git/GitHub CI/CD pull request review gates.',
      script: 'Discuss how you established automated PR test gating, branch protection rules, and team code review checklists.',
    }
  }

  // Non-tech / Operations / Management
  return {
    keyword: 'Operational Excellence & Quality Governance',
    bullet: 'Drove operational excellence and quality governance across cross-functional initiatives, establishing standard review gates and delivery benchmarks.',
    script: 'Discuss your methodology for establishing standard review gates, metric tracking, and stakeholder alignment to maintain delivery rigor.',
  }
}

/**
 * Universal Deterministic Keyword Weaver
 */
export function deterministicWeave(experiences, targetKws, targetRole = '') {
  const role = targetRole || experiences?.[0]?.role || ''
  const validTargetKws = (Array.isArray(targetKws) ? targetKws : [])
    .map((s) => (typeof s === 'string' ? s.trim() : s?.name || s?.skill || '').trim())
    .filter(isConcreteTechSkill)
  const keywordLedger = []
  const usedKeywords = new Set()
  const expClones = JSON.parse(JSON.stringify(experiences || []))

  if (expClones.length === 0 || validTargetKws.length === 0) {
    return {
      tailoredExperiences: expClones,
      interviewLedger: [],
      totalKeywordsWoven: 0,
    }
  }

  const expProfiles = expClones.map((exp, idx) => {
    const rawBullets = (exp.bullets || []).map((b) => (typeof b === 'string' ? b : b?.text || ''))
    return {
      index: idx,
      company: exp.company || `Company ${idx + 1}`,
      isCurrent: isRoleCurrent(exp),
      bullets: [...rawBullets],
      modifiedCount: 0,
      synthesizedCount: 0,
    }
  })

  const needsQuality = validTargetKws.some((k) => /test|review|quality|git|guardrail|assertion/i.test(k))
  const isProductOrNonTech =
    /product\s*(?:manager|owner|lead)|program\s*manager|project\s*manager|scrum\s*master|operations|business\s*(?:operations|lead)|strategy|marketing|sales|customer\s*success|recruiter|hr\b/i.test(role)
  const isData =
    /data\s*(?:analyst|analytics|specialist|bi\b|science|scientist)|business\s+analyst|analytics\b|bi\s+(?:developer|analyst|specialist)|tableau|power\s*bi/i.test(role) ||
    (/data|analyst|analytics|bi\b/i.test(role) && !/software\s+developer|swe|sde/i.test(role))

  // 1. Natural In-Line Weaving by Semantic Relevance
  for (const kw of validTargetKws) {
    if (!isConcreteTechSkill(kw)) continue
    const kwLower = kw.toLowerCase()
    if (usedKeywords.has(kwLower)) continue

    // For Non-Tech / Product roles: NEVER weave Git/GitHub PR gating, code review, or SWE unit testing tools
    if (isProductOrNonTech && /git\b|github|pull\s*request|unit\s*test|pytest|jest|code\s*review/i.test(kwLower)) {
      usedKeywords.add(kwLower)
      continue
    }

    if (needsQuality && (/test|review|quality|git\b|guardrail|assertion/i.test(kwLower) || classifyToolCategory(kw, role) === 'testing_qa')) {
      continue // Reserved for role-appropriate practice bullet below
    }

    const category = classifyToolCategory(kw, role)

    // Select candidate company profile: prioritize least modified and fewest bullets for balanced distribution
    let candidateProfiles = [...expProfiles].sort((a, b) => {
      if (a.modifiedCount !== b.modifiedCount) return a.modifiedCount - b.modifiedCount
      return a.bullets.length - b.bullets.length
    })

    let woven = false

    for (const prof of candidateProfiles) {
      if (woven) break

      for (let bIdx = 0; bIdx < prof.bullets.length; bIdx++) {
        const origText = prof.bullets[bIdx]

        // Skip if keyword already in bullet
        if (new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(origText)) {
          usedKeywords.add(kwLower)
          woven = true
          break
        }

        // Domain-specific bullet matching check
        const isDbKw = category === 'data_warehouse' || /sql|database|query|queries|caching|redis|postgres/i.test(kwLower)
        const isChatbotBullet = /chatbot|virtual assistant|dialogue|conversational/i.test(origText)
        if (isDbKw && isChatbotBullet) continue // Never tack database/cache tools onto chatbot bullets

        const isMatch = (
          (category === 'data_warehouse' && /(?:sql|query|queries|data\s+pipeline|report|dashboard|analytics|warehouse|database|mart|etl)/i.test(origText)) ||
          (category === 'ai_ml' && /(?:ai\b|model|search|query|chat|assistant|retrieval|nlp|agent|prompt|vector)/i.test(origText)) ||
          (category === 'messaging_streaming' && /(?:event|stream|queue|sync|message|worker|async|transaction|database|queries|caching)/i.test(origText)) ||
          (category === 'cloud_devops' && /(?:deploy|cloud|infrastructure|cluster|containers?|kubernetes|docker|terraform|ci\/cd|pipeline|aws|azure|gcp)/i.test(origText)) ||
          (category === 'backend_api' && /(?:api\b|services?|endpoints?|microservices?|backend|server|grpc|rest|graphql|payload)/i.test(origText)) ||
          (category === 'frontend_ui' && /(?:ui\b|frontend|component|page|view|interface|dashboard|client|web|react|node|state)/i.test(origText)) ||
          (category === 'testing_qa' && /(?:tests?|testing|test\s+coverage|test\s+suite|validation|quality\s+assurance|qa\b|code\s+reviews?)/i.test(origText))
        )

        if (isMatch) {
          const wovenText = weaveToolIntoSentence(origText, kw, category)
          if (wovenText !== origText) {
            prof.bullets[bIdx] = wovenText
            prof.modifiedCount++
            usedKeywords.add(kwLower)
            woven = true

            const script = generateInterviewScript(kw, category, role, prof.company)
            keywordLedger.push({
              keyword: kw,
              company: prof.company,
              placement: `${category.replace(/_/g, ' ').toUpperCase()} Clause`,
              bulletText: wovenText,
              exactBullet: wovenText,
              wovenBullet: wovenText,
              interviewerQuestion: `How did you apply ${kw} at ${prof.company}?`,
              interviewTalkingScript: script,
              talkingScript: script,
              tradeOffJustification: `Selected ${kw} to optimize execution performance and eliminate workflow bottlenecks at ${prof.company}.`,
            })
            break
          }
        }
      }
    }
  }

  // 2. Synthesize Dedicated Domain Bullet if an Experience has < 5 Bullets
  for (const kw of validTargetKws) {
    if (!isConcreteTechSkill(kw)) continue
    const kwLower = kw.toLowerCase()
    if (usedKeywords.has(kwLower)) continue

    // For Non-Tech / Product roles: NEVER synthesize SWE testing, git, or code review bullets
    if (isProductOrNonTech && /git\b|github|pull\s*request|unit\s*test|pytest|jest|code\s*review/i.test(kwLower)) {
      usedKeywords.add(kwLower)
      continue
    }

    if (needsQuality && (/test|review|quality|git\b|guardrail|assertion/i.test(kwLower) || classifyToolCategory(kw, role) === 'testing_qa')) {
      continue
    }

    const availableProfile = expProfiles
      .filter((p) => p.synthesizedCount === 0 && p.bullets.length < 5)
      .sort((a, b) => a.bullets.length - b.bullets.length)[0]

    if (!availableProfile) break

    const isCurrent = availableProfile.isCurrent
    const category = classifyToolCategory(kw, role)
    let synthBullet = ''

    if (category === 'data_warehouse') {
      synthBullet = isCurrent
        ? `Architect scalable data pipelines and schema transformations using ${kw}, optimizing query performance and ensuring automated reporting refresh.`
        : `Architected scalable data pipelines and schema transformations using ${kw}, optimizing query performance and ensuring automated reporting refresh.`
    } else if (category === 'ai_ml') {
      synthBullet = isCurrent
        ? `Engineer production agentic workflows and context retrieval systems using ${kw}, sustaining sub-second latency and high retrieval precision.`
        : `Engineered production agentic workflows and context retrieval systems using ${kw}, sustaining sub-second latency and high retrieval precision.`
    } else if (category === 'cloud_devops') {
      synthBullet = isCurrent
        ? `Deploy and automate cloud infrastructure using ${kw}, ensuring high availability, reproducible environments, and zero-downtime rolling releases.`
        : `Deployed and automated cloud infrastructure using ${kw}, ensuring high availability, reproducible environments, and zero-downtime rolling releases.`
    } else if (category === 'messaging_streaming') {
      synthBullet = isCurrent
        ? `Implement event-driven streaming workers and message queues with ${kw}, decoupling microservices and eliminating message drops under peak loads.`
        : `Implemented event-driven streaming workers and message queues with ${kw}, decoupling microservices and eliminating message drops under peak loads.`
    } else {
      synthBullet = isCurrent
        ? `Engineer high-throughput enterprise backend services utilizing ${kw}, maintaining system reliability and resilient client integrations.`
        : `Engineered high-throughput enterprise backend services utilizing ${kw}, maintaining system reliability and resilient client integrations.`
    }

    if (synthBullet) {
      availableProfile.bullets.push(synthBullet)
      availableProfile.synthesizedCount++
      usedKeywords.add(kwLower)

      const script = generateInterviewScript(kw, category, role, availableProfile.company)
      keywordLedger.push({
        keyword: kw,
        company: availableProfile.company,
        placement: 'Added to Experience',
        bulletText: synthBullet,
        exactBullet: synthBullet,
        wovenBullet: synthBullet,
        interviewerQuestion: `How did you apply ${kw} at ${availableProfile.company}?`,
        interviewTalkingScript: script,
        talkingScript: script,
        tradeOffJustification: `Selected ${kw} over custom in-memory alternatives to ensure standardized maintainability and resilient scalability.`,
      })
    }
  }

  // 3. Role-Appropriate Practice Bullet if Testing/Reliability Keywords Requested
  if (needsQuality && !usedKeywords.has('unit testing') && !usedKeywords.has('data quality') && !usedKeywords.has('ci/cd automation') && !usedKeywords.has('git') && !usedKeywords.has('quality governance')) {
    if (isProductOrNonTech) {
      // For Non-Tech / Product roles: NEVER inject Git/GitHub PR gating or unit testing bullets
      const practice = buildRolePracticeBullet(role)
      if (!/git|github|pull\s*request|unit\s*test|pytest|jest|code\s*review/i.test(practice.bullet)) {
        const prof0 = expProfiles[0]
        if (prof0 && !prof0.bullets.some((b) => b.includes(practice.bullet))) {
          prof0.bullets.push(practice.bullet)
          usedKeywords.add('operational excellence')
          usedKeywords.add('quality governance')

          keywordLedger.push({
            keyword: practice.keyword,
            company: prof0.company,
            placement: 'Dedicated Quality Governance Bullet',
            bulletText: practice.bullet,
            exactBullet: practice.bullet,
            wovenBullet: practice.bullet,
            interviewerQuestion: `How did you enforce quality governance and review gates at ${prof0.company}?`,
            interviewTalkingScript: practice.script,
            talkingScript: practice.script,
            tradeOffJustification: 'Established structured review gates to prevent production regressions and maintain SLA consistency across sprints.',
          })
        }
      }
    } else if (isData) {
      // For Data Analyst / BI roles: inject ONLY data-specific quality bullets (data validation, reconciliation, dbt tests)
      const practice = buildRolePracticeBullet(role)
      const prof0 = expProfiles[0]
      if (prof0 && !prof0.bullets.some((b) => b.includes(practice.bullet))) {
        prof0.bullets.push(practice.bullet)
        usedKeywords.add('data quality')
        usedKeywords.add('dbt assertions')

        keywordLedger.push({
          keyword: practice.keyword,
          company: prof0.company,
          placement: 'Dedicated Data Quality Bullet',
          bulletText: practice.bullet,
          exactBullet: practice.bullet,
          wovenBullet: practice.bullet,
          interviewerQuestion: `How did you design automated testing and schema assertions for data pipelines at ${prof0.company}?`,
          interviewTalkingScript: practice.script,
          talkingScript: practice.script,
          tradeOffJustification: 'Implemented dbt assertions over manual checks to detect corrupted source data before it propagates to executive BI dashboards.',
        })
      }
    } else {
      // SWE, DevOps, AI tech roles
      const practice = buildRolePracticeBullet(role)
      const prof0 = expProfiles[0]
      if (prof0 && !prof0.bullets.some((b) => b.includes(practice.bullet))) {
        prof0.bullets.push(practice.bullet)
        usedKeywords.add('unit testing')
        usedKeywords.add('git')
        usedKeywords.add('data quality')
        usedKeywords.add('ci/cd automation')

        keywordLedger.push({
          keyword: practice.keyword,
          company: prof0.company,
          placement: 'Dedicated Production Quality Bullet',
          bulletText: practice.bullet,
          exactBullet: practice.bullet,
          wovenBullet: practice.bullet,
          interviewerQuestion: `How did you implement CI/CD test gates and code review standards at ${prof0.company}?`,
          interviewTalkingScript: practice.script,
          talkingScript: practice.script,
          tradeOffJustification: 'Automated PR test gating to catch defects prior to merging, reducing post-release incidents and stabilizing deployments.',
        })
      }
    }
  }

  // 4. For any remaining keywords that cannot be woven into full profiles without fabricating facts:
  // Place them cleanly into Technical Skills and mark in ledger as 'Skill Section Insertion'
  for (const kw of validTargetKws) {
    if (!isConcreteTechSkill(kw)) continue
    const kwLower = kw.toLowerCase()
    if (usedKeywords.has(kwLower)) continue

    const category = classifyToolCategory(kw, role)
    const script = generateInterviewScript(kw, category, role, expProfiles[0]?.company || 'my recent projects')

    keywordLedger.push({
      keyword: kw,
      company: 'Technical Skills',
      placement: 'Skill Section Insertion',
      bulletText: `Added ${kw} to Technical Skills profile`,
      exactBullet: `Added ${kw} to Technical Skills profile`,
      wovenBullet: `Added ${kw} to Technical Skills profile`,
      interviewerQuestion: `What production challenges did you solve using ${kw}?`,
      interviewTalkingScript: script,
      talkingScript: script,
      tradeOffJustification: `Adopted ${kw} for its strong ecosystem support, efficiency, and seamless fit within our tech stack.`,
    })
    usedKeywords.add(kwLower)
  }

  const tailoredExperiences = expClones.map((origExp, idx) => {
    const prof = expProfiles[idx]
    const isCurrent = prof.isCurrent
    const finalBullets = cleanBoilerplateAndTense(prof.bullets, isCurrent)
    return {
      ...origExp,
      isCurrent,
      bullets: finalBullets,
    }
  })

  return {
    tailoredExperiences,
    interviewLedger: keywordLedger,
    totalKeywordsWoven: usedKeywords.size,
  }
}

/**
 * Main Async Keyword Weaver
 */
export async function weaveKeywordsAndBuildLedger({
  canonicalResume = {},
  missingKeywords = [],
  targetRole = '',
  skillsOnlyKeywords = [],
}) {
  const experiences = JSON.parse(JSON.stringify(canonicalResume?.experiences || canonicalResume?.experience || []))
  const role = targetRole || canonicalResume?.target_role || canonicalResume?.candidate?.targetRole || ''

  const rawPool = [
    ...(Array.isArray(missingKeywords) ? missingKeywords : []),
    ...(Array.isArray(skillsOnlyKeywords) ? skillsOnlyKeywords : []),
  ]

  const seen = new Set()
  const targetKws = []
  for (const item of rawPool) {
    const raw = typeof item === 'string' ? item : item?.keyword || item?.skill || item?.name || ''
    const clean = raw.trim()
    if (isConcreteTechSkill(clean) && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase())
      targetKws.push(clean)
    }
  }

  if (targetKws.length === 0 || experiences.length === 0) {
    return {
      tailoredExperiences: experiences.map((exp) => ({
        ...exp,
        bullets: cleanBoilerplateAndTense(exp.bullets || [], isRoleCurrent(exp)),
      })),
      interviewLedger: [],
      totalKeywordsWoven: 0,
    }
  }

  try {
    const result = await batchWeaveBulletsWithLLM({
      experiences,
      targetSkills: targetKws,
      targetRole: role,
      company: experiences[0]?.company || 'Enterprise',
      timeoutMs: 30000,
    })
    if (result && Array.isArray(result.tailoredExperiences) && result.tailoredExperiences.length > 0) {
      return result
    }
  } catch (err) {
    console.warn('[SmartKeywordWeaver] batchWeaveBulletsWithLLM failed in weaveKeywordsAndBuildLedger, falling back:', err.message)
  }

  return deterministicWeave(experiences, targetKws, role)
}

export function weaveKeywordsDeterministic({ canonicalResume = {}, missingKeywords = [], targetRole = '' } = {}) {
  const experiences = canonicalResume?.experiences || canonicalResume?.experience || []
  const role = targetRole || canonicalResume?.target_role || canonicalResume?.candidate?.targetRole || experiences?.[0]?.role || ''
  const targetKws = (Array.isArray(missingKeywords) ? missingKeywords : [])
    .map((k) => (typeof k === 'string' ? k : k?.skill || k?.name || k?.keyword || ''))
    .map((s) => s.trim())
    .filter(isConcreteTechSkill)
  return deterministicWeave(experiences, targetKws, role)
}

export default {
  batchWeaveBulletsWithLLM,
  BULLET_REWRITE_CACHE,
  weaveKeywordsAndBuildLedger,
  deterministicWeave,
  weaveKeywordsDeterministic,
  classifyToolCategory,
  weaveToolIntoSentence,
  generateInterviewScript,
  generateTalkingScript,
  buildHumanizedTalkingPoint,
  buildRolePracticeBullet,
  isRoleCurrent,
  cleanBoilerplateAndTense,
}
