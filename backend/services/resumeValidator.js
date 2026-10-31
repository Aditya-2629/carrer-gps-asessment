/**
 * Resume Post-LLM Validator & Intake Normalizer
 */

const SENTINEL_ONLY = /^(?:degree|university|college|school|company|candidate|resume)$/i
const SENTINEL_DEBUG = /\[Extracted Document Links:[^\]]*\]|\bundefined\b|\bnull\b/gi
const PLACEHOLDER_REGEX = /\[(?:ADD|TODO|TBD|INSERT)[^\]]*\]/i

const BANNED_BUZZWORDS = [
  'spearheaded', 'leveraged', 'synergistic', 'cutting-edge',
  'results-driven', 'passionate', 'dynamic', 'detail-oriented',
  'responsible for', 'as measured', 'hardworking', 'team player'
]

const META_COMMENTARY_WORDS = /\b(maintained clean chronological formatting|chronological formatting|integrating [A-Za-z0-9\s]+ into the primary|format of the resume|section with verified dates|re-written to|rewritten for ATS|as requested in the prompt)\b/i
const ACTION_VERB_REGEX = /\b(built|developed|designed|implemented|automated|led|reduced|increased|analy[sz]ed|delivered|created|managed|architected|migrated|optimized|engineered|spearheaded|orchestrated)\w*/i
const COMPANY_HEADER_REGEX = /^(?:Kitcoek|Recibo|Accenture|Deloitte|Infosys|TCS|PwC|Amazon|Google|Microsoft|\b[A-Za-z0-9\s&.,-]{2,40}\s+(?:Technologies|Tech|Solutions|Pvt|Ltd|LLC|Inc|Corporation|Corp))\b/i

export function isLeakedHeader(text) {
  const t = String(text || '').trim()
  if (t.length < 15) return true
  const isCompanyLike = COMPANY_HEADER_REGEX.test(t)
  return isCompanyLike && !ACTION_VERB_REGEX.test(t)
}

const pad = (n, w = 3) => String(n).padStart(w, '0')

const formatDateRange = (s, e, cur) => {
  const cleanStart = String(s || '').trim()
  let cleanEnd = String(e || '').trim()
  if (cur && (!cleanEnd || /current|present|now/i.test(cleanEnd))) {
    cleanEnd = 'Present'
  }
  if (cleanStart && cleanEnd && cleanStart !== cleanEnd) {
    return `${cleanStart} – ${cleanEnd}`
  }
  return cleanEnd || cleanStart || ''
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

  let rawSummary = raw.summary?.text ?? (typeof raw.summary === 'string' ? raw.summary : (raw.professional_summary || raw.summaryText || ''))

  return {
    ...raw,
    candidate_name: c.name || raw.candidate_name || raw.name || '',
    target_role: c.targetRole || raw.target_role || raw.targetRole || '',
    contact: c.contact || raw.contact || {},
    summary: rawSummary,
    years_of_experience: raw.years_of_experience || raw.yearsExperience || 3,
    experiences: exps.map((e, i) => {
      const id = e.id ?? `exp_${pad(i + 1, 3)}`
      return {
        ...e,
        id,
        company: e.company || e.employer || '',
        role: e.role || e.title || '',
        location: e.location || '',
        duration: formatDateRange(e.startDate, e.endDate || e.duration, e.isCurrent) || e.duration || '',
        bullets: (e.bullets || []).map((b, j) => {
          const text = typeof b === 'string' ? b : b?.text || ''
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
        title: p.title || p.name || 'Project',
        techStack: p.techStack || (Array.isArray(p.technologies) ? p.technologies.join(', ') : (p.technologies || '')),
        dates: formatDateRange(p.startDate, p.endDate || p.dates, false) || p.dates || '',
        link: p.link || p.github || '',
        bullets: (Array.isArray(p.bullets) ? p.bullets : [p.description].filter(Boolean)).map((b, j) => {
          const text = typeof b === 'string' ? b : b?.text || ''
          const bId = b?.id || `${id}_b${pad(j + 1, 2)}`
          return { id: bId, text }
        }),
      }
    }),
    education: edu.map((ed) => ({
      degree: ed.degree || ed.degreeName || (typeof ed === 'string' ? ed : ''),
      school: ed.school || ed.institution || ed.university || '',
      location: ed.location || '',
      dates: formatDateRange(ed.startDate, ed.endDate || ed.dates || ed.year, false) || ed.dates || ed.year || '',
    })),
    certifications: certs.map((ct) => (typeof ct === 'string' ? ct : ct?.name || ct?.title || '')).filter(Boolean),
  }
}

/**
 * Numbers Integrity Truth Check:
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
 * Tokenize skill strings safely without splitting on commas inside parens or slashes
 * Preserves 'A/B Testing', 'CI/CD', and single-character skills 'R', 'C'.
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
 * Main Sanitizer & Validator Engine
 */
export function sanitizeAndValidateResume(canonicalResume = {}, tailoredBullets = []) {
  const warnings = []
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

  // 2. Candidate Name Sanitization
  let cName = (sanitized.candidate_name || '').replace(SENTINEL_DEBUG, '').trim()
  if (SENTINEL_ONLY.test(cName)) cName = ''
  sanitized.candidate_name = cName

  // 3. Contact & Location Sanitization (Allows 'NY', 'UK', 'LA', 'Oswego, IL')
  if (sanitized.contact) {
    let loc = String(sanitized.contact.location || '').replace(SENTINEL_DEBUG, '').trim()
    const looksLikePlace = /^[\p{L} .'-]+(?:,\s*[\p{L} .'-]{2,})?$|^[\p{L}]{2,}$/u.test(loc)
    const rawSkills = sanitized.skills || []
    const skillSet = new Set((Array.isArray(rawSkills) ? rawSkills : []).map((s) => (typeof s === 'string' ? s.toLowerCase() : (s?.name || '').toLowerCase())))

    if (!looksLikePlace || loc.split(/,\s*/).some((p) => skillSet.has(p.toLowerCase()))) {
      warnings.push(`Invalid location removed (contained tech skill or broken string: "${loc}")`)
      sanitized.contact.location = ''
    }
    if (sanitized.contact.email) sanitized.contact.email = sanitized.contact.email.replace(SENTINEL_DEBUG, '').trim()
    if (sanitized.contact.linkedin) sanitized.contact.linkedin = sanitized.contact.linkedin.replace(SENTINEL_DEBUG, '').trim()
    if (sanitized.contact.github) sanitized.contact.github = sanitized.contact.github.replace(SENTINEL_DEBUG, '').trim()
  }

  // 4. Professional Summary
  let sum = sanitized.summary || ''
  if (sum) {
    sum = sum.replace(SENTINEL_DEBUG, '').replace(/\s*—\s*/g, ', ').trim()
    const openP = (sum.match(/\(/g) || []).length
    const closeP = (sum.match(/\)/g) || []).length
    if (openP > closeP) sum += ')'.repeat(openP - closeP)
    if (!/[.!?]$/.test(sum)) sum += '.'
    sanitized.summary = sum
  }

  // 5. Known Companies for Cross-Company Leak Detection
  const allCompanies = (sanitized.experiences || [])
    .map((e) => String(e.company || '').trim())
    .filter((c) => c && c.length >= 3)

  // 6. Experience Sanitization & ID-based Tailoring
  sanitized.experiences = (sanitized.experiences || []).map((exp, expIdx) => {
    let company = String(exp.company || '').replace(SENTINEL_DEBUG, '').trim()
    if (SENTINEL_ONLY.test(company)) company = ''

    let role = String(exp.role || '').replace(SENTINEL_DEBUG, '').trim()
    if (SENTINEL_ONLY.test(role)) role = ''

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

      // Truth Check: Number violations
      const fabricated = findNumberViolations(origText, candidateText)
      if (fabricated.length > 0) {
        warnings.push(`Fabricated number(s) [${fabricated.join(', ')}] in ${bId}. Reverted to original text.`)
        candidateText = origText
      }

      // Check Placeholders
      if (PLACEHOLDER_REGEX.test(candidateText)) {
        warnings.push(`Unresolved placeholder stripped in ${bId}`)
        candidateText = candidateText.replace(/\s*,?\s*(?:achieving|by)?\s*\[(?:ADD|TODO|TBD|INSERT)[^\]]*\]/gi, '')
      }

      // Check Meta-Commentary
      if (META_COMMENTARY_WORDS.test(candidateText)) {
        warnings.push(`Meta-commentary dropped in ${bId}. Reverted to original.`)
        candidateText = origText
      }

      // Cross-company leak check (e.g. Shure inside PwC)
      const otherCompanies = allCompanies.filter((c) => c.toLowerCase() !== company.toLowerCase())
      for (const otherC of otherCompanies) {
        if (otherC.length >= 4 && new RegExp(`\\b${otherC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(candidateText)) {
          warnings.push(`Cross-company leak removed: "${otherC}" from "${company}" bullet.`)
          candidateText = candidateText.replace(new RegExp(`\\s*(?:at|for|with)\\s+${otherC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s+[A-Za-z]+)?`, 'gi'), '').trim()
        }
      }

      // Format bullet, em dash, glued words
      candidateText = candidateText
        .replace(/^[•\-–*]\s+/, '')
        .replace(/(\w)- (\w)/g, '$1-$2')
        .replace(/\bachievedsecurity\b/gi, 'achieved security')
        .replace(/\bzero-\s+downtime\b/gi, 'zero-downtime')
        .replace(/\bintent-\s+classification\b/gi, 'intent-classification')
        .replace(/\s*—\s*/g, ', ')
        .replace(SENTINEL_DEBUG, '')
        .trim()

      if (candidateText && !/[.!?]$/.test(candidateText)) candidateText += '.'
      if (isLeakedHeader(candidateText)) {
        warnings.push(`Leaked company header dropped in ${bId}: "${candidateText}"`)
        return
      }
      if (candidateText.length >= 12) {
        cleanBullets.push(candidateText)
      }
    })

    return {
      ...exp,
      company,
      role,
      location,
      bullets: cleanBullets,
    }
  })

  // 7. Projects (Preserves Title, Stack, Dates, Label — Never deletes bare projects)
  sanitized.projects = (sanitized.projects || []).map((p, pIdx) => {
    let title = String(p.title || '').replace(SENTINEL_DEBUG, '').trim()
    const techStack = p.techStack || ''
    const dates = p.dates || ''
    let label = p.label || ''

    if (!label && /(?:Academic|Personal|Team|Capstone)\s+Project/i.test(title)) {
      label = title.match(/(?:Academic|Personal|Team|Capstone)\s+Project/i)[0]
      title = title.replace(new RegExp(`\\s*${label}$`, 'i'), '').trim()
    }

    const cleanBullets = []
    ;(p.bullets || []).forEach((pb) => {
      const origText = pb.text || ''
      const pbId = pb.id || `proj_${pad(pIdx + 1, 3)}_b01`
      let candidateText = rewriteMap.get(pbId) || origText

      candidateText = candidateText
        .replace(/^[•\-–*]\s+/, '')
        .replace(/\s*—\s*/g, ', ')
        .replace(SENTINEL_DEBUG, '')
        .trim()

      if (candidateText && !/[.!?]$/.test(candidateText)) candidateText += '.'
      if (candidateText.length >= 12 && !META_COMMENTARY_WORDS.test(candidateText)) {
        cleanBullets.push(candidateText)
      }
    })

    // If project has no bullets, keep title and stack rather than deleting!
    return {
      title,
      techStack,
      dates,
      label,
      link: p.link || '',
      bullets: cleanBullets,
    }
  }).filter((p) => p.title)

  // 8. Education (Safe University string check — "University of Illinois" intact)
  sanitized.education = (sanitized.education || []).map((edu) => {
    let degree = String(edu.degree || '').trim().replace(/^Degree,?\s*/i, '').replace(SENTINEL_DEBUG, '').trim()
    let school = String(edu.school || '').trim().replace(SENTINEL_DEBUG, '').trim()

    if (SENTINEL_ONLY.test(degree)) degree = ''
    if (SENTINEL_ONLY.test(school)) school = ''

    return {
      degree,
      school,
      location: String(edu.location || '').replace(SENTINEL_DEBUG, '').trim(),
      dates: String(edu.dates || '').replace(/\s*-\s*/g, ' – ').trim(),
    }
  }).filter((e) => e.degree || e.school)

  // 9. Certifications (Clean debug links)
  sanitized.certifications = (sanitized.certifications || [])
    .map((c) => String(c).replace(SENTINEL_DEBUG, '').trim())
    .filter((c) => c && c.length >= 2 && !SENTINEL_ONLY.test(c))

  return {
    sanitizedResume: sanitized,
    warnings,
  }
}
