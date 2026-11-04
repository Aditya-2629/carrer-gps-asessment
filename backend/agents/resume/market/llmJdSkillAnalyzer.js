/**
 * LLM-Powered JD Analyzer & Canonical Skill Normalizer — Career GPS Market Intelligence
 *
 * Analyzes scraped Job Descriptions in compact batches of 10 to extract genuine technical
 * skills, libraries, frameworks, cloud services, and technical methodologies.
 * Eliminates English noise, prepositions, and generic words.
 * Canonically normalizes synonyms (e.g. "Postgres" -> "PostgreSQL", "PowerBI" -> "Power BI")
 * and computes exact occurrence frequencies and market percentages across postings.
 */

import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { jsonrepair } from 'jsonrepair'
import { isConcreteTechSkill } from './dynamicSkillExtractor.js'
import { extractSkillsFromJd } from './jdNormalizer.js'

export const BATCH_SIZE = 10

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
  'react': 'React',
  'react.js': 'React',
  'reactjs': 'React',
  'node': 'Node.js',
  'node.js': 'Node.js',
  'nodejs': 'Node.js',
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

export const JD_ANALYSIS_SYSTEM_PROMPT = `You are a Principal Talent Intelligence & ATS Skills Architect.
Your task is to analyze raw Job Descriptions and extract all required technical skills, platforms, libraries, programming languages, databases, cloud services, and technical methodologies.

CRITICAL NORMALIZATION RULES:
1. Extract ONLY concrete technical tools, software, platforms, libraries, languages, and technical methodologies.
2. NEVER extract English prepositions, pronouns, job levels, or generic nouns (e.g. NEVER extract "into", "your", "position", "overview", "senior", "insights", "server", "US", "data", "IT").
3. CANONICAL NORMALIZATION: Normalize synonyms into their single industry standard canonical name:
   - "Postgres" / "Postgre SQL" -> "PostgreSQL"
   - "PowerBI" / "MS Power BI" / "Power-BI" -> "Power BI"
   - "AWS" / "Amazon Web Services" -> "AWS"
   - "GCP" / "Google Cloud Platform" -> "Google Cloud"
   - "BigQuery" / "Google BigQuery" -> "BigQuery"
   - "dbt" / "DBT Core" -> "dbt"
   - "React.js" / "ReactJS" -> "React"
   - "Node.js" / "NodeJS" -> "Node.js"
   - "Kube" / "K8s" -> "Kubernetes"
4. Assign each skill to a canonical category:
   - "languages"
   - "cloud_devops"
   - "database_warehousing"
   - "bi_visualization"
   - "data_engineering"
   - "ai_ml"
   - "methodologies_processes"

OUTPUT FORMAT (JSON ONLY):
{
  "analyzedJobs": [
    {
      "jobIndex": 0,
      "skills": [
        { "canonicalName": "SQL", "category": "database_warehousing" },
        { "canonicalName": "Power BI", "category": "bi_visualization" },
        { "canonicalName": "Snowflake", "category": "database_warehousing" }
      ]
    }
  ]
}`

/**
 * Normalizes a raw skill string to its canonical industry name
 */
export function normalizeCanonicalSkill(rawName = '') {
  if (!rawName || typeof rawName !== 'string') return null
  const trimmed = rawName.trim()
  if (trimmed.length < 2) return null

  const lower = trimmed.toLowerCase()
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
 * Analyzes a batch of JDs via Fast LLM Gateway (Groq / OpenRouter)
 */
export async function analyzeJdBatch(jobsBatch = [], startIndex = 0) {
  const formattedJds = jobsBatch
    .map((job, idx) => {
      const title = job.title || 'Untitled'
      const company = job.company || 'Unknown'
      const desc = (job.description || job.text || job.normalizedDescription || '').slice(0, 1500)
      return `--- JOB #${startIndex + idx} (${title} at ${company}) ---\n${desc}\n`
    })
    .join('\n')

  try {
    const response = await llmGateway.generate({
      purpose: 'market_jd_analysis',
      preferredProvider: 'groq',
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: JD_ANALYSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze these ${jobsBatch.length} Job Descriptions and extract canonical technical skills:\n\n${formattedJds}`,
        },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.1,
      maxTokens: 2500,
      timeoutMs: 30000,
    })

    const raw = response?.text || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = JSON.parse(jsonrepair(raw))
    }

    return parsed?.analyzedJobs || []
  } catch (err) {
    console.warn(`[LlmJdAnalyzer] Batch ${startIndex} extraction via Groq failed, attempting OpenRouter:`, err.message)
    try {
      const response = await llmGateway.generate({
        purpose: 'market_jd_analysis',
        preferredProvider: 'openrouter',
        model: 'google/gemini-3.5-flash',
        messages: [
          { role: 'system', content: JD_ANALYSIS_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze these ${jobsBatch.length} Job Descriptions and extract canonical technical skills:\n\n${formattedJds}`,
          },
        ],
        responseFormat: { type: 'json_object' },
        temperature: 0.1,
        maxTokens: 2500,
        timeoutMs: 30000,
      })
      const raw = response?.text || '{}'
      return JSON.parse(jsonrepair(raw))?.analyzedJobs || []
    } catch (openRouterErr) {
      console.warn(`[LlmJdAnalyzer] Batch ${startIndex} OpenRouter extraction also failed:`, openRouterErr.message)
      // Heuristic fallback for offline / test environments
      return jobsBatch.map((job, idx) => {
        const rawSkills = job.skills || extractSkillsFromJd(job.description || job.text || job.normalizedDescription || '')
        const skills = rawSkills
          .map((s) => ({ canonicalName: normalizeCanonicalSkill(s) || s, category: 'tools' }))
          .filter((item) => Boolean(item.canonicalName))
        return {
          jobIndex: startIndex + idx,
          skills,
        }
      })
    }
  }
}

/**
 * Analyzes an entire pool of scraped JDs (e.g. 90-100 JDs),
 * computes exact frequency counts and percentages, and produces a normalized skill matrix.
 */
export async function analyzeAndAggregateJdCorpus(rawJds = [], bucketKey = '') {
  if (!Array.isArray(rawJds) || rawJds.length === 0) {
    return { totalAnalyzed: 0, marketSkills: [] }
  }

  const totalJds = rawJds.length
  const skillOccurrences = new Map() // canonicalName -> { count, category, canonicalName }

  console.log(`[LlmJdAnalyzer] Starting LLM batch analysis for ${totalJds} JDs in bucket "${bucketKey}"...`)

  // Process in batches of 10 to respect token limits
  for (let i = 0; i < totalJds; i += BATCH_SIZE) {
    const batch = rawJds.slice(i, i + BATCH_SIZE)
    const analyzedJobs = await analyzeJdBatch(batch, i)

    for (const jobResult of analyzedJobs) {
      const uniqueInJob = new Set()
      const jobSkills = jobResult?.skills || []

      for (const item of jobSkills) {
        const rawName = String(item.canonicalName || '').trim()
        const canonical = normalizeCanonicalSkill(rawName)
        if (!canonical || canonical.length < 2) continue

        // Extra guard: Disallow banned non-skill tokens
        if (/^(into|your|our|us|position|overview|senior|insights?|server|data|it)$/i.test(canonical)) continue

        const key = canonical.toLowerCase()
        if (!uniqueInJob.has(key)) {
          uniqueInJob.add(key)
          if (!skillOccurrences.has(key)) {
            skillOccurrences.set(key, {
              canonicalName: canonical,
              category: item.category || 'tools',
              count: 0,
            })
          }
          skillOccurrences.get(key).count += 1
        }
      }
    }
  }

  // Calculate percentages and sort descending by market demand
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
      }
    })
    .filter((s) => s.percentage >= 10) // Appears in at least 10% of market postings
    .sort((a, b) => b.percentage - a.percentage)

  console.log(
    `[LlmJdAnalyzer] Finished analysis for "${bucketKey}". Discovered ${marketSkills.length} unique canonical skills across ${totalJds} JDs.`
  )

  return {
    totalAnalyzed: totalJds,
    marketSkills,
    analyzedAt: new Date().toISOString(),
  }
}

