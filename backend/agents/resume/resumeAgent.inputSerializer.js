/**
 * Compact Resume Serializer V1.4
 * Converts structured Canonical Resume JSON into concise, human-readable plain text
 * for LLM consumption while preserving exact stable bullet IDs and verbatim evidence text.
 *
 * Removes internal parser metadata (source, bbox, pageCount, confidence) to maximize
 * context efficiency and focus recruiter reasoning.
 */

import crypto from 'crypto'

export const INPUT_SERIALIZER_VERSION = 'compact-resume-v1'

/**
 * Computes deterministic SHA-256 hash of an object or string (first 16 hex chars)
 */
export function computeHash(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data)
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/**
 * Serializes a canonical resume object into compact human-readable text.
 *
 * @param {Object} canonicalResume - Internal canonical resume representation
 * @param {Object} [options]
 * @param {string} [options.targetRole] - Target role override if specified
 * @returns {string} Human-readable serialized resume text
 */
export function serializeResumeForLLM(canonicalResume, options = {}) {
  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return ''
  }

  const sections = []

  // 1. Target Role
  const effectiveRole =
    options.targetRole ||
    canonicalResume.candidate?.targetRole ||
    'Senior Technical Professional'
  sections.push(`TARGET ROLE\n${effectiveRole.trim()}`)

  // 2. Candidate Information
  const candidateName = (canonicalResume.candidate?.name || '').trim()
  if (candidateName) {
    sections.push(`CANDIDATE\n${candidateName}`)
  }

  // 3. Experience Level (infer from experience items / summary if present, without fabricating)
  let expLevel = ''
  const summaryText = (canonicalResume.summary?.text || '').trim()
  const yearsMatch = summaryText.match(/(\d+[\+]?\s*(?:years|yrs))/i)
  if (yearsMatch) {
    expLevel = yearsMatch[1]
  } else if (Array.isArray(canonicalResume.experience) && canonicalResume.experience.length > 0) {
    const jobCount = canonicalResume.experience.length
    expLevel = jobCount >= 4 ? 'Senior (5+ years)' : jobCount >= 2 ? 'Mid-Level (2-5 years)' : 'Early Career'
  }
  if (expLevel) {
    sections.push(`EXPERIENCE LEVEL\n${expLevel}`)
  }

  // 4. Summary (exact text without rewriting — wrapped with stable ID summary_001)
  if (summaryText) {
    sections.push(`SUMMARY\n\n[summary_001]\n${summaryText}`)
  }

  // 5. Professional Experience (preserve exact IDs and verbatim bullet text)
  if (Array.isArray(canonicalResume.experience) && canonicalResume.experience.length > 0) {
    const expBlocks = []

    for (const exp of canonicalResume.experience) {
      if (!exp) continue
      const headerLines = [`[${exp.id}]`]

      // Preserve role, company, location, dates as available in canonical data
      if (exp.role) headerLines.push(`Role: ${exp.role.trim()}`)
      if (exp.company) headerLines.push(`Company: ${exp.company.trim()}`)
      if (exp.location) headerLines.push(`Location: ${exp.location.trim()}`)
      const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ')
      if (dates) headerLines.push(`Dates: ${dates.trim()}`)

      const bulletLines = []
      if (Array.isArray(exp.bullets)) {
        for (const b of exp.bullets) {
          if (!b || !b.text) continue
          const bId = b.id || `${exp.id}_b01`
          bulletLines.push(`[${bId}]\n${b.text.trim()}`)
        }
      }

      expBlocks.push(headerLines.join('\n') + (bulletLines.length > 0 ? '\n\n' + bulletLines.join('\n\n') : ''))
    }

    if (expBlocks.length > 0) {
      sections.push(`EXPERIENCE\n\n${expBlocks.join('\n\n')}`)
    }
  }

  // 6. Projects (preserve exact project bullet IDs)
  if (Array.isArray(canonicalResume.projects) && canonicalResume.projects.length > 0) {
    const projBlocks = []

    for (const proj of canonicalResume.projects) {
      if (!proj) continue
      const projHeader = [`[${proj.id}]`, proj.title ? proj.title.trim() : 'Project']
      if (proj.technologies) {
        projHeader.push(`Technologies: ${proj.technologies.trim()}`)
      }

      const bulletLines = []
      if (Array.isArray(proj.bullets)) {
        for (const b of proj.bullets) {
          if (!b || !b.text) continue
          const bId = b.id || `${proj.id}_b01`
          bulletLines.push(`[${bId}]\n${b.text.trim()}`)
        }
      }

      projBlocks.push(projHeader.join('\n') + (bulletLines.length > 0 ? '\n\n' + bulletLines.join('\n\n') : ''))
    }

    if (projBlocks.length > 0) {
      sections.push(`PROJECTS\n\n${projBlocks.join('\n\n')}`)
    }
  }

  // 7. Education (preserve items with exact IDs)
  if (Array.isArray(canonicalResume.education) && canonicalResume.education.length > 0) {
    const eduBlocks = []

    for (const edu of canonicalResume.education) {
      if (!edu) continue
      const eduHeader = [`[${edu.id}]`]
      const details = [edu.degree, edu.institution, edu.year].filter(Boolean)
      if (details.length > 0) {
        eduHeader.push(details.join(' | '))
      }
      eduBlocks.push(eduHeader.join('\n'))
    }

    if (eduBlocks.length > 0) {
      sections.push(`EDUCATION\n\n${eduBlocks.join('\n\n')}`)
    }
  }

  // 8. Skills Compaction (group by category if present or extract cleanly)
  if (Array.isArray(canonicalResume.skills) && canonicalResume.skills.length > 0) {
    const categoriesMap = new Map()
    let currentCategory = 'Technical Skills'

    for (const skill of canonicalResume.skills) {
      if (!skill || !skill.name) continue
      const rawName = skill.name.trim()

      let cat = (skill.category && skill.category !== 'General') ? skill.category : ''
      let skillName = rawName

      if (rawName.includes(':')) {
        const colonIdx = rawName.indexOf(':')
        const prefix = rawName.slice(0, colonIdx).trim()
        const remainder = rawName.slice(colonIdx + 1).trim()
        if (prefix.length > 1 && prefix.length < 35 && remainder.length > 0) {
          cat = prefix
          skillName = remainder
          currentCategory = prefix
        }
      } else if (cat) {
        currentCategory = cat
      } else {
        cat = currentCategory
      }

      if (!cat) cat = currentCategory || 'Technical Skills'

      if (!categoriesMap.has(cat)) {
        categoriesMap.set(cat, [])
      }
      if (!categoriesMap.get(cat).includes(skillName)) {
        categoriesMap.get(cat).push(skillName)
      }
    }

    const skillGroupLines = []
    for (const [catName, skillList] of categoriesMap.entries()) {
      if (skillList.length > 0) {
        skillGroupLines.push(`${catName}:\n${skillList.join(', ')}`)
      }
    }

    if (skillGroupLines.length > 0) {
      sections.push(`SKILLS\n\n[skills_001]\n${skillGroupLines.join('\n\n')}`)
    }
  }

  // 9. Certifications
  if (Array.isArray(canonicalResume.certifications) && canonicalResume.certifications.length > 0) {
    const certBlocks = canonicalResume.certifications
      .map((c) => `[${c.id}]\n${[c.name, c.issuer, c.year].filter(Boolean).join(' | ')}`)
      .filter(Boolean)
    if (certBlocks.length > 0) {
      sections.push(`CERTIFICATIONS\n\n${certBlocks.join('\n\n')}`)
    }
  }

  return sections.join('\n\n')
}

export default {
  INPUT_SERIALIZER_VERSION,
  serializeResumeForLLM,
  computeHash,
}
