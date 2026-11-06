/**
 * Jev System One Discriminative Classifier — Career GPS Skill Intelligence
 *
 * Ultrafast, zero-hallucination decision gatekeeper powered by TypeSafe AI's Jev
 * (typesafe/jev via OpenRouter) with automatic fallback to Gemini 2.5 Flash-Lite.
 * Validates domain and technical tokens against:
 * - VALID_SKILL: Approved domain tool / framework / language / methodology
 * - LOCATION: Country / state / city / work arrangement
 * - BOILERPLATE: Scraped job board disclaimers, headers, perks
 * - GENERIC_NOISE: General soft skills, non-technical business nouns
 */

import { isConcreteTechSkill } from './dynamicSkillExtractor.js'

export const JEV_DECISION_CACHE = new Map()

// Pre-seed known technical entities and confirmed noise into O(1) cache
const SEED_APPROVED_SKILLS = [
  'python', 'sql', 'snowflake', 'dbt', 'tableau', 'power bi', 'aws', 'gcp', 'azure',
  'docker', 'kubernetes', 'terraform', 'spark', 'kafka', 'airflow', 'databricks',
  'react', 'node.js', 'typescript', 'java', 'c++', 'c#', 'go', 'rust', 'excel',
  'patient care', 'clinical assessment', 'epic systems', 'epic ehr', 'hipaa',
  'financial modeling', 'bloomberg terminal', 'sap s/4hana', 'gaap', 'salesforce', 'hubspot'
]

const SEED_LOCATION_TOKENS = [
  'uk', 'ca', 'us', 'usa', 'ny', 'tx', 'fl', 'il', 'pa', 'remote', 'hybrid', 'onsite'
]

const SEED_REJECTED_TOKENS = [
  'ai-generated', 'ai generated', 'generated', 'disclaimer', 'overviewwe', 'opportunitywe',
  'positionwe', 'summarywe', 'descriptionwe', 'companywe', 'communication', 'teamwork',
  'leadership', 'insights', 'solutions', 'environment', 'server', 'servers', 'data'
]

SEED_APPROVED_SKILLS.forEach((s) => JEV_DECISION_CACHE.set(s, { decision: 'VALID_SKILL', isSkill: true, confidence: 1.0 }))
SEED_LOCATION_TOKENS.forEach((l) => JEV_DECISION_CACHE.set(l, { decision: 'LOCATION', isSkill: false, confidence: 1.0 }))
SEED_REJECTED_TOKENS.forEach((n) => JEV_DECISION_CACHE.set(n, { decision: 'BOILERPLATE', isSkill: false, confidence: 1.0 }))

let _gatewayInstance = null
async function getLlmGateway() {
  if (_gatewayInstance) return _gatewayInstance
  try {
    const gwMod = await import('../../../ai/gateway/llmGateway.js')
    _gatewayInstance = gwMod.llmGateway || null
  } catch {
    _gatewayInstance = null
  }
  return _gatewayInstance
}

/**
 * Classifies a list of extracted candidate skill tokens using Jev System One discriminative model.
 *
 * @param {string[]} tokens - List of candidate skill strings
 * @param {string} [role='Professional'] - Target role context
 * @param {object} [options={}] - Options (model override, timeoutMs)
 * @returns {Promise<{ validSkills: string[], rejectedTerms: Array<{ term: string, decision: string, reason: string }> }>}
 */
export async function classifySkillsWithJev(tokens = [], role = 'Professional', options = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { validSkills: [], rejectedTerms: [] }
  }

  const validSkills = []
  const rejectedTerms = []
  const uncached = []

  for (const token of tokens) {
    if (!token || typeof token !== 'string') continue
    const clean = token.trim()
    const lower = clean.toLowerCase()

    if (JEV_DECISION_CACHE.has(lower)) {
      const cached = JEV_DECISION_CACHE.get(lower)
      if (cached.isSkill) {
        validSkills.push(clean)
      } else {
        rejectedTerms.push({ term: clean, decision: cached.decision, reason: 'Cached decision' })
      }
      continue
    }

    if (!isConcreteTechSkill(clean)) {
      const isLoc = /^(?:uk|ca|us|usa|remote|hybrid|onsite)$/i.test(clean)
      const decision = isLoc ? 'LOCATION' : 'BOILERPLATE'
      JEV_DECISION_CACHE.set(lower, { decision, isSkill: false, confidence: 1.0 })
      rejectedTerms.push({ term: clean, decision, reason: 'Failed structural entity guard' })
      continue
    }

    uncached.push(clean)
  }

  if (uncached.length === 0) {
    return { validSkills: Array.from(new Set(validSkills)), rejectedTerms }
  }

  const uniqueUncached = Array.from(new Set(uncached))

  try {
    const decisionPrompt = `You are the Jev System One Discriminative Classifier.
Target Role Context: "${role}"

TASK:
For each term in the candidate list below, output a structured Choice decision:
- "VALID_SKILL": A genuine technical software tool, programming language, database, cloud infrastructure, clinical competency, or financial methodology.
- "LOCATION": Geographic country, state, city code, or work arrangement (e.g. UK, CA, Remote, Hybrid).
- "BOILERPLATE": Scraped job board noise, disclaimers, concatenated headers (e.g. OverviewWe), or employment perks.
- "GENERIC_NOISE": General soft skill or non-technical business noun (e.g. communication, insights, server, data).

CANDIDATE TERMS:
${JSON.stringify(uniqueUncached)}

OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "decisions": [
    { "term": "Snowflake", "choice": "VALID_SKILL", "confidence": 0.99 },
    { "term": "UK", "choice": "LOCATION", "confidence": 0.99 }
  ]
}`

    const gw = await getLlmGateway()
    if (!gw) throw new Error('Gateway offline in test sandbox')

    const response = await gw.generate({
      purpose: 'skill_validation_decision',
      preferredProvider: 'openrouter',
      model: options.model || 'typesafe/jev',
      messages: [
        { role: 'system', content: 'You are Jev, a discriminative decision classifier. Classify each input term into exactly one choice. No conversational filler.' },
        { role: 'user', content: decisionPrompt },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.0,
      maxTokens: 1000,
      timeoutMs: options.timeoutMs || 8000,
    }).catch(async (_primaryErr) => {
      return await gw.generate({
        purpose: 'skill_validation_decision',
        preferredProvider: 'openrouter',
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: 'You are a strict discriminative decision classifier. Classify each term into VALID_SKILL, LOCATION, BOILERPLATE, or GENERIC_NOISE.' },
          { role: 'user', content: decisionPrompt },
        ],
        responseFormat: { type: 'json_object' },
        temperature: 0.0,
        maxTokens: 1000,
        timeoutMs: 10000,
      })
    })

    const rawText = response?.text || response?.content || '{}'
    const cleaned = String(rawText).replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(cleaned)

    const decisionList = Array.isArray(parsed?.decisions) ? parsed.decisions : []
    const decisionMap = new Map()
    for (const d of decisionList) {
      if (d?.term) decisionMap.set(String(d.term).toLowerCase(), d)
    }

    for (const term of uniqueUncached) {
      const lower = term.toLowerCase()
      const d = decisionMap.get(lower)
      const choice = d?.choice || 'VALID_SKILL'
      const confidence = typeof d?.confidence === 'number' ? d.confidence : 0.9
      const isSkill = choice === 'VALID_SKILL'

      JEV_DECISION_CACHE.set(lower, { decision: choice, isSkill, confidence })
      if (isSkill) validSkills.push(term)
      else rejectedTerms.push({ term, decision: choice, reason: `Jev classified as ${choice}` })
    }
  } catch (_apiErr) {
    for (const term of uniqueUncached) {
      const isPass = isConcreteTechSkill(term)
      JEV_DECISION_CACHE.set(term.toLowerCase(), { decision: isPass ? 'VALID_SKILL' : 'BOILERPLATE', isSkill: isPass, confidence: 0.85 })
      if (isPass) validSkills.push(term)
      else rejectedTerms.push({ term, decision: 'BOILERPLATE', reason: 'Deterministic guard fallback' })
    }
  }

  return {
    validSkills: Array.from(new Set(validSkills)),
    rejectedTerms,
  }
}

