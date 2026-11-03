/**
 * Smart Keyword Weaver & Interview Cheat Sheet Generator
 *
 * Weaves missing JD keywords (e.g. Kafka, TypeScript, Unit/Integration Testing, Git/GitHub, System Design)
 * into matching experience bullets or synthesizes crisp domain-accurate bullets (< 28 words),
 * while enforcing strict active present tense on current roles and past tense on completed roles.
 *
 * Uses llmGateway mini-agent when available, with a battle-tested deterministic fallback.
 */

import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { toPresentTense } from '../signals/patterns.js'

/**
 * Deterministic fallback keyword weaver with tense discipline and synthetic bullet generation.
 */
export function weaveKeywordsDeterministic({ canonicalResume = {}, missingKeywords = [], targetRole = '' }) {
  const experiences = JSON.parse(JSON.stringify(canonicalResume?.experiences || canonicalResume?.experience || []))
  const keywordLedger = []
  const usedKeywords = new Set()

  const targetKws = (Array.isArray(missingKeywords) ? missingKeywords : [])
    .map((k) => (typeof k === 'string' ? k : k?.skill || k?.name || k?.keyword || ''))
    .map((s) => s.trim())
    .filter(Boolean)

  experiences.forEach((exp, expIdx) => {
    const isCurrent = exp.isCurrent === true ||
      /present|current|now/i.test(exp.endDate || '') ||
      /present|current|now/i.test(exp.dates || '') ||
      /present|current|now/i.test(exp.duration || '')

    const bullets = exp.bullets || []

    bullets.forEach((b, bIdx) => {
      let text = typeof b === 'string' ? b : (b?.text || '')
      const initialWordCount = text.split(/\s+/).filter(Boolean).length
      // Strict Length Guard: Do not append secondary clauses to already dense bullets (35+ words)
      if (initialWordCount >= 35) return

      for (const kw of targetKws) {
        const kwLower = kw.toLowerCase()
        if (usedKeywords.has(kwLower)) continue

        // 1. Static Typing & Contract Safety slot (TypeScript)
        if (kwLower === 'typescript' && /react|frontend|api|endpoint|service|javascript|node|web|ui/i.test(text)) {
          if (!new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
            const clean = text.replace(/[.!?]+$/, '').trim()
            const candidate = isCurrent
              ? `${clean}, adopting TypeScript to enforce strict API payload contracts, eliminating runtime type errors across service boundaries.`
              : `${clean}, adopting TypeScript to enforce strict API payload contracts, eliminating runtime type errors across service boundaries.`
            if (candidate.split(/\s+/).filter(Boolean).length <= 38) {
              text = candidate
            } else {
              text = `${clean}, enforcing strict TypeScript API contracts.`
            }
            usedKeywords.add(kwLower)
            keywordLedger.push({
              keyword: kw,
              company: exp.company || `Company ${expIdx + 1}`,
              placement: 'Static Typing & Contract Safety Clause',
              bulletText: text,
              exactBullet: text,
              wovenBullet: text,
              talkingScript: `Explain that you adopted ${kw} to enforce static typing and contract validation, preventing runtime payload errors across microservices.`,
              interviewTalkingScript: `Explain that you adopted ${kw} to enforce static typing and contract validation, preventing runtime payload errors across microservices.`,
            })
            break
          }
        }

        // 2. Event Streaming & Messaging slot (Kafka, SQS, RabbitMQ)
        if (['kafka', 'sqs', 'rabbitmq'].includes(kwLower) && /event|stream|queue|sync|message|serverless|worker|pipeline/i.test(text)) {
          if (!new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
            const clean = text.replace(/[.!?]+$/, '').trim()
            const candidate = `${clean}, utilizing Kafka event topics to decouple asynchronous workers, eliminating request drops during high-volume spikes.`
            if (candidate.split(/\s+/).filter(Boolean).length <= 38) {
              text = candidate
            } else {
              text = `${clean}, utilizing Kafka event topics to decouple asynchronous workers.`
            }
            usedKeywords.add(kwLower)
            keywordLedger.push({
              keyword: kw,
              company: exp.company || `Company ${expIdx + 1}`,
              placement: 'Event Streaming Architecture Clause',
              bulletText: text,
              exactBullet: text,
              wovenBullet: text,
              talkingScript: `Highlight how you used ${kw} for decoupled event streaming to prevent request drops during traffic spikes.`,
              interviewTalkingScript: `Highlight how you used ${kw} for decoupled event streaming to prevent request drops during traffic spikes.`,
            })
            break
          }
        }

        // 3. Read-Aside Caching slot (Redis) — Strictly DO NOT tack onto AI/Chatbot bullets!
        if (kwLower === 'redis') {
          const isChatbotOrAi = /chatbot|llm|copilot|rag|conversational|dialog|prompt|vector/i.test(text)
          const isDbOrQuery = /cache|caching|latency|query|database|session|api|throughput|load|sql|postgres|postgresql|orm/i.test(text)
          if (!isChatbotOrAi && isDbOrQuery) {
            if (!new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
              const clean = text.replace(/[.!?]+$/, '').trim()
              const fullCandidate = `${clean}, implementing a Redis read-aside caching layer with TTL eviction, offloading 70% of read queries from the primary database.`
              if (fullCandidate.split(/\s+/).filter(Boolean).length <= 38) {
                text = fullCandidate
              } else {
                text = `${clean}, deploying Redis read-aside caching to cut p95 database query latency by 35%.`
              }
              usedKeywords.add(kwLower)
              keywordLedger.push({
                keyword: kw,
                company: exp.company || `Company ${expIdx + 1}`,
                placement: 'Read-Aside Caching Architecture',
                bulletText: text,
                exactBullet: text,
                wovenBullet: text,
                talkingScript: `Describe how introducing a Redis read-aside caching layer with TTL eviction offloaded heavy queries and reduced database read latency.`,
                interviewTalkingScript: `Describe how introducing a Redis read-aside caching layer with TTL eviction offloaded heavy queries and reduced database read latency.`,
              })
              break
            }
          }
        }

        // 4. Container Orchestration slot (Docker, Kubernetes)
        if (['docker', 'kubernetes', 'k8s'].includes(kwLower) && /deploy|container|cloud|ci\/cd|pipeline|backend|service|microservice|aws/i.test(text)) {
          if (!new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
            const clean = text.replace(/[.!?]+$/, '').trim()
            const candidate = isCurrent
              ? `${clean}, containerized using multi-stage Docker builds and deployed on Kubernetes with automated health probes and rolling updates.`
              : `${clean}, containerized using multi-stage Docker builds and deployed on Kubernetes with automated health probes and rolling updates.`
            if (candidate.split(/\s+/).filter(Boolean).length <= 38) {
              text = candidate
            } else {
              text = `${clean}, containerized via Docker and deployed on Kubernetes.`
            }
            usedKeywords.add(kwLower)
            keywordLedger.push({
              keyword: kw,
              company: exp.company || `Company ${expIdx + 1}`,
              placement: 'Container Orchestration Clause',
              bulletText: text,
              exactBullet: text,
              wovenBullet: text,
              talkingScript: `Explain how multi-stage Docker builds and Kubernetes automated health probes ensured repeatable deployments and zero downtime.`,
              interviewTalkingScript: `Explain how multi-stage Docker builds and Kubernetes automated health probes ensured repeatable deployments and zero downtime.`,
            })
            break
          }
        }

        // 5. GraphQL / gRPC API slot
        if (['graphql', 'grpc'].includes(kwLower) && /api|endpoint|service|interface|rest|backend/i.test(text)) {
          if (!new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
            const clean = text.replace(/[.!?]+$/, '').trim()
            const clause = kwLower === 'graphql'
              ? 'architecting a unified GraphQL schema to eliminate over-fetching and consolidate multi-endpoint data retrieval'
              : 'implementing high-performance gRPC service-to-service communication with Protocol Buffers'
            const candidate = `${clean}, ${clause}.`
            if (candidate.split(/\s+/).filter(Boolean).length <= 38) {
              text = candidate
            } else {
              text = `${clean}, adopting ${kw} to optimize API network payloads.`
            }
            usedKeywords.add(kwLower)
            keywordLedger.push({
              keyword: kw,
              company: exp.company || `Company ${expIdx + 1}`,
              placement: `${kw} API Layer Clause`,
              bulletText: text,
              exactBullet: text,
              wovenBullet: text,
              talkingScript: `Discuss how you integrated ${kw} to optimize client-server communication efficiency and payload contracts.`,
              interviewTalkingScript: `Discuss how you integrated ${kw} to optimize client-server communication efficiency and payload contracts.`,
            })
            break
          }
        }
      }

      // Enforce active present tense on current role bullets
      if (isCurrent && text) {
        const m = text.match(/^([•\-*▪–—\s]*)([A-Za-z]+)\b(.*)$/s)
        if (m) {
          const prefix = m[1]
          const firstWord = m[2]
          const rest = m[3]
          const presentWord = toPresentTense(firstWord)
          if (presentWord && presentWord.toLowerCase() !== firstWord.toLowerCase()) {
            text = `${prefix}${presentWord}${rest}`
          }
        }
      }

      if (typeof exp.bullets[bIdx] === 'string') exp.bullets[bIdx] = text
      else if (exp.bullets[bIdx] && typeof exp.bullets[bIdx] === 'object') exp.bullets[bIdx].text = text
    })

    // Synthesize Engineering Practice Bullet (Testing, Code Reviews, Git) if missing
    const needsTesting = targetKws.some((k) => /testing|code review|git|system design/i.test(k))
    if (expIdx === 0 && needsTesting && !usedKeywords.has('unit testing')) {
      const practiceBullet = isCurrent
        ? 'Establish comprehensive automated testing and release reliability with Jest and PyTest, driving peer code reviews and Git/GitHub CI/CD pull request review gates.'
        : 'Established comprehensive automated testing and release reliability with Jest and PyTest, driving peer code reviews and Git/GitHub CI/CD pull request review gates.'
      exp.bullets.push(practiceBullet)
      usedKeywords.add('unit testing')
      usedKeywords.add('code review')
      usedKeywords.add('git')

      keywordLedger.push({
        keyword: 'Unit / Integration Testing & Git',
        company: exp.company || 'Current Company',
        placement: 'Dedicated Production Quality Bullet',
        bulletText: practiceBullet,
        exactBullet: practiceBullet,
        wovenBullet: practiceBullet,
        talkingScript: 'Discuss how you established automated PR test gating, branch protection rules, and team code review checklists.',
        interviewTalkingScript: 'Discuss how you established automated PR test gating, branch protection rules, and team code review checklists.',
      })
    }

    // Synthesize crisp new bullet (< 28 words) if high-impact missing keyword could not be inserted directly
    for (const kw of targetKws) {
      const kwLower = kw.toLowerCase()
      if (usedKeywords.has(kwLower)) continue

      if (expIdx === 0 && (kwLower === 'docker' || kwLower === 'kubernetes')) {
        const synBullet = isCurrent
          ? 'Deploy containerized microservices via Docker and Kubernetes with automated health probes and rolling updates.'
          : 'Deployed containerized microservices via Docker and Kubernetes with automated health probes and rolling updates.'
        exp.bullets.push(synBullet)
        usedKeywords.add(kwLower)
        keywordLedger.push({
          keyword: kw,
          company: exp.company || 'Current Company',
          placement: 'Synthesized Containerization Bullet',
          bulletText: synBullet,
          exactBullet: synBullet,
          wovenBullet: synBullet,
          talkingScript: `Explain how containerizing services with ${kw} ensured repeatable deployments and high system availability.`,
          interviewTalkingScript: `Explain how containerizing services with ${kw} ensured repeatable deployments and high system availability.`,
        })
        break
      }
    }
  })

  return {
    tailoredExperiences: experiences,
    interviewLedger: keywordLedger,
    totalKeywordsWoven: usedKeywords.size,
  }
}

/**
 * Natural Keyword Weaving Mini-Agent.
 * Generates context-aware, recruiter-grade keyword insertions via LLM gateway,
 * falling back gracefully to deterministic weaving when offline or keys are absent.
 */
export async function weaveKeywordsAndBuildLedger({ canonicalResume = {}, missingKeywords = [], targetRole = '' }) {
  const experiences = JSON.parse(JSON.stringify(canonicalResume?.experiences || canonicalResume?.experience || []))
  if (!experiences.length) {
    return { tailoredExperiences: [], interviewLedger: [], totalKeywordsWoven: 0 }
  }

  const cleanKeywords = (Array.isArray(missingKeywords) ? missingKeywords : [])
    .map((k) => (typeof k === 'string' ? k : k?.skill || k?.name || k?.keyword || ''))
    .map((s) => s.trim())
    .filter(Boolean)

  if (!cleanKeywords.length) {
    return weaveKeywordsDeterministic({ canonicalResume, missingKeywords: [], targetRole })
  }

  try {
    const systemPrompt = `You are a technical recruiter and resume engineering specialist.
Weave missing target keywords into candidate experience bullets or synthesize realistic new bullets.

CRITICAL RULES:
1. Weave missing keywords into existing tooling or architecture clauses where technically plausible.
2. If direct insertion produces an unnatural sentence, synthesize a brand-new, realistic engineering bullet (strictly under 28 words) matching the company's domain.
3. TENSE RULES:
   - For CURRENT roles (isCurrent=true or dates containing Present/Current/Now), every opening verb MUST be in active present tense (e.g., Build, Architect, Deploy, Engineer, Optimize).
   - For COMPLETED roles, every opening verb MUST be in past tense (e.g., Built, Architected, Deployed, Engineered, Optimized).
4. Strictly FORBID repeating boilerplate clauses (e.g. "by establishing decoupled microservice boundaries...").
5. Return ONLY a valid JSON object matching this schema:
{
  "tailoredExperiences": [
    {
      "company": "Company Name",
      "role": "Role Title",
      "isCurrent": true,
      "bullets": ["...", "..."]
    }
  ],
  "interviewLedger": [
    {
      "keyword": "Keyword",
      "company": "Company Name",
      "placement": "Placement clause or Synthesized Bullet",
      "bulletText": "Full bullet text",
      "exactBullet": "Full bullet text",
      "wovenBullet": "Full bullet text",
      "interviewTalkingScript": "How candidate should explain this in interview",
      "talkingScript": "How candidate should explain this in interview"
    }
  ]
}`

    const userPrompt = `TARGET ROLE: ${targetRole || canonicalResume?.target_role || 'Software Engineer'}
MISSING KEYWORDS TO WEAVE: ${JSON.stringify(cleanKeywords.slice(0, 10))}

EXPERIENCES:
${JSON.stringify(
  experiences.map((e) => ({
    company: e.company,
    role: e.role,
    dates: e.dates || e.duration || (e.isCurrent ? 'Present' : ''),
    isCurrent:
      e.isCurrent === true ||
      /present|current|now/i.test(e.endDate || '') ||
      /present|current|now/i.test(e.dates || '') ||
      /present|current|now/i.test(e.duration || ''),
    bullets: (e.bullets || []).map((b) => (typeof b === 'string' ? b : b?.text || '')),
  })),
  null,
  2
)}`

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('LLM keyword weaving timeout')), 6000)
    )

    const generatePromise = llmGateway.generate({
      purpose: 'resume_keyword_weaving',
      responseFormat: 'json_object',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const response = await Promise.race([generatePromise, timeoutPromise])
    const text = response?.text || (typeof response === 'string' ? response : '')
    const parsed = JSON.parse(text)

    if (Array.isArray(parsed?.tailoredExperiences) && parsed.tailoredExperiences.length > 0) {
      const mergedExperiences = experiences.map((origExp, idx) => {
        const aiExp = parsed.tailoredExperiences[idx]
        if (aiExp && Array.isArray(aiExp.bullets) && aiExp.bullets.length > 0) {
          return {
            ...origExp,
            bullets: aiExp.bullets.map((bText, bIdx) => {
              const origBullet = (origExp.bullets || [])[bIdx]
              if (typeof origBullet === 'object' && origBullet !== null) {
                return { ...origBullet, text: bText }
              }
              return bText
            }),
          }
        }
        return origExp
      })

      const ledger = (Array.isArray(parsed?.interviewLedger) ? parsed.interviewLedger : []).map((item) => ({
        keyword: item.keyword || '',
        company: item.company || '',
        placement: item.placement || 'Technical Tooling Clause',
        bulletText: item.bulletText || item.wovenBullet || item.exactBullet || '',
        exactBullet: item.exactBullet || item.wovenBullet || item.bulletText || '',
        wovenBullet: item.wovenBullet || item.exactBullet || item.bulletText || '',
        interviewTalkingScript: item.interviewTalkingScript || item.talkingScript || `Discuss how you applied ${item.keyword} in production.`,
        talkingScript: item.talkingScript || item.interviewTalkingScript || `Discuss how you applied ${item.keyword} in production.`,
      }))

      return {
        tailoredExperiences: mergedExperiences,
        interviewLedger: ledger,
        totalKeywordsWoven: ledger.length,
      }
    }
  } catch (_err) {
    // Non-blocking fallback to deterministic weaver
  }

  return weaveKeywordsDeterministic({ canonicalResume, missingKeywords: cleanKeywords, targetRole })
}

export default {
  weaveKeywordsAndBuildLedger,
  weaveKeywordsDeterministic,
}
