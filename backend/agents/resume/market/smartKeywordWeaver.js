/**
 * Smart Keyword Weaver & Interview Cheat Sheet Generator
 *
 * Weaves missing JD keywords (e.g. Kafka, TypeScript, Unit/Integration Testing, Git/GitHub, System Design)
 * into matching experience bullets, synthesizes high-impact engineering practice bullets if missing,
 * and generates the candidate's Interview Talking Points / Interview Defense Sheet.
 */

export function weaveKeywordsAndBuildLedger({ canonicalResume = {}, missingKeywords = [] }) {
  const experiences = JSON.parse(JSON.stringify(canonicalResume?.experiences || canonicalResume?.experience || []))
  const keywordLedger = []
  const usedKeywords = new Set()

  const targetKws = (Array.isArray(missingKeywords) ? missingKeywords : [])
    .map((k) => (typeof k === 'string' ? k : k?.skill || k?.name || k?.keyword || ''))
    .map((s) => s.trim())
    .filter(Boolean)

  experiences.forEach((exp, expIdx) => {
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
            const candidate = `${clean}, adopting TypeScript to enforce strict API payload contracts, eliminating runtime type errors across service boundaries.`
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
            const candidate = `${clean}, containerized using multi-stage Docker builds and deployed on Kubernetes with automated health probes and rolling updates.`
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

      if (typeof exp.bullets[bIdx] === 'string') exp.bullets[bIdx] = text
      else if (exp.bullets[bIdx] && typeof exp.bullets[bIdx] === 'object') exp.bullets[bIdx].text = text
    })

    // Synthesize Engineering Practice Bullet (Testing, Code Reviews, Git) if missing
    const needsTesting = targetKws.some((k) => /testing|code review|git|system design/i.test(k))
    if (expIdx === 0 && needsTesting && !usedKeywords.has('unit testing')) {
      const practiceBullet = `Established comprehensive automated testing and release reliability with Jest and PyTest, driving peer code reviews and Git/GitHub CI/CD pull request review gates.`
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
  })

  return {
    tailoredExperiences: experiences,
    interviewLedger: keywordLedger,
    totalKeywordsWoven: usedKeywords.size,
  }
}

export default {
  weaveKeywordsAndBuildLedger,
}

