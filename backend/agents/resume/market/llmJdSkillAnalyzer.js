/**
 * LLM-Powered JD Analyzer & Canonical Skill Normalizer — Career GPS Market Intelligence
 *
 * Implements two-stage market intelligence pipeline:
 * Step 1: Skill Extraction (Per-JD Analysis) -> Extracts raw resume-worthy technical skills (required vs preferred).
 * Step 2: Taxonomy Normalization -> Maps raw terms to standardized canonical industry names or rejects noise ("").
 */

import { aiGateway, llmGateway } from '../../../ai/gateway/llmGateway.js'
import { isConcreteTechSkill } from './dynamicSkillExtractor.js'
import { classifySkillsWithJev } from './jevDecisionClassifier.js'
import {
  extractSkillsFromJd,
  extractResponsibilitiesFromJd,
  extractSenioritySignalsFromJd,
} from './jdNormalizer.js'

// Safe dynamic jsonrepair fallback
let jsonrepair = (s) => s
try {
  const mod = await import('jsonrepair')
  jsonrepair = mod.jsonrepair || mod.default || ((s) => s)
} catch {
  // jsonrepair optional fallback
}

export function parseLlmJson(rawOutput) {
  if (!rawOutput) return null
  if (typeof rawOutput === 'object') return rawOutput

  const cleaned = String(rawOutput || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch (_e1) {
    try {
      return JSON.parse(jsonrepair(cleaned || '{}'))
    } catch (_e2) {
      const relaxed = cleaned.replace(/,\s*([}\]])/g, '$1')
      try {
        return JSON.parse(relaxed)
      } catch (_e3) {
        return null
      }
    }
  }
}

export const BATCH_SIZE = 10
export const MICRO_BATCH_SIZE = 5

/**
 * Clean and prune JD text to remove boilerplate noise (EEO, benefits, culture)
 * and preserve technical requirements, stack, and responsibilities up to 4000 characters.
 */
export function pruneJdText(text = '') {
  if (!text || typeof text !== 'string') return ''
  const trimmed = text.trim()
  if (trimmed.length < 50) return trimmed

  // 1. Strip legal, EEO, accommodations, and benefits boilerplate
  const withoutEeo = trimmed
    .replace(/(?:equal employment opportunity|equal opportunity employer|we are an equal opportunity|eeo statement|benefits and perks|compensation & benefits|accommodations|reasonable accommodation)[\s\S]*$/i, '')
    .trim() || trimmed

  if (withoutEeo.length <= 4000) {
    return withoutEeo
  }

  // 2. If text is long (> 4000 chars), prioritize tech stack, qualifications, and responsibilities
  const match = withoutEeo.match(/(?:requirements|qualifications|skills|technical skills|tech stack|what you(?:'ll)? need|what we(?:'re)? looking for|to be considered|good fit|must have|who you are|what you will do|as a .*? you will|responsibilities)[\s\S]{300,4000}/i)
  if (match) {
    return match[0].trim()
  }

  // 3. Fallback for long unstructured JDs: skip initial 300 chars of PR blurbs if very long, take next 3700 chars
  if (withoutEeo.length > 5000) {
    return withoutEeo.slice(300, 4000).trim()
  }
  return withoutEeo.slice(0, 4000).trim()
}

// --- 1. SKILL EXTRACTION PROMPT (PER-JD ANALYSIS) ---

export const SKILL_EXTRACTION_SYSTEM_PROMPT = `You are an elite Talent Taxonomy Engine specializing in skill extraction across IT, Engineering, Healthcare, Finance, Marketing, Operations, and Business roles.
Analyze the provided Job Description and extract ONLY concrete, resume-worthy domain skills, tools, software, regulatory standards, and professional methodologies.

DOMAIN SPECIFICATION:
- IT / Software / Data: Programming languages, frameworks, cloud platforms, databases, dev tools, and technical methodologies.
- Healthcare / Clinical: Clinical competencies, EHR/EMR systems (Epic, Cerner), medical procedures, patient assessment, compliance (HIPAA, BLS, ACLS).
- Finance / Accounting: Financial modeling, ERP systems (SAP, Oracle, NetSuite), valuation (DCF, LBO), accounting standards (GAAP, IFRS), financial tools (Bloomberg, Excel).
- Marketing / Sales / Ops: Core platforms (Salesforce, HubSpot, Google Ads), marketing tech, analytics tools, CRM, and domain methodologies.
- ANY Domain: Professional software, domain tools, regulatory frameworks, licenses, and concrete operational methodologies.

STRICT EXCLUSIONS (NEVER EXTRACT):
- Soft skills (e.g., communication, problem-solving, leadership, collaboration)
- Locations, state/country codes (e.g., UK, CA, US, NY, Texas, Remote, Hybrid)
- Metadata labels, disclaimers, and job board notices (e.g., AI-generated, Job description, Equal Opportunity, Benefits)
- Concatenated section titles or sentence fragments (e.g., OverviewWe, OpportunityWe, PositionWe)
- Job titles & seniority levels (e.g., Senior, Lead, Manager, Intern)
- Generic non-domain filler or vague nouns (e.g., insights, solutions, environment, server, data)
- Company names, benefits, education, and compensation details

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "required": ["Domain Skill 1", "Core Tool 2"],
  "preferred": ["Bonus Competency 1", "Certification 2"]
}`

// Backward-compatible alias
export const JD_ANALYSIS_SYSTEM_PROMPT = SKILL_EXTRACTION_SYSTEM_PROMPT

export function buildSkillExtractionUserMessage(jobTitle = '', jobDescription = '') {
  return `Job Title: ${jobTitle || 'Professional'}\n\nJob Description:\n${jobDescription || ''}`
}

// --- 1.5. LEAN 1-SHOT BATCH JD EXTRACTION PROMPT ---

export const buildBatchJdExtractionPrompt = (role, jdsTextList = []) => {
  return `You are an expert Technical Recruiter.
Target Role: "${role}"

TASK:
Analyze the following ${jdsTextList.length} Job Descriptions and extract top high-demand tech skills, tools, and methodologies. 

RULES:
- Extract ONLY concrete hard skills (Languages, Frameworks, Cloud, Databases, Core Concepts).
- Do NOT extract generic soft skills (e.g., "team player", "communication").
- Calculate accurate frequency count across these JDs.
- Return ONLY a valid JSON object matching the schema below. No markdown wrapping, no fluff.

SCHEMA:
{
  "totalJdsAnalyzed": ${jdsTextList.length},
  "skills": [
    {
      "name": "Canonical Skill Name (e.g. TypeScript, AWS, Docker)",
      "frequency": <number of JDs mentioning this skill>,
      "category": "language" | "framework" | "cloud" | "database" | "tool" | "concept"
    }
  ]
}

JOB DESCRIPTIONS:
${jdsTextList.map((jd, idx) => `--- JD #${idx + 1} ---\n${String(jd).slice(0, 1500)}`).join('\n\n')}`;
};

/**
 * Executes a 1-shot batch LLM extraction across multiple JDs in a single request.
 * Drastically reduces latency and token cost by replacing per-JD iterations.
 */
export async function extractSkillsFromBatch1Shot({ role = 'Professional', jdsTextList = [], timeoutMs = 35000 } = {}) {
  if (!Array.isArray(jdsTextList) || jdsTextList.length === 0) {
    return { totalJdsAnalyzed: 0, skills: [] }
  }

  const prompt = buildBatchJdExtractionPrompt(role, jdsTextList)
  const response = await llmGateway.generate({
    purpose: 'market_jd_analysis',
    stage: 'BATCH_1SHOT_JD_EXTRACTION',
    model: 'google/gemini-3.5-flash-lite',
    preferredProvider: 'openrouter',
    messages: [
      { role: 'user', content: prompt },
    ],
    responseFormat: 'json_object',
    temperature: 0.1,
    maxTokens: 2500,
    timeoutMs,
  })

  let parsed = null
  try {
    parsed = JSON.parse(jsonrepair(response.text || '{}'))
  } catch (err) {
    console.warn(`[LlmJdAnalyzer] Failed to parse 1-shot batch JSON: ${err.message}`)
    return { totalJdsAnalyzed: jdsTextList.length, skills: [] }
  }

  const skills = Array.isArray(parsed?.skills) ? parsed.skills : []
  return {
    totalJdsAnalyzed: parsed?.totalJdsAnalyzed || jdsTextList.length,
    skills,
  }
}

// --- 2. CANONICAL MAPPING PROMPT (STEP 2 - TAXONOMY NORMALIZER) ---

export const TAXONOMY_NORMALIZER_SYSTEM_PROMPT = `You are a technical taxonomy normalizer.
You will receive an array of raw technical terms extracted from various job descriptions.

TASK:
1. Map each raw input term to its official, canonical industry name (e.g., "postgres" -> "PostgreSQL", "k8s" -> "Kubernetes", "power bi" -> "Power BI", "node js" -> "Node.js", "gcp" -> "Google Cloud Platform").
2. If an input term is generic noise, a soft skill, or not a concrete technical skill/tool/methodology (e.g., "communication", "insights", "analytics", "server"), map its canonical value to an empty string "".
3. Return the mapping for EVERY single input term in the array.

OUTPUT FORMAT (STRICT JSON OBJECT ONLY):
{
  "mappings": [
    { "term": "<exact input term>", "canonical": "<Standardized Name or ''>" }
  ]
}`

export function buildTaxonomyNormalizerUserMessage(terms = []) {
  return JSON.stringify(terms, null, 2)
}

// Preserved high-frequency synonym dictionary for instant 0ms lookups
export const CANONICAL_SYNONYMS = {
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'postgre sql': 'PostgreSQL',
  'powerbi': 'Power BI',
  'power bi': 'Power BI',
  'ms power bi': 'Power BI',
  'power-bi': 'Power BI',
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'gcp': 'Google Cloud',
  'google cloud platform': 'Google Cloud',
  'google cloud': 'Google Cloud',
  'bigquery': 'BigQuery',
  'google bigquery': 'BigQuery',
  'dbt': 'dbt',
  'dbt core': 'dbt',
  'node': 'Node.js',
  'node.js': 'Node.js',
  'nodejs': 'Node.js',
  'node js': 'Node.js',
  'react': 'React',
  'react.js': 'React',
  'reactjs': 'React',
  'react js': 'React',
  'vue': 'Vue.js',
  'vue.js': 'Vue.js',
  'vuejs': 'Vue.js',
  'vue js': 'Vue.js',
  'next': 'Next.js',
  'next.js': 'Next.js',
  'nextjs': 'Next.js',
  'next js': 'Next.js',
  'k8s': 'Kubernetes',
  'kube': 'Kubernetes',
  'kubernetes': 'Kubernetes',
  'snowflake': 'Snowflake',
  'databricks': 'Databricks',
  'pyspark': 'PySpark',
  'spark': 'Apache Spark',
  'apache spark': 'Apache Spark',
  'airflow': 'Apache Airflow',
  'apache airflow': 'Apache Airflow',
  'kafka': 'Apache Kafka',
  'apache kafka': 'Apache Kafka',
  'tableau': 'Tableau',
  'sql': 'SQL',
  'python': 'Python',
  'excel': 'Excel',
  'ms excel': 'Excel',
  'microsoft excel': 'Excel',
}

// In-memory cache for normalized taxonomy terms
export const TAXONOMY_CANONICAL_CACHE = new Map()

// Pre-seed known synonyms and noise terms into cache
Object.entries(CANONICAL_SYNONYMS).forEach(([term, canon]) => {
  TAXONOMY_CANONICAL_CACHE.set(term.toLowerCase(), canon)
})
;['communication', 'insights', 'analytics', 'server', 'data', 'cloud', 'backend', 'into', 'your', 'our', 'us', 'position', 'overview', 'senior'].forEach((noise) => {
  TAXONOMY_CANONICAL_CACHE.set(noise, '')
})

/**
 * Normalizes a raw skill string to its canonical industry name
 */
export function normalizeCanonicalSkill(rawName = '') {
  if (!rawName || typeof rawName !== 'string') return null
  const trimmed = rawName.trim()
  if (trimmed.length < 2) return null

  const lower = trimmed.toLowerCase()
  if (TAXONOMY_CANONICAL_CACHE.has(lower)) {
    const cached = TAXONOMY_CANONICAL_CACHE.get(lower)
    return cached && cached.length > 0 ? cached : null
  }

  if (CANONICAL_SYNONYMS[lower]) {
    return CANONICAL_SYNONYMS[lower]
  }

  if (/^(into|your|our|us|position|overview|senior|insights?|server|data|it)$/i.test(trimmed)) {
    return null
  }

  if (!isConcreteTechSkill(trimmed)) {
    return null
  }

  return trimmed
}

/**
 * Step 1: Extracts raw required and preferred technical skills from a single JD
 */
export async function extractSkillsFromSingleJd({ jobTitle = '', jobDescription = '', timeoutMs = 15000 }) {
  if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 20) {
    return { required: [], preferred: [] }
  }

  try {
    const response = await llmGateway.generate({
      purpose: 'market_jd_analysis',
      preferredProvider: 'openrouter',
      model: 'google/gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: SKILL_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: buildSkillExtractionUserMessage(jobTitle, jobDescription.slice(0, 3000)) },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.1,
      maxTokens: 1000,
      timeoutMs,
    })

    const raw = response?.text || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = JSON.parse(jsonrepair(raw))
    }

    const required = Array.isArray(parsed?.required) ? parsed.required : []
    const preferred = Array.isArray(parsed?.preferred) ? parsed.preferred : []

    return {
      required: required.map((s) => (typeof s === 'string' ? s.trim() : (s?.name || '')).trim()).filter(Boolean),
      preferred: preferred.map((s) => (typeof s === 'string' ? s.trim() : (s?.name || '')).trim()).filter(Boolean),
    }
  } catch (err) {
    console.warn(`[LlmJdAnalyzer] Step 1 extraction failed for "${jobTitle}":`, err.message)
    // Heuristic fallback for offline/test environments
    const heuristicSkills = extractSkillsFromJd(jobDescription)
    return {
      required: heuristicSkills,
      preferred: [],
    }
  }
}

/**
 * Step 2: Normalizes an array of raw technical terms into canonical industry names
 */
export async function normalizeTaxonomyWithLLM(rawTerms = [], timeoutMs = 20000) {
  if (!Array.isArray(rawTerms) || rawTerms.length === 0) {
    return new Map()
  }

  const resultMap = new Map()
  const uncachedTerms = []

  for (const term of rawTerms) {
    if (!term || typeof term !== 'string') continue
    const clean = term.trim()
    const low = clean.toLowerCase()

    if (CANONICAL_SYNONYMS[low]) {
      resultMap.set(clean, CANONICAL_SYNONYMS[low])
    } else if (TAXONOMY_CANONICAL_CACHE.has(low)) {
      resultMap.set(clean, TAXONOMY_CANONICAL_CACHE.get(low))
    } else {
      uncachedTerms.push(clean)
    }
  }

  if (uncachedTerms.length === 0) {
    return resultMap
  }

  const uniqueUncached = Array.from(new Set(uncachedTerms))

  try {
    const response = await llmGateway.generate({
      purpose: 'market_jd_analysis',
      preferredProvider: 'openrouter',
      model: 'google/gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: TAXONOMY_NORMALIZER_SYSTEM_PROMPT },
        { role: 'user', content: buildTaxonomyNormalizerUserMessage(uniqueUncached) },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.1,
      maxTokens: 2000,
      timeoutMs,
    })

    const raw = response?.text || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = JSON.parse(jsonrepair(raw))
    }

    const items = Array.isArray(parsed?.mappings)
      ? parsed.mappings
      : Array.isArray(parsed)
      ? parsed
      : (typeof parsed === 'object' && parsed !== null
          ? Object.entries(parsed).map(([k, v]) => ({ term: k, canonical: typeof v === 'string' ? v : v?.canonical || '' }))
          : [])
    for (const item of items) {
      if (item?.term) {
        const canonical = typeof item.canonical === 'string' ? item.canonical.trim() : ''
        TAXONOMY_CANONICAL_CACHE.set(item.term.toLowerCase(), canonical)
        resultMap.set(item.term, canonical)
      }
    }
  } catch (err) {
    console.warn('[LlmJdAnalyzer] Step 2 taxonomy normalization failed, falling back to deterministic dictionary:', err.message)
    for (const term of uniqueUncached) {
      const fallback = normalizeCanonicalSkill(term) || ''
      TAXONOMY_CANONICAL_CACHE.set(term.toLowerCase(), fallback)
      resultMap.set(term, fallback)
    }
  }

  // Ensure all requested terms have an entry
  for (const term of rawTerms) {
    if (!resultMap.has(term)) {
      const low = term.toLowerCase()
      resultMap.set(term, TAXONOMY_CANONICAL_CACHE.get(low) || normalizeCanonicalSkill(term) || '')
    }
  }

  return resultMap
}

/**
 * Analyzes a batch of JDs via Fast LLM Gateway (Groq / OpenRouter)
 * Combines Step 1 (parallel extraction) and Step 2 (taxonomy normalization)
 */
export async function analyzeJdBatch(jobsBatch = [], startIndex = 0) {
  if (!Array.isArray(jobsBatch) || jobsBatch.length === 0) return []

  // Step 1: Throttled extraction across batch with concurrency limit of 3
  const CONCURRENCY_LIMIT = 3
  const extractedResults = []
  for (let i = 0; i < jobsBatch.length; i += CONCURRENCY_LIMIT) {
    const chunk = jobsBatch.slice(i, i + CONCURRENCY_LIMIT)
    const chunkResults = await Promise.all(
      chunk.map((job) =>
        extractSkillsFromSingleJd({
          jobTitle: job.title || 'Untitled',
          jobDescription: job.description || job.text || job.normalizedDescription || '',
        })
      )
    )
    extractedResults.push(...chunkResults)
  }

  // Collect all unique raw terms across the batch
  const allRawTerms = new Set()
  const extractedPerJob = extractedResults.map((extracted, idx) => {
    const combined = [
      ...extracted.required.map((s) => ({ term: s, isRequired: true })),
      ...extracted.preferred.map((s) => ({ term: s, isRequired: false })),
    ]
    combined.forEach((c) => allRawTerms.add(c.term))
    return {
      jobIndex: startIndex + idx,
      rawSkills: combined,
    }
  })

  // Step 2: Single batch taxonomy normalization
  const taxonomyMap = await normalizeTaxonomyWithLLM(Array.from(allRawTerms))

  // Map canonical skills back to each job
  return extractedPerJob.map((job) => {
    const seenCanon = new Set()
    const skills = []

    for (const item of job.rawSkills) {
      const canonical = taxonomyMap.get(item.term) || normalizeCanonicalSkill(item.term)
      if (canonical && canonical.length >= 2) {
        const low = canonical.toLowerCase()
        if (!seenCanon.has(low)) {
          seenCanon.add(low)
          skills.push({
            canonicalName: canonical,
            category: 'tools',
            isRequired: item.isRequired,
          })
        }
      }
    }

    return {
      jobIndex: job.jobIndex,
      skills,
    }
  })
}

/**
 * Analyzes an entire pool of scraped JDs (e.g. 90-100 JDs),
 * computes exact frequency counts and percentages, and produces a normalized skill matrix.
 */
/**
 * Deterministic fallback corpus extraction for offline tests or when LLM gateway is unavailable.
 */
export async function fallbackCorpusExtraction(jds = [], role = 'Professional') {
  const totalJds = jds.length
  const analyzedJobs = []
  const skillOccurrences = new Map()
  const respOccurrences = new Map()
  const seniorityOccurrences = new Map()

  console.log(`[LlmJdAnalyzer] Running deterministic corpus extraction for ${totalJds} JDs (${role})...`)

  for (const job of jds) {
    const rawText = job.description || job.jobDescription || job.text || job.body || ''
    const cleanText = pruneJdText(rawText)
    const skills = extractSkillsFromJd(cleanText)
    const resps = extractResponsibilitiesFromJd(cleanText)
    const seniority = extractSenioritySignalsFromJd(cleanText)

    analyzedJobs.push({
      ...job,
      title: job.title || job.jobTitle || role,
      company: job.company || 'Enterprise Employer',
      location: job.location || 'United States',
      description: rawText,
      normalizedDescription: cleanText,
      skills,
      responsibilities: resps,
      senioritySignals: seniority,
    })

    new Set(skills).forEach((skill) => {
      const canonical = normalizeCanonicalSkill(skill) || skill
      if (/^(into|your|our|us|position|overview|senior|insights?|server|data|it)$/i.test(canonical)) return
      const lower = canonical.toLowerCase()
      if (!skillOccurrences.has(lower)) {
        skillOccurrences.set(lower, {
          canonicalName: canonical,
          category: 'tool',
          count: 0,
        })
      }
      skillOccurrences.get(lower).count += 1
    })

    new Set(resps).forEach((resp) => {
      const lower = resp.toLowerCase()
      if (!respOccurrences.has(lower)) {
        respOccurrences.set(lower, { name: resp, count: 0 })
      }
      respOccurrences.get(lower).count += 1
    })

    new Set(seniority).forEach((sig) => {
      const lower = sig.toLowerCase()
      if (!seniorityOccurrences.has(lower)) {
        seniorityOccurrences.set(lower, { name: sig, count: 0 })
      }
      seniorityOccurrences.get(lower).count += 1
    })
  }

  const skills = Array.from(skillOccurrences.values())
    .map((s) => {
      const percentage = Math.round((s.count / totalJds) * 100)
      const priority = percentage >= 40 ? 'HIGH' : percentage >= 20 ? 'MEDIUM' : 'LOW'
      return {
        name: s.canonicalName,
        category: s.category,
        count: s.count,
        frequency: s.count,
        percentage,
        frequencyRatio: Math.round((s.count / totalJds) * 100) / 100,
        priority,
        requiredCount: s.count,
        preferredCount: 0,
      }
    })
    .sort((a, b) => b.percentage - a.percentage || b.count - a.count)

  const responsibilities = Array.from(respOccurrences.values())
    .map((r) => ({
      name: r.name,
      frequency: r.count,
      frequencyRatio: Math.round((r.count / totalJds) * 100) / 100,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 15)

  const senioritySignals = Array.from(seniorityOccurrences.values())
    .map((s) => ({
      name: s.name,
      frequency: s.count,
      frequencyRatio: Math.round((s.count / totalJds) * 100) / 100,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10)

  return {
    discoveredSkills: skills,
    marketSkills: skills,
    responsibilities,
    senioritySignals,
    analyzedJobs,
    sampleSize: totalJds,
    totalAnalyzed: totalJds,
    analyzedAt: new Date().toISOString(),
    method: 'deterministic_fallback',
  }
}

export const INTERN_OR_ENTRY_LEVEL_SKILLS = new Set([
  'word', 'ms word', 'microsoft word',
  'powerpoint', 'ms powerpoint', 'microsoft powerpoint',
  'data entry', 'typing', 'filing', 'basic computer skills',
  'internet research', 'copy paste', 'general office',
  'excel basics', 'basic excel', 'spreadsheets basics',
  'internship', 'student', 'trainee', 'apprentice'
])

/**
 * Scalable micro-batch analysis of JDs using Gemini Flash with deterministic math aggregation.
 * Chunks JDs into small groups of 5 JDs to prevent token truncation, timeouts, and hallucinated frequencies.
 */
export async function analyzeJdBatchWithGemini(role = 'Professional', jds = [], options = {}) {
  if (!Array.isArray(jds) || jds.length === 0) {
    return {
      discoveredSkills: [],
      marketSkills: [],
      responsibilities: [],
      senioritySignals: [],
      analyzedJobs: [],
      sampleSize: 0,
      totalAnalyzed: 0,
    }
  }

  const expBucket = options.experienceBucket || '3-5'
  const isSenior = expBucket === '6-8' || expBucket === '8+'
  const totalJds = jds.length
  console.log(`[LlmJdAnalyzer] Starting scalable micro-batch analysis for ${totalJds} JDs (Role: "${role}")...`)

  // Step 1: Pre-process each JD with smart pruning
  const preparedJds = jds.map((jd, idx) => ({
    rawJob: jd,
    title: jd.title || jd.jobTitle || role,
    company: jd.company || 'Enterprise Employer',
    location: jd.location || 'United States',
    description: jd.description || jd.jobDescription || jd.text || jd.body || '',
    cleanText: pruneJdText(jd.description || jd.jobDescription || jd.text || jd.body || ''),
    index: idx,
  }))

  const analyzedJobs = []

  for (let i = 0; i < preparedJds.length; i += MICRO_BATCH_SIZE) {
    const batch = preparedJds.slice(i, i + MICRO_BATCH_SIZE)
    const batchNum = Math.floor(i / MICRO_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(preparedJds.length / MICRO_BATCH_SIZE)

    const formattedJobs = batch.map((item, bIdx) => {
      return `### Job #${bIdx + 1}: ${item.title} (${item.company})\n${item.cleanText}`
    }).join('\n\n---\n\n')

    const prompt = `You are an elite Talent Intelligence Engine specializing in recruitment and skills analysis across IT, Engineering, Healthcare, Finance, Marketing, and Operations.
Target Role: "${role}"
Batch: ${batch.length} live Job Descriptions.

TASK:
For EACH job description in this batch, extract:
1. "skills": High-leverage, concrete domain skills required for "${role}".
   - If IT / Software / Data: Extract programming languages, frameworks, cloud platforms, databases, dev tools, and technical methodologies.
   - If Healthcare / Clinical: Extract clinical competencies, EHR systems (Epic, Cerner), medical procedures, patient assessment, and compliance (HIPAA, BLS, ACLS).
   - If Finance / Accounting: Extract financial modeling, ERP systems (SAP, Oracle, NetSuite), valuation methods (DCF, LBO), accounting standards (GAAP, IFRS), and tools (Bloomberg, Excel).
   - If Marketing / Sales / Operations: Extract core platforms (Salesforce, HubSpot, Google Ads), marketing tech, analytics tools, CRM, and domain methodologies.
   - For ANY profession: Extract real tools, software, regulatory standards, and concrete operational methodologies.

STRICT NEGATIVE CONSTRAINTS (NEVER EXTRACT AS SKILLS):
- NEVER extract locations, state/country codes (e.g., "UK", "CA", "US", "NY", "Remote", "Hybrid").
- NEVER extract job board metadata, disclaimers, or labels (e.g., "AI-generated", "Job description", "Equal Opportunity", "Benefits").
- NEVER extract concatenated sentence fragments or section headers (e.g., "OverviewWe", "OpportunityWe", "PositionWe").
- DO NOT extract generic non-domain filler or vague nouns (e.g., "insights", "solutions", "environment", "server", "data").
- DO NOT extract generic soft skills (e.g. communication, teamwork, leadership).

2. "responsibilities": 2 to 4 concise, action-oriented core responsibilities for "${role}".
3. "senioritySignals": 1 to 3 seniority signals or experience requirements.

OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "jobs": [
    {
      "jobIndex": 1,
      "skills": ["Domain Skill 1", "Domain Skill 2", "Software / Framework 3"],
      "responsibilities": ["Action-oriented core responsibility 1", "Core responsibility 2"],
      "senioritySignals": ["Experience requirement 1", "Seniority signal 2"]
    }
  ]
}

JOB DESCRIPTIONS IN BATCH:
${formattedJobs}`

    try {
      console.log(`[LlmJdAnalyzer] Processing micro-batch ${batchNum}/${totalBatches} (${batch.length} JDs)...`)
      const response = await aiGateway.execute({
        provider: 'gemini',
        preferredProvider: 'openrouter',
        model: 'google/gemini-3.5-flash-lite',
        systemPrompt: 'You are an expert talent taxonomy engine. Extract skills, responsibilities, and seniority signals strictly adhering to the JSON schema. No fluff, no markdown fences.',
        prompt,
        temperature: 0.1,
        responseFormat: 'json',
        stage: 'MARKET_JD_DYNAMIC_ANALYSIS',
        timeoutMs: 35000,
      })

      const rawOutput = response?.content || response?.text || response
      const parsedJson = parseLlmJson(rawOutput)
      const extractedJobsList = Array.isArray(parsedJson?.jobs)
        ? parsedJson.jobs
        : (Array.isArray(parsedJson) ? parsedJson : [])

      batch.forEach((item, bIdx) => {
        const found = extractedJobsList.find((ej) => ej.jobIndex === bIdx + 1) || extractedJobsList[bIdx] || {}
        const rawSkills = Array.isArray(found.skills) ? found.skills : []
        const rawResps = Array.isArray(found.responsibilities) ? found.responsibilities : []
        const rawSeniority = Array.isArray(found.senioritySignals) ? found.senioritySignals : []

        // Fallback per-job if LLM missed it
        const effectiveSkills = rawSkills.length > 0
          ? rawSkills.map(normalizeCanonicalSkill).filter((s) => s && isConcreteTechSkill(s))
          : extractSkillsFromJd(item.cleanText).filter(isConcreteTechSkill)

        const effectiveResps = rawResps.length > 0
          ? rawResps.map((r) => String(r).trim()).filter(Boolean)
          : extractResponsibilitiesFromJd(item.cleanText)

        const effectiveSeniority = rawSeniority.length > 0
          ? rawSeniority.map((s) => String(s).trim()).filter(Boolean)
          : extractSenioritySignalsFromJd(item.cleanText)

        analyzedJobs.push({
          ...item.rawJob,
          title: item.title,
          company: item.company,
          location: item.location,
          description: item.description,
          normalizedDescription: item.cleanText,
          skills: Array.from(new Set(effectiveSkills)),
          responsibilities: Array.from(new Set(effectiveResps)),
          senioritySignals: Array.from(new Set(effectiveSeniority)),
        })
      })
    } catch (err) {
      console.warn(`[LlmJdAnalyzer] Micro-batch ${batchNum} LLM extraction failed: ${err.message}. Using deterministic fallback.`)
      batch.forEach((item) => {
        const fallbackSkills = extractSkillsFromJd(item.cleanText).filter(isConcreteTechSkill)
        const fallbackResps = extractResponsibilitiesFromJd(item.cleanText)
        const fallbackSeniority = extractSenioritySignalsFromJd(item.cleanText)

        analyzedJobs.push({
          ...item.rawJob,
          title: item.title,
          company: item.company,
          location: item.location,
          description: item.description,
          normalizedDescription: item.cleanText,
          skills: Array.from(new Set(fallbackSkills)),
          responsibilities: Array.from(new Set(fallbackResps)),
          senioritySignals: Array.from(new Set(fallbackSeniority)),
        })
      })
    }
  }

  // Step 1.5: Jev System One Decision Filter
  const allExtractedCandidates = Array.from(new Set(
    analyzedJobs.flatMap((j) => j.skills || [])
  ))
  const { validSkills: jevApprovedSkills } = await classifySkillsWithJev(allExtractedCandidates, role)
  const jevApprovedSet = new Set(jevApprovedSkills.map((s) => s.toLowerCase()))

  // Step 2: Deterministic Mathematical Aggregation (100% Accurate Counting)
  const skillOccurrences = new Map()
  const respOccurrences = new Map()
  const seniorityOccurrences = new Map()

  for (const job of analyzedJobs) {
    const jobSkills = new Set((job.skills || [])
      .map((s) => normalizeCanonicalSkill(s) || s)
      .filter((s) => s && isConcreteTechSkill(s) && jevApprovedSet.has(s.toLowerCase()))
    )
    for (const skill of jobSkills) {
      if (!isConcreteTechSkill(skill)) continue
      if (/^(into|your|our|us|position|overview|senior|insights?|server|data|it)$/i.test(skill)) continue
      const lower = skill.toLowerCase()
      if (isSenior && INTERN_OR_ENTRY_LEVEL_SKILLS.has(lower)) continue
      if (!skillOccurrences.has(lower)) {
        skillOccurrences.set(lower, {
          canonicalName: skill,
          category: 'tool',
          count: 0,
        })
      }
      skillOccurrences.get(lower).count += 1
    }

    const jobResps = new Set((job.responsibilities || []).map((r) => String(r).trim()).filter(Boolean))
    for (const resp of jobResps) {
      const lower = resp.toLowerCase()
      if (!respOccurrences.has(lower)) {
        respOccurrences.set(lower, { name: resp, count: 0 })
      }
      respOccurrences.get(lower).count += 1
    }

    const jobSeniority = new Set((job.senioritySignals || []).map((s) => String(s).trim()).filter(Boolean))
    for (const sig of jobSeniority) {
      const lower = sig.toLowerCase()
      if (!seniorityOccurrences.has(lower)) {
        seniorityOccurrences.set(lower, { name: sig, count: 0 })
      }
      seniorityOccurrences.get(lower).count += 1
    }
  }

  const marketSkills = Array.from(skillOccurrences.values())
    .map((s) => {
      const percentage = Math.round((s.count / totalJds) * 100)
      const priority = percentage >= 40 ? 'HIGH' : percentage >= 20 ? 'MEDIUM' : 'LOW'
      return {
        name: s.canonicalName,
        category: s.category,
        count: s.count,
        frequency: s.count,
        percentage,
        frequencyRatio: Math.round((s.count / totalJds) * 100) / 100,
        priority,
        requiredCount: s.count,
        preferredCount: 0,
      }
    })
    .sort((a, b) => b.frequency - a.frequency || b.percentage - a.percentage)

  const responsibilities = Array.from(respOccurrences.values())
    .map((r) => ({
      name: r.name,
      frequency: r.count,
      frequencyRatio: Math.round((r.count / totalJds) * 100) / 100,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 15)

  const senioritySignals = Array.from(seniorityOccurrences.values())
    .map((s) => ({
      name: s.name,
      frequency: s.count,
      frequencyRatio: Math.round((s.count / totalJds) * 100) / 100,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10)

  console.log(`[LlmJdAnalyzer] ✔ Analysis complete: Discovered ${marketSkills.length} market skills across ${totalJds} JDs.`)

  return {
    discoveredSkills: marketSkills,
    marketSkills,
    responsibilities,
    senioritySignals,
    analyzedJobs,
    sampleSize: totalJds,
    totalAnalyzed: totalJds,
    analyzedAt: new Date().toISOString(),
    method: 'scalable_micro_batch_gemini',
  }
}

/**
 * Backward-compatible entrypoint: Analyzes an entire pool of JDs and produces a normalized skill matrix.
 */
export async function analyzeAndAggregateJdCorpus(rawJds = [], bucketKey = '') {
  if (!Array.isArray(rawJds) || rawJds.length === 0) {
    return {
      totalAnalyzed: 0,
      marketSkills: [],
      discoveredSkills: [],
      responsibilities: [],
      senioritySignals: [],
      analyzedJobs: [],
      sampleSize: 0,
    }
  }

  const [roleKey, expPart] = (bucketKey || '').split('::')
  const roleClean = (rawJds[0]?.title || roleKey || 'Professional')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return await analyzeJdBatchWithGemini(roleClean, rawJds, { experienceBucket: expPart || '3-5' })
}

export default {
  SKILL_EXTRACTION_SYSTEM_PROMPT,
  buildSkillExtractionUserMessage,
  TAXONOMY_NORMALIZER_SYSTEM_PROMPT,
  buildTaxonomyNormalizerUserMessage,
  CANONICAL_SYNONYMS,
  TAXONOMY_CANONICAL_CACHE,
  normalizeCanonicalSkill,
  extractSkillsFromSingleJd,
  normalizeTaxonomyWithLLM,
  analyzeJdBatch,
  analyzeAndAggregateJdCorpus,
  buildBatchJdExtractionPrompt,
  extractSkillsFromBatch1Shot,
  pruneJdText,
  analyzeJdBatchWithGemini,
  fallbackCorpusExtraction,
}
