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
import { getMarketDemandedSkills } from './marketSkillDemandRegistry.js'
import { isConcreteTechSkill } from './dynamicSkillExtractor.js'
import { inferRoleFromKeywordFrequency } from '../resumeAgent.normalizer.js'

export const isGenuineTechnicalSkill = isConcreteTechSkill

export const JUNIOR_OR_INTERN_SKILLS = new Set([
  'word',
  'ms word',
  'microsoft word',
  'powerpoint',
  'ms powerpoint',
  'data entry',
  'typing',
  'filing',
  'basic computer skills',
  'general office',
  'internship',
  'student',
  'trainee',
])

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
  'product-manager': [
    'Product Strategy',
    'Roadmapping',
    'User Research',
    'Agile / Scrum',
    'A/B Testing',
    'Data Analytics',
    'Stakeholder Management',
    'JIRA',
    'SQL',
    'PRD Authoring',
    'Feature Prioritization',
    'KPI Tracking',
  ],
  'project-manager': [
    'Project Planning',
    'Risk Management',
    'Agile / Scrum',
    'Process Optimization',
    'Stakeholder Communication',
    'Budgeting & Forecasting',
    'Resource Allocation',
    'JIRA',
    'Cross-Functional Leadership',
    'SLA Management',
  ],
  'sales': [
    'Pipeline Management',
    'B2B Sales',
    'Salesforce',
    'HubSpot',
    'Contract Negotiation',
    'Lead Qualification',
    'Account Management',
    'Revenue Forecasting',
    'Discovery Calls',
    'CRM',
  ],
  'marketing': [
    'Digital Marketing',
    'SEO / SEM',
    'Content Strategy',
    'Google Analytics',
    'Campaign Management',
    'Social Media Marketing',
    'Email Marketing',
    'Brand Strategy',
    'A/B Testing',
    'Marketing Automation',
  ],
  'finance': [
    'Financial Modeling',
    'DCF Valuation',
    'Excel',
    'Budgeting & Forecasting',
    'Financial Reporting',
    'Variance Analysis',
    'GAAP',
    'P&L Analysis',
    'Capital Budgeting',
    'ERP Systems',
  ],
  'clinical-healthcare': [
    'Patient Care',
    'Electronic Health Records (EHR)',
    'Clinical Assessment',
    'Medication Administration',
    'Patient Advocacy',
    'HIPAA Compliance',
    'Triage & Vital Signs',
    'Infection Control',
    'Care Planning',
    'BLS / ACLS Certification',
  ],
  'general-professional': [
    'Process Improvement',
    'Cross-Functional Collaboration',
    'Project Coordination',
    'Data Analysis',
    'Performance Metrics / KPIs',
    'Stakeholder Management',
    'Reporting & Documentation',
    'Operational Excellence',
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
  'git': ['git', 'github', 'gitlab', 'bitbucket', 'version control', 'pull request', 'pr'],
  'git / github': ['git', 'github', 'gitlab', 'bitbucket', 'version control', 'pull request', 'pr'],
  'machine learning': ['machine learning', 'ml', 'deep learning', 'scikit-learn', 'tensorflow', 'pytorch'],
  'system design': ['system design', 'system architecture', 'distributed systems', 'high-level design', 'low-level design', 'software architecture', 'microservices architecture'],
  'unit / integration testing': ['unit test', 'unit testing', 'integration test', 'integration testing', 'jest', 'pytest', 'mocha', 'junit', 'automated tests', 'test coverage', 'tdd', 'test automation'],
  'unit testing': ['unit test', 'unit testing', 'integration test', 'integration testing', 'jest', 'pytest', 'mocha', 'junit', 'automated tests', 'test coverage', 'tdd'],
  'code review': ['code review', 'code reviews', 'pr review', 'pr reviews', 'peer review'],
  'devops': ['devops', 'ci/cd', 'ci / cd', 'docker', 'kubernetes', 'terraform', 'jenkins'],
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

  const roleName = targetRole || canonicalResume?.candidate?.targetRole || inferRoleFromKeywordFrequency(expAndProjText) || 'Professional'
  const isJdProvided = Boolean(targetJobDescription && targetJobDescription.trim().length > 40)

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
  const skillsText = declaredSkills.filter(isConcreteTechSkill).join(', ')
  const summaryText = canonicalResume?.summary?.text || ''
  const fullResumeText = `${expAndProjText}\n${skillsText}\n${summaryText}`

  // 1. Gather all candidate text across experience, projects, skills, and summary
  const candidateSkillsSet = new Set(
    declaredSkills.map((s) => s.toLowerCase().trim())
  )

  const roleLower = roleName.toLowerCase()
  let packKey = 'general-professional'
  if (/ai|ml|machine\s*learning|deep\s*learning|nlp/i.test(roleLower)) packKey = 'ai-ml-engineer'
  else if (/data\s*(&|\+|and|\/)?\s*(business\s*)?analyst|business\s*analyst|analytics|bi\b/i.test(roleLower)) packKey = 'data-analyst'
  else if (/devops|sre|cloud|platform|infrastructure/i.test(roleLower)) packKey = 'devops-engineer'
  else if (/data\s*engineer|big\s*data|data\s*platform/i.test(roleLower)) packKey = 'data-engineer'
  else if (/qa|sdet|test/i.test(roleLower)) packKey = 'qa-engineer'
  else if (/security|cyber/i.test(roleLower)) packKey = 'security-engineer'
  else if (/software|developer|full\s*stack|backend|frontend|web\s*developer|programmer|engineer/i.test(roleLower)) packKey = 'software-engineer'
  else if (/product\s*(manager|owner|lead)/i.test(roleLower)) packKey = 'product-manager'
  else if (/project\s*(manager|lead)|operations|scrum\s*master/i.test(roleLower)) packKey = 'project-manager'
  else if (/sales|account\s*exec|business\s*development|bdr|sdr/i.test(roleLower)) packKey = 'sales'
  else if (/marketing|growth|seo|brand/i.test(roleLower)) packKey = 'marketing'
  else if (/finance|financial|accounting|accountant|auditor/i.test(roleLower)) packKey = 'finance'
  else if (/nurse|nursing|clinical|healthcare|patient|medical/i.test(roleLower)) packKey = 'clinical-healthcare'
  else packKey = 'general-professional'

  // 2. Determine Target Keywords (12–16 Core High-Impact Keywords)
  let targetKeywords = []
  if (isJdProvided) {
    const extractedJdSkills = extractSkillsFromJd(targetJobDescription)
    targetKeywords = [...extractedJdSkills]
  }

  const hasRealMarketProfile = Boolean(
    marketProfile &&
    Array.isArray(marketProfile.skills) &&
    marketProfile.skills.length > 0 &&
    ((marketProfile.sampleSize || 0) > 0 || (marketProfile.totalAnalyzed || 0) > 0)
  )

  if (hasRealMarketProfile) {
    // 100% REAL DATA ONLY: Bypass static fallback packs completely when real market intelligence is present
    targetKeywords = marketProfile.skills
      .map((s) => (typeof s === 'string' ? s : s?.name || s?.skill || ''))
      .filter(isGenuineTechnicalSkill)
  } else if (!isJdProvided) {
    // Priority 3: Fallback pack only if no market data is present
    const fallbackPack = MARKET_ROLE_KEYWORD_PACKS[packKey] || MARKET_ROLE_KEYWORD_PACKS['general-professional'] || []
    targetKeywords = Array.from(new Set([...targetKeywords, ...fallbackPack]))
  }

  // Deduplicate & filter genuine technical skills (Uncapped!)
  targetKeywords = Array.from(new Set(targetKeywords.filter(isGenuineTechnicalSkill)))

  // Build allMarketSkills mapping back to marketProfile metadata if present
  const marketSkillsMap = new Map()
  if (hasRealMarketProfile) {
    for (const item of marketProfile.skills) {
      const name = typeof item === 'string' ? item : (item?.name || item?.skill || '')
      if (name) {
        marketSkillsMap.set(name.toLowerCase(), typeof item === 'string' ? { name: item, frequency: 1, percentage: 50 } : item)
      }
    }
  }

  const totalRealJds = marketProfile?.sampleSize || marketProfile?.totalAnalyzed || 1

  const allMarketSkills = targetKeywords.map((name, idx) => {
    const existing = marketSkillsMap.get(name.toLowerCase())
    if (existing && typeof existing === 'object') {
      const realCount = existing.count || existing.frequency || 1
      const realPercentage = existing.percentage != null
        ? existing.percentage
        : Math.min(100, Math.round((realCount / totalRealJds) * 100))
      return {
        ...existing,
        name,
        frequency: realCount,
        count: realCount,
        totalJds: totalRealJds,
        percentage: realPercentage,
      }
    }
    if (isJdProvided) {
      return {
        name,
        frequency: totalRealJds || 1,
        percentage: 100,
      }
    }

    // Calibrated baseline market percentages (Tiered by seniority demand)
    // Top 5 skills: 75%-60%, Next 5: 55%-40%, Remaining: 35%-20%
    let percentage = 45
    if (idx < 4) percentage = 75 - (idx * 5)
    else if (idx < 8) percentage = 55 - ((idx - 4) * 4)
    else percentage = Math.max(20, 38 - ((idx - 8) * 3))

    return {
      name,
      frequency: Math.round((percentage / 100) * 100),
      percentage,
    }
  })

  // 3. Separate candidate's verified skills vs GENUINELY missing skills (NO CAPPING)
  const matchedInExperience = []
  const skillsOnlyUnverified = []
  const missingMarketSkillsRanked = []

  const bucketKey = marketProfile?.bucketKey || ''
  const isSeniorBucket = /6-8|8\+/.test(bucketKey)
  const experienceRolesCount = (canonicalResume?.experience || []).length
  const isSeniorCandidate = isSeniorBucket || experienceRolesCount >= 3

  for (const item of allMarketSkills) {
    const skillName = typeof item === 'string' ? item : item?.name || ''
    if (!isGenuineTechnicalSkill(skillName)) continue

    const skillLower = skillName.toLowerCase()
    if (isSeniorCandidate && JUNIOR_OR_INTERN_SKILLS.has(skillLower)) {
      continue
    }

    const inExperience = keywordMatchesText(skillName, expAndProjText)
    const inSkills = keywordMatchesText(skillName, skillsText) || candidateSkillsSet.has(skillName.toLowerCase())
    const inSummary = keywordMatchesText(skillName, summaryText) || keywordMatchesText(skillName, fullResumeText)

    if (inExperience) {
      matchedInExperience.push(skillName)
    } else if (inSkills || inSummary) {
      skillsOnlyUnverified.push(skillName)
    } else {
      // Genuinely missing from candidate's entire resume!
      const count = typeof item === 'object' ? (item.frequency || item.count || 1) : 1
      const percentage = typeof item === 'object' && item.percentage != null
        ? item.percentage
        : Math.min(100, Math.round((count / totalRealJds) * 100))

      let priority = 'LOW'
      let priorityColor = 'grey'
      if (percentage >= 40) {
        priority = 'HIGH'
        priorityColor = 'red'
      } else if (percentage >= 20) {
        priority = 'MEDIUM'
        priorityColor = 'yellow'
      }

      missingMarketSkillsRanked.push({
        keyword: skillName,
        count,
        totalJds: totalRealJds,
        percentage,
        priority,
        priorityColor,
        category: item.category || 'tools',
        badge: `${percentage}% of JDs`,
        talkingScript: `Discuss how you can leverage ${skillName} in production workflows for ${roleName}.`,
      })
    }
  }

  // Also process candidate's declared skills that were not in market skills
  for (const skill of declaredSkills) {
    if (!isGenuineTechnicalSkill(skill)) continue
    const norm = skill.toLowerCase()
    const alreadyHandled =
      matchedInExperience.some((k) => k.toLowerCase() === norm) ||
      skillsOnlyUnverified.some((k) => k.toLowerCase() === norm)

    if (!alreadyHandled) {
      const inExperience = keywordMatchesText(skill, expAndProjText)
      if (inExperience) {
        matchedInExperience.push(skill)
      } else {
        skillsOnlyUnverified.push(skill)
      }
    }
  }

  // Sort genuinely missing skills strictly by market percentage descending (ALL OF THEM, NO SLICE!)
  missingMarketSkillsRanked.sort((a, b) => b.percentage - a.percentage || b.count - a.count)

  const uniqueMatched = Array.from(new Set(matchedInExperience))
  const uniqueSkillsOnly = Array.from(new Set(skillsOnlyUnverified)).filter(
    (s) => !uniqueMatched.some((m) => m.toLowerCase() === s.toLowerCase())
  )
  const uniqueMissing = missingMarketSkillsRanked.map((m) => m.keyword)

  const matchedCount = uniqueMatched.length
  const totalTargetKeywords = uniqueMatched.length + uniqueSkillsOnly.length + missingMarketSkillsRanked.length
  const matchPercent = totalTargetKeywords > 0 ? Math.round((matchedCount / totalTargetKeywords) * 100) : 100

  return {
    source: isJdProvided ? 'active_jd' : 'market_intelligence',
    sourceLabel: isJdProvided ? 'Active Job Description' : 'Market Intelligence (Top Target Keywords)',
    targetRole: roleName,
    targetKeywords,
    matchedCount,
    totalTargetKeywords,
    matchPercent,
    matchedInExperience: uniqueMatched,
    skillsOnlyUnverified: uniqueSkillsOnly,
    missingFromResume: uniqueMissing, // 100% genuinely missing skills only, UNCAPPED!
    missingMarketSkillsRanked,        // 100% genuinely missing skills only, UNCAPPED!
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
    matchKw: /\b(aws|azure|gcp|docker|kubernetes|k8s|ecs|eks|terraform|ci\/cd|clouds?|ansible|helm|cloudformation|linux|git|github|gitlab)\b/i,
    matchBullet: /\b(deploy|deployment|deploying|microservices?|infrastructure|clouds?|containers?|containerized|pipelines?|clusters?|ci\/cd|version\s+control|releases?)\b/i,
  },
  messaging_slot: {
    matchKw: /\b(kafka|rabbitmq|sqs|sns|redis|pub\/sub|celery|eventbridge|messages?|message\s+queues?|activemq)\b/i,
    matchBullet: /\b(messaging|queues?|streams?|streaming|caching|cache|async|asynchronous|events?|pub\/sub|telemetry|ingestion|event-driven)\b/i,
  },
  frontend_slot: {
    matchKw: /\b(react|next\.?js|redux|tailwind|vue|angular|typescript|javascript|frontends?|ui|css|html)\b/i,
    matchBullet: /\b(frontends?|front-end|ui|ux|components?|interfaces?|web|client|pages?|views?|dashboard)\b/i,
  },
  testing_slot: {
    matchKw: /\b(unit\s+testing|testing|test\s+automation|jest|cypress|mocha|pytest|tdd|integration\s+testing|qa)\b/i,
    matchBullet: /\b(tests?|testing|test\s+coverage|coverage|quality|validation|validating|ci|releases?|defect|regression|suites?)\b/i,
  },
}

export function determineSemanticSlot(kw, dynamicCategory = null) {
  if (dynamicCategory) {
    if (dynamicCategory === 'messaging_streaming') return 'messaging_slot'
    if (dynamicCategory === 'cloud_devops') return 'cloud_slot'
    if (dynamicCategory === 'testing_quality') return 'testing_slot'
    if (dynamicCategory === 'ai_ml') return 'api_slot'
    if (dynamicCategory === 'database_data') {
      if (/redis|cache|caching/i.test(kw)) return 'messaging_slot'
      return 'api_slot'
    }
    if (dynamicCategory === 'languages_frameworks') {
      if (/react|ui|vue|front|tailwind|css/i.test(kw)) return 'frontend_slot'
      return 'api_slot'
    }
  }

  // Fallback to pattern matcher
  const low = String(kw || '').toLowerCase()
  if (/\b(unit\s+testing|testing|test\s+automation|jest|cypress|mocha|pytest|tdd|integration\s+testing|qa)\b/i.test(low)) {
    return 'testing_slot'
  }
  if (/\b(kafka|rabbitmq|sqs|sns|redis|pub\/sub|celery|eventbridge|streaming|event-driven)\b/i.test(low)) {
    return 'messaging_slot'
  }
  if (/\b(typescript|react|next\.?js|redux|tailwind|vue|angular|frontend|ui)\b/i.test(low)) {
    return 'frontend_slot'
  }
  if (/\b(graphql|rest|restful|swagger|websockets?|grpc|fastapi|openapi|apis?|jwt|oauth)\b/i.test(low)) {
    return 'api_slot'
  }
  for (const [slotName, slotDef] of Object.entries(SEMANTIC_SLOTS)) {
    if (slotDef.matchKw.test(kw)) return slotName
  }
  return 'cloud_slot'
}

export function cleanTargetRoleTitle(prefix, baseRole) {
  if (!baseRole && !prefix) return 'Professional'
  if (!baseRole) return String(prefix).trim()
  if (!prefix) {
    return String(baseRole)
      .replace(/^((?:senior|lead|principal|staff|junior|mid-level)\s+)(?:\1)+/i, '$1')
      .trim()
  }
  const clean = String(baseRole).replace(/^((?:senior|lead|principal|staff|junior|mid-level)\s+)+/i, '').trim()
  return `${String(prefix).trim()} ${clean}`.trim()
}

/**
 * Comprehensive Knowledge Base for Companion Interview Talking Points & Keyword Transparency Ledger
 */
export const KEYWORD_INTERVIEW_CHEATSHEET = {
  kafka: {
    whyRecruiterLookedForThis: 'High-throughput event streaming is a core requirement for modern distributed architectures. Recruiters screen for Kafka to verify you can decouple microservices asynchronously and handle data at scale.',
    howToSpeakToIt: 'Emphasize your understanding of topic partitions, consumer groups, offset commits, retention policies, and exactly how at-least-once delivery or backpressure handling prevented message loss.',
    sampleInterviewAnswer: 'In our architecture, we leveraged Kafka as the central event bus between our ingestion layer and downstream consumers. I configured consumer groups to scale horizontally across partitions, ensuring fault-tolerant delivery and sub-100ms processing latencies.',
    keyConceptsToMention: ['Partitions & Consumer Groups', 'At-Least-Once Delivery', 'Backpressure Handling', 'Schema Registry / Avro'],
  },
  typescript: {
    whyRecruiterLookedForThis: 'Type safety drastically reduces runtime errors in large-scale full-stack and frontend codebases. Recruiters and engineering managers view TypeScript as a standard indicator of production engineering maturity.',
    howToSpeakToIt: 'Discuss interface contracts, generics, strict null checks, discriminated unions, and how type inference streamlined team collaboration and eliminated regression bugs during refactors.',
    sampleInterviewAnswer: 'We transitioned our codebase to TypeScript with strict type checking. By defining shared domain interfaces and strict contract validation across API boundaries, we eliminated common runtime null-pointer exceptions and made large refactors painless across the team.',
    keyConceptsToMention: ['Strict Null Checking', 'Discriminated Unions', 'Generic Constraints', 'API Contract Types'],
  },
  'unit testing': {
    whyRecruiterLookedForThis: 'Hiring teams want engineers who ship reliable code that does not break in production. Automated unit testing proves you write modular, testable code and protect business logic against regressions.',
    howToSpeakToIt: 'Focus on test coverage metrics, mocking external dependencies/APIs, edge case validation, and incorporating unit tests into pre-commit hooks and CI/CD pull request gates.',
    sampleInterviewAnswer: 'I prioritize automated unit testing using frameworks like Jest and PyTest. I focus on testing business logic edge cases, mocking third-party integrations, and maintaining automated CI test suites that keep our regression rate near zero.',
    keyConceptsToMention: ['Mocking & Dependency Injection', 'Edge Case Coverage', 'Regression Prevention', 'TDD & CI Gates'],
  },
  git: {
    whyRecruiterLookedForThis: 'Git is the universal foundation for team collaboration, code reviews, and release management in modern engineering workflows.',
    howToSpeakToIt: 'Highlight trunk-based development or GitFlow, rebasing vs merging, interactive rebases for clean commit histories, and pull request review workflows with CI gate checks.',
    sampleInterviewAnswer: 'We used Git for our entire development lifecycle, utilizing feature branching and pull request reviews with automated CI checks. I kept history clean with rebasing and ensured that every PR required peer approval and passing test suites before merging.',
    keyConceptsToMention: ['Feature Branching & GitFlow', 'Interactive Rebase & Clean History', 'Merge Conflict Resolution', 'PR Review Gates'],
  },
  docker: {
    whyRecruiterLookedForThis: 'Containerization guarantees reproducible environments across dev, staging, and production. Recruiters look for Docker as fundamental evidence of cloud-ready engineering.',
    howToSpeakToIt: 'Talk about multi-stage builds for minimal image size, container isolation, layer caching, and docker-compose for local integration testing.',
    sampleInterviewAnswer: 'I containerized our microservices using multi-stage Dockerfiles to minimize attack surface and image size, reducing our deployment image sizes by 65% and eliminating "works on my machine" inconsistencies.',
    keyConceptsToMention: ['Multi-Stage Builds', 'Layer Caching', 'Container Isolation', 'Minimal Base Images (Alpine/Distroless)'],
  },
  kubernetes: {
    whyRecruiterLookedForThis: 'Container orchestration at scale requires Kubernetes knowledge. Recruiters view K8s experience as a high-signal indicator of senior cloud systems proficiency.',
    howToSpeakToIt: 'Discuss Pods, Deployments, Services, Ingress, Horizontal Pod Autoscaling (HPA), Helm charts, and health probes (readiness/liveness).',
    sampleInterviewAnswer: 'I managed container deployments on Kubernetes clusters using Helm charts, configuring Horizontal Pod Autoscalers and readiness/liveness probes to maintain 99.99% service availability during traffic spikes.',
    keyConceptsToMention: ['Deployments & Services', 'Horizontal Pod Autoscaling (HPA)', 'Readiness & Liveness Probes', 'Helm Charts & Ingress'],
  },
  aws: {
    whyRecruiterLookedForThis: 'AWS is the dominant cloud platform; hands-on experience with core primitives (ECS, S3, IAM, Lambda, RDS) proves cloud deployment autonomy.',
    howToSpeakToIt: 'Highlight least-privilege IAM roles, automated infrastructure provisioning, multi-AZ high availability, and CloudWatch metrics for real-time observability.',
    sampleInterviewAnswer: 'We deployed our microservices on AWS using containerized services with auto-scaling policies, least-privilege IAM security roles, and CloudWatch metrics for real-time observability.',
    keyConceptsToMention: ['Least-Privilege IAM', 'Multi-AZ High Availability', 'Auto-scaling & CloudWatch', 'Serverless & Container Primitives'],
  },
  graphql: {
    whyRecruiterLookedForThis: 'GraphQL solves over-fetching and under-fetching, allowing frontend teams to query flexible nested data in a single round-trip.',
    howToSpeakToIt: 'Explain schema design, resolver optimization, avoiding the N+1 problem with DataLoader, and caching strategies.',
    sampleInterviewAnswer: 'We implemented GraphQL to consolidate multiple REST endpoints into a unified schema, utilizing DataLoader for batching and caching to solve the N+1 database query problem.',
    keyConceptsToMention: ['Schema Design & Resolvers', 'DataLoader & N+1 Prevention', 'Type Safety & Introspection', 'Query Complexity Analysis'],
  },
  redis: {
    whyRecruiterLookedForThis: 'In-memory caching and data structures are essential for sub-millisecond data retrieval, session storage, and rate limiting.',
    howToSpeakToIt: 'Discuss read-aside caching, cache invalidation strategies (TTL vs write-through), cache penetration/stampede prevention, and Redis data structures (hashes, sorted sets).',
    sampleInterviewAnswer: 'I implemented a Redis read-aside caching layer for our high-frequency query endpoints with calibrated TTLs, offloading 75% of read queries from our primary database.',
    keyConceptsToMention: ['Read-Aside Caching', 'TTL & Eviction Policies', 'Cache Stampede Mitigation', 'Distributed Locks'],
  },
  'ci/cd': {
    whyRecruiterLookedForThis: 'Automated build, test, and release pipelines directly impact engineering velocity and production reliability.',
    howToSpeakToIt: 'Describe pipeline stages (lint, test, build, scan, deploy), blue/green or canary deployments, and automated rollbacks.',
    sampleInterviewAnswer: 'I architected our CI/CD pipeline using GitHub Actions, automating test suites and security scans on every PR and enabling zero-downtime canary deployments to production.',
    keyConceptsToMention: ['Automated Linting & Test Gates', 'Blue-Green / Canary Releases', 'Automated Rollback', 'Secret Management'],
  },
  postgresql: {
    whyRecruiterLookedForThis: 'PostgreSQL is the industry-standard relational database for ACID compliance, complex queries, and JSONB capabilities.',
    howToSpeakToIt: 'Talk about query indexing (B-Tree, GIN), EXPLAIN ANALYZE for query optimization, connection pooling, and transactional integrity.',
    sampleInterviewAnswer: 'I optimized our PostgreSQL database through index restructuring and query plan analysis with EXPLAIN ANALYZE, resolving slow queries and scaling our concurrent connection capacity.',
    keyConceptsToMention: ['B-Tree & GIN Indexing', 'EXPLAIN ANALYZE Tuning', 'Connection Pooling (PgBouncer)', 'ACID Transactions & Row Locking'],
  },
}

export function getTalkingPointsForKeyword(keyword, slot = 'cloud_slot') {
  const low = String(keyword || '').toLowerCase().trim()
  if (KEYWORD_INTERVIEW_CHEATSHEET[low]) {
    return { ...KEYWORD_INTERVIEW_CHEATSHEET[low] }
  }
  for (const [key, data] of Object.entries(KEYWORD_INTERVIEW_CHEATSHEET)) {
    if (low.includes(key) || key.includes(low)) {
      return { ...data }
    }
  }
  return {
    whyRecruiterLookedForThis: `Recruiters screen for ${keyword} as an industry-standard skill to verify hands-on execution and modern stack proficiency.`,
    howToSpeakToIt: `Explain your architecture decisions with ${keyword}, how you integrated it with surrounding services, and the measurable reliability or performance gains achieved.`,
    sampleInterviewAnswer: `I leveraged ${keyword} to streamline our engineering workflow and enhance production stability, ensuring our team delivered dependable, scalable results.`,
    keyConceptsToMention: ['Architecture Integration', 'Production Best Practices', 'Error Handling & Resilience', 'Performance Tuning'],
  }
}

export function buildInterviewTalkingPointsLedger(wovenResults = []) {
  if (!Array.isArray(wovenResults)) return []
  return wovenResults.map((item) => {
    const kw = item.wovenKeyword || (Array.isArray(item.wovenKeywords) ? item.wovenKeywords[0] : '') || ''
    const points = item.interviewTalkingPoints || getTalkingPointsForKeyword(kw, item.slot)
    return {
      keyword: kw,
      slot: item.slot || 'cloud_slot',
      bulletId: item.bulletId,
      company: item.company || '',
      role: item.role || '',
      originalBullet: item.originalText || '',
      wovenBullet: item.readyToUseRewrite || item.rewrittenText || '',
      recruiterCritique: item.recruiterCritique || '',
      interviewTalkingPoints: points,
      whyRecruiterLookedForThis: points.whyRecruiterLookedForThis,
      howToSpeakToIt: points.howToSpeakToIt,
      sampleInterviewAnswer: points.sampleInterviewAnswer,
      keyConceptsToMention: points.keyConceptsToMention,
    }
  })
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
    const role = exp.role || exp.title || 'Professional'
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

    // Context-anchored insertion rules for top high-frequency keywords:
    const kwLower = kw.toLowerCase()

    // 1. Kafka: event-driven, telemetry, ingestion, streaming pipelines
    if (kwLower === 'kafka') {
      if (/\b(event-driven|telemetry|ingestion|streaming|data\s+pipeline)\b/i.test(cleaned)) {
        if (/\bin\s+([A-Za-z]+)\b/i.test(cleaned) && !/\bin\s+[A-Za-z]+\s+and\b/i.test(cleaned)) {
          cleaned = cleaned.replace(/\bin\s+([A-Za-z]+)\b/i, 'in $1 and Kafka')
          return `${cleaned}${trailingPunct}`
        }
      }
    }

    // 2. TypeScript: React, Node, frontend, type-safe APIs
    if (kwLower === 'typescript') {
      if (/\bin\s+React\b/i.test(cleaned) && !/typescript/i.test(cleaned)) {
        cleaned = cleaned.replace(/\bin\s+React\b/i, 'in React, TypeScript,')
        cleaned = cleaned.replace(/\s*,\s*,/g, ',')
        return `${cleaned}${trailingPunct}`
      }
    }

    // 3. Unit Testing: test suites, code coverage, test automation
    if (kwLower === 'unit testing') {
      if (/\b(test\s+suites?|coverage)\b/i.test(cleaned) && !/unit testing/i.test(cleaned)) {
        cleaned = cleaned.replace(/\b(test\s+suites?)\b/i, '$1 with automated Unit Testing')
        return `${cleaned}${trailingPunct}`
      }
    }

    // 4. Git: CI/CD, version control, branching, infrastructure
    if (kwLower === 'git') {
      if (/\busing\s+([A-Za-z0-9\s,&/+-]+?)\s+and\s+([A-Za-z0-9\s,&/+-]+?)(?=\s*,|\s+cutting|\s+reducing|\s+improving|$)/i.test(cleaned) && !/\bgit\b/i.test(cleaned)) {
        cleaned = cleaned.replace(
          /\busing\s+([A-Za-z0-9\s,&/+-]+?)\s+and\s+([A-Za-z0-9\s,&/+-]+?)(?=\s*,|\s+cutting|\s+reducing|\s+improving|$)/i,
          'using $1, Git, and $2'
        )
        return `${cleaned}${trailingPunct}`
      }
    }

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

    // 3. Natural domain-safe insertion
    if (/\b((?:technology|tech)?\s*stack|tools?|technologies|frameworks?|libraries)\b/i.test(cleaned)) {
      cleaned = cleaned.replace(/\b((?:technology|tech)?\s*stack|tools?|technologies|frameworks?|libraries)\b/i, (m) => `${m} including ${kw}`)
    } else if (/\b(?:built|developed|engineered|implemented|designed)\b/i.test(cleaned) && !/\bwith\s+[A-Z]/i.test(cleaned)) {
      const m = cleaned.match(/\b(built|developed|engineered|implemented|designed)\s+([a-zA-Z\s-]+?)(?=\s+(?:handling|processing|serving|cutting|reducing|delivering|supporting|achieving|generating|scaling|to|for|at|by|\d)|(?:,\s*[a-zA-Z])|$)/i)
      if (m) {
        cleaned = cleaned.replace(m[0], `${m[0].trim()} using ${kw}`)
      } else {
        cleaned = `${cleaned} (leveraging ${kw} for execution)`
      }
    } else {
      // Graceful trailing integration
      cleaned = `${cleaned} (leveraging ${kw} for execution)`
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
        interviewTalkingPoints: getTalkingPointsForKeyword(cand.keyword, slot),
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

  // Build companion Interview Talking Points & Keyword Transparency Ledger
  const ledger = buildInterviewTalkingPointsLedger(results)
  results.keywordTransparencyLedger = ledger
  results.interviewTalkingPoints = ledger

  return results
}

export default {
  computeKeywordAlignment,
  weaveKeywordsIntoBullets,
  determineSemanticSlot,
  cleanTargetRoleTitle,
  buildInterviewTalkingPointsLedger,
  getTalkingPointsForKeyword,
  KEYWORD_INTERVIEW_CHEATSHEET,
  SEMANTIC_SLOTS,
  MARKET_ROLE_KEYWORD_PACKS,
  KEYWORD_SYNONYMS,
}
