/**
 * Deterministic Keyword & JD Alignment Engine
 *
 * Compares candidate resume against target Job Description (if provided) OR
 * target role market intelligence across 3 actionable buckets:
 * 1. matchedInExperience (Green — verified in experience & project bullets)
 * 2. skillsOnlyUnverified (Amber — listed in Skills section only, not in bullets)
 * 3. missingFromResume (Red/Blue — high-frequency target keywords completely absent)
 */

import { extractSkillsFromJd } from './jdNormalizer.js'

// Curated high-frequency market intelligence keywords per controlled role category
export const MARKET_ROLE_KEYWORD_PACKS = {
  'software-engineer': [
    'React',
    'TypeScript',
    'Node.js',
    'Spring Boot',
    'Java',
    'PostgreSQL',
    'Microservices',
    'Docker',
    'Kubernetes',
    'AWS',
    'CI/CD',
    'JWT / OAuth 2.0',
    'REST APIs',
    'GraphQL',
    'Kafka',
    'Redis',
    'System Design',
    'Terraform',
    'Git',
  ],
  'ai-ml-engineer': [
    'Python',
    'PyTorch',
    'TensorFlow',
    'LLM',
    'RAG',
    'LangChain',
    'Vector DB',
    'FastAPI',
    'Docker',
    'Kubernetes',
    'AWS',
    'MLOps',
    'CI/CD',
    'System Design',
    'Git',
  ],
  'data-analyst': [
    'SQL',
    'Python',
    'Power BI',
    'Tableau',
    'Excel',
    'Data Modeling',
    'ETL',
    'Snowflake',
    'BigQuery',
    'Looker',
    'KPI Reporting',
    'Statistical Analysis',
    'Requirements Gathering (BRD/FRD)',
    'Git',
    'PostgreSQL',
  ],
  'devops-engineer': [
    'AWS',
    'Kubernetes',
    'Docker',
    'Terraform',
    'CI/CD',
    'Linux',
    'Ansible',
    'Prometheus',
    'Grafana',
    'Python',
    'Bash',
    'Git',
    'Helm',
  ],
  'data-engineer': [
    'Python',
    'SQL',
    'Apache Spark',
    'Kafka',
    'PostgreSQL',
    'Snowflake',
    'AWS',
    'Airflow',
    'dbt',
    'BigQuery',
    'Docker',
    'ETL Pipelines',
  ],
  'qa-engineer': [
    'Selenium',
    'Cypress',
    'Playwright',
    'JavaScript',
    'TypeScript',
    'Python',
    'API Testing',
    'Postman',
    'CI/CD',
    'JIRA',
    'Git',
    'Test Automation',
  ],
  'security-engineer': [
    'Application Security',
    'OWASP Top 10',
    'Penetration Testing',
    'SOC 2',
    'OAuth 2.0',
    'JWT',
    'AWS Security',
    'Vulnerability Assessment',
    'Cryptography',
    'SIEM',
  ],
}

// Canonical synonym and concept mapping for accurate recruiter-grade verification
export const KEYWORD_SYNONYMS = {
  'data modeling': [
    'data modeling',
    'data model',
    'data models',
    'star schema',
    'star schemas',
    'snowflake schema',
    'dimensional model',
    'dimensional modeling',
    'entity relationship',
    'er diagram',
    'schema design',
  ],
  'excel': [
    'excel',
    'ms excel',
    'microsoft excel',
    'advanced excel',
    'vlookup',
    'xlookup',
    'pivot table',
    'pivot tables',
    'power query',
  ],
  'postgresql': ['postgresql', 'postgres', 'psql', 'rds postgres'],
  'ms sql server': [
    'ms sql server',
    'sql server',
    'ms sql',
    'mssql',
    't-sql',
    'tsql',
    'ssms',
    'ssis',
    'ssrs',
  ],
  'sql server': [
    'sql server',
    'ms sql server',
    'ms sql',
    'mssql',
    't-sql',
    'tsql',
    'ssms',
    'ssis',
    'ssrs',
  ],
  'google cloud': [
    'google cloud',
    'gcp',
    'bigquery',
    'cloud sql',
    'dataproc',
    'dataflow',
    'vertex ai',
    'looker',
  ],
  'gcp': [
    'gcp',
    'google cloud',
    'bigquery',
    'cloud sql',
    'dataproc',
    'dataflow',
    'vertex ai',
    'looker',
  ],
  'aws': [
    'aws',
    'amazon web services',
    'ec2',
    's3',
    'lambda',
    'rds',
    'redshift',
    'ecs',
    'eks',
    'sagemaker',
    'glue',
    'athena',
  ],
  'azure': [
    'azure',
    'microsoft azure',
    'aks',
    'azure kubernetes',
    'synapse',
    'azure data factory',
    'adf',
    'azure devops',
  ],
  'kubernetes': ['kubernetes', 'k8s', 'aks', 'eks', 'gke', 'helm'],
  'microservices': [
    'microservices',
    'microservice',
    'service-oriented',
    'distributed services',
    'spring boot services',
    'microservices architecture',
  ],
  'ci/cd': [
    'ci/cd',
    'ci / cd',
    'jenkins',
    'github actions',
    'gitlab ci',
    'bitbucket pipelines',
    'azure pipelines',
    'automated deployment',
    'continuous integration',
    'continuous delivery',
  ],
  'rest apis': [
    'rest apis',
    'rest api',
    'restful',
    'restful apis',
    'fastapi',
    'express.js',
    'spring boot',
    'swagger',
    'openapi',
    'graphql',
  ],
  'git': ['git', 'github', 'gitlab', 'bitbucket', 'version control', 'pull request'],
  'jwt / oauth 2.0': [
    'jwt / oauth 2.0',
    'jwt',
    'oauth',
    'oauth2',
    'oauth 2.0',
    'rbac',
    'spring security',
    'authentication',
  ],
  'jwt': ['jwt', 'oauth', 'oauth2', 'oauth 2.0', 'rbac', 'spring security', 'authentication'],
  'oauth 2.0': ['oauth 2.0', 'oauth', 'oauth2', 'jwt', 'rbac', 'spring security', 'authentication'],
  'etl': [
    'etl',
    'elt',
    'data pipeline',
    'data pipelines',
    'cloud data pipelines',
    'airflow',
    'dbt',
    'spark',
    'pyspark',
    'data ingestion',
  ],
  'data pipelines': [
    'data pipelines',
    'data pipeline',
    'etl',
    'elt',
    'cloud data pipelines',
    'airflow',
    'dbt',
    'spark',
    'pyspark',
    'data ingestion',
  ],
  'etl pipelines': [
    'etl pipelines',
    'etl',
    'elt',
    'data pipeline',
    'data pipelines',
    'cloud data pipelines',
    'airflow',
    'dbt',
    'spark',
    'pyspark',
    'data ingestion',
  ],
  'requirements gathering (brd/frd)': [
    'requirements gathering (brd/frd)',
    'requirements gathering',
    'brd',
    'frd',
    'business requirements',
    'functional requirements',
    'user stories',
    'business requirements document',
    'functional requirements document',
  ],
  'kpi reporting': [
    'kpi reporting',
    'kpi',
    'kpis',
    'dashboards',
    'dashboard',
    'reporting metrics',
    'business metrics',
    'executive dashboards',
    'reporting',
  ],
  'statistical analysis': [
    'statistical analysis',
    'statistics',
    'hypothesis testing',
    'a/b testing',
    'regression',
    'statistical modeling',
  ],
}

function testTermInText(term, text) {
  if (!term || !text) return false
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+.-])${escaped}(?:$|[^a-zA-Z0-9_#+.-])`, 'i')
  return regex.test(text)
}

/**
 * Checks if a keyword or any of its canonical synonyms is mentioned in a text block.
 */
export function keywordMatchesText(keyword, text) {
  if (!keyword || !text) return false
  const lowerKw = keyword.toLowerCase().trim()

  // 1. Direct synonym matching
  const synonyms = KEYWORD_SYNONYMS[lowerKw] || []
  if (synonyms.some((syn) => testTermInText(syn, text))) {
    return true
  }

  // 2. Handle slash combinations e.g. "JWT / OAuth 2.0"
  if (lowerKw.includes('/')) {
    const parts = lowerKw.split('/').map((p) => p.trim()).filter(Boolean)
    if (parts.some((p) => keywordMatchesText(p, text))) return true
  }

  // 3. Common tech variations
  if (lowerKw === 'node.js') {
    return /\bnode(?:\.js)?\b/i.test(text) || /\bnodejs\b/i.test(text)
  }
  if (lowerKw === 'next.js') {
    return /\bnext(?:\.js)?\b/i.test(text) || /\bnextjs\b/i.test(text)
  }
  if (lowerKw === 'react') {
    return /\breact(?:\.js)?\b/i.test(text) || /\breactjs\b/i.test(text)
  }
  if (lowerKw === 'spring boot') {
    return /\bspring\s*boot\b/i.test(text) || (/\bspring\b/i.test(text) && /\bboot\b/i.test(text))
  }
  if (lowerKw === 'system design') {
    return /\bsystem\s+design\b/i.test(text) || /\barchitecture\b/i.test(text)
  }

  // 4. Word-boundary regex match
  return testTermInText(lowerKw, text)
}

export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str
  return str
    .replace(/&(?:amp|Amp);?/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function isConcreteTechSkillChip(skill) {
  if (!skill || typeof skill !== 'string') return false
  const s = decodeHtmlEntities(skill).trim()
  if (s.length < 2 || s.length > 35) return false
  if (/&(?:amp|Amp);?/i.test(s)) return false
  const wordCount = s.split(/\s+/).length
  if (wordCount > 3) return false
  if (/^(?:stakeholder collaboration|cross-functional collaboration|communication|team player|leadership|problem solving|process automation)$/i.test(s)) return false
  return true
}

/**
 * Computes deterministic Keyword & JD Alignment
 *
 * @param {Object} params
 * @param {Object} params.canonicalResume - Parsed resume structure
 * @param {string} [params.targetJobDescription] - Raw active JD text if provided
 * @param {string} [params.targetRole] - Target role title
 * @param {Object} [params.marketProfile] - Active market profile from retriever
 * @returns {Object} Structured keywordAlignment payload
 */
export function computeKeywordAlignment({
  canonicalResume,
  targetJobDescription = '',
  targetRole = '',
  marketProfile = null,
}) {
  const roleName = targetRole || canonicalResume?.candidate?.targetRole || 'Software Engineer'
  const isJdProvided = Boolean(targetJobDescription && targetJobDescription.trim().length > 40)

  // 1. Gather Candidate Text Corpi including project tech headers & summaries
  const expAndProjBullets = [
    ...(canonicalResume?.experience || []).flatMap((e) => [
      e.role || '',
      e.company || '',
      ...(e.bullets || []).map((b) => (typeof b === 'string' ? b : b.text || '')),
    ]),
    ...(canonicalResume?.projects || []).flatMap((p) => [
      p.title || '',
      p.techStack || '',
      ...(p.bullets || []).map((b) => (typeof b === 'string' ? b : b.text || '')),
    ]),
  ].filter(Boolean)
  const expAndProjText = expAndProjBullets.join('\n')

  const declaredSkills = []
  const rawSkillsArray = canonicalResume?.skills || []
  for (const s of rawSkillsArray) {
    const rawName = typeof s === 'string' ? s : s.name || s.text || ''
    if (!rawName) continue
    const decodedName = decodeHtmlEntities(rawName)
    // Handle category prefixes like "Backend & Cloud: ..."
    const content = decodedName.includes(':') ? decodedName.split(':').slice(1).join(':') : decodedName
    // Split on commas, semicolons, or pipe, but handle parenthetical blocks safely
    const tokens = content.split(/[,;|]/)
    for (let token of tokens) {
      token = decodeHtmlEntities(token.trim().replace(/^[-•*▪]\s*/, '').replace(/[.]+$/, ''))
      if (!token || token.length < 2) continue

      // Ignore noise tokens or fragments
      if (/^\d+\.?\w*(\s*\(.*\))?$/.test(token)) continue
      if (/^(and|or|etc|tools|languages|frameworks|emerging)$/i.test(token)) continue
      if (token.includes('(') && !token.includes(')')) continue
      if (!token.includes('(') && token.includes(')')) continue

      // Extract from parenthetical if well formed: e.g. "AWS (EC2, Lambda)" -> "AWS", "EC2", "Lambda"
      const parenMatch = token.match(/^(.*?)\((.*?)\)$/)
      if (parenMatch) {
        const lead = parenMatch[1].trim()
        if (lead && lead.length >= 2 && !/^\d/.test(lead)) declaredSkills.push(lead)
        parenMatch[2].split(/[,/]/).forEach((sub) => {
          const subClean = sub.trim()
          if (subClean && subClean.length >= 2 && !/^\d/.test(subClean)) declaredSkills.push(subClean)
        })
      } else if (!/^\d/.test(token) && token.length >= 2 && token.length <= 40) {
        declaredSkills.push(token)
      }
    }
  }
  const skillsText = declaredSkills.join(', ')
  const summaryText = canonicalResume?.summary?.text || ''
  const fullResumeText = `${expAndProjText}\n${skillsText}\n${summaryText}`

  // 2. Determine Target Keywords (12–16 Core High-Impact Keywords)
  let targetKeywords = []
  if (isJdProvided) {
    const extractedJdSkills = extractSkillsFromJd(targetJobDescription)
    if (extractedJdSkills.length >= 6) {
      targetKeywords = extractedJdSkills
    }
  }

  // If JD yields few keywords or no JD provided, use Market Pack for role
  if (targetKeywords.length < 6) {
    const roleLower = roleName.toLowerCase()
    let packKey = 'software-engineer'
    if (/ai|ml|machine\s*learning|deep\s*learning|nlp/i.test(roleLower)) packKey = 'ai-ml-engineer'
    else if (/data\s*(&|\+|and|\/)?\s*(business\s*)?analyst|business\s*analyst|analytics|bi\b/i.test(roleLower)) packKey = 'data-analyst'
    else if (/devops|sre|cloud|platform|infrastructure/i.test(roleLower)) packKey = 'devops-engineer'
    else if (/data\s*engineer|big\s*data|data\s*platform/i.test(roleLower)) packKey = 'data-engineer'
    else if (/qa|sdet|test/i.test(roleLower)) packKey = 'qa-engineer'
    else if (/security|cyber/i.test(roleLower)) packKey = 'security-engineer'

    const pack = MARKET_ROLE_KEYWORD_PACKS[packKey] || MARKET_ROLE_KEYWORD_PACKS['software-engineer']
    targetKeywords = Array.from(new Set([...targetKeywords, ...pack]))
  }

  // Enforce evaluation of top 12–16 core keywords
  targetKeywords = targetKeywords.slice(0, 16)

  // 3. Classify target keywords into 3 buckets
  const matchedInExperience = []
  const skillsOnlyUnverified = []
  const missingFromResume = []

  for (const kw of targetKeywords) {
    const inExperience = keywordMatchesText(kw, expAndProjText)
    const inSkills = keywordMatchesText(kw, skillsText)
    const inSummary = keywordMatchesText(kw, summaryText)
    const inFullResume = inExperience || inSkills || inSummary || keywordMatchesText(kw, fullResumeText)

    if (inExperience) {
      // Verified in Experience & Projects
      matchedInExperience.push(kw)
    } else if (inSkills || inSummary || inFullResume) {
      // Present in Skills or Summary — NEVER marked as missing
      skillsOnlyUnverified.push(kw)
    } else {
      // Absent from entire resume
      missingFromResume.push(kw)
    }
  }

  // 4. Pick at most top 6–8 unverified skills from declared skills (never dump 30 raw skills)
  const additionalUnverified = []
  for (const skill of declaredSkills) {
    const norm = skill.toLowerCase()
    const alreadyHandled =
      matchedInExperience.some((k) => k.toLowerCase() === norm) ||
      skillsOnlyUnverified.some((k) => k.toLowerCase() === norm) ||
      missingFromResume.some((k) => k.toLowerCase() === norm)

    if (!alreadyHandled) {
      const inExperience = keywordMatchesText(skill, expAndProjText)
      if (!inExperience) {
        additionalUnverified.push(skill)
      }
    }
  }

  // Deduplicate and cap skillsOnlyUnverified to at most 6–8 items total
  const uniqueMatched = Array.from(new Set(matchedInExperience))
  const rawSkillsOnly = [
    ...skillsOnlyUnverified,
    ...additionalUnverified.slice(0, 6),
  ]
  const uniqueSkillsOnly = Array.from(
    new Set(
      rawSkillsOnly
        .map(decodeHtmlEntities)
        .filter(isConcreteTechSkillChip)
        .filter((s) => !/&amp/i.test(s) && s.split(/\s+/).length <= 3)
        .filter((s) => !uniqueMatched.some((m) => m.toLowerCase() === s.toLowerCase()))
    )
  ).slice(0, 8)

  const uniqueMissing = Array.from(
    new Set(missingFromResume.filter((s) => !uniqueMatched.some((m) => m.toLowerCase() === s.toLowerCase())))
  )

  const matchedCount = uniqueMatched.length
  const totalTargetKeywords = uniqueMatched.length + uniqueMissing.length
  const matchPercent = totalTargetKeywords > 0 ? Math.round((matchedCount / totalTargetKeywords) * 100) : 100

  return {
    source: isJdProvided ? 'active_jd' : 'market_intelligence',
    sourceLabel: isJdProvided ? 'Active Job Description' : 'Market Intelligence (Top Target Keywords)',
    targetRole: roleName,
    matchedCount,
    totalTargetKeywords,
    matchPercent,
    matchedInExperience: uniqueMatched,
    skillsOnlyUnverified: uniqueSkillsOnly,
    missingFromResume: uniqueMissing,
    isCompleteCoverage: uniqueMissing.length === 0,
    skillsOnlyGuidance: 'Listed in your Skills section, but not shown in your work bullets — mention in 1 bullet to prove hands-on usage.',
  }
}

// Semantic Slot definitions for Keyword Weaver
export const SEMANTIC_SLOTS = {
  api_slot: {
    matchKw: /\b(graphql|rest|restful|swagger|websockets?|grpc|fastapi|openapi|apis?|jwt|oauth)\b/i,
    matchBullet: /\b(apis?|endpoints?|retrieval|backend|services?|server|http|restful|rest)\b/i,
  },
  cloud_slot: {
    matchKw: /\b(aws|azure|gcp|docker|kubernetes|k8s|ecs|eks|terraform|ci\/cd|clouds?|ansible|helm|cloudformation|linux)\b/i,
    matchBullet: /\b(deploy|deployment|deploying|microservices?|infrastructure|clouds?|containers?|containerized|pipelines?|clusters?|ci\/cd)\b/i,
  },
  messaging_slot: {
    matchKw: /\b(kafka|rabbitmq|sqs|sns|redis|pub\/sub|celery|eventbridge|messages?|message\s+queues?|activemq)\b/i,
    matchBullet: /\b(messaging|queues?|streams?|streaming|caching|cache|async|asynchronous|events?|pub\/sub)\b/i,
  },
  frontend_slot: {
    matchKw: /\b(react|next\.?js|redux|tailwind|vue|angular|typescript|javascript|frontends?|ui|css|html)\b/i,
    matchBullet: /\b(frontends?|front-end|ui|ux|components?|interfaces?|web|client|pages?|views?|dashboard)\b/i,
  },
}

export function determineSemanticSlot(kw) {
  for (const [slotName, slotDef] of Object.entries(SEMANTIC_SLOTS)) {
    if (slotDef.matchKw.test(kw)) return slotName
  }
  return 'cloud_slot'
}

/**
 * KEYWORD WEAVER ALGORITHM
 * Weaves high-value missing JD keywords and stranded skills directly into experience bullets.
 *
 * Rules:
 * 1. Collect candidates for injection:
 *    - Priority 1: High-value Missing JD Keywords (e.g. Kafka, TypeScript)
 *    - Priority 2: Stranded Skills-Only Keywords (e.g. GraphQL, AWS, Docker)
 * 2. Map keywords to semantic slots:
 *    - api_slot (GraphQL, REST, Swagger, WebSockets) -> Matches bullets containing API, endpoint, retrieval, backend
 *    - cloud_slot (AWS, Azure, Docker, Kubernetes, ECS) -> Matches bullets containing deployment, microservices, infrastructure
 *    - messaging_slot (Kafka, RabbitMQ, SQS, Redis) -> Matches bullets containing messaging, queue, stream, caching, async
 *    - frontend_slot (React 19, Next.js, Redux, Tailwind) -> Matches frontend/UI bullets
 * 3. Natural Weaving Rule:
 *    - Never inject more than 1 new keyword per bullet
 *    - Insert into the tooling or method clause (...using [Existing Stack] and [Woven Keyword]...)
 *    - Preserve all existing numbers, percentages, and metrics verbatim
 */
export function weaveKeywordsIntoBullets(experiences = [], missingKeywords = [], skillsOnlyKeywords = []) {
  if (!Array.isArray(experiences) || experiences.length === 0) return []

  const normList = (arr) => {
    if (!Array.isArray(arr)) return []
    return arr
      .map((item) => (typeof item === 'string' ? item : item?.keyword || item?.name || item?.skill || ''))
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
  }

  const p1 = normList(missingKeywords)
  const p2 = normList(skillsOnlyKeywords)

  const candidateKeywords = []
  const seenKw = new Set()
  for (const kw of p1) {
    const low = kw.toLowerCase()
    if (!seenKw.has(low)) {
      seenKw.add(low)
      candidateKeywords.push({ keyword: kw, priority: 1, source: 'missing_jd' })
    }
  }
  for (const kw of p2) {
    const low = kw.toLowerCase()
    if (!seenKw.has(low)) {
      seenKw.add(low)
      candidateKeywords.push({ keyword: kw, priority: 2, source: 'stranded_skill' })
    }
  }

  if (candidateKeywords.length === 0) return []

  const getSlot = determineSemanticSlot

  // Flatten experience bullets with stable identifiers
  const flattenedBullets = []
  experiences.forEach((exp, expIdx) => {
    const expId = exp.id || `exp_${String(expIdx + 1).padStart(3, '0')}`
    const company = exp.company || exp.employer || `Company ${expIdx + 1}`
    const role = exp.role || exp.title || 'Software Engineer'
    ;(exp.bullets || []).forEach((b, bIdx) => {
      const bId = (typeof b === 'object' && b?.id) ? b.id : `${expId}_b${String(bIdx + 1).padStart(2, '0')}`
      const origText = typeof b === 'string' ? b : b?.text || ''
      flattenedBullets.push({
        expId,
        company,
        role,
        bulletId: bId,
        origText,
        expIdx,
        bIdx,
      })
    })
  })

  const results = []
  const usedBulletIds = new Set()
  const injectedKeywords = []

  // Natural weaving function preserving existing metrics verbatim
  const naturalWeave = (text, kw, slot) => {
    if (!text || !kw) return text
    const kwRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (kwRegex.test(text)) return text

    let cleaned = text.trim()
    const trailingPunct = /[.!?]$/.test(cleaned) ? cleaned.slice(-1) : '.'
    if (/[.!?]$/.test(cleaned)) cleaned = cleaned.slice(0, -1).trim()

    // 1. Tooling clause starting with "using", "utilizing", "leveraging", "via", or "with"
    // Tooling clause must not capture numeric metrics (e.g. "with 99.99% uptime")
    const usingRegex = /\b(?:(using|utilizing|leveraging|via)\s+([A-Za-z0-9\s,&/+-]+?)|(with)\s+([A-Za-z\s,&/+-]+?))(?=\s+(?:with|to|for|at|in|delivering|achieving|cutting|reducing|improving|saving|by)|[,;.]|$)/i
    const usingMatch = cleaned.match(usingRegex)
    if (usingMatch) {
      const prep = usingMatch[1] || usingMatch[3]
      const stack = (usingMatch[2] || usingMatch[4]).trim()
      if (stack && !kwRegex.test(stack) && !/\d{2,}/.test(stack)) {
        let updatedStack
        if (/\band\b/i.test(stack)) {
          updatedStack = `${stack.replace(/\s+and\s+/i, ', ')}, and ${kw}`
        } else {
          updatedStack = `${stack} and ${kw}`
        }
        cleaned = cleaned.replace(usingMatch[0], `${prep} ${updatedStack}`)
        return `${cleaned}${trailingPunct}`
      }
    }

    // 2. Slot-specific natural insertion
    if (slot === 'api_slot' && /\b(REST\s+APIs?|APIs?|endpoints?)\b/i.test(cleaned)) {
      cleaned = cleaned.replace(/\b(REST\s+APIs?|APIs?|endpoints?)\b/i, `$1 and ${kw} endpoints`)
      return `${cleaned}${trailingPunct}`
    }

    // 3. Insert before primary clause / comma or append
    const commaIndex = cleaned.indexOf(',')
    if (commaIndex > 15) {
      const head = cleaned.slice(0, commaIndex)
      const tail = cleaned.slice(commaIndex)
      cleaned = `${head} using ${kw}${tail}`
    } else {
      cleaned = `${cleaned} using ${kw}`
    }

    return `${cleaned}${trailingPunct}`
  }

  // Process candidates in priority order (Priority 1: Missing JD, Priority 2: Stranded Skills)
  for (const cand of candidateKeywords) {
    const slot = getSlot(cand.keyword)
    const slotDef = SEMANTIC_SLOTS[slot] || SEMANTIC_SLOTS.cloud_slot
    const kwRegex = new RegExp(`\\b${cand.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')

    // Find best matching unused bullet for this slot
    let targetCandidate = flattenedBullets.find((fb) => {
      if (usedBulletIds.has(fb.bulletId)) return false
      if (kwRegex.test(fb.origText)) return false
      return slotDef.matchBullet.test(fb.origText)
    })

    // If no slot match, fallback to any unused bullet with length >= 25
    if (!targetCandidate) {
      targetCandidate = flattenedBullets.find((fb) => {
        if (usedBulletIds.has(fb.bulletId)) return false
        if (kwRegex.test(fb.origText)) return false
        return fb.origText.length >= 25
      })
    }

    if (targetCandidate) {
      const rewritten = naturalWeave(targetCandidate.origText, cand.keyword, slot)
      usedBulletIds.add(targetCandidate.bulletId)
      injectedKeywords.push(cand.keyword)

      results.push({
        bulletId: targetCandidate.bulletId,
        experienceId: targetCandidate.expId,
        company: targetCandidate.company,
        role: targetCandidate.role,
        originalText: targetCandidate.origText,
        recruiterCritique: `Line lacked verified hands-on evidence of ${cand.keyword} (${cand.source === 'missing_jd' ? 'high-demand JD keyword' : 'stranded technical skill'}). Woven into tooling clause.`,
        wovenKeyword: cand.keyword,
        wovenKeywords: [cand.keyword],
        slot,
        priority: cand.priority,
        readyToUseRewrite: rewritten,
        rewrittenText: rewritten,
      })
    }
  }

  // Build cloned experiences with woven bullets in place
  const wovenExperiences = experiences.map((exp, expIdx) => {
    const expId = exp.id || `exp_${String(expIdx + 1).padStart(3, '0')}`
    const newBullets = (exp.bullets || []).map((b, bIdx) => {
      const bId = (typeof b === 'object' && b?.id) ? b.id : `${expId}_b${String(bIdx + 1).padStart(2, '0')}`
      const matchRw = results.find((r) => r.bulletId === bId)
      if (matchRw) {
        return typeof b === 'object'
          ? { ...b, text: matchRw.readyToUseRewrite }
          : matchRw.readyToUseRewrite
      }
      return b
    })
    return {
      ...exp,
      bullets: newBullets,
    }
  })

  // Attach enriched properties for ergonomic caller consumption
  results.wovenExperiences = wovenExperiences
  results.wovenCount = results.length
  results.injectedKeywords = injectedKeywords

  return results
}

export default { computeKeywordAlignment, weaveKeywordsIntoBullets, MARKET_ROLE_KEYWORD_PACKS, KEYWORD_SYNONYMS }
