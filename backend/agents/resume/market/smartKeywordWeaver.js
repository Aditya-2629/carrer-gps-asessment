import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { toPresentTense } from '../signals/patterns.js'

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

export function deterministicWeave(experiences, targetKws, targetRole = '') {
  const keywordLedger = []
  const usedKeywords = new Set()
  const expClones = JSON.parse(JSON.stringify(experiences || []))

  if (expClones.length === 0 || targetKws.length === 0) {
    return {
      tailoredExperiences: expClones,
      interviewLedger: [],
      totalKeywordsWoven: 0,
    }
  }

  const expProfiles = expClones.map((exp, idx) => {
    const rawBullets = (exp.bullets || []).map((b) => (typeof b === 'string' ? b : b?.text || ''))
    const combinedText = [exp.company, exp.role, ...rawBullets].join(' ').toLowerCase()
    return {
      index: idx,
      company: exp.company || `Company ${idx + 1}`,
      isCurrent: isRoleCurrent(exp),
      bullets: [...rawBullets],
      isDatabase: /database|sql|mysql|sync|orm|backend|graphql|sequelize|query|postgres|redis|nosql|schema/i.test(combinedText),
      isCloud: /cloud|aws|azure|gcp|serverless|lambda|docker|kubernetes|k8s|devops|infrastructure|jenkins/i.test(combinedText),
      isAi: /ai|ml|machine\s*learning|nlp|langchain|llm|agent|gemini|embeddings|pytorch|tensorflow/i.test(combinedText),
      isFrontend: /react|frontend|ui|typescript|javascript|next|web|components/i.test(combinedText),
      modifiedCount: 0,
      synthesizedCount: 0,
    }
  })

  for (const kw of targetKws) {
    const kwLower = kw.toLowerCase()
    if (usedKeywords.has(kwLower)) continue

    const isDbKw = /sql|postgres|mysql|redis|nosql|orm|sequelize|graphql|rest|node/i.test(kwLower)
    const isCloudKw = /azure|gcp|aws|docker|kubernetes|terraform|ci\/cd|git|github|jenkins/i.test(kwLower)
    const isAiKw = /pytorch|tensorflow|ml|embeddings|rag|fine-tuning|mlops|model/i.test(kwLower)
    const isLangKw = /typescript|javascript|python|java|go/i.test(kwLower)
    const isTestKw = /testing|unit|integration|jest|pytest|code review/i.test(kwLower)

    let candidateProfiles = expProfiles.filter((p) => (p.modifiedCount + p.synthesizedCount) < 2)
    if (candidateProfiles.length === 0) candidateProfiles = expProfiles

    let targetProfile = null
    if (isDbKw) {
      targetProfile = candidateProfiles.find((p) => p.isDatabase) || candidateProfiles[candidateProfiles.length - 1]
    } else if (isCloudKw) {
      targetProfile = candidateProfiles.find((p) => p.isCloud) || candidateProfiles[0]
    } else if (isAiKw) {
      targetProfile = candidateProfiles.find((p) => p.isAi) || candidateProfiles[0]
    } else if (isLangKw) {
      targetProfile = candidateProfiles.find((p) => p.isFrontend || p.isDatabase) || candidateProfiles[candidateProfiles.length - 1]
    } else if (isTestKw) {
      targetProfile = candidateProfiles.find((p) => p.modifiedCount === 0) || candidateProfiles[0]
    }

    if (!targetProfile) targetProfile = candidateProfiles[0]

    let wovenInline = false
    for (let bIdx = 0; bIdx < targetProfile.bullets.length; bIdx++) {
      let bText = targetProfile.bullets[bIdx]

      if (new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(bText)) {
        usedKeywords.add(kwLower)
        wovenInline = true
        break
      }

      if (isDbKw && /mysql|ms sql|database synchronization|database sync/i.test(bText)) {
        if (/postgres/i.test(kwLower) && !/postgres/i.test(bText)) {
          bText = bText.replace(/between\s+MySQL\s+and\s+MS\s+SQL/i, 'between MySQL, PostgreSQL, and MS SQL')
          wovenInline = true
        } else if (/redis/i.test(kwLower) && !/redis/i.test(bText)) {
          bText = bText.replace(/for\s+enterprise\s+clients/i, 'with Redis caching for enterprise clients')
          wovenInline = true
        }
      }

      if (!wovenInline && (isDbKw || isLangKw) && /graphql|sequelize|orm|backend/i.test(bText)) {
        if (/typescript/i.test(kwLower) && !/typescript/i.test(bText)) {
          bText = bText.replace(/using\s+GraphQL/i, 'using TypeScript, GraphQL')
          wovenInline = true
        } else if (/node/i.test(kwLower) && !/node/i.test(bText)) {
          bText = bText.replace(/backend\s+services/i, 'Node.js backend microservices')
          wovenInline = true
        }
      }

      if (!wovenInline && isCloudKw && /monolith|serverless|azure|backend/i.test(bText)) {
        if (/docker/i.test(kwLower) && !/docker/i.test(bText)) {
          bText = bText.replace(/on\s+Azure/i, 'on Azure containerized with Docker')
          wovenInline = true
        }
      }

      if (!wovenInline && isAiKw && /chatbot|langchain|gemini/i.test(bText)) {
        if (/pytorch/i.test(kwLower) && !/pytorch/i.test(bText)) {
          bText = bText.replace(/using\s+LangChain/i, 'using LangChain, PyTorch embeddings')
          wovenInline = true
        }
      }

      if (!wovenInline && isCloudKw && /ci\/cd|deployment|jenkins/i.test(bText)) {
        if (/git|github/i.test(kwLower) && !/git/i.test(bText)) {
          bText = bText.replace(/deployment/i, 'deployment integrated with Git / GitHub')
          wovenInline = true
        } else if (/gcp/i.test(kwLower) && !/gcp/i.test(bText)) {
          bText = bText.replace(/zero-downtime/i, 'zero-downtime releases across GCP and')
          wovenInline = true
        }
      }

      if (wovenInline) {
        targetProfile.bullets[bIdx] = bText
        targetProfile.modifiedCount++
        usedKeywords.add(kwLower)
        keywordLedger.push({
          keyword: kw,
          company: targetProfile.company,
          placement: 'Woven into existing bullet',
          exactBullet: bText,
          wovenBullet: bText,
          interviewTalkingScript: generateTalkingScript(kw, targetProfile.company),
          talkingScript: generateTalkingScript(kw, targetProfile.company),
        })
        break
      }
    }
  }

  for (const kw of targetKws) {
    const kwLower = kw.toLowerCase()
    if (usedKeywords.has(kwLower)) continue

    const availableProfile = expProfiles
      .filter((p) => p.synthesizedCount === 0 && p.bullets.length < 5)
      .sort((a, b) => a.bullets.length - b.bullets.length)[0]

    if (!availableProfile) break

    const isCurrent = availableProfile.isCurrent
    let synthBullet = ''

    if (/testing|unit|integration|jest|pytest|code review/i.test(kwLower)) {
      synthBullet = isCurrent
        ? `Maintain production reliability by establishing unit and integration test coverage with Jest and PyTest alongside peer code reviews to gate pull requests.`
        : `Maintained production reliability by establishing unit and integration test coverage with Jest and PyTest alongside peer code reviews to gate pull requests.`
      usedKeywords.add('unit / integration testing')
      usedKeywords.add('unit testing')
      usedKeywords.add('code review')
    } else if (/java/i.test(kwLower)) {
      synthBullet = isCurrent
        ? `Engineer high-throughput enterprise RESTful API endpoints utilizing Java and Spring Boot for secure third-party client integrations.`
        : `Engineered high-throughput enterprise RESTful API endpoints utilizing Java and Spring Boot for secure third-party client integrations.`
      usedKeywords.add('java')
    } else if (/gcp|cloud/i.test(kwLower)) {
      synthBullet = isCurrent
        ? `Deploy and monitor cloud workloads on GCP, automating resource scaling and pipeline telemetry to ensure high availability.`
        : `Deployed and monitored cloud workloads on GCP, automating resource scaling and pipeline telemetry to ensure high availability.`
      usedKeywords.add('gcp')
    } else if (/typescript/i.test(kwLower)) {
      synthBullet = isCurrent
        ? `Standardize type safety and API contract integrity across microservices using TypeScript, eliminating runtime payload errors.`
        : `Standardized type safety and API contract integrity across microservices using TypeScript, eliminating runtime payload errors.`
      usedKeywords.add('typescript')
    } else if (/sql|postgres|database/i.test(kwLower)) {
      synthBullet = isCurrent
        ? `Optimize database query performance and relational indexing using PostgreSQL for sub-second retrieval across high-volume transaction tables.`
        : `Optimized database query performance and relational indexing using PostgreSQL for sub-second retrieval across high-volume transaction tables.`
      usedKeywords.add('postgresql')
    } else {
      synthBullet = isCurrent
        ? `Implement ${kw} across core backend workflows, enhancing system modularity, operational observability, and deployment velocity.`
        : `Implemented ${kw} across core backend workflows, enhancing system modularity, operational observability, and deployment velocity.`
      usedKeywords.add(kwLower)
    }

    if (synthBullet) {
      availableProfile.bullets.push(synthBullet)
      availableProfile.synthesizedCount++
      keywordLedger.push({
        keyword: kw,
        company: availableProfile.company,
        placement: 'Synthesized high-impact bullet',
        exactBullet: synthBullet,
        wovenBullet: synthBullet,
        interviewTalkingScript: generateTalkingScript(kw, availableProfile.company),
        talkingScript: generateTalkingScript(kw, availableProfile.company),
      })
    }
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

function generateTalkingScript(kw, company) {
  const low = kw.toLowerCase()
  if (low.includes('git')) {
    return `In technical rounds, explain how you enforced trunk-based development, branch protection rules, and automated PR test gates in ${company}.`
  }
  if (low.includes('azure') || low.includes('gcp') || low.includes('aws')) {
    return `Highlight your hands-on infrastructure provisioning, IAM roles, and serverless compute scaling on ${kw} to handle enterprise production traffic.`
  }
  if (low.includes('test') || low.includes('jest') || low.includes('review')) {
    return `Discuss your testing philosophy: driving unit test coverage on core business logic and conducting mandatory peer code reviews to prevent regressions.`
  }
  if (low.includes('typescript')) {
    return `Explain that you introduced ${kw} to enforce strict contract boundaries between microservices and eliminate null-pointer exceptions in production.`
  }
  if (low.includes('postgres') || low.includes('redis') || low.includes('sql')) {
    return `Describe how you selected ${kw} to optimize query latency, indexing strategies, and caching for data synchronization at ${company}.`
  }
  if (low.includes('pytorch') || low.includes('ml')) {
    return `Walk through how you applied ${kw} for model embedding generation and semantic search inference in live agent workflows.`
  }
  if (low.includes('java')) {
    return `Discuss your experience designing performant, type-safe backend services in ${kw} to support high-concurrency enterprise client integrations.`
  }
  return `Explain your hands-on architectural implementation of ${kw} at ${company}, focusing on trade-offs, system reliability, and business impact.`
}

export async function weaveKeywordsAndBuildLedger({
  canonicalResume = {},
  missingKeywords = [],
  targetRole = '',
  skillsOnlyKeywords = [],
}) {
  const experiences = JSON.parse(JSON.stringify(canonicalResume?.experiences || canonicalResume?.experience || []))

  const rawPool = [
    ...(Array.isArray(missingKeywords) ? missingKeywords : []),
    ...(Array.isArray(skillsOnlyKeywords) ? skillsOnlyKeywords : []),
  ]

  const seen = new Set()
  const targetKws = []
  for (const item of rawPool) {
    const raw = typeof item === 'string' ? item : item?.keyword || item?.skill || item?.name || ''
    const clean = raw.trim()
    if (clean.length >= 2 && !seen.has(clean.toLowerCase()) && !/^(?:and|or|etc|tools|skills)$/i.test(clean)) {
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
Your objective is to naturally distribute and weave target keywords across candidate experience entries.

CRITICAL ARCHITECTURAL CONSTRAINTS:
1. BALANCED MULTI-COMPANY DISTRIBUTION (NEVER DUMP ALL KEYWORDS INTO ONE COMPANY):
   - You MUST distribute keywords across ALL candidate companies based on technical domain relevance.
   - Database, SQL, PostgreSQL, Redis, Node.js, ORM, GraphQL, Java keywords belong in database/backend-centric roles.
   - Cloud, serverless, Azure, GCP, Docker, Kubernetes, CI/CD, Git, PyTorch keywords belong in cloud/AI-centric roles.
   - Testing & Code Quality (Unit / Integration Testing, Code Reviews) can be placed in either role.
   - MAXIMUM 1-2 keyword additions or modifications per company!
   - Total bullets per company must be balanced (target 4-5 bullets per company, NEVER exceed 6).

2. NATURAL IN-LINE WEAVING FIRST (AVOID GENERIC ONE-LINERS):
   - Prioritize enhancing an existing bullet naturally with the keyword instead of adding a new bullet.
   - Only synthesize a new bullet if no existing bullet can naturally accommodate the keyword.
   - Any synthesized bullet must be rich, concrete, technical, under 28 words, and directly grounded in that company's product domain.

3. STRICT TENSE ENFORCEMENT:
   - For ANY experience entry where isCurrent is true: EVERY bullet MUST strictly start with an active PRESENT TENSE verb.
   - For past completed roles (isCurrent is false): EVERY bullet MUST strictly start with an active PAST TENSE verb.

4. INTERVIEW DEFENSE LEDGER:
   - For EVERY woven keyword, provide:
     - "keyword": exact keyword
     - "company": company name where woven
     - "placement": "Woven into existing bullet" or "Synthesized high-impact bullet"
     - "exactBullet": the final bullet text containing the keyword
     - "interviewTalkingScript": a concise, 1-sentence technical defense script explaining why you chose this tool, architectural trade-offs, and measurable impact for recruiter/tech screening rounds.

OUTPUT FORMAT:
Return valid JSON only:
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

    const userPrompt = `Target Role: ${targetRole || canonicalResume?.target_role || 'Software Engineer'}
Target Keywords to Weave: ${targetKws.slice(0, 10).join(', ')}

Candidate Experiences:
${JSON.stringify(compactExperiences, null, 2)}`

    const response = await llmGateway.generate({
      purpose: 'resume_keyword_weaving',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      responseFormat: 'json_object',
      temperature: 0.2,
      maxTokens: 2500,
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
            wovenBullet: l.wovenBullet || l.exactBullet || '',
            exactBullet: l.exactBullet || l.wovenBullet || '',
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

  return deterministicWeave(experiences, targetKws, targetRole)
}

export function weaveKeywordsDeterministic({ canonicalResume = {}, missingKeywords = [], targetRole = '' } = {}) {
  const experiences = canonicalResume?.experiences || canonicalResume?.experience || []
  const targetKws = (Array.isArray(missingKeywords) ? missingKeywords : [])
    .map((k) => (typeof k === 'string' ? k : k?.skill || k?.name || k?.keyword || ''))
    .map((s) => s.trim())
    .filter(Boolean)
  return deterministicWeave(experiences, targetKws, targetRole)
}

export default {
  weaveKeywordsAndBuildLedger,
  deterministicWeave,
  weaveKeywordsDeterministic,
  isRoleCurrent,
  cleanBoilerplateAndTense,
}
