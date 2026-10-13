/**
 * Canonical Resume Normalizer
 * Converts raw parsed document text into structured Canonical Resume JSON with stable IDs.
 */

import { detectCertifications } from './signals/certificationDetector.js'

export class ResumeNormalizer {
  /**
   * Main normalization function
   *
   * @param {Object} parsedDoc - Output from DocumentParser.parse()
   * @param {string} [targetRoleOverride] - Optional target role passed by user/caller
   * @returns {Object} Canonical Resume Representation
   */
  static normalize(parsedDoc, targetRoleOverride = '') {
    const rawText = parsedDoc.rawText || ''
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)

    const candidate = this.extractCandidateInfo(lines, targetRoleOverride)
    const sections = this.segmentSections(lines)

    const experience = this.parseExperience(sections.experience || [])
    const projects = this.parseProjects(sections.projects || [])
    const education = this.parseEducation(sections.education || [])
    const skills = this.parseSkills(sections.skills || [])
    const initialCertifications = this.parseCertifications(sections.certifications || [])
    const summary = this.parseSummary(sections.summary || [])

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

    return canonical
  }

  /**
   * Extracts candidate name, contact, and target role from header lines
   */
  static extractCandidateInfo(lines, targetRoleOverride) {
    const headerLines = lines.slice(0, 10)
    let email = null
    let phone = null
    let location = null
    let name = ''

    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/

    for (const line of headerLines) {
      if (!email && emailRegex.test(line)) {
        email = line.match(emailRegex)[1]
      }
      if (!phone && phoneRegex.test(line)) {
        phone = line.match(phoneRegex)[0]
      }
      // Heuristic location detection
      if (!location && /[A-Z][a-zA-Z]+,\s*[A-Z]{2}/.test(line)) {
        const match = line.match(/([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})/)
        if (match) location = match[1]
      }
    }

    // First line that is not email/phone/link is likely candidate name
    for (const line of headerLines) {
      if (
        !line.includes('@') &&
        !phoneRegex.test(line) &&
        !line.toLowerCase().includes('http') &&
        !line.toLowerCase().includes('linkedin') &&
        !line.toLowerCase().includes('github') &&
        line.length > 2 &&
        line.length < 50 &&
        /^[A-Za-z\s.'-]+$/.test(line)
      ) {
        name = line
        break
      }
    }

    return {
      name: name || 'Candidate',
      targetRole: targetRoleOverride || '',
      contact: {
        email: email || 'N/A',
        phone: phone || 'N/A',
        location: location || 'N/A',
      },
    }
  }

  /**
   * Determines whether a line belongs in the header block (name, contact, links, location, headline)
   * rather than being part of the summary or body text.
   */
  static isContactOrHeaderLine(line) {
    if (!line || typeof line !== 'string') return false
    const clean = line.trim()
    if (!clean) return false

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    const urlRegex = /(?:https?:\/\/|www\.|linkedin\.com|github\.com|gitlab\.com|portfolio|twitter\.com|x\.com)/i

    // 1. Explicit contact info: email, phone, web link / profile
    if (emailRegex.test(clean) || phoneRegex.test(clean) || urlRegex.test(clean)) {
      if (clean.length < 150 || /[|•·/]/.test(clean)) {
        return true
      }
    }

    // 2. Location format: "City, ST", "City, Country", "Postal"
    const locationRegex = /^[A-Z][a-zA-Z\s]+,\s*([A-Z]{2}|[A-Za-z\s]+)(\s+\d{5}(-\d{4})?)?$/
    if (locationRegex.test(clean) && clean.length < 60) {
      return true
    }

    // 3. Delimited short metadata line (e.g. "San Jose, CA | US Citizen | Full-Time")
    if (/[|•·]/.test(clean) && clean.length < 100) {
      return true
    }

    // 4. Short candidate name or title/headline: length < 60, no full-sentence punctuation at end
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
      { key: 'experience', regex: /^(work\s+experience|professional\s+experience|experience|employment\s+history|career\s+history)$/i },
      { key: 'projects', regex: /^(projects|technical\s+projects|personal\s+projects|academic\s+projects|key\s+projects)$/i },
      { key: 'education', regex: /^(education|academic\s+background|academics|education\s+and\s+training)$/i },
      { key: 'skills', regex: /^(skills|technical\s+skills|core\s+competencies|technologies|tools\s+and\s+technologies)$/i },
      { key: 'certifications', regex: /^(certifications|licenses|courses|awards|certifications\s+and\s+licenses)$/i },
      { key: 'summary', regex: /^(summary|professional\s+summary|profile|about\s+me|objective|career\s+summary|executive\s+summary)$/i },
    ]

    for (const line of lines) {
      // Check if line is a section heading
      const cleanHeading = line.replace(/^[#\-*•_\s]+|[#\-*•_\s]+$/g, '').trim()
      let matchedSection = null

      if (cleanHeading.length < 35) {
        for (const { key, regex } of sectionPatterns) {
          if (regex.test(cleanHeading)) {
            matchedSection = key
            break
          }
        }
      }

      if (matchedSection) {
        currentSection = matchedSection
      } else if (currentSection === 'header') {
        // We are before any explicit section heading
        if (this.isContactOrHeaderLine(line)) {
          sections.header.push(line)
        } else {
          // Narrative prose before first section heading is an unheaded summary
          currentSection = 'summary'
          sections.summary.push(line)
        }
      } else {
        sections[currentSection].push(line)
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
   * Helper to parse experience header lines into { role, company, location, dates, startDate, endDate }
   */
  static parseExperienceHeader(line1, line2 = null) {
    const dateRangeRegex = /((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b)\s*(?:[–—\-–]|to)\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b|present|current|now))/i
    const roleKeywords = /\b(engineer|developer|architect|manager|lead|director|analyst|scientist|consultant|specialist|designer|intern|administrator|coordinator|programmer|officer|head|vp|president|founder|cto|ceo|cpo)\b/i
    const locationRegex = /^(?:[A-Za-z\s.]+,\s*(?:[A-Z]{2}|[A-Za-z\s]+)|remote|hybrid|onsite)$/i

    let role = ''
    let company = ''
    let location = ''
    let dates = ''
    let startDate = ''
    let endDate = ''

    const allLines = [line1, line2].filter(Boolean)
    const unconsumedParts = []

    for (const line of allLines) {
      const dMatch = line.match(dateRangeRegex)
      if (dMatch) {
        if (!dates) dates = dMatch[0]
        const cleanLine = line.replace(dMatch[0], '').replace(/^[|–—\-\s]+|[|–—\-\s]+$/g, '').trim()
        if (cleanLine) {
          unconsumedParts.push(...cleanLine.split(/[|•]/).map((s) => s.trim()).filter(Boolean))
        }
      } else {
        unconsumedParts.push(...line.split(/[|•]/).map((s) => s.trim()).filter(Boolean))
      }
    }

    if (dates) {
      const parts = dates.split(/[–—\-–]|(?:\s+to\s+)/i).map((s) => s.trim()).filter(Boolean)
      startDate = parts[0] || ''
      endDate = parts[1] || (dates.toLowerCase().includes('present') ? 'Present' : '')
    }

    for (let i = 0; i < unconsumedParts.length; i++) {
      const part = unconsumedParts[i]
      if (!location && locationRegex.test(part)) {
        location = part
      } else if (!role && roleKeywords.test(part)) {
        role = part
      } else if (!company) {
        company = part
      } else if (!role) {
        role = part
      }
    }

    return {
      role,
      company: company || line1,
      location,
      dates,
      startDate,
      endDate,
    }
  }

  /**
   * Parses experience section into items and stable bullet IDs
   */
  static parseExperience(lines) {
    const items = []
    let currentItem = null
    let expCounter = 1
    let bulletCounter = 1

    const bulletRegex = /^[•\-*▪–—]\s*|\b\d+\.\s+/

    for (const line of lines) {
      const isBullet = bulletRegex.test(line)

      if (isBullet && currentItem) {
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
      } else {
        // Potential company / role header
        // If line contains dates or pipe separator, likely new job entry
        const hasDate = /\b(20\d\d|19\d\d|present|current)\b/i.test(line)
        const hasSeparator = line.includes('|') || line.includes(' - ') || line.includes(' — ')

        if ((hasDate || hasSeparator) && (!currentItem || currentItem.bullets.length > 0)) {
          bulletCounter = 1
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
            bullets: [],
            _rawHeader1: line,
          }
          items.push(currentItem)
        } else if (currentItem && currentItem.bullets.length === 0) {
          // Second line of header before bullets (often dates or role)
          const updated = this.parseExperienceHeader(currentItem._rawHeader1 || currentItem.company, line)
          currentItem.company = updated.company || currentItem.company
          currentItem.role = updated.role || currentItem.role
          currentItem.location = updated.location || currentItem.location
          currentItem.startDate = updated.startDate || currentItem.startDate
          currentItem.endDate = updated.endDate || currentItem.endDate
          currentItem.dates = updated.dates || currentItem.dates
        } else if (currentItem) {
          // Non-bullet line within existing job
          const bulletId = `${currentItem.id}_b${String(bulletCounter).padStart(2, '0')}`
          currentItem.bullets.push({
            id: bulletId,
            text: line,
            source: { page: 1, bbox: null },
          })
          bulletCounter++
        } else {
          // Create initial experience item if none exists
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
            bullets: [],
            _rawHeader1: line,
          }
          items.push(currentItem)
        }
      }
    }

    // Clean internal temporary fields
    for (const it of items) {
      delete it._rawHeader1
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

      if (isBullet && currentProj) {
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
      } else {
        bulletCounter = 1
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
        const parts = line.split(/[|•]/).map((s) => s.trim()).filter(Boolean)
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
   * Parses skills into clean list
   */
  static parseSkills(lines) {
    const skills = []
    let skillCounter = 1

    for (const line of lines) {
      // Split by comma, pipe, or bullet
      const parts = line.split(/[,|•▪]/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40)
      for (const part of parts) {
        skills.push({
          id: `skill_${String(skillCounter).padStart(3, '0')}`,
          name: part,
          category: 'General',
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

    for (const line of lines) {
      if (line.length > 4) {
        certifications.push({
          id: `cert_${String(certCounter).padStart(3, '0')}`,
          name: line,
          issuer: '',
          year: '',
        })
        certCounter++
      }
    }

    return certifications
  }
}

export default ResumeNormalizer
