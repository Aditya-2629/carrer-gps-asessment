/**
 * Resume Post-LLM Validator & Intake Normalizer
 * Enforces Absolute Truth, Number Integrity, Safe Marker Stripping,
 * Grammar Normalization, and Missing Keywords Injection with Evidence Verification.
 */

export const SENTINEL_ONLY = /^(?:degree|university|college|school|company|candidate|resume|n\/a|null|undefined)$/i
export const SENTINEL_DEBUG = /\[Extracted Document Links:[^\]]*\]|\bundefined\b|\bnull\b/gi
export const PLACEHOLDER_REGEX = /\[(?:ADD|TODO|TBD|INSERT)[^\]]*\]/i

export const BANNED_BUZZWORDS = [
  'spearheaded', 'leveraged', 'synergistic', 'cutting-edge',
  'results-driven', 'passionate', 'dynamic', 'detail-oriented',
  'responsible for', 'as measured', 'hardworking', 'team player',
]

export const META_COMMENTARY_WORDS = /\b(maintained clean chronological formatting|chronological formatting|integrating [A-Za-z0-9\s]+ into the primary|format of the resume|section with verified dates|re-written to|rewritten for ATS|as requested in the prompt)\b/i
export const ACTION_VERB_REGEX = /\b(built|developed|designed|implemented|automated|led|reduced|increased|analy[sz]ed|delivered|created|managed|architected|migrated|optimized|engineered|spearheaded|orchestrated|coordinated|facilitated|deployed|resolved|scaled|formulated|directed|established|executed)\w*/i
export const COMPANY_HEADER_REGEX = /^(?:Kitcoek|Recibo|Accenture|Deloitte|Infosys|TCS|PwC|Amazon|Google|Microsoft|\b[A-Za-z0-9\s&.,-]{2,40}\s+(?:Technologies|Tech|Solutions|Pvt|Ltd|LLC|Inc|Corporation|Corp))\b/i

// Safe bullet marker regex preserving leading Markdown bold tags (e.g. **Built**)
export const SAFE_BULLET_STRIP_REGEX = /^([•\-\u2022\u25E6\u2043\u2219]|\*(?!\*))\s*/

const pad = (n, w = 3) => String(n).padStart(w, '0')

/**
 * Safely extracts a clean string from any data type
 */
export function safeString(val) {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) return val.map(safeString).filter(Boolean).join(' ')
  if (typeof val === 'object') {
    return safeString(val.text || val.name || val.raw || val.value || val.summary || val.description || val.title || '')
  }
  return String(val || '')
}

/**
 * Safely extracts location from string or structured object
 */
export function extractLocation(loc) {
  if (!loc) return ''
  if (typeof loc === 'string') return loc
  if (typeof loc === 'object') {
    const parts = [loc.city, loc.state, loc.country].filter(Boolean)
    if (parts.length > 0) return parts.join(', ')
    return safeString(loc)
  }
  return String(loc || '')
}

/**
 * Date Range Formatter:
 * const range = (s, e, cur) => { const end = cur ? 'Present' : (e || ''); return s && end ? `${s} – ${end}` : (end || s || ''); }
 * Never outputs 'undefined' or orphan dashes (e.g. 'Jan 2019 – ').
 */
export const formatDateRange = (s, e, cur) => {
  const cleanStart = String(s || '').replace(/\s*[–-]\s*$/, '').trim()
  const rawEnd = cur ? 'Present' : String(e || '').replace(/^\s*[–-]\s*/, '').trim()
  const end = rawEnd === 'undefined' || rawEnd === 'null' ? '' : rawEnd
  const start = cleanStart === 'undefined' || cleanStart === 'null' ? '' : cleanStart

  if (start && end && start !== end) {
    return `${start} – ${end}`
  }
  return end || start || ''
}

/**
 * Grammar & Legacy Phrase Normalizer
 * Eliminates orphan commas, broken prepositions, and repairs known glitches.
 */
export function repairGrammar(rawText) {
  if (!rawText || typeof rawText !== 'string') return ''

  let text = rawText
    // Safe bullet marker stripping preserving **bold**
    .replace(SAFE_BULLET_STRIP_REGEX, '')
    // Repair legacy broken phrases
    .replace(/\bEliminated of manual\b/gi, 'Eliminated manual')
    .replace(/\breduced of\b/gi, 'reduced')
    .replace(/\bassisted with to\b/gi, 'assisted with')
    .replace(/\bachievedsecurity\b/gi, 'achieved security')
    .replace(/\bzero-\s+downtime\b/gi, 'zero-downtime')
    .replace(/\bintent-\s+classification\b/gi, 'intent-classification')
    // Buzzword rephrasings
    .replace(/\bas measured by\s+([^,.;]+)/gi, 'targeting $1')
    .replace(/\s*—\s*/g, ', ')
    .replace(SENTINEL_DEBUG, '')
    // Clean dangling placeholder phrases cleanly
    .replace(/\s*,?\s*(?:achieving|supporting|delivering|by|with|to|for|at|across)\s*\[(?:ADD|TODO|TBD|INSERT)[^\]]*\]/gi, '')
    .replace(PLACEHOLDER_REGEX, '')
    // Strip orphan prepositions before punctuation
    .replace(/\s+(?:by|to|of|across|for|with|at|in|from|supporting|driving|achieving|delivering)\s*([.,;])/gi, '$1')
    .replace(/\s*,+\s*,+/g, ', ')
    .replace(/\s+([.,;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return text
}

/**
 * Truth-First Number Integrity Checker:
 * Normalizes numbers by ignoring currency symbols, commas, whitespace, AND '+' signs
 * (e.g. '50+' in original matches '50' in rewrite without false violations).
 */
const normNum = (s) => s.replace(/[\$,\s+]/g, '').toLowerCase()
const NUM_REGEX = /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|[KMBkmb]\b|x\b)?\+?/g
const extractNumbers = (t) => new Set((String(t || '').match(NUM_REGEX) || []).map(normNum))

export function findNumberViolations(originalText, bulletText) {
  const orig = extractNumbers(originalText)
  const rew = extractNumbers(bulletText)
  return [...rew].filter((n) => !orig.has(n))
}

/**
 * Bracket-Aware Skill Tokenizer:
 * Never splits skills across unclosed parentheses (...) or compound slashes (A/B Testing, CI/CD).
 */
export function tokenizeSkillsSafe(rawSkillStr) {
  if (!rawSkillStr || typeof rawSkillStr !== 'string') return []
  const tokens = []
  let current = []
  let depth = 0

  for (let i = 0; i < rawSkillStr.length; i++) {
    const ch = rawSkillStr[i]
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)

    if ((ch === ',' || ch === ';') && depth === 0) {
      const token = current.join('').trim()
      if (token) tokens.push(token)
      current = []
    } else {
      current.push(ch)
    }
  }

  const lastToken = current.join('').trim()
  if (lastToken) tokens.push(lastToken)
  return tokens
}

/**
 * Identifies if a bullet is purely a leaked employer/location header
 */
export function isLeakedHeader(text) {
  const t = String(text || '').trim()
  if (t.length < 15) return true
  const isCompanyLike = COMPANY_HEADER_REGEX.test(t)
  return isCompanyLike && !ACTION_VERB_REGEX.test(t)
}

/**
 * Categorizes a skill into an exact ATS bucket based on target role
 */
export function determineSkillBucket(skill, targetRole = '') {
  const low = String(skill || '').toLowerCase()
  const isDataRole = /data|analyst|analytics|bi\b|sql|tableau|power bi/i.test(targetRole)

  if (isDataRole) {
    if (/sql|snowflake|bigquery|postgresql|mysql|t-sql|queries/i.test(low)) return 'SQL & Core Database'
    if (/power bi|tableau|looker|excel|dashboards|reporting|dax/i.test(low)) return 'BI & Visualization'
    if (/python|machine learning|predictive|regression|hypothesis|a\/b|pandas|numpy/i.test(low)) return 'Analytics & Machine Learning'
    if (/aws|azure|dbt|alteryx|airflow|etl|databricks|spark/i.test(low)) return 'Cloud & Data Engineering'
    return 'Business Analysis & Process'
  }

  // SWE / AI / Full Stack
  if (/python|javascript|typescript|go\b|golang|bash|c\+\+|java\b|\bc\b|\br\b|rust|c#/i.test(low)) return 'Programming Languages'
  if (/langchain|fastmcp|smolagents|rag|llm|tensorflow|pytorch|openai|gemini|nlp|genai/i.test(low)) return 'AI & Machine Learning Systems'
  if (/fastapi|node|express|flask|django|react|next\.js|rest|graphql|microservices|system design/i.test(low)) return 'Backend & Architecture'
  if (/aws|docker|kubernetes|terraform|ci\/cd|jenkins|git|cloud|linux/i.test(low)) return 'Cloud & DevOps'
  return 'Databases & Caching'
}

/**
 * Universal Canonical Adapter: Normalizes all raw parser variations
 * into consistent fields (candidate_name, target_role, contact, experiences with IDs)
 */
export function normalizeCanonical(raw = {}) {
  const c = raw.candidate || {}
  const exps = raw.experiences || raw.experience || []
  const projs = raw.projects || raw.featuredProjects || []
  const edu = raw.education || raw.educations || []
  const certs = raw.certifications || raw.licensesAndCertifications || []

  let rawSummary = safeString(
    raw.summary?.text ?? (typeof raw.summary === 'string' ? raw.summary : (raw.professional_summary || raw.summaryText || ''))
  )

  return {
    ...raw,
    candidate_name: safeString(c.name || raw.candidate_name || raw.name || ''),
    target_role: safeString(c.targetRole || raw.target_role || raw.targetRole || ''),
    contact: c.contact || raw.contact || {},
    summary: rawSummary,
    years_of_experience: raw.years_of_experience || raw.yearsExperience || 3,
    experiences: exps.map((e, i) => {
      const id = e.id ?? `exp_${pad(i + 1, 3)}`
      return {
        ...e,
        id,
        company: safeString(e.company || e.employer || ''),
        role: safeString(e.role || e.title || ''),
        location: extractLocation(e.location),
        duration: formatDateRange(e.startDate, e.endDate || e.duration, e.isCurrent) || safeString(e.duration || '').replace(/\s*[–-]\s*$/, ''),
        bullets: (e.bullets || []).map((b, j) => {
          const text = safeString(b)
          const bId = b?.id || `${id}_b${pad(j + 1, 2)}`
          return { id: bId, text }
        }),
      }
    }),
    projects: projs.map((p, i) => {
      const id = p.id ?? `proj_${pad(i + 1, 3)}`
      return {
        ...p,
        id,
        title: safeString(p.title || p.name || 'Project'),
        techStack: safeString(p.techStack || (Array.isArray(p.technologies) ? p.technologies.join(', ') : (p.technologies || ''))),
        dates: formatDateRange(p.startDate, p.endDate || p.dates, false) || safeString(p.dates || '').replace(/\s*[–-]\s*$/, ''),
        link: safeString(p.link || p.github || ''),
        bullets: (Array.isArray(p.bullets) ? p.bullets : [p.description].filter(Boolean)).map((b, j) => {
          const text = safeString(b)
          const bId = b?.id || `${id}_b${pad(j + 1, 2)}`
          return { id: bId, text }
        }),
      }
    }),
    education: edu.map((ed) => ({
      degree: safeString(ed.degree || ed.degreeName || (typeof ed === 'string' ? ed : '')),
      school: safeString(ed.school || ed.institution || ed.university || ''),
      location: extractLocation(ed.location),
      dates: formatDateRange(ed.startDate, ed.endDate || ed.dates || ed.year, false) || safeString(ed.dates || ed.year || '').replace(/\s*[–-]\s*$/, ''),
    })),
    certifications: certs.map((ct) => safeString(typeof ct === 'string' ? ct : ct?.name || ct?.title || '')).filter(Boolean),
  }
}

/**
 * Known semantic aliases mapping JD skills to verified candidate equivalents
 */
const EVIDENCE_ALIASES = {
  python: ['fastapi', 'flask', 'django', 'pandas', 'numpy', 'scipy', 'pytorch', 'tensorflow', 'smolagents', 'langchain', 'backend'],
  sql: ['postgresql', 'postgres', 'mysql', 'sqlite', 'snowflake', 'bigquery', 'oracle', 't-sql', 'rdbms', 'queries', 'relational database', 'relational databases'],
  postgresql: ['sql', 'postgres', 'relational database', 'relational databases', 'rdbms', 'queries', 'database'],
  postgres: ['sql', 'postgresql', 'relational database', 'relational databases', 'rdbms', 'queries'],
  mysql: ['sql', 'relational database', 'relational databases', 'rdbms', 'queries'],
  aws: ['cloud', 'cloud infrastructure', 'ec2', 's3', 'lambda', 'ecs', 'eks', 'cloudformation', 'dynamodb', 'cloudwatch', 'iam'],
  docker: ['container', 'containers', 'containerized', 'kubernetes', 'k8s', 'dockerfile', 'compose'],
  kubernetes: ['docker', 'container', 'containers', 'k8s', 'helm', 'cluster'],
  'ci/cd': ['jenkins', 'github actions', 'gitlab ci', 'pipeline', 'deployment', 'devsecops'],
  rag: ['fastmcp', 'langchain', 'vector db', 'chromadb', 'pinecone', 'embedding', 'retrieval'],
  fastapi: ['rest api', 'restful api', 'microservices', 'python backend', 'endpoints', 'apis'],
  redis: ['cache', 'caching', 'in-memory', 'key-value', 'queue'],
  'data visualization': ['tableau', 'power bi', 'looker', 'dashboards', 'metabase'],
}

/**
 * Checks if a URL is fake, dummy, or sentinel
 */
function isFakeUrl(url) {
  if (!url) return true
  return /example\.com|fakeurl|dummy|placeholder|localhost|\[|\]/i.test(url)
}

/**
 * Main Sanitizer & Validator Engine
 * Contract: returns { sanitizedResume, warnings, appliedKeywords, pendingKeywords }
 */
export function sanitizeAndValidateResume(canonicalResume = {}, tailoredBullets = [], jdKeywords = []) {
  const warnings = []
  const appliedKeywords = []
  const pendingKeywords = []

  const normalized = normalizeCanonical(canonicalResume)
  const sanitized = JSON.parse(JSON.stringify(normalized))

  // 1. Build fast rewrite lookup map by exact ID
  const rewriteMap = new Map()
  if (Array.isArray(tailoredBullets)) {
    tailoredBullets.forEach((b) => {
      const id = b.id || b.bulletId
      const text = b.rewrite || b.rewrittenText || b.text
      if (id && text) {
        rewriteMap.set(id, text)
      }
    })
  }

  // 2. Build full candidate text corpus for evidence verification
  const candidateCorpusParts = [
    sanitized.candidate_name,
    sanitized.summary,
    sanitized.target_role,
    JSON.stringify(sanitized.skills || []),
    ...(sanitized.experiences || []).flatMap((e) => [e.company, e.role, ...(e.bullets || []).map((b) => b.text)]),
    ...(sanitized.projects || []).flatMap((p) => [p.title, p.techStack, ...(p.bullets || []).map((b) => b.text)]),
    ...(sanitized.education || []).flatMap((ed) => [ed.degree, ed.school]),
  ]
  const candidateCorpus = candidateCorpusParts.filter(Boolean).join(' ').toLowerCase()

  // 3. Process Missing JD Keywords
  const normalizedJdKeywords = (Array.isArray(jdKeywords) ? jdKeywords : [])
    .map((item) => {
      if (typeof item === 'string') return { keyword: item.trim(), count: 1 }
      return {
        keyword: String(item?.keyword || item?.name || item?.skill || '').trim(),
        count: item?.count || item?.jdCount || 1,
      }
    })
    .filter((k) => k.keyword.length >= 2)

  const existingSkillsSet = new Set()
  const rawSkills = sanitized.skills || []
  if (Array.isArray(rawSkills)) {
    rawSkills.forEach((s) => {
      const name = typeof s === 'string' ? s : s?.name || ''
      if (name) existingSkillsSet.add(name.toLowerCase().trim())
    })
  } else if (typeof rawSkills === 'object') {
    Object.values(rawSkills).flat().forEach((s) => {
      const name = typeof s === 'string' ? s : s?.name || ''
      if (name) existingSkillsSet.add(name.toLowerCase().trim())
    })
  }

  const verifiedKeywordsToInject = []

  normalizedJdKeywords.forEach(({ keyword, count }) => {
    const kwLow = keyword.toLowerCase()
    if (existingSkillsSet.has(kwLow)) return

    // Evidence check: direct mention in candidate corpus or via verified aliases
    const directMention = new RegExp(`\\b${kwLow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(candidateCorpus)
    const aliases = EVIDENCE_ALIASES[kwLow] || []
    const aliasMention = aliases.some((al) => candidateCorpus.includes(al))
    const hasEvidence = directMention || aliasMention

    if (hasEvidence) {
      // A. Inject into Technical Skills under exact matching category bucket
      const categoryBucket = determineSkillBucket(keyword, sanitized.target_role)
      if (Array.isArray(sanitized.skills)) {
        sanitized.skills.push(keyword)
      } else if (typeof sanitized.skills === 'object' && sanitized.skills !== null) {
        sanitized.skills[categoryBucket] = sanitized.skills[categoryBucket] || []
        if (!sanitized.skills[categoryBucket].includes(keyword)) {
          sanitized.skills[categoryBucket].push(keyword)
        }
      } else {
        sanitized.skills = [keyword]
      }
      existingSkillsSet.add(kwLow)
      appliedKeywords.push({ keyword, location: `Technical Skills (${categoryBucket})` })
      verifiedKeywordsToInject.push({ keyword, kwLow, aliases })
    } else {
      // No evidence: DO NOT inject into resume; push to pendingKeywords
      pendingKeywords.push({
        keyword,
        jdCount: count,
        status: 'Add only if true',
        suggestedLocation: 'Technical Skills or Projects',
      })
    }
  })


  // 4. Candidate Name Sanitization (Never fabricate sentinel defaults)
  let cName = (sanitized.candidate_name || '').replace(SENTINEL_DEBUG, '').trim()
  if (SENTINEL_ONLY.test(cName)) {
    warnings.push({ type: 'missing_field', field: 'candidate_name', message: 'Candidate name was sentinel and was suppressed' })
    cName = ''
  }
  sanitized.candidate_name = cName

  // 5. Contact & Location Sanitization
  if (sanitized.contact) {
    let loc = String(sanitized.contact.location || '').replace(SENTINEL_DEBUG, '').trim()
    const looksLikePlace = /^[\p{L} .'-]+(?:,\s*[\p{L} .'-]{2,})?$|^[\p{L}]{2,}$/u.test(loc)
    const rawSkillsArr = Array.isArray(sanitized.skills) ? sanitized.skills : Object.values(sanitized.skills || {}).flat()
    const skillSet = new Set(rawSkillsArr.map((s) => (typeof s === 'string' ? s.toLowerCase() : (s?.name || '').toLowerCase())))

    if (!looksLikePlace || loc.split(/,\s*/).some((p) => skillSet.has(p.toLowerCase()))) {
      warnings.push({ type: 'invalid_location', location: loc, message: `Invalid location removed: "${loc}"` })
      sanitized.contact.location = ''
    }
    if (sanitized.contact.email) sanitized.contact.email = sanitized.contact.email.replace(SENTINEL_DEBUG, '').trim()
    if (sanitized.contact.linkedin) {
      sanitized.contact.linkedin = sanitized.contact.linkedin.replace(SENTINEL_DEBUG, '').trim()
      if (isFakeUrl(sanitized.contact.linkedin)) {
        warnings.push({ type: 'missing_field', field: 'linkedin', message: 'LinkedIn URL was dummy or invalid' })
        sanitized.contact.linkedin = ''
      }
    }
    if (sanitized.contact.github) {
      sanitized.contact.github = sanitized.contact.github.replace(SENTINEL_DEBUG, '').trim()
      if (isFakeUrl(sanitized.contact.github)) {
        warnings.push({ type: 'missing_field', field: 'github', message: 'GitHub URL was dummy or invalid' })
        sanitized.contact.github = ''
      }
    }
  }

  // 6. Professional Summary
  let sum = sanitized.summary || ''
  if (sum) {
    sum = repairGrammar(sum)
    const openP = (sum.match(/\(/g) || []).length
    const closeP = (sum.match(/\)/g) || []).length
    if (openP > closeP) sum += ')'.repeat(openP - closeP)
    if (!/[.!?]$/.test(sum)) sum += '.'
    sanitized.summary = sum
  }

  // 7. Known Companies for Cross-Company Leak Detection
  const allCompanies = (sanitized.experiences || [])
    .map((e) => String(e.company || '').trim())
    .filter((c) => c && c.length >= 3)

  // 8. Experience Sanitization & ID-based Tailoring (NEVER drop a role)
  sanitized.experiences = (sanitized.experiences || []).map((exp, expIdx) => {
    let company = String(exp.company || '').replace(SENTINEL_DEBUG, '').trim()
    if (SENTINEL_ONLY.test(company)) {
      warnings.push({ type: 'missing_field', field: 'company', index: expIdx, message: 'Company was sentinel and was suppressed' })
      company = ''
    }

    let role = String(exp.role || '').replace(SENTINEL_DEBUG, '').trim()
    if (SENTINEL_ONLY.test(role)) {
      warnings.push({ type: 'missing_field', field: 'role', index: expIdx, message: 'Role was sentinel and was suppressed' })
      role = ''
    }

    // Role cleaner with word boundary
    role = role.replace(/\s*[(|,-]?\s*\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}.*$/i, '')
               .replace(/\s*\b(?:19|20)\d{2}\b.*$/, '').trim()

    // Deduplicate location if present inside company string
    let location = String(exp.location || '').trim()
    if (company && location && company.toLowerCase().includes(location.toLowerCase())) {
      company = company.replace(new RegExp(`,?\\s*${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '').trim()
    }

    const cleanBullets = []
    ;(exp.bullets || []).forEach((b) => {
      const origText = b.text || ''
      const bId = b.id || `exp_${pad(expIdx + 1, 3)}_b01`
      let candidateText = rewriteMap.get(bId) || origText

      // Check Placeholders: Never delete text leaving an incomplete fragment.
      // If a rewrite contains [ADD: ...] or placeholder markers, REVERT to original candidate bullet.
      if (PLACEHOLDER_REGEX.test(candidateText)) {
        warnings.push({ type: 'needs_input', bulletId: bId, message: `Rewrite contained unresolved placeholder; reverted to original bullet.` })
        candidateText = origText
      }

      // Truth Check: Strict Number Integrity
      const fabricated = findNumberViolations(origText, candidateText)
      if (fabricated.length > 0) {
        warnings.push({
          type: 'number_violation',
          original: origText,
          rewrite: candidateText,
          fabricatedNumbers: fabricated,
          message: `Fabricated numbers [${fabricated.join(', ')}] in ${bId}; reverted to original text.`,
        })
        candidateText = origText
      }

      // Check Meta-Commentary: Revert if contaminated
      if (META_COMMENTARY_WORDS.test(candidateText)) {
        warnings.push({ type: 'meta_commentary', bulletId: bId, message: `Meta-commentary dropped in ${bId}; reverted to original.` })
        candidateText = origText
      }

      // Cross-company leak check (e.g. Shure inside PwC)
      const otherCompanies = allCompanies.filter((c) => c.toLowerCase() !== company.toLowerCase())
      for (const otherC of otherCompanies) {
        if (otherC.length >= 4 && new RegExp(`\\b${otherC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(candidateText)) {
          warnings.push({ type: 'cross_company_leak', company: otherC, hostCompany: company, bulletId: bId })
          candidateText = candidateText.replace(new RegExp(`\\s*(?:at|for|with)\\s+${otherC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+[A-Za-z]+)?`, 'gi'), '').trim()
        }
      }

      // Generic Term Rephrasing for verified JD keywords
      for (const item of verifiedKeywordsToInject) {
        const { keyword, kwLow } = item
        const genericRules = [
          {
            matches: ['sql', 'postgresql', 'postgres', 'mysql', 'oracle'],
            test: /\brelational databases?\b|\brdbms\b/i,
            replace: (t) => t.replace(/\brelational databases?\b|\brdbms\b/gi, `${keyword} database`),
          },
          {
            matches: ['docker'],
            test: /\b(?:containers?|containerized|containerization)\b/i,
            replace: (t) => t.replace(/\bcontainerized\b/gi, `${keyword}-containerized`)
                             .replace(/\bcontainers?\b/gi, `${keyword} containers`)
                             .replace(/\bcontainerization\b/gi, `${keyword} containerization`),
          },
          {
            matches: ['aws', 'azure', 'gcp', 'google cloud'],
            test: /\bcloud infrastructure\b|\bcloud environment\b/i,
            replace: (t) => t.replace(/\bcloud infrastructure\b|\bcloud environment\b/gi, `${keyword} cloud infrastructure`),
          },
          {
            matches: ['fastapi', 'express', 'flask'],
            test: /\brestful apis?\b|\brest apis?\b/i,
            replace: (t) => t.replace(/\brestful apis?\b|\brest apis?\b/gi, `${keyword} REST endpoints`),
          },
        ]

        for (const gr of genericRules) {
          if (gr.matches.includes(kwLow) && gr.test.test(candidateText)) {
            candidateText = gr.replace(candidateText)
            appliedKeywords.push({ keyword, location: `Replaced generic terminology in ${bId}` })
            item.injectedInBullet = true
            break
          }
        }
      }

      // Method/Tooling clause injection for verified keywords not yet in a bullet
      for (const item of verifiedKeywordsToInject) {
        if (item.injectedInBullet) continue
        const { keyword, kwLow, aliases } = item
        const hasToolingClause = /\b(using|utilizing|with|via)\s+([^.,;]+)/i.test(candidateText)
        const hasDomainOverlap = aliases.some((al) => candidateText.toLowerCase().includes(al))
        if (hasToolingClause && hasDomainOverlap && !candidateText.toLowerCase().includes(kwLow)) {
          candidateText = candidateText.replace(/\b(using|utilizing|with|via)\s+([^.,;]+)/i, (m, prep, tools) => {
            return `${prep} ${tools.trim()}, and ${keyword}`
          })
          appliedKeywords.push({ keyword, location: `Method/Tooling clause in ${bId}` })
          item.injectedInBullet = true
          break
        }
      }

      // Run Grammar & Legacy Phrase Normalization
      candidateText = repairGrammar(candidateText)

      // Leaked Header Check: discard only pure company/location header lines
      if (isLeakedHeader(candidateText)) {
        warnings.push({ type: 'leaked_header', bullet: candidateText, bulletId: bId })
        return
      }

      // Weak opener check: NEVER drop bullet! Emit warning and KEEP the bullet.
      if (!ACTION_VERB_REGEX.test(candidateText)) {
        warnings.push({ type: 'weak_opener', bullet: candidateText, bulletId: bId })
      }

      if (candidateText && !/[.!?]$/.test(candidateText)) candidateText += '.'
      if (candidateText.length >= 10) {
        cleanBullets.push(candidateText)
      }
    })

    return {
      ...exp,
      company,
      role,
      location,
      duration: formatDateRange(exp.startDate, exp.endDate || exp.duration, exp.isCurrent) || safeString(exp.duration || '').replace(/\s*[–-]\s*$/, ''),
      bullets: cleanBullets,
    }
  })

  // 9. Projects: NEVER drop a project (Preserves Title, Stack, Dates, Label)
  sanitized.projects = (sanitized.projects || []).map((p, pIdx) => {
    let title = String(p.title || '').replace(SENTINEL_DEBUG, '').trim()
    const techStack = p.techStack || ''
    const dates = formatDateRange(p.startDate, p.endDate || p.dates, false) || safeString(p.dates || '').replace(/\s*[–-]\s*$/, '')
    let label = p.label || ''

    if (!label && /(?:Academic|Personal|Team|Capstone)\s+Project/i.test(title)) {
      label = title.match(/(?:Academic|Personal|Team|Capstone)\s+Project/i)[0]
      title = title.replace(new RegExp(`\\s*${label}$`, 'i'), '').trim()
    }

    let link = p.link || ''
    if (isFakeUrl(link)) {
      link = ''
    }

    const cleanBullets = []
    ;(p.bullets || []).forEach((pb) => {
      const origText = pb.text || ''
      const pbId = pb.id || `proj_${pad(pIdx + 1, 3)}_b01`
      let candidateText = rewriteMap.get(pbId) || origText

      if (PLACEHOLDER_REGEX.test(candidateText)) {
        warnings.push({ type: 'needs_input', bulletId: pbId })
        candidateText = origText
      }

      // Check Number Integrity on project rewrites
      const fabricated = findNumberViolations(origText, candidateText)
      if (fabricated.length > 0) {
        warnings.push({
          type: 'number_violation',
          original: origText,
          rewrite: candidateText,
          fabricatedNumbers: fabricated,
          message: `Fabricated numbers [${fabricated.join(', ')}] in ${pbId}; reverted to original text.`,
        })
        candidateText = origText
      }

      candidateText = repairGrammar(candidateText)

      // Weak opener check: emit warning and KEEP bullet
      if (!ACTION_VERB_REGEX.test(candidateText)) {
        warnings.push({ type: 'weak_opener', bullet: candidateText, bulletId: pbId })
      }

      if (candidateText && !/[.!?]$/.test(candidateText)) candidateText += '.'
      if (candidateText.length >= 10 && !META_COMMENTARY_WORDS.test(candidateText)) {
        cleanBullets.push(candidateText)
      }
    })

    return {
      title,
      techStack,
      dates,
      label,
      link,
      bullets: cleanBullets,
    }
  }).filter((p) => p.title)

  // 10. Education (Never output sentinel defaults)
  sanitized.education = (sanitized.education || []).map((edu, eduIdx) => {
    let degree = String(edu.degree || '').trim().replace(/^Degree,?\s*/i, '').replace(SENTINEL_DEBUG, '').trim()
    let school = String(edu.school || '').trim().replace(SENTINEL_DEBUG, '').trim()

    if (SENTINEL_ONLY.test(degree)) {
      warnings.push({ type: 'missing_field', field: 'degree', index: eduIdx, message: 'Degree was sentinel and was suppressed' })
      degree = ''
    }
    if (SENTINEL_ONLY.test(school)) {
      warnings.push({ type: 'missing_field', field: 'school', index: eduIdx, message: 'School was sentinel and was suppressed' })
      school = ''
    }

    return {
      degree,
      school,
      location: String(edu.location || '').replace(SENTINEL_DEBUG, '').trim(),
      dates: formatDateRange(edu.startDate, edu.endDate || edu.dates, false) || safeString(edu.dates || '').replace(/\s*[–-]\s*$/, ''),
    }
  }).filter((e) => e.degree || e.school)

  // 11. Certifications
  sanitized.certifications = (sanitized.certifications || [])
    .map((c) => String(c).replace(SENTINEL_DEBUG, '').trim())
    .filter((c) => c && c.length >= 2 && !SENTINEL_ONLY.test(c))

  return {
    sanitizedResume: sanitized,
    warnings,
    appliedKeywords,
    pendingKeywords,
  }
}
