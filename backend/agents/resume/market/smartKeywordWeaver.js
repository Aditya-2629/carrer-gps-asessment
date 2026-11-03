import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { toPresentTense } from '../signals/patterns.js'
import { isConcreteTechSkill } from './dynamicSkillExtractor.js'

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
        return `${clean}, leveraging ${kw} for scalable transformation pipelines, dimensional modeling, and automated reporting refresh.`
      }
      return `${clean}, utilizing ${kw} for scalable analytical data processing.`

    case 'ai_ml':
      if (/(?:ai|model|search|query|chat|assistant|retrieval|nlp|agent)/i.test(clean)) {
        return `${clean}, integrating ${kw} to optimize vector retrieval precision and sustain sub-second query latency.`
      }
      return `${clean}, powered by ${kw} for automated contextual intelligence.`

    case 'messaging_streaming':
      if (/(?:event|stream|queue|sync|message|worker|async|transaction|ingestion|database|queries)/i.test(clean)) {
        return `${clean}, utilizing ${kw} event streams to decouple asynchronous workers and eliminate message drops during high-volume spikes.`
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
      return `${clean}, utilizing ${kw} for modular, responsive interface delivery.`

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
      return `${clean}, leveraging ${kw} to enhance production execution and reliability.`
  }
}

/**
 * Dynamic Interview Talking Script Generator
 * Quotes the tool directly and explains its real-world operational impact.
 */
export function generateInterviewScript(kw, category = '', targetRole = '', company = '') {
  const comp = company || 'my organization'
  const cat = category || classifyToolCategory(kw, targetRole)

  switch (cat) {
    case 'data_warehouse':
      return `At ${comp}, I leveraged ${kw} to model star schemas, optimize query runtimes, and automate business reporting SLAs.`
    case 'ai_ml':
      return `At ${comp}, I integrated ${kw} to optimize context retrieval precision, manage token latency, and enforce prompt defense guardrails.`
    case 'messaging_streaming':
      return `At ${comp}, I configured ${kw} partitions, retention policies, and consumer offset handling for decoupled event streaming to eliminate message drops under load.`
    case 'cloud_devops':
      return `At ${comp}, I used ${kw} for reproducible environments, automated health probes, and zero-downtime deployment rollouts.`
    case 'frontend_ui':
      return `At ${comp}, I used ${kw} to define strict interfaces, enforce static typing, and ensure interface state predictability, eliminating runtime errors.`
    case 'testing_qa':
      return `At ${comp}, I established comprehensive unit and integration test coverage using ${kw} with automated PR test gating to maintain code quality.`
    case 'backend_api':
      return `At ${comp}, I implemented ${kw} to handle enterprise backend services, optimize throughput, and sustain resilient integrations.`
    default:
      return `At ${comp}, I applied ${kw} directly in production workflows, evaluating architectural trade-offs to deliver measurable operational gains.`
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
              interviewTalkingScript: script,
              talkingScript: script,
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
        ? `Architect scalable data pipelines and schema transformations leveraging ${kw}, optimizing query performance and ensuring automated reporting refresh.`
        : `Architected scalable data pipelines and schema transformations leveraging ${kw}, optimizing query performance and ensuring automated reporting refresh.`
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
        interviewTalkingScript: script,
        talkingScript: script,
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
            interviewTalkingScript: practice.script,
            talkingScript: practice.script,
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
          interviewTalkingScript: practice.script,
          talkingScript: practice.script,
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
          interviewTalkingScript: practice.script,
          talkingScript: practice.script,
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
      interviewTalkingScript: script,
      talkingScript: script,
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
    const compactExperiences = experiences.map((exp, idx) => ({
      index: idx,
      company: exp.company || `Company ${idx + 1}`,
      role: exp.role || exp.title || '',
      duration: exp.duration || '',
      isCurrent: isRoleCurrent(exp),
      bullets: (exp.bullets || []).map((b) => (typeof b === 'string' ? b : b?.text || '')),
    }))

    const systemPrompt = `You are an elite Principal Technical Recruiter & Staff Resume Architect.
Your objective is to naturally distribute and weave target keywords across candidate experience entries based on technical domain relevance.

CRITICAL DOMAIN-AWARE ARCHITECTURAL RULES:
1. UNIVERSAL DOMAIN CALIBRATION:
   - Data / Analytics roles: Weave warehouse pipelines, dimensional star schemas, dbt, SQL, and business metrics.
   - Generative AI / ML roles: Weave RAG vector retrieval, LLM serving, agentic tool-calling (FastMCP/LangGraph), and prompt guardrails.
   - DevOps / Cloud roles: Weave containerization, Kubernetes orchestration, Terraform IaC, and CI/CD zero-downtime rollouts.
   - SWE / Backend roles: Weave decoupled microservices, API payload typing, caching, and automated testing.

2. BALANCED MULTI-COMPANY DISTRIBUTION:
   - You MUST distribute keywords across ALL candidate companies based on technical domain relevance.
   - Target 5 high-impact bullets per company (e.g., exactly 5 bullets per company, never exceed 6, and never leave an experience with fewer than 5 bullets when target keywords are provided).
   - Distribute keyword additions so each company receives meaningful technical enhancements.

3. STRICT TENSE ENFORCEMENT:
   - For ANY experience entry where isCurrent is true: EVERY bullet MUST strictly start with an active PRESENT TENSE verb.
   - For past completed roles (isCurrent is false): EVERY bullet MUST strictly start with an active PAST TENSE verb.

4. INTERVIEW DEFENSE LEDGER:
   - Provide "keyword", "company", "placement", "exactBullet", and "interviewTalkingScript" (a natural first-person developer explanation).

OUTPUT FORMAT (JSON ONLY):
{
  "tailoredExperiences": [
    {
      "index": 0,
      "company": "...",
      "role": "...",
      "duration": "...",
      "isCurrent": true/false,
      "bullets": ["..."]
    }
  ],
  "interviewLedger": [
    {
      "keyword": "...",
      "company": "...",
      "placement": "...",
      "exactBullet": "...",
      "interviewTalkingScript": "..."
    }
  ]
}`

    const userPrompt = `Target Role: ${role || 'Professional'}
Target Keywords to Weave: ${targetKws.slice(0, 10).join(', ')}

Candidate Experiences:
${JSON.stringify(compactExperiences, null, 2)}`

    const response = await llmGateway.generate({
      purpose: 'resume_keyword_weaving',
      model: 'gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.2,
      maxTokens: 2500,
      preferredProvider: 'gemini',
    })

    if (response && response.text) {
      let parsed = null
      try {
        parsed = JSON.parse(response.text)
      } catch (_jsonErr) {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
      }

      if (parsed && Array.isArray(parsed.tailoredExperiences) && parsed.tailoredExperiences.length > 0) {
        const maxBullets = Math.max(...parsed.tailoredExperiences.map((te) => (te.bullets || []).length))
        if (maxBullets <= 6) {
          const wovenExperiences = experiences.map((origExp, idx) => {
            const matching = parsed.tailoredExperiences.find((te) => te.index === idx || te.company === origExp.company)
            const isCurrent = isRoleCurrent(origExp)
            const newBullets = (matching?.bullets && matching.bullets.length > 0) ? matching.bullets : origExp.bullets
            return {
              ...origExp,
              isCurrent,
              bullets: cleanBoilerplateAndTense(newBullets, isCurrent),
            }
          })

          const ledger = (Array.isArray(parsed.interviewLedger) ? parsed.interviewLedger : []).map((l) => ({
            ...l,
            wovenBullet: l.wovenBullet || l.exactBullet || l.bulletText || '',
            exactBullet: l.exactBullet || l.wovenBullet || l.bulletText || '',
            bulletText: l.bulletText || l.exactBullet || l.wovenBullet || '',
            talkingScript: l.talkingScript || l.interviewTalkingScript || '',
            interviewTalkingScript: l.interviewTalkingScript || l.talkingScript || '',
          }))
          const totalWoven = ledger.length > 0 ? ledger.length : targetKws.length

          return {
            tailoredExperiences: wovenExperiences,
            interviewLedger: ledger,
            totalKeywordsWoven: totalWoven,
          }
        }
      }
    }
  } catch (err) {
    console.warn('[SmartKeywordWeaver] Mini-agent LLM call fell back to deterministic weaver:', err.message)
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
  weaveKeywordsAndBuildLedger,
  deterministicWeave,
  weaveKeywordsDeterministic,
  classifyToolCategory,
  weaveToolIntoSentence,
  generateInterviewScript,
  generateTalkingScript,
  buildRolePracticeBullet,
  isRoleCurrent,
  cleanBoilerplateAndTense,
}
