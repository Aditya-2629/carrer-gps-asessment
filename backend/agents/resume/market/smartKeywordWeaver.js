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

      for (const kw of targetKws) {
        const kwLower = kw.toLowerCase()
        if (usedKeywords.has(kwLower)) continue

        // 1. API / Language slot (TypeScript, GraphQL, gRPC)
        if (['typescript', 'graphql', 'grpc'].includes(kwLower) && /react|frontend|api|endpoint|service/i.test(text)) {
          if (!new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
            if (/(using|with)\s+([^,.;]+)/i.test(text)) {
              text = text.replace(/(using|with)\s+([^,.;]+)/i, `$1 $2 and ${kw}`)
            } else {
              text = text.replace(/([.,;]?)$/, ` using ${kw}$1`)
            }
            usedKeywords.add(kwLower)
            keywordLedger.push({
              keyword: kw,
              company: exp.company || `Company ${expIdx + 1}`,
              placement: 'Inline Tooling Clause',
              bulletText: text,
              exactBullet: text,
              interviewTalkingScript: `Explain that you adopted ${kw} to enforce static typing and contract validation, preventing runtime payload errors across microservices.`,
            })
            break
          }
        }

        // 2. Messaging / Async slot (Kafka, Redis, SQS, RabbitMQ)
        if (['kafka', 'redis', 'sqs', 'rabbitmq'].includes(kwLower) && /event|stream|queue|sync|message|serverless/i.test(text)) {
          if (!new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
            if (/(using|with)\s+([^,.;]+)/i.test(text)) {
              text = text.replace(/(using|with)\s+([^,.;]+)/i, `$1 $2, ${kw} message queues,`)
            } else {
              text = text.replace(/([.,;]?)$/, ` via ${kw} message queues$1`)
            }
            usedKeywords.add(kwLower)
            keywordLedger.push({
              keyword: kw,
              company: exp.company || `Company ${expIdx + 1}`,
              placement: 'Event Architecture Clause',
              bulletText: text,
              exactBullet: text,
              interviewTalkingScript: `Highlight how you used ${kw} for decoupled event streaming to prevent request drops during traffic spikes.`,
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
      const practiceBullet = `Maintained production reliability by establishing unit and integration test coverage with Jest and PyTest, driving peer code reviews and Git/GitHub release deployment workflows.`
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

