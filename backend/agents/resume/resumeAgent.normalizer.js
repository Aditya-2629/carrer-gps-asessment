/**
 * Canonical Resume Normalizer
 * Converts raw parsed document text into structured Canonical Resume JSON with stable IDs.
 */

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
    const certifications = this.parseCertifications(sections.certifications || [])
    const summary = this.parseSummary(sections.summary || [])

    return {
      document: {
        type: parsedDoc.type || 'text',
        pageCount: parsedDoc.pageCount || 1,
        extractionConfidence: parsedDoc.confidence || 0.9,
        warnings: parsedDoc.warnings || [],
      },
      candidate,
      summary,
      experience,
      projects,
      education,
      skills,
      certifications,
    }
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
   * Segments lines into major resume sections based on recognizable headings
   */
  static segmentSections(lines) {
    const sections = {
      summary: [],
      experience: [],
      projects: [],
      education: [],
      skills: [],
      certifications: [],
      misc: [],
    }

    let currentSection = 'summary'

    const sectionPatterns = [
      { key: 'experience', regex: /^(work\s+experience|professional\s+experience|experience|employment\s+history)$/i },
      { key: 'projects', regex: /^(projects|technical\s+projects|personal\s+projects|academic\s+projects)$/i },
      { key: 'education', regex: /^(education|academic\s+background|academics)$/i },
      { key: 'skills', regex: /^(skills|technical\s+skills|core\s+competencies|technologies)$/i },
      { key: 'certifications', regex: /^(certifications|licenses|courses|awards)$/i },
      { key: 'summary', regex: /^(summary|professional\s+summary|profile|about\s+me|objective)$/i },
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

          currentItem = {
            id: itemId,
            company: line,
            role: '',
            startDate: '',
            endDate: '',
            bullets: [],
          }
          items.push(currentItem)
        } else if (currentItem && currentItem.bullets.length === 0) {
          // If already started an item, second header line might be role or dates
          if (!currentItem.role) {
            currentItem.role = line
          } else {
            // Treat as bullet if it looks like a sentence
            const bulletId = `${currentItem.id}_b${String(bulletCounter).padStart(2, '0')}`
            currentItem.bullets.push({
              id: bulletId,
              text: line,
              source: { page: 1, bbox: null },
            })
            bulletCounter++
          }
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
          currentItem = {
            id: itemId,
            company: line,
            role: '',
            startDate: '',
            endDate: '',
            bullets: [],
          }
          items.push(currentItem)
        }
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
        education.push({
          id: `edu_${String(eduCounter).padStart(3, '0')}`,
          degree: line,
          institution: '',
          year: '',
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
