/**
 * LLM-Powered JD Analyzer & Canonical Skill Normalizer — Career GPS Market Intelligence
 *
 * Implements two-stage market intelligence pipeline:
 * Step 1: Skill Extraction (Per-JD Analysis) -> Extracts raw resume-worthy technical skills (required vs preferred).
 * Step 2: Taxonomy Normalization -> Maps raw terms to standardized canonical industry names or rejects noise ("").
 */

import { aiGateway, llmGateway } from '../../../ai/gateway/llmGateway.js'
import { jsonrepair } from 'jsonrepair'
import { isConcreteTechSkill } from './dynamicSkillExtractor.js'
import { extractSkillsFromJd } from './jdNormalizer.js'

export const BATCH_SIZE = 10

/**
 * Clean and prune JD text to remove boilerplate noise (EEO, benefits, culture)
 */
export function pruneJdText(text = '') {
  if (!text) return ''
  // Requirements / Qualifications / Tech Stack section dhoondhna
  const match = text.match(/(?:requirements|qualifications|skills|technical skills|what you'll need|responsibilities)[\s\S]{300,2500}/i)
  if (match) {
    return match[0].trim()
  }
  // Fallback: Pehle 1500 characters
  return text.slice(0, 1500).trim()
}

// --- 1. SKILL EXTRACTION PROMPT (PER-JD ANALYSIS) ---

export const SKILL_EXTRACTION_SYSTEM_PROMPT = `You are an expert technical recruiter and talent taxonomy engine. 
Analyze the provided Job Description and extract ONLY concrete, resume-worthy technical skills.

CATEGORIES TO EXTRACT:
- Programming languages & runtimes (e.g., Python, SQL, R, TypeScript)
- Frameworks & libraries (e.g., React, Pandas, PyTorch, Express)
- Databases & storage (e.g., PostgreSQL, MongoDB, Redis, Snowflake, BigQuery)
- Cloud platforms & infrastructure (e.g., AWS, Azure, GCP, Docker, Kubernetes)
- Developer tools & platforms (e.g., Git, Jira, Postman, Airflow)
- Methodologies (e.g., Agile, Scrum, CI/CD, ETL/ELT)
- Technical certifications (e.g., AWS SAA, PMP, Databricks Certified)

STRICT EXCLUSIONS:
- Soft skills (e.g., communication, problem-solving, leadership, collaboration)
- Job titles & seniority levels (e.g., Senior, Lead, Manager, Intern)
- Generic nouns / tech buzzwords (e.g., data, cloud, backend, insights, dashboard, software, server, scalability)
- Company names, benefits, education, and compensation details

RULES:
1. "required": Skills explicitly stated as mandatory, required, minimum qualifications, or essential.
2. "preferred": Skills stated as bonus, nice-to-have, preferred qualifications, or plus points.
3. Preserve the exact naming style as found in the text (do not guess normalization here).
4. Do not include any preambles, explanations, or Markdown fences.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "required": ["Python", "SQL", "Snowflake"],
  "preferred": ["Docker", "Airflow", "dbt"]
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
  const skillOccurrences = new Map()

  console.log(`[LlmJdAnalyzer] Running deterministic corpus extraction for ${totalJds} JDs (${role})...`)

  for (let i = 0; i < totalJds; i += BATCH_SIZE) {
    const batch = jds.slice(i, i + BATCH_SIZE)
    const analyzedJobs = await analyzeJdBatch(batch, i)

    for (const jobResult of analyzedJobs) {
      const uniqueInJob = new Set()
      const jobSkills = jobResult?.skills || []

      for (const item of jobSkills) {
        const canonical = item.canonicalName
        if (!canonical || canonical.length < 2) continue
        if (/^(into|your|our|us|position|overview|senior|insights?|server|data|it)$/i.test(canonical)) continue

        const key = canonical.toLowerCase()
        if (!uniqueInJob.has(key)) {
          uniqueInJob.add(key)
          if (!skillOccurrences.has(key)) {
            skillOccurrences.set(key, {
              canonicalName: canonical,
              category: item.category || 'tools',
              count: 0,
              requiredCount: 0,
              preferredCount: 0,
            })
          }
          const entry = skillOccurrences.get(key)
          entry.count += 1
          if (item.isRequired) entry.requiredCount += 1
          else entry.preferredCount += 1
        }
      }
    }
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
        requiredCount: s.requiredCount,
        preferredCount: s.preferredCount,
      }
    })
    .filter((s) => (totalJds <= 5 ? s.count >= 1 : (totalJds <= 35 ? s.count >= 2 : s.percentage >= 10)))
    .sort((a, b) => b.percentage - a.percentage || b.count - a.count)

  return {
    discoveredSkills: skills,
    marketSkills: skills,
    sampleSize: totalJds,
    totalAnalyzed: totalJds,
    analyzedAt: new Date().toISOString(),
    method: 'deterministic_fallback',
  }
}

/**
 * Single-pass batch analysis of JDs using Gemini Flash
 */
export async function analyzeJdBatchWithGemini(role = 'Professional', jds = []) {
  if (!jds || jds.length === 0) {
    return { discoveredSkills: [], marketSkills: [], sampleSize: 0, totalAnalyzed: 0 }
  }

  // JDs ko prune aur format karna
  const formattedJds = jds.map((jd, index) => {
    const rawText = jd.description || jd.jobDescription || jd.text || jd.body || ''
    const cleanText = pruneJdText(rawText)
    const title = jd.title || jd.jobTitle || role
    return `### Job #${index + 1}: ${title}\n${cleanText}`
  }).join('\n\n---\n\n')

  const systemInstruction = `You are an elite Technical Talent Intelligence Engine.
Analyze the provided batch of ${jds.length} live Job Descriptions for the target role: "${role}".

OBJECTIVE:
Extract hard technical skills, libraries, frameworks, cloud services, and tools with their exact frequency count across these JDs.

RULES:
1. Extract ONLY hard tech skills (e.g., "React", "Node.js", "Docker", "AWS", "PostgreSQL", "Kafka", "TypeScript").
2. DO NOT extract soft skills (e.g., "leadership", "communication", "teamwork", "problem solving").
3. Normalize canonical names (e.g., use "TypeScript" instead of "ts", "PostgreSQL" instead of "postgres").
4. "frequency" must represent the actual number of individual JDs that mention the skill.
5. Filter out skills with frequency < 2 if total JDs > 5.
6. Return strictly valid JSON object matching the schema below. No markdown fences.`

  const prompt = `${systemInstruction}

Target Role: "${role}"
Total JDs: ${jds.length}

JOB DESCRIPTIONS BATCH:
${formattedJds}

OUTPUT SCHEMA:
{
  "totalJdsAnalyzed": ${jds.length},
  "skills": [
    {
      "name": "Exact Canonical Skill Name",
      "frequency": <number>,
      "category": "language" | "framework" | "database" | "cloud" | "tool" | "architecture"
    }
  ]
}`

  try {
    console.log(`[LlmJdAnalyzer] Sending batch of ${jds.length} JDs to Gemini Flash...`)

    // Provider explicitly "gemini" aur model "gemini-1.5-flash" ya "gemini-3.5-flash-lite"
    const response = await aiGateway.execute({
      provider: 'gemini',
      preferredProvider: 'openrouter',
      model: 'google/gemini-3.5-flash-lite',
      systemPrompt: systemInstruction,
      prompt: prompt,
      temperature: 0.1,
      responseFormat: 'json',
      stage: 'MARKET_JD_DYNAMIC_ANALYSIS',
      timeoutMs: 40000,
    })

    let resultJson = null
    const rawOutput = response?.content || response?.text || response

    if (typeof rawOutput === 'object' && rawOutput?.skills) {
      resultJson = rawOutput
    } else {
      // Clean string JSON parsing
      const cleaned = String(rawOutput || '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim()
      try {
        resultJson = JSON.parse(cleaned)
      } catch (_jsonErr) {
        resultJson = JSON.parse(jsonrepair(cleaned || '{}'))
      }
    }

    const skills = (resultJson?.skills || []).map((s) => {
      const canonical = normalizeCanonicalSkill(s.name) || s.name
      const rawCount = parseInt(s.frequency || s.count, 10) || 1
      const count = Math.min(jds.length, Math.max(1, rawCount))
      const percentage = Math.round((count / jds.length) * 100)
      const priority = percentage >= 40 ? 'HIGH' : percentage >= 20 ? 'MEDIUM' : 'LOW'
      return {
        name: canonical,
        frequency: count,
        count,
        percentage,
        priority,
        category: s.category || 'tool',
        requiredCount: count,
        preferredCount: 0,
      }
    }).filter((s) => s.name && !/^(into|your|our|us|position|overview|senior|insights?|server|data|it)$/i.test(s.name))

    // Highest frequency pehle sort karein
    skills.sort((a, b) => b.frequency - a.frequency || b.percentage - a.percentage)

    if (skills.length === 0) {
      throw new Error('Zero valid skills returned from Gemini batch extraction.')
    }

    console.log(`[LlmJdAnalyzer] Successfully discovered ${skills.length} dynamic skills via Gemini Flash.`)
    return {
      discoveredSkills: skills,
      marketSkills: skills,
      sampleSize: jds.length,
      totalAnalyzed: jds.length,
    }

  } catch (error) {
    console.error(`[LlmJdAnalyzer] Gemini extraction failed:`, error.message)
    console.warn(`[LlmJdAnalyzer] Falling back to deterministic corpus extraction for ${jds.length} JDs...`)
    return await fallbackCorpusExtraction(jds, role)
  }
}

/**
 * Backward-compatible entrypoint: Analyzes an entire pool of JDs and produces a normalized skill matrix.
 */
export async function analyzeAndAggregateJdCorpus(rawJds = [], bucketKey = '') {
  if (!Array.isArray(rawJds) || rawJds.length === 0) {
    return { totalAnalyzed: 0, marketSkills: [], discoveredSkills: [], sampleSize: 0 }
  }

  const [roleKey] = (bucketKey || '').split('::')
  const roleClean = (rawJds[0]?.title || roleKey || 'Professional')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return await analyzeJdBatchWithGemini(roleClean, rawJds)
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
