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

export const BANNED_GENERIC_WORDS = new Set([
  // Prepositions & Pronouns
  'into', 'your', 'our', 'their', 'his', 'her', 'its', 'us', 'we', 'you', 'them',
  'with', 'from', 'about', 'above', 'below', 'under', 'over', 'across', 'through',
  // Common sentence openers & generic business nouns
  'overview', 'position', 'role', 'insights', 'insight', 'server', 'servers',
  'senior', 'junior', 'lead', 'staff', 'principal', 'intern', 'entry', 'level',
  'candidate', 'applicant', 'requirements', 'qualifications', 'responsibilities',
  'opportunity', 'company', 'organization', 'client', 'stakeholders', 'teams',
  'experience', 'years', 'working', 'ability', 'skills', 'knowledge', 'understanding',
  'solutions', 'environment', 'business', 'process', 'management', 'delivery',
  'data', 'it', 'ai', 'bi', 'information', 'technology', 'system', 'systems',
  'desktop', 'mobile', 'web', 'application', 'applications', 'platform', 'platforms',
  'pipeline', 'pipelines', 'dashboard', 'dashboards', 'report', 'reports', 'reporting',
  'development', 'developer', 'engineer', 'analyst', 'specialist', 'manager',
  'high', 'scale', 'fast', 'deep', 'strong', 'solid', 'proven', 'excellent',
  'good', 'great', 'best', 'well', 'such', 'other', 'various', 'relevant',
  'description', 'analytics', 'employer', 'competitive', 'salary', 'benefits',
  'health', 'dental', 'vision', 'hands', 'performing',
  // Additional stop words & action verbs
  'and', 'the', 'for', 'will', 'are', 'have', 'work', 'join', 'help', 'build', 'create', 'support',
  'bachelor', 'master', 'degree', 'computer', 'science', 'engineering', 'written', 'verbal',
  'communication', 'problem', 'solving', 'equal', 'preferred', 'demonstrated', 'proficient',
  'proficiency', 'must', 'should', 'can', 'may', 'collaborate', 'collaborating', 'collaboration',
  'require', 'required', 'requiring', 'plus', 'including', 'include', 'includes', 'familiar',
  'familiarity', 'expertise', 'deliver', 'delivering', 'ensure', 'ensuring', 'maintain', 'maintaining'
])

export const ALLOWED_LOWERCASE_TOOLS = new Set([
  'sql', 'aws', 'gcp', 'dbt', 'git', 'r', 'sas', 'etl', 'elt', 'dax',
  'python', 'java', 'react', 'vue', 'node', 'scala', 'rust', 'redis', 'kafka', 'spark', 'linux', 'c', 'c++', 'c#'
])

/**
 * Strict Technical Entity Validation
 * Validates whether a token represents a real concrete technical skill, library, framework, or tool
 * rather than an English stop word, pronoun, preposition, or generic business noun.
 */
export function isConcreteTechSkill(token) {
  if (!token || typeof token !== 'string') return false
  let clean = token.trim()

  // Strip leading/trailing conjunctions or prepositions if phrase was captured
  clean = clean.replace(/^(?:and|or|with|as\s+well\s+as|in|the|a|an|of|for|to)\s+/i, '').trim()
  clean = clean.replace(/\s+(?:and|or|with|in|the|platforms?|tools?|systems?)$/i, '').trim()

  const low = clean.toLowerCase()

  // Length limits
  if (clean.length < 2 || clean.length > 35) return false

  // Pure digits or punctuation
  if (/^\d+$/.test(clean) || /^[^a-zA-Z0-9]+$/.test(clean)) return false

  // Disallow hyphenated ordinary English words (e.g. high-performing, well-known, fast-paced, day-to-day)
  if (clean.includes('-')) {
    if (/^(?:high|low|fast|slow|well|end|day|multi|cross|user|client|customer|self|in|out|on|off)-/i.test(clean) &&
        !/^(?:ci-cd|scikit-learn|spring-boot|react-native|angular-cli|node-cron)$/i.test(clean)) {
      return false
    }
  }

  // Specifically block common non-skill two-letter uppercase/lowercase words
  if (/^(?:us|it|at|or|in|to|do|as|by|on|if|is|be|an|am|so|no|my|he|we)$/i.test(clean)) {
    return false
  }

  // Banned generic words & prepositions
  if (BANNED_GENERIC_WORDS.has(low)) return false

  // Disallow single generic lowercase words without punctuation or digits
  // (True tools usually have camelCase, uppercase acronyms, dots/plus, or are known tech names)
  if (/^[a-z]{2,8}$/.test(clean) && !ALLOWED_LOWERCASE_TOOLS.has(low)) {
    return false
  }

  // Block capitalized ordinary English verbs/adjectives that are not tools
  if (/^[A-Z][a-z]{2,15}$/.test(clean) && !ALLOWED_LOWERCASE_TOOLS.has(low)) {
    if (
      BANNED_GENERIC_WORDS.has(low) ||
      /^(?:must|should|could|would|can|may|will|have|has|had|been|were|was|are|is|collaborate|participate|contribute|deliver|ensure|support|provide|maintain|develop|build|create|manage|lead|drive|execute|work|join|learn|grow|thrive|excel)$/i.test(low)
    ) {
      return false
    }
  }

  // Multi-word phrase validation
  const words = clean.split(/\s+/)
  if (words.length > 1) {
    const allowedPhrases = new Set([
      'ruby on rails', 'power bi', 'power apps', 'power automate', 'google cloud',
      'amazon web services', 'apache spark', 'apache kafka', 'apache flink', 'apache airflow',
      'apache cassandra', 'apache camel', 'spring boot', 'react native', 'rest api', 'rest apis',
      'epic systems', 'sql server', 'big query', 'ci cd', 'ci/cd', 'scikit learn'
    ])
    if (!allowedPhrases.has(low)) {
      const stopWordsInPhrase = [
        'into', 'your', 'our', 'their', 'his', 'her', 'its', 'us', 'we', 'you', 'them',
        'in', 'on', 'at', 'to', 'for', 'from', 'with', 'by', 'about', 'across', 'through',
        'the', 'a', 'an', 'as', 'position', 'overview', 'role', 'insights', 'insight',
        'solutions', 'environment', 'process', 'management', 'delivery', 'responsibilities',
        'requirements', 'qualifications', 'opportunity', 'company', 'organization'
      ]
      for (const w of words) {
        const wLow = w.toLowerCase()
        if (stopWordsInPhrase.includes(wLow)) return false
        if (BANNED_GENERIC_WORDS.has(wLow)) return false
      }
    }
  }

  return true
}

export const isGenuineTechnicalSkill = isConcreteTechSkill

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
        model: options.model || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: DYNAMIC_EXTRACTOR_SYSTEM_PROMPT },
          { role: 'user', content: `Extract technical skills and tools from this Job Description:\n\n${cleanText}` },
        ],
        temperature: 0.1,
        maxTokens: 1500,
        responseFormat: { type: 'json_object' },
        preferredProvider: 'groq',
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
 * Finds capitalized technical terms, acronyms (2-5 uppercase letters: e.g. GCP, ETL, IAM, LLM, SDK),
 * camelCase/PascalCase tokens (e.g. LangGraph, TensorFlow, PostgreSQL),
 * hyphenated tools (e.g. ci-cd, scikit-learn), and noun phrases following indicator patterns
 * ("experience with", "proficiency in", "knowledge of", "hands-on with").
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

  // 1. Capitalized technical acronyms & abbreviations (2-5 uppercase letters, e.g. GCP, ETL, IAM, LLM, SDK, AWS, SQL, API, RAG, dbt)
  const acronymMatches = text.match(/\b[A-Z]{2,5}\b|\b[a-z][A-Z0-9]+\b|\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b|\b[A-Z]{1,5}\d{1,4}\b/g) || []
  for (const acr of acronymMatches) {
    if (['US', 'IT', 'AT', 'OR', 'IN', 'TO', 'DO'].includes(acr)) continue
    if (isConcreteTechSkill(acr)) {
      found.add(acr)
      categories[acr.toLowerCase()] = assignHeuristicCategory(acr)
    }
  }

  // 2. Technical pattern captures (e.g. Node.js, Next.js, .NET, C++, C#, CI/CD, Power BI, REST APIs)
  const patternMatches = text.match(/\b(?:[A-Za-z0-9]+(?:\.[a-z]{2,4})|\.NET|C\+\+|C#|CI\/CD|Power\s+BI|REST(?:ful)?\s+APIs?)\b/gi) || []
  for (const pat of patternMatches) {
    const trimmed = pat.trim()
    if (isConcreteTechSkill(trimmed)) {
      found.add(trimmed)
      categories[trimmed.toLowerCase()] = assignHeuristicCategory(trimmed)
    }
  }

  // 3. CamelCase/PascalCase technical compounds & specialized suffixes (e.g. LangGraph, TensorFlow, PostgreSQL, ChromaDB, Biopython, Nextflow)
  const compoundMatches = text.match(/\b[A-Z][a-z]+[A-Z][a-zA-Z]+\b|\b[A-Z][a-z]*(?:[Ff]low|[Pp]ython|[Dd]b|[Ss]ql|[Gg]raph|[Mm]cp|[Hh]ub|[Ll]ab|[Ss]cript|[Bb]ox|[Bb]ase|[Ss]tack)\b/g) || []
  for (const cmp of compoundMatches) {
    const trimmed = cmp.trim()
    if (isConcreteTechSkill(trimmed)) {
      found.add(trimmed)
      categories[trimmed.toLowerCase()] = assignHeuristicCategory(trimmed)
    }
  }

  // 4. Hyphenated technical tools (e.g. ci-cd, scikit-learn, spring-boot, react-native)
  const hyphenMatches = text.match(/\b[a-zA-Z0-9]+-[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)?\b/g) || []
  for (const hyp of hyphenMatches) {
    if (isConcreteTechSkill(hyp) && !/^(?:pre-requisite|full-time|part-time|day-to-day|hands-on|end-to-end)$/i.test(hyp)) {
      found.add(hyp)
      categories[hyp.toLowerCase()] = assignHeuristicCategory(hyp)
    }
  }

  // 5. Noun phrases following indicator clauses: "experience with", "proficiency in", "knowledge of", "hands-on with"
  const indicatorRegex = /(?:experience with|proficiency in|knowledge of|hands-on with|familiarity with|expertise in)\s+([A-Za-z0-9#+, \t/-]+(?:\.[A-Za-z0-9#+]+)*(?:[A-Za-z0-9#+, \t/-]+)*)/gi
  let indMatch
  while ((indMatch = indicatorRegex.exec(text)) !== null) {
    const chunk = indMatch[1] || ''
    const parts = chunk.split(/[,/]\s*|\s+(?:and|or|as\s+well\s+as)\s+/i).map((p) => p.trim())
    for (const p of parts) {
      let pClean = p.replace(/[.!?]+$/, '').trim()
      pClean = pClean.replace(/^(?:and|or|with|as\s+well\s+as|in|the|a|an|of|for|to)\s+/i, '').trim()
      pClean = pClean.replace(/\s+(?:in|on|at|for|to|with|from|by|across|within|into)\s+.*$/i, '').trim()
      pClean = pClean.replace(/\s+(?:and|or|with|in|the|platforms?|tools?|systems?|pipelines?)$/i, '').trim()
      if (isConcreteTechSkill(pClean)) {
        const canonical = pClean.toLowerCase() === 'dbt' ? 'dbt' : pClean
        found.add(canonical)
        categories[canonical.toLowerCase()] = assignHeuristicCategory(canonical)
      }
    }
  }

  // 6. Two-word capitalized domain platforms (e.g. Epic Systems, Apache Spark, Google Cloud)
  const twoWordMatches = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || []
  for (const phrase of twoWordMatches) {
    const trimmed = phrase.trim()
    const low = trimmed.toLowerCase()
    const words = low.split(/\s+/)
    if (isConcreteTechSkill(trimmed) && /systems|platform|cloud|analytics|database|studio|bi|engine|services/i.test(words[1]) && !BANNED_GENERIC_WORDS.has(words[0])) {
      found.add(trimmed)
      categories[low] = assignHeuristicCategory(trimmed)
    }
  }

  // 7. Well-known base languages & core tech when present in text
  const coreTech = ['python', 'java', 'sql', 'docker', 'kubernetes', 'git', 'snowflake', 'tableau', 'excel', 'spark', 'kafka', 'redis', 'airflow', 'dbt']
  const lowerText = text.toLowerCase()
  for (const ct of coreTech) {
    const rx = new RegExp(`\\b${ct}\\b`, 'i')
    if (rx.test(lowerText)) {
      const canon = ct.charAt(0).toUpperCase() + ct.slice(1)
      const name = ct === 'sql' ? 'SQL' : ct === 'dbt' ? 'dbt' : canon
      found.add(name)
      categories[ct] = assignHeuristicCategory(ct)
    }
  }

  return {
    skills: Array.from(found).slice(0, 35),
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
  isConcreteTechSkill,
  BANNED_GENERIC_WORDS,
  DYNAMIC_EXTRACTOR_SYSTEM_PROMPT,
  JD_SKILL_CACHE,
  clearJdSkillCache,
}
