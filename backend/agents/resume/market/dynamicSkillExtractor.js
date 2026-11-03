import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { jsonrepair } from 'jsonrepair'
import crypto from 'crypto'
import natural from 'natural'
import { recordLearningSignal } from './marketLearning.js'

// In-memory LRU cache to prevent repeated LLM calls on identical JD texts
export const JD_SKILL_CACHE = new Map()
export const MAX_CACHE_SIZE = 500

export function clearJdSkillCache() {
  JD_SKILL_CACHE.clear()
}

export const COMMON_STOP_WORDS = new Set([
  'and', 'the', 'with', 'for', 'you', 'will', 'are', 'have', 'our', 'team',
  'experience', 'years', 'work', 'working', 'ability', 'skills', 'role',
  'candidate', 'business', 'company', 'strong', 'equal', 'opportunity',
  'requirements', 'preferred', 'qualifications', 'including', 'across',
  'demonstrated', 'proficient', 'knowledge', 'responsibilities', 'duties',
  'bachelor', 'master', 'degree', 'computer', 'science', 'engineering',
  'written', 'verbal', 'communication', 'problem', 'solving', 'environment',
  'engineer', 'analyst', 'developer', 'specialist', 'manager', 'lead',
  'looking', 'join', 'help', 'build', 'create', 'support', 'high', 'quality',
  'collaborate', 'partners', 'stakeholders', 'teams', 'solutions', 'systems'
])

export const DYNAMIC_EXTRACTOR_SYSTEM_PROMPT = `You are a Universal ATS Skill & Technology Extractor.
Your job is to read raw Job Description text from ANY industry domain (SWE, Data Analytics, Generative AI, Healthcare, Embedded, Salesforce, Finance, Biotech, etc.) and extract all specific technical skills, tools, frameworks, languages, and methodologies required.

RULES:
1. Extract ONLY concrete tools, languages, software, platforms, libraries, cloud services, and technical methodologies.
2. DO NOT extract generic soft skills or vague nouns (e.g. "team player", "leadership", "communication", "fast-paced", "passion").
3. Preserve canonical casing (e.g., "FastMCP", "dbt", "LangGraph", "Power BI", "PostgreSQL", "Nextflow", "Apex", "PyTorch").
4. Assign each tool to one of these semantic categories:
   - "languages_frameworks" (programming languages, web/app frameworks)
   - "cloud_devops" (AWS, Docker, CI/CD, K8s, infra)
   - "database_data" (SQL, Snowflake, BigQuery, dbt, Spark, ETL, warehouses)
   - "messaging_streaming" (Kafka, Redis, RabbitMQ, SQS, event buses)
   - "ai_ml" (RAG, LLMs, PyTorch, LangChain, computer vision, NLP)
   - "testing_quality" (Jest, PyTest, Cypress, Selenium, TDD)
   - "domain_specialized" (Tools unique to domain, e.g. Epic EHR, SAP S/4HANA, Simulink, AutoCAD)

OUTPUT FORMAT (JSON ONLY):
{
  "skills": [
    { "name": "FastMCP", "category": "ai_ml" },
    { "name": "Python", "category": "languages_frameworks" },
    { "name": "Kafka", "category": "messaging_streaming" }
  ],
  "seniority": "Senior",
  "minYears": 4
}`

/**
 * Assigns a semantic category based on known heuristics when LLM is bypassed
 */
export function assignHeuristicCategory(skill = '') {
  const low = String(skill || '').toLowerCase()
  if (/kafka|redis|rabbitmq|sqs|sns|pub\/sub|celery|event/i.test(low)) return 'messaging_streaming'
  if (/aws|azure|gcp|docker|kubernetes|k8s|ci\/cd|terraform|helm|ansible|devops/i.test(low)) return 'cloud_devops'
  if (/sql|snowflake|bigquery|dbt|spark|postgres|mongo|database|etl|warehouse/i.test(low)) return 'database_data'
  if (/test|jest|pytest|cypress|selenium|tdd|qa/i.test(low)) return 'testing_quality'
  if (/rag|llm|langchain|langgraph|fastmcp|vllm|pytorch|tensorflow|chromadb|ai|ml|nlp|vision/i.test(low)) return 'ai_ml'
  if (/epic|ehr|hl7|fhir|sap|s\/4hana|biopython|nextflow|gatk|blast|simulink|autocad|salesforce|apex/i.test(low)) return 'domain_specialized'
  return 'languages_frameworks'
}

/**
 * Extracts skills dynamically from JD text via Fast LLM Gateway (Gemini Flash / Groq)
 * with in-memory caching, self-learning persistence, and heuristic fallback.
 */
export async function extractSkillsDynamically(jdText = '', options = {}) {
  if (!jdText || typeof jdText !== 'string' || jdText.trim().length < 30) {
    return { skills: [], categories: {}, seniority: 'Mid-Level', minYears: 0, source: 'empty_input' }
  }

  const cleanText = jdText.slice(0, 4000).trim()
  const hash = crypto.createHash('md5').update(cleanText).digest('hex')

  // Check cache first (0ms, 0 cost)
  if (JD_SKILL_CACHE.has(hash)) {
    return JD_SKILL_CACHE.get(hash)
  }

  // Tier 1: Fast LLM Structured Extraction
  if (!options.bypassLLM) {
    try {
      const response = await llmGateway.generate({
        purpose: 'resume-parsing',
        model: options.model || 'gemini-3.5-flash-lite',
        messages: [
          { role: 'system', content: DYNAMIC_EXTRACTOR_SYSTEM_PROMPT },
          { role: 'user', content: `Extract technical skills and tools from this Job Description:\n\n${cleanText}` },
        ],
        temperature: 0.1,
        maxTokens: 1500,
        responseFormat: { type: 'json_object' },
        preferredProvider: 'gemini',
      })

      const rawJson = response?.text || '{}'
      let parsed = null
      try {
        parsed = JSON.parse(rawJson)
      } catch {
        parsed = JSON.parse(jsonrepair(rawJson))
      }

      if (parsed && Array.isArray(parsed.skills) && parsed.skills.length > 0) {
        const categories = {}
        const skillNames = []

        parsed.skills.forEach((s) => {
          const name = (typeof s === 'string' ? s : s?.name || '').trim()
          const cat = s?.category || 'languages_frameworks'
          if (name && name.length >= 2 && name.length <= 35) {
            skillNames.push(name)
            categories[name.toLowerCase()] = cat
          }
        })

        const result = {
          skills: Array.from(new Set(skillNames)),
          categories,
          seniority: parsed.seniority || 'Mid-Level',
          minYears: parsed.minYears || 0,
          source: 'dynamic_llm',
        }

        // Cache result (LRU eviction if at limit)
        if (JD_SKILL_CACHE.size >= MAX_CACHE_SIZE) {
          const firstKey = JD_SKILL_CACHE.keys().next().value
          JD_SKILL_CACHE.delete(firstKey)
        }
        JD_SKILL_CACHE.set(hash, result)

        // Tier 2: Self-Learning Persistence (Async background record to LearningSignal)
        if (options.roleKey) {
          Promise.all(
            result.skills.slice(0, 5).map((sk) =>
              recordLearningSignal({
                signalType: 'MARKET_SKILL_TREND',
                roleKey: options.roleKey,
                experienceBucket: options.experienceBucket || 'all',
                signal: sk,
                evidence: { jdSnippet: cleanText.slice(0, 200) },
                confidence: 0.9,
                source: 'dynamic_skill_extractor',
              }).catch(() => {})
            )
          ).catch(() => {})
        }

        return result
      }
    } catch (llmErr) {
      console.warn('[DynamicSkillExtractor] LLM extraction fallback to heuristic:', llmErr.message)
    }
  }

  // Tier 3: Deterministic Heuristic Fallback (Capitalized Tech N-Gram & Acronym Extractor)
  const heuristicResult = extractSkillsHeuristically(cleanText)
  
  // Cache heuristic fallback as well
  if (JD_SKILL_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = JD_SKILL_CACHE.keys().next().value
    JD_SKILL_CACHE.delete(firstKey)
  }
  JD_SKILL_CACHE.set(hash, heuristicResult)

  return heuristicResult
}

/**
 * Deterministic Heuristic Extractor:
 * Finds capitalized technical terms, acronyms (2-6 uppercase letters), camelCase words,
 * technical compounds, and known patterns without requiring rigid static single-domain lists.
 */
export function extractSkillsHeuristically(text = '') {
  if (!text || typeof text !== 'string') {
    return {
      skills: [],
      categories: {},
      seniority: 'Mid-Level',
      minYears: 0,
      source: 'heuristic_fallback',
    }
  }

  const found = new Set()
  const categories = {}

  // 1. Acronyms & technical abbreviations (e.g. AWS, GCP, SQL, ETL, RAG, API, SDK, dbt, K8s, FHIR, HL7, GATK, BLAST)
  const acronymMatches = text.match(/\b[A-Z]{2,6}\b|\b[a-z][A-Z0-9]+\b|\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b|\b[A-Z]{1,5}\d{1,4}\b/g) || []
  for (const acr of acronymMatches) {
    if (!COMMON_STOP_WORDS.has(acr.toLowerCase()) && acr.length >= 2) {
      found.add(acr)
      categories[acr.toLowerCase()] = assignHeuristicCategory(acr)
    }
  }

  // 2. Technical pattern captures (e.g. Node.js, Next.js, .NET, C++, C#, CI/CD, Power BI, REST APIs)
  const patternMatches = text.match(/\b(?:[A-Za-z0-9]+(?:\.[a-z]{2,4})|\.NET|C\+\+|C#|CI\/CD|Power\s+BI|REST(?:ful)?\s+APIs?)\b/gi) || []
  for (const pat of patternMatches) {
    const trimmed = pat.trim()
    if (!COMMON_STOP_WORDS.has(trimmed.toLowerCase())) {
      found.add(trimmed)
      categories[trimmed.toLowerCase()] = assignHeuristicCategory(trimmed)
    }
  }

  // 3. Technical compounds & specialized suffixes (e.g. Biopython, Nextflow, ChromaDB, LangGraph)
  const compoundMatches = text.match(/\b[A-Z][a-z]*(?:flow|python|db|sql|graph|mcp|hub|lab|script|box|base|stack)\b/gi) || []
  for (const cmp of compoundMatches) {
    const trimmed = cmp.trim()
    if (!COMMON_STOP_WORDS.has(trimmed.toLowerCase()) && trimmed.length >= 3) {
      found.add(trimmed)
      categories[trimmed.toLowerCase()] = assignHeuristicCategory(trimmed)
    }
  }

  // 4. Two-word capitalized domain platforms (e.g. Epic Systems, Apache Spark, Google Cloud)
  const twoWordMatches = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || []
  for (const phrase of twoWordMatches) {
    const low = phrase.toLowerCase()
    const words = low.split(/\s+/)
    if (/systems|platform|cloud|analytics|database|studio|bi|engine|services/i.test(words[1]) && !COMMON_STOP_WORDS.has(words[0])) {
      found.add(phrase.trim())
      categories[low] = assignHeuristicCategory(phrase)
    }
  }

  // 5. Well-known base languages & core tech when present in text
  const coreTech = ['python', 'java', 'sql', 'docker', 'kubernetes', 'git', 'snowflake', 'tableau', 'excel', 'spark', 'kafka', 'redis', 'airflow', 'dbt']
  const lowerText = text.toLowerCase()
  for (const ct of coreTech) {
    const rx = new RegExp(`\\b${ct}\\b`, 'i')
    if (rx.test(lowerText)) {
      const canon = ct.charAt(0).toUpperCase() + ct.slice(1)
      const name = canon === 'Sql' ? 'SQL' : canon
      found.add(name)
      categories[ct] = assignHeuristicCategory(ct)
    }
  }

  return {
    skills: Array.from(found).slice(0, 30),
    categories,
    seniority: 'Mid-Level',
    minYears: 0,
    source: 'heuristic_fallback',
  }
}

export default {
  extractSkillsDynamically,
  extractSkillsHeuristically,
  assignHeuristicCategory,
  DYNAMIC_EXTRACTOR_SYSTEM_PROMPT,
  JD_SKILL_CACHE,
  clearJdSkillCache,
}
