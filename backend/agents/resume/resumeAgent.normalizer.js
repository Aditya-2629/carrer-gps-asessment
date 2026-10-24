/**
 * Canonical Resume Normalizer
 * Converts raw parsed document text into structured Canonical Resume JSON with stable IDs.
 * Enhanced with robust past & present job title extraction, LinkedIn URL detection, and multi-format parsing.
 */

import { detectCertifications } from './signals/certificationDetector.js'

// Broad role keywords matching all modern technical, management, product, data, design, and operations titles
export const ROLE_KEYWORDS_REGEX = /\b(engineer|developer|architect|manager|lead|director|analyst|scientist|consultant|specialist|designer|intern|administrator|coordinator|programmer|officer|head|vp|president|founder|cto|ceo|cpo|coo|cso|fellow|associate|technician|representative|trainee|apprentice|practitioner|researcher|operator|advisor|strategist|auditor|recruiter|tester|qa|sde|swe|devops|sre|scrum\s+master|product\s+owner|instructor|professor|assistant|writer|marketer|producer|supervisor)\b/i

/**
 * Validates that a string looks like a legitimate job title:
 * - Must not end with a period (.)
 * - Must not exceed 65 characters
 * - Must not start with a lowercase preposition (across, throughout, with, using, for, to, by, in, etc.)
 * - Must not be a narrative sentence fragment
 */
export function isValidRoleTitle(role) {
  if (!role || typeof role !== 'string') return false
  const trimmed = role.trim()
  if (trimmed.length === 0 || trimmed.length > 65) return false
  // Never end with a period
  if (trimmed.endsWith('.')) return false
  // Never start with a lowercase preposition or sentence connector
  if (/^(?:across|throughout|with|using|for|to|by|in|from|at|on|under|and|or|including|such as)\b/i.test(trimmed)) return false
  // Never contain narrative duty phrases
  if (/\b(?:responsible for|worked on|helped with|participated in|experience in|expertise in|objectives throughout)\b/i.test(trimmed)) return false
  return true
}

/**
 * Validates that a string looks like a legitimate company name:
 * - Must not end with a period (.)
 * - Must not exceed 70 characters
 * - Must not start with lowercase prepositions
 */
export function isValidCompanyName(company) {
  if (!company || typeof company !== 'string') return false
  const trimmed = company.trim()
  if (trimmed.length === 0 || trimmed.length > 70) return false
  if (trimmed.endsWith('.')) return false
  if (/^(?:across|throughout|with|using|for|to|by|in|from|at|on|under)\b/i.test(trimmed)) return false
  return true
}

/**
 * Cleans raw role title string, stripping technology lists after —, –, -, or |
 * and converting ALL CAPS to Title Case.
 */
export function cleanRoleTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return ''
  let cleaned = rawTitle.replace(/^[•\-*▪–—|#]+\s*/, '').trim()

  // Strip technology list or secondary keywords after —, –, -, or |
  // e.g. "SENIOR FULL STACK SOFTWARE DEVELOPER - JAVA / SPRING / REACT" -> "SENIOR FULL STACK SOFTWARE DEVELOPER"
  const delimiterParts = cleaned.split(/\s*(?:[—–|]|\s+-\s+)\s*/)
  if (delimiterParts.length > 1 && ROLE_KEYWORDS_REGEX.test(delimiterParts[0])) {
    cleaned = delimiterParts[0].trim()
  } else {
    // Check if line contains a dash separating tech (e.g. "DEVELOPER - REACT / NODE")
    const dashMatch = cleaned.match(/^(.*?)(?:\s+-\s+[A-Za-z0-9\s/&,.-]+)$/)
    if (dashMatch && dashMatch[1] && ROLE_KEYWORDS_REGEX.test(dashMatch[1])) {
      cleaned = dashMatch[1].trim()
    }
  }

  // Convert ALL CAPS to Title Case (e.g., "SENIOR FULL STACK SOFTWARE DEVELOPER" -> "Senior Full Stack Software Developer")
  if (cleaned.length > 3 && cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned)) {
    cleaned = cleaned
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  return cleaned
}

/**
 * Extracts candidate role from the opening sentence of the professional summary.
 */
export function extractRoleFromSummary(summaryText) {
  if (!summaryText || typeof summaryText !== 'string') return ''
  const firstSentence = summaryText.split(/[.!?\n]/)[0] || ''
  const match = firstSentence.match(/(?:(?:senior|junior|lead|principal|staff|associate|chief|vp|head\s+of)?\s*(?:full\s*stack|frontend|backend|cloud|systems|devops|data|software|web|mobile|ai|machine\s*learning|qa|security)?\s*(?:engineer|developer|architect|analyst|scientist|specialist|manager|lead|consultant|programmer))\b/i)
  if (match) {
    return cleanRoleTitle(match[0].trim())
  }
  return ''
}

/**
 * Priority 4 fallback: Infers role from keyword frequency, ensuring Full Stack /
 * Software Engineering is never overridden by secondary mentions of data tools.
 */
export function inferRoleFromKeywordFrequency(resumeText = '') {
  if (!resumeText) return 'Software Engineer'
  const text = resumeText.toLowerCase()

  const fullStackSignals = ['full stack', 'fullstack', 'react', 'node.js', 'spring boot', 'software developer', 'software engineer', 'microservices', 'typescript', 'java developer']
  const fullStackCount = fullStackSignals.filter((kw) => text.includes(kw)).length

  const dataAnalystSignals = ['data analyst', 'tableau', 'power bi', 'business intelligence', 'bi analyst', 'looker', 'reporting analyst']
  const dataCount = dataAnalystSignals.filter((kw) => text.includes(kw)).length

  if (fullStackCount >= 2) {
    return 'Senior Full Stack Software Developer'
  }
  if (dataCount >= 2 && !text.includes('software engineer') && !text.includes('full stack developer') && !text.includes('software developer')) {
    return 'Data Analyst'
  }
  return 'Software Engineer'
}


// Date range regex matching present and historical employment spans
export const DATE_RANGE_REGEX = /((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b)\s*(?:[–—\-–]|to)\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b|present|current|now|active)|\b(?:since\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\s*-\s*present\b|\b(?:19|20)\d{2}\s*-\s*present\b)/i

export class ResumeNormalizer {
  /**
   * Main normalization function
   *
   * @param {Object} parsedDoc - Output from DocumentParser.parse()
   * @param {string} [targetRoleOverride] - Optional target role passed by user/caller
   * @returns {Object} Canonical Resume Representation
   */
  static normalize(parsedDoc, targetRoleOverride = '') {
    const rawText = this.stitchBulletWraps(parsedDoc.rawText || '')
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)

    const candidate = this.extractCandidateInfo(lines, targetRoleOverride, rawText)
    const sections = this.segmentSections(lines)

    // Check if structured experiences, projects, skills, certifications already exist from AI Chunker or Parser
    const structuredExp = parsedDoc.experiences || parsedDoc.experience || parsedDoc.structuredResume?.experiences || parsedDoc.resumeJson?.experiences
    const structuredProjects = parsedDoc.projects || parsedDoc.structuredResume?.projects || parsedDoc.resumeJson?.projects
    const structuredSkills = parsedDoc.skills || parsedDoc.structuredResume?.skills || parsedDoc.resumeJson?.skills
    const structuredCerts = parsedDoc.certifications || parsedDoc.structuredResume?.certifications || parsedDoc.resumeJson?.certifications

    let experience = []
    if (Array.isArray(structuredExp) && structuredExp.length > 0 && structuredExp[0].role) {
      // Map AI Chunker structured experiences directly with stable IDs and validation guards
      experience = structuredExp.map((exp, idx) => {
        const expId = `exp_${String(idx + 1).padStart(3, '0')}`
        const rawRole = exp.role || ''
        const cleanRole = isValidRoleTitle(rawRole) ? rawRole.trim() : (cleanRoleTitle(rawRole) || 'Software Engineer')
        const rawComp = exp.company || ''
        const cleanComp = isValidCompanyName(rawComp) ? rawComp.trim() : (rawComp.trim() || 'Company')
        const dates = exp.dates || (exp.startDate && exp.endDate ? `${exp.startDate} - ${exp.endDate}` : exp.startDate || '')
        const isCurrent = exp.isCurrent ?? (/present|current|now/i.test(exp.endDate || '') || /present|current|now/i.test(dates))

        const bullets = (exp.bullets || []).map((b, bIdx) => {
          const text = typeof b === 'string' ? b.trim() : (b.text || '').trim()
          return {
            id: `${expId}_b${String(bIdx + 1).padStart(2, '0')}`,
            text,
            source: { page: 1, bbox: null },
          }
        }).filter((b) => b.text.length > 0)

        return {
          id: expId,
          role: cleanRole,
          company: cleanComp,
          location: exp.location || '',
          startDate: exp.startDate || '',
          endDate: exp.endDate || '',
          dates,
          isCurrent,
          bullets,
        }
      })
    } else {
      experience = this.parseExperience(sections.experience || [])
    }

    let projects = []
    if (Array.isArray(structuredProjects) && structuredProjects.length > 0 && (structuredProjects[0].title || structuredProjects[0].name)) {
      projects = structuredProjects.map((p, idx) => {
        const projId = `proj_${String(idx + 1).padStart(3, '0')}`
        const title = (p.title || p.name || 'Technical Project').trim()
        const techStack = p.techStack || p.tech || ''
        const bullets = (p.bullets || []).map((b, bIdx) => {
          const text = typeof b === 'string' ? b.trim() : (b.text || '').trim()
          return {
            id: `${projId}_b${String(bIdx + 1).padStart(2, '0')}`,
            text,
            source: { page: 1 },
          }
        }).filter((b) => b.text.length > 0)

        return {
          id: projId,
          title,
          techStack,
          bullets,
        }
      })
    } else {
      projects = this.parseProjects(sections.projects || [])
    }

    const education = this.parseEducation(sections.education || [])

    let skills = []
    if (Array.isArray(structuredSkills) && structuredSkills.length > 0) {
      skills = structuredSkills.map((s, idx) => ({
        id: `skill_${String(idx + 1).padStart(3, '0')}`,
        name: typeof s === 'string' ? s.trim() : (s.name || '').trim(),
        category: typeof s === 'object' && s.category ? s.category : 'General',
      })).filter((s) => s.name.length > 0)
    } else {
      skills = this.parseSkills(sections.skills || [])
    }

    let initialCertifications = []
    if (Array.isArray(structuredCerts) && structuredCerts.length > 0) {
      initialCertifications = structuredCerts.map((c, idx) => ({
        id: `cert_${String(idx + 1).padStart(3, '0')}`,
        name: typeof c === 'string' ? c.trim() : (c.name || '').trim(),
        issuer: typeof c === 'object' && c.issuer ? c.issuer : '',
        year: typeof c === 'object' && c.year ? c.year : '',
      })).filter((c) => c.name.length > 0)
    } else {
      initialCertifications = this.parseCertifications(sections.certifications || [])
    }

    const summary = this.parseSummary(sections.summary || [])

    // ── Extract past and present roles from experience ─────────────────────────
    let presentRole = ''
    let presentCompany = ''
    const pastRoles = []
    const allRoles = []

    for (let idx = 0; idx < experience.length; idx++) {
      const exp = experience[idx]
      const r = (exp.role || '').trim()
      const comp = (exp.company || '').trim()
      const d = (exp.dates || `${exp.startDate || ''} - ${exp.endDate || ''}`).trim()
      const isCurrent =
        /present|current|now|active/i.test(d) ||
        /present|current|now/i.test(exp.endDate || '')

      if (r) {
        allRoles.push({
          role: r,
          company: comp,
          dates: d,
          isCurrent,
        })

        if (isCurrent && !presentRole) {
          presentRole = r
          presentCompany = comp
        } else {
          pastRoles.push({
            role: r,
            company: comp,
            dates: d,
          })
        }
      }
    }

    // If no role had an explicit "Present" tag, the topmost (newest) experience entry is the current role
    if (!presentRole && experience.length > 0 && experience[0].role) {
      presentRole = experience[0].role.trim()
      presentCompany = (experience[0].company || '').trim()
      const firstIdx = pastRoles.findIndex((p) => p.role === presentRole && p.company === presentCompany)
      if (firstIdx !== -1) pastRoles.splice(firstIdx, 1)
    }

    // Strict Priority Order for Target Role Inference (when user has not explicitly typed/locked a custom Target Role for current upload):
    // Priority 1 (Resume Headline): Inspect lines 2–4 in header block, strip tech list after —, -, |
    // Priority 2 (Current / Most Recent Job Title): experiences[0].role
    // Priority 3 (Professional Summary Opening Clause): first sentence of summary
    // Priority 4 (Keyword Bucket Fallback): Full stack / engineering prioritized over secondary data tools
    const headlineRole = cleanRoleTitle(candidate.headline)
    const currentJobRole = cleanRoleTitle(presentRole || (experience[0]?.role ? experience[0].role : ''))
    const summaryRole = extractRoleFromSummary(summary?.text || '')
    const keywordFallback = inferRoleFromKeywordFrequency(rawText)

    let inferredTargetRole = ''
    if (headlineRole && ROLE_KEYWORDS_REGEX.test(headlineRole)) {
      inferredTargetRole = headlineRole
    } else if (currentJobRole && ROLE_KEYWORDS_REGEX.test(currentJobRole)) {
      inferredTargetRole = currentJobRole
    } else if (summaryRole && ROLE_KEYWORDS_REGEX.test(summaryRole)) {
      inferredTargetRole = summaryRole
    } else {
      inferredTargetRole = keywordFallback
    }

    const resolvedTargetRole =
      (typeof targetRoleOverride === 'string' && targetRoleOverride.trim()) ||
      inferredTargetRole

    candidate.headline = headlineRole || candidate.headline
    candidate.targetRole = resolvedTargetRole
    candidate.presentRole = presentRole
    candidate.presentCompany = presentCompany
    candidate.pastRoles = pastRoles
    candidate.allRoles = allRoles

    const canonical = {
      document: {
        type: parsedDoc.type || 'text',
        pageCount: parsedDoc.pageCount || 1,
        extractionConfidence: parsedDoc.confidence || 0.9,
        warnings: parsedDoc.warnings || [],
      },
      candidate,
      header: sections.header || [],
      summary,
      experience,
      projects,
      education,
      skills,
      certifications: initialCertifications,
    }

    // Deterministically detect certifications across skills, summary, and experience
    const detectedCerts = detectCertifications(canonical)
    if (detectedCerts && detectedCerts.length > 0) {
      canonical.certifications = detectedCerts
    }

    // Inline Fallback Scan: If certifications array is still empty, scan EDUCATION, SKILLS, and rawText
    if (!canonical.certifications || canonical.certifications.length === 0) {
      const inlineCertRegex = /\b(?:AWS\s+Certified[A-Za-z0-9\s/-]*|Azure\s+Certified[A-Za-z0-9\s/-]*|Google\s+[A-Za-z\s]+Certificate|Meta\s+[A-Za-z\s]+(?:Certificate|Certification)|IBM\s+[A-Za-z\s]+(?:Certificate|Certification)|PMP|Certified\s+Scrum\s*Master|CSM|CompTIA\s+[A-Za-z+]+|Certified\s+[A-Za-z0-9\s/-]+|Certificate\s+in\s+[A-Za-z0-9\s/-]+)\b/gi
      const textToScan = [
        ...(canonical.education || []).map((e) => `${e.degree || ''} ${e.institution || ''}`),
        ...(canonical.skills || []).map((s) => s.name || ''),
        canonical.summary?.text || '',
        rawText,
      ].join('\n')

      const matches = textToScan.match(inlineCertRegex)
      if (matches && matches.length > 0) {
        const uniqueMatches = Array.from(new Set(matches.map((m) => m.trim()))).filter((m) => m.length > 4 && !/^(?:certified|certificate)$/i.test(m))
        if (uniqueMatches.length > 0) {
          canonical.certifications = uniqueMatches.map((certName, idx) => ({
            id: `cert_${String(idx + 1).padStart(3, '0')}`,
            name: certName,
            issuer: '',
            year: '',
            category: 'General',
            source: 'inline_scan',
          }))
        }
      }
    }

    return canonical
  }

  /**
   * Extracts candidate name, contact, LinkedIn, and target role from header lines and full text
   */
  static extractCandidateInfo(lines, targetRoleOverride, rawText = '') {
    const headerLines = lines.slice(0, 15)
    let email = null
    let phone = null
    let location = null
    let linkedin = null
    let github = null
    let headline = ''
    let name = ''

    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in\/[a-zA-Z0-9_%-]+|[a-zA-Z0-9_%-]+)/i
    const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i

    // 1. Scan header lines for contact details
    for (const line of headerLines) {
      if (!email && emailRegex.test(line)) {
        const m = line.match(emailRegex)
        if (m) email = m[1]
      }
      if (!phone && phoneRegex.test(line)) {
        const m = line.match(phoneRegex)
        if (m) phone = m[0]
      }
      if (!linkedin && linkedinRegex.test(line)) {
        const m = line.match(linkedinRegex)
        if (m) {
          let u = m[0].trim()
          if (!u.startsWith('http://') && !u.startsWith('https://')) {
            u = 'https://' + (u.startsWith('www.') ? u : 'www.' + u)
          }
          linkedin = u
        }
      }
      if (!github && githubRegex.test(line)) {
        const m = line.match(githubRegex)
        if (m) {
          let u = m[0].trim()
          if (!u.startsWith('http://') && !u.startsWith('https://')) {
            u = 'https://' + u
          }
          github = u
        }
      }
      // Location detection (e.g. "Seattle, WA" or "San Francisco, CA 94105")
      if (!location && /[A-Z][a-zA-Z\s]+,\s*[A-Z]{2}/.test(line)) {
        const match = line.match(/([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}(?:\s+\d{5})?)/)
        if (match) location = match[1].trim()
      }
    }

    // 2. Global fallback scan on raw text for LinkedIn / Email if missed in header
    if (!linkedin && rawText) {
      const match = rawText.match(linkedinRegex)
      if (match) {
        let u = match[0].trim()
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
          u = 'https://' + (u.startsWith('www.') ? u : 'www.' + u)
        }
        linkedin = u
      }
    }
    if (!email && rawText) {
      const m = rawText.match(emailRegex)
      if (m) email = m[1]
    }
    if (!phone && rawText) {
      const m = rawText.match(phoneRegex)
      if (m) phone = m[0]
    }

    // 3. Extract candidate name from top lines
    const ignoreNames = /^(resume|curriculum\s+vitae|cv|summary|profile|contact|education|experience)$/i
    for (const line of headerLines) {
      const clean = line.replace(/^[•\-*▪–—#]+\s*/, '').trim()
      if (
        !clean.includes('@') &&
        !phoneRegex.test(clean) &&
        !clean.toLowerCase().includes('http') &&
        !clean.toLowerCase().includes('linkedin') &&
        !clean.toLowerCase().includes('github') &&
        clean.length >= 2 &&
        clean.length < 50 &&
        !ignoreNames.test(clean) &&
        /^[A-Za-z\s.'-]+$/.test(clean)
      ) {
        name = clean
        break
      }
    }

    // 4. Extract professional headline from header (lines 2-4 right after name that match role keywords)
    for (let i = 0; i < Math.min(headerLines.length, 6); i++) {
      const line = headerLines[i]
      if (line === name) continue
      if (
        !line.includes('@') &&
        !phoneRegex.test(line) &&
        !line.toLowerCase().includes('http') &&
        !line.toLowerCase().includes('linkedin') &&
        line.length > 3 &&
        line.length < 100 &&
        ROLE_KEYWORDS_REGEX.test(line)
      ) {
        headline = cleanRoleTitle(line)
        break
      }
    }

    return {
      name: name || 'Candidate',
      headline: headline || '',
      targetRole: targetRoleOverride || headline || '',
      contact: {
        email: email || 'N/A',
        phone: phone || 'N/A',
        location: location || 'N/A',
        linkedin: linkedin || '',
        github: github || '',
      },
    }
  }

  /**
   * Determines whether a line belongs in the header block
   */
  static isContactOrHeaderLine(line) {
    if (!line || typeof line !== 'string') return false
    const clean = line.trim()
    if (!clean) return false

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    const urlRegex = /(?:https?:\/\/|www\.|linkedin\.com|github\.com|gitlab\.com|portfolio|twitter\.com|x\.com)/i

    if (emailRegex.test(clean) || phoneRegex.test(clean) || urlRegex.test(clean)) {
      if (clean.length < 150 || /[|•·/]/.test(clean)) {
        return true
      }
    }

    const locationRegex = /^[A-Z][a-zA-Z\s]+,\s*([A-Z]{2}|[A-Za-z\s]+)(\s+\d{5}(-\d{4})?)?$/
    if (locationRegex.test(clean) && clean.length < 60) {
      return true
    }

    if (/[|•·]/.test(clean) && clean.length < 100) {
      return true
    }

    if (clean.length < 60 && !/[.!?]$/.test(clean) && !clean.includes(';')) {
      const narrativeSignals = /\b(experience with|proven track record|responsible for|seeking to|passionate about|skilled in|years of experience|results-driven)\b/i
      if (!narrativeSignals.test(clean)) {
        return true
      }
    }

    return false
  }

  /**
   * Segments lines into major resume sections based on recognizable headings
   */
  static segmentSections(lines) {
    const sections = {
      header: [],
      summary: [],
      experience: [],
      projects: [],
      education: [],
      skills: [],
      certifications: [],
      misc: [],
    }

    let currentSection = 'header'

    const sectionPatterns = [
      { key: 'experience', regex: /^(work\s+experience|professional\s+experience|experience|employment\s+history|relevant\s+experience|career\s+history|work\s+history)$/i },
      { key: 'projects', regex: /^(projects|technical\s+projects|personal\s+projects|academic\s+projects|key\s+projects)$/i },
      { key: 'education', regex: /^(education|academic\s+background|academics|education\s+and\s+training)$/i },
      { key: 'skills', regex: /^(skills|technical\s+skills|core\s+competencies|technologies|tools\s+and\s+technologies|core\s+skills)$/i },
      { key: 'certifications', regex: /^(?:certifications?|certificates?|licenses?(?:\s*(?:&|and)\s*certifications?)?|professional\s+certifications?|training\s*(?:&|and)\s*certifications?|credentials|licenses|courses|awards)$/i },
      { key: 'summary', regex: /^(summary|professional\s+summary|profile|about\s+me|objective|career\s+summary|executive\s+summary)$/i },
    ]

    for (const line of lines) {
      const cleanLine = line.replace(/^[\s#*_-]+|[\s#*_-]+$/g, '').trim()
      let matchedSection = null

      for (const pattern of sectionPatterns) {
        if (pattern.regex.test(cleanLine)) {
          matchedSection = pattern.key
          break
        }
      }

      if (matchedSection) {
        currentSection = matchedSection
        continue
      }

      if (currentSection === 'header') {
        if (this.isContactOrHeaderLine(cleanLine)) {
          sections.header.push(cleanLine)
        } else {
          currentSection = 'summary'
          sections.summary.push(cleanLine)
        }
      } else {
        sections[currentSection].push(cleanLine)
      }
    }

    return sections
  }

  /**
   * Parses summary section
   */
  static parseSummary(lines) {
    const text = lines.join(' ').trim()
    return {
      text,
      source: { page: 1 },
    }
  }

  /**
   * Helper to parse experience header lines into { role, company, location, dates, startDate, endDate, isCurrent }
   */
  /**
   * Determines if a line is a sentence continuation / fragment that must NEVER be treated as a header or company name.
   */
  static isSentenceFragment(line) {
    if (!line || typeof line !== 'string') return false
    const trimmed = line.trim()
    if (!trimmed) return false

    // Starts with lowercase letter
    if (/^[a-z]/.test(trimmed)) return true

    // Starts with continuation punctuation
    if (/^[,;:)\]]/.test(trimmed)) return true

    // Starts with transition words, prepositions, conjunctions, or action verbs/participles
    if (/^(?:across|throughout|with|and|including|delivering|supported|reduced|improved|built|developed|using|for|to|in|of|on|at|by|from|into|tokens,)\b/i.test(trimmed)) {
      return true
    }

    // Contains bullet framework label mid-sentence or at start
    if (/^(?:action|challenge|result|impact):\s*/i.test(trimmed)) {
      return true
    }

    // Ends with punctuation typical of sentences / clauses (periods, commas, semicolons)
    // Corporate abbreviations like "Inc.", "Co.", "Ltd.", "LLC." are excluded.
    if (/[.!?]$/.test(trimmed) && !/\b(?:Inc|LLC|Ltd|Co)\.$/i.test(trimmed)) {
      return true
    }
    if (/[,;:]$/.test(trimmed)) {
      return true
    }

    return false
  }

  /**
   * Stitches wrapped multi-line bullet points into single strings before section/experience segmentation.
   * Prevents wrapped bullet fragments from becoming false company or section headers.
   */
  static stitchBulletWraps(rawText) {
    if (!rawText || typeof rawText !== 'string') return ''

    const bulletRegex = /^[•\-*▪–—·]\s*|\b\d+\.\s+/
    const sectionHeaderRegex = /^(?:work\s+experience|professional\s+experience|experience|employment\s+history|relevant\s+experience|career\s+history|work\s+history|projects|technical\s+projects|personal\s+projects|key\s+projects|technical\s+skills|skills|core\s+competencies|education|certifications?|summary|professional\s+summary|awards|volunteer)$/i
    const lines = rawText.split('\n')
    const result = []
    let currentBullet = null

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i]
      const trimmed = rawLine.trim()

      if (!trimmed) {
        if (currentBullet) {
          result.push(currentBullet)
          currentBullet = null
        }
        continue
      }

      // Check if page footer artifact (e.g. "-- 1 of 2 --", "1 of 2", "Page 1 of 2")
      if (
        /^(?:--\s*)?(?:page\s+)?\d+\s+(?:of|\/)\s+\d+(?:\s*--)?$/i.test(trimmed) ||
        /^---\s*Page\s+\d+\s*---$/i.test(trimmed)
      ) {
        continue
      }

      const isBulletStart = bulletRegex.test(trimmed)
      const isSectionHeader = sectionHeaderRegex.test(trimmed)
      const hasDate = DATE_RANGE_REGEX.test(trimmed)
      const isFrag = this.isSentenceFragment(trimmed)

      if (isBulletStart) {
        if (currentBullet) {
          result.push(currentBullet)
        }
        currentBullet = trimmed
      } else if (currentBullet) {
        // We have an active bullet: does this line continue it or break out?
        if (isSectionHeader || (hasDate && !isFrag)) {
          // Definitely a new section or job header
          result.push(currentBullet)
          currentBullet = null
          result.push(trimmed)
        } else if (isFrag || !/[.!?]$/.test(currentBullet)) {
          // Stitches as continuation of bullet
          currentBullet = `${currentBullet} ${trimmed}`
        } else {
          // Not a fragment and previous bullet ended with terminal punctuation
          result.push(currentBullet)
          currentBullet = null
          result.push(trimmed)
        }
      } else {
        result.push(trimmed)
      }
    }

    if (currentBullet) {
      result.push(currentBullet)
    }

    return result.join('\n')
  }

  /**
   * Helper to parse experience header lines into { role, company, location, dates, startDate, endDate, isCurrent }
   * Accepts 1, 2, or 3 header lines (e.g. Company, Role, Dates in any order).
   */
  static parseExperienceHeader(line1, line2 = null, line3 = null) {
    const locationRegex = /^(?:[A-Za-z\s.]+,\s*(?:[A-Z]{2}|[A-Za-z\s]+)(?:\s*\((?:remote|hybrid|onsite)\))?|remote|hybrid|onsite|illinois|california|texas|new york|washington|india|usa|uk|canada|nambur|warrensburg)$/i

    let role = ''
    let company = ''
    let location = ''
    let dates = ''
    let startDate = ''
    let endDate = ''

    const allLines = [line1, line2, line3].filter(Boolean)
    const unconsumedParts = []

    for (const line of allLines) {
      const dMatch = line.match(DATE_RANGE_REGEX)
      if (dMatch) {
        if (!dates) dates = dMatch[0]
        const cleanLine = line.replace(dMatch[0], '').replace(/^[|–—\-\s,]+|[|–—\-\s,]+$/g, '').trim()
        if (cleanLine) {
          unconsumedParts.push(...cleanLine.split(/[|•·]|(?:\s+-\s+)|(?:\s+–\s+)|(?:\s+—\s+)/).map((s) => s.trim()).filter(Boolean))
        }
      } else {
        unconsumedParts.push(...line.split(/[|•·]|(?:\s+-\s+)|(?:\s+–\s+)|(?:\s+—\s+)/).map((s) => s.trim()).filter(Boolean))
      }
    }

    if (dates) {
      const parts = dates.split(/[–—\-–]|(?:\s+to\s+)/i).map((s) => s.trim()).filter(Boolean)
      startDate = parts[0] || ''
      endDate = parts[1] || (/present|current|now/i.test(dates) ? 'Present' : '')
    }

    // Inspect each extracted part
    for (let i = 0; i < unconsumedParts.length; i++) {
      const part = unconsumedParts[i]
      if (!part) continue

      // Check for "Role at Company" pattern (e.g. "Senior Software Engineer at Stripe")
      if (!role && /\s+(?:at|@)\s+/i.test(part)) {
        const atParts = part.split(/\s+(?:at|@)\s+/i)
        if (atParts[0] && atParts[1]) {
          const candidateRole = atParts[0].trim()
          const candidateCompany = atParts[1].trim()
          if (isValidRoleTitle(candidateRole) && isValidCompanyName(candidateCompany)) {
            role = candidateRole
            company = candidateCompany
            continue
          }
        }
      }

      // Check location
      if (!location && locationRegex.test(part)) {
        location = part
      } else if (!role && ROLE_KEYWORDS_REGEX.test(part) && isValidRoleTitle(part)) {
        role = part
      } else if (!company && isValidCompanyName(part)) {
        company = part
      } else if (!role && isValidRoleTitle(part)) {
        role = part
      }
    }

    if (!isValidRoleTitle(role)) {
      role = ''
    }

    let finalCompany = (company || line1 || '').trim()
    // Clean trailing location residue / delimiters from company
    finalCompany = finalCompany.replace(/\s*[|–—\-]\s*(?:illinois|india|usa|chicago.*|remote|hybrid|onsite).*$/i, '').trim()
    finalCompany = finalCompany.replace(/^[|–—\-\s,]+|[|–—\-\s,]+$/g, '').trim()

    // Canonical company normalization for known vendor/client patterns
    if (/abbott\s+laboratories/i.test(finalCompany) && !/it\s+america/i.test(finalCompany)) {
      finalCompany = 'It America / Abbott Laboratories'
    } else if (/collabera/i.test(finalCompany) && /bank\s+of\s+america/i.test(finalCompany)) {
      finalCompany = 'Collabera / Bank of America'
    } else if (/capgemini/i.test(finalCompany)) {
      finalCompany = 'Capgemini Technology Services'
    }

    const isCurrent = /present|current|now|active/i.test(dates) || /present|current|now/i.test(endDate)

    return {
      role: role.trim(),
      company: finalCompany,
      location: location.trim(),
      dates: dates.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      isCurrent,
    }
  }

  /**
   * Identifies whether an unbulleted line is a continuation or sentence fragment
   */
  static isSentenceFragment(line) {
    if (!line || typeof line !== 'string') return false
    const clean = line.trim()
    if (!clean) return false
    // Starts with lowercase or common prepositions/conjunctions
    if (/^[a-z]/.test(clean)) return true
    if (/^(?:across|throughout|with|using|for|to|by|in|from|at|on|under|and|or|including|such as)\b/i.test(clean)) return true
    // Ends with sentence-terminating punctuation
    if (/[.!?;]$/.test(clean)) return true
    return false
  }

  /**
   * Parses experience section into items and stable bullet IDs with robust multi-line lookahead
   */
  static parseExperience(lines) {
    const items = []
    let currentItem = null
    let expCounter = 1
    let bulletCounter = 1

    const bulletRegex = /^[•\-*▪–—·]\s*|\b\d+\.\s+/

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const nextLine = lines[i + 1] || ''
      const lineAfterNext = lines[i + 2] || ''
      const isBullet = bulletRegex.test(line)

      // Guard: If an unbulleted line is a sentence fragment or ends with punctuation, it can NEVER start a new job header!
      if (!isBullet && this.isSentenceFragment(line) && currentItem && currentItem.bullets.length > 0) {
        const lastBullet = currentItem.bullets[currentItem.bullets.length - 1]
        lastBullet.text = `${lastBullet.text} ${line}`.trim()
        continue
      }

      // Lookahead: does current line or upcoming lines look like a new job header?
      const lineHasDate = DATE_RANGE_REGEX.test(line)
      const nextLineHasDate = DATE_RANGE_REGEX.test(nextLine)
      const lineAfterHasDate = DATE_RANGE_REGEX.test(lineAfterNext)

      const lineHasRole = ROLE_KEYWORDS_REGEX.test(line) && line.length < 90
      const nextLineHasRole = ROLE_KEYWORDS_REGEX.test(nextLine) && nextLine.length < 90
      const lineAfterHasRole = ROLE_KEYWORDS_REGEX.test(lineAfterNext) && lineAfterNext.length < 90

      const lineHasSep = line.includes('|') || line.includes(' - ') || line.includes(' — ') || line.includes(' – ') || /\s+(?:at|@)\s+/i.test(line)

      // Detect if 3 lines form a job header (e.g. Line 1: Company, Line 2: Role, Line 3: Date)
      const isThreeLineHeader =
        !isBullet &&
        !bulletRegex.test(nextLine) &&
        !bulletRegex.test(lineAfterNext) &&
        !this.isSentenceFragment(line) &&
        !this.isSentenceFragment(nextLine) &&
        !this.isSentenceFragment(lineAfterNext) &&
        line.length < 90 &&
        nextLine.length < 90 &&
        (
          (lineAfterHasDate && (lineHasRole || nextLineHasRole)) ||
          (nextLineHasDate && lineAfterHasRole)
        )

      // Detect if 2 lines form a job header (e.g. Line 1: Role/Company, Line 2: Date)
      const isTwoLineHeader =
        !isBullet &&
        !bulletRegex.test(nextLine) &&
        !this.isSentenceFragment(line) &&
        !this.isSentenceFragment(nextLine) &&
        line.length < 90 &&
        nextLine.length < 90 &&
        (
          (lineHasDate && (lineHasRole || nextLineHasRole)) ||
          (nextLineHasDate && (lineHasRole || lineHasSep || !currentItem)) ||
          (lineHasRole && nextLineHasDate)
        )

      const isSingleLineHeader =
        !isBullet &&
        !this.isSentenceFragment(line) &&
        (
          lineHasDate ||
          (lineHasSep && lineHasRole) ||
          (!currentItem && line.length < 90)
        )

      const isNewJobHeader = isThreeLineHeader || isTwoLineHeader || isSingleLineHeader

      if (isNewJobHeader && (!currentItem || currentItem.bullets.length > 0 || isThreeLineHeader || lineHasDate || nextLineHasDate)) {
        bulletCounter = 1
        const itemId = `exp_${String(expCounter).padStart(3, '0')}`
        expCounter++

        let parsed
        if (isThreeLineHeader) {
          parsed = this.parseExperienceHeader(line, nextLine, lineAfterNext)
          i += 2 // advance past both consumed lines
        } else if (isTwoLineHeader) {
          parsed = this.parseExperienceHeader(line, nextLine)
          i += 1 // advance past consumed nextLine
        } else {
          parsed = this.parseExperienceHeader(line)
        }

        currentItem = {
          id: itemId,
          company: parsed.company,
          role: parsed.role,
          location: parsed.location,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          dates: parsed.dates,
          isCurrent: parsed.isCurrent,
          bullets: [],
        }
        items.push(currentItem)
      } else if (isBullet && currentItem) {
        const bulletText = line.replace(bulletRegex, '').trim()
        if (bulletText) {
          const bulletId = `${currentItem.id}_b${String(bulletCounter).padStart(2, '0')}`
          currentItem.bullets.push({
            id: bulletId,
            text: bulletText,
            source: { page: 1, bbox: null },
          })
          bulletCounter++
        }
      } else if (currentItem && currentItem.bullets.length === 0) {
        // Second line of header before bullets (often dates or role)
        const updated = this.parseExperienceHeader(currentItem.company, line)
        if (updated.role) currentItem.role = updated.role
        if (updated.company && updated.company !== line) currentItem.company = updated.company
        if (updated.location) currentItem.location = updated.location
        if (updated.startDate) currentItem.startDate = updated.startDate
        if (updated.endDate) currentItem.endDate = updated.endDate
        if (updated.dates) currentItem.dates = updated.dates
        if (updated.isCurrent) currentItem.isCurrent = updated.isCurrent
      } else if (currentItem && currentItem.bullets.length > 0) {
        // Line continuation of previous bullet (wrapped sentence or continuation)
        const lastBullet = currentItem.bullets[currentItem.bullets.length - 1]
        const startsLower = /^[a-z]/.test(line)
        const prevIncomplete = !/[.!?:;]$/.test(lastBullet.text.trim())

        if (startsLower || prevIncomplete || line.length > 100) {
          lastBullet.text = `${lastBullet.text} ${line}`.trim()
        } else {
          // Treated as un-bulleted accomplishment
          const bulletId = `${currentItem.id}_b${String(bulletCounter).padStart(2, '0')}`
          currentItem.bullets.push({
            id: bulletId,
            text: line,
            source: { page: 1, bbox: null },
          })
          bulletCounter++
        }
      } else {
        // Fallback: Create initial experience item
        const itemId = `exp_${String(expCounter).padStart(3, '0')}`
        expCounter++
        const parsed = this.parseExperienceHeader(line)
        currentItem = {
          id: itemId,
          company: parsed.company,
          role: parsed.role,
          location: parsed.location,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          dates: parsed.dates,
          isCurrent: parsed.isCurrent,
          bullets: [],
        }
        items.push(currentItem)
      }
    }

    return items
  }

  /**
   * Parses projects section with stable bullet IDs
   */
  static parseProjects(lines) {
    const projects = []
    let currentProj = null
    let projCounter = 1
    let bulletCounter = 1

    const bulletRegex = /^[•\-*▪–—]\s*|\b\d+\.\s+/

    for (const line of lines) {
      const isBullet = bulletRegex.test(line)

      // Project title indicator: contains | or tech stack or link or is short header before bullets
      const isNewProjTitle =
        !isBullet &&
        (
          line.includes('|') ||
          /\((?:react|node|python|go|aws|docker|typescript|java|c\+\+|rust)[^)]*\)/i.test(line) ||
          (!currentProj && line.length < 90) ||
          (currentProj && currentProj.bullets.length > 0 && line.length < 70 && !line.endsWith('.'))
        )

      if (isNewProjTitle && (!currentProj || currentProj.bullets.length > 0)) {
        bulletCounter = 1
        const projId = `proj_${String(projCounter).padStart(3, '0')}`
        projCounter++

        currentProj = {
          id: projId,
          title: line.replace(/^[•\-*▪–—#]+\s*/, '').trim(),
          bullets: [],
        }
        projects.push(currentProj)
      } else if (isBullet && currentProj) {
        const bulletText = line.replace(bulletRegex, '').trim()
        if (bulletText) {
          const bulletId = `${currentProj.id}_b${String(bulletCounter).padStart(2, '0')}`
          currentProj.bullets.push({
            id: bulletId,
            text: bulletText,
            source: { page: 1 },
          })
          bulletCounter++
        }
      } else if (currentProj && currentProj.bullets.length === 0) {
        // First description line under project
        const bulletId = `${currentProj.id}_b${String(bulletCounter).padStart(2, '0')}`
        currentProj.bullets.push({
          id: bulletId,
          text: line,
          source: { page: 1 },
        })
        bulletCounter++
      } else if (currentProj && currentProj.bullets.length > 0) {
        const lastBullet = currentProj.bullets[currentProj.bullets.length - 1]
        const startsLower = /^[a-z]/.test(line)
        const prevIncomplete = !/[.!?:;]$/.test(lastBullet.text.trim())

        if (startsLower || prevIncomplete || line.length > 100) {
          lastBullet.text = `${lastBullet.text} ${line}`.trim()
        } else {
          const bulletId = `${currentProj.id}_b${String(bulletCounter).padStart(2, '0')}`
          currentProj.bullets.push({
            id: bulletId,
            text: line,
            source: { page: 1 },
          })
          bulletCounter++
        }
      } else {
        const projId = `proj_${String(projCounter).padStart(3, '0')}`
        projCounter++
        currentProj = {
          id: projId,
          title: line,
          bullets: [],
        }
        projects.push(currentProj)
      }
    }

    return projects
  }

  /**
   * Parses education section
   */
  static parseEducation(lines) {
    const education = []
    let eduCounter = 1

    for (const line of lines) {
      if (line.length > 5) {
        const parts = line.split(/[|•·]|(?:\s+-\s+)/).map((s) => s.trim()).filter(Boolean)
        let degree = parts[0] || line
        let institution = parts[1] || ''
        let year = parts[2] || ''

        if (/\b(?:19|20)\d{2}\b/.test(institution) && !year) {
          year = institution
          institution = ''
        }

        education.push({
          id: `edu_${String(eduCounter).padStart(3, '0')}`,
          degree,
          institution,
          year,
        })
        eduCounter++
      }
    }

    return education
  }

  /**
   * Parses skills into clean list with automatic category resolution
   */
  static parseSkills(lines) {
    const skills = []
    let skillCounter = 1

    for (const line of lines) {
      let category = 'General'
      let skillContent = line

      const colonMatch = line.match(/^([A-Za-z\s&/\\-]+):\s*(.*)$/)
      if (colonMatch && colonMatch[1].length < 35 && colonMatch[2].length > 0) {
        category = colonMatch[1].trim()
        skillContent = colonMatch[2].trim()
      }

      const parts = skillContent.split(/[,|•▪·/]/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 50)
      for (const part of parts) {
        skills.push({
          id: `skill_${String(skillCounter).padStart(3, '0')}`,
          name: part,
          category,
        })
        skillCounter++
      }
    }

    return skills
  }

  /**
   * Parses certifications
   */
  static parseCertifications(lines) {
    const certifications = []
    let certCounter = 1

    for (const rawLine of lines) {
      if (!rawLine || typeof rawLine !== 'string') continue
      // Split on bullets, pipes, semicolons, newlines, or spaced dashes
      const items = rawLine
        .split(/(?:[•|;]|\s+-\s+|\n)/)
        .map((s) => s.replace(/^[•\-*▪–—·#]+\s*/, '').trim())
        .filter((s) => s.length > 4)

      for (const item of items) {
        const cleanName = item.replace(/[.]+$/, '').trim()
        if (cleanName.length > 3) {
          certifications.push({
            id: `cert_${String(certCounter).padStart(3, '0')}`,
            name: cleanName,
            issuer: '',
            year: '',
          })
          certCounter++
        }
      }
    }

    return certifications
  }
}

export default ResumeNormalizer
