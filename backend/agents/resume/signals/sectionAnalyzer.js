/**
 * Section Structure Analyzer
 * Returns objective structural facts about resume sections: existence, item counts,
 * bullet counts, character counts, and contact data presence.
 * Does NOT classify or score section quality.
 */

export function analyzeSections(canonicalResume) {
  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return {
      summary: { exists: false, characterCount: 0, wordCount: 0 },
      experience: { exists: false, items: 0, bullets: 0 },
      projects: { exists: false, items: 0, bullets: 0 },
      education: { exists: false, items: 0 },
      skills: { exists: false, items: 0 },
      certifications: { exists: false, items: 0 },
      contact: { hasEmail: false, hasPhone: false, hasLocation: false },
    }
  }

  // 1. Summary
  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) ||
    canonicalResume.candidate?.summary ||
    ''
  const summaryClean = summaryText.trim()
  const summaryExists = summaryClean.length > 0
  const summaryWords = summaryExists ? summaryClean.split(/\s+/).filter(Boolean).length : 0

  // 2. Experience
  let expItems = 0
  let expBullets = 0
  if (Array.isArray(canonicalResume.experience)) {
    expItems = canonicalResume.experience.length
    for (const exp of canonicalResume.experience) {
      if (exp && Array.isArray(exp.bullets)) {
        expBullets += exp.bullets.filter(Boolean).length
      }
    }
  }

  // 3. Projects
  let projItems = 0
  let projBullets = 0
  if (Array.isArray(canonicalResume.projects)) {
    projItems = canonicalResume.projects.length
    for (const proj of canonicalResume.projects) {
      if (proj && Array.isArray(proj.bullets)) {
        projBullets += proj.bullets.filter(Boolean).length
      }
    }
  }

  // 4. Education
  const eduItems = Array.isArray(canonicalResume.education) ? canonicalResume.education.length : 0

  // 5. Skills
  let skillItems = 0
  if (Array.isArray(canonicalResume.skills)) {
    skillItems = canonicalResume.skills.length
  } else if (canonicalResume.skills?.items && Array.isArray(canonicalResume.skills.items)) {
    skillItems = canonicalResume.skills.items.length
  } else if (typeof canonicalResume.skills?.text === 'string') {
    skillItems = canonicalResume.skills.text.split(/[,|•▪]/).filter(Boolean).length
  }

  // 6. Certifications
  const certItems = Array.isArray(canonicalResume.certifications) ? canonicalResume.certifications.length : 0

  // 7. Contact info
  const contact = canonicalResume.candidate?.contact || {}
  const hasEmail = Boolean(contact.email && contact.email !== 'N/A' && contact.email.includes('@'))
  const hasPhone = Boolean(contact.phone && contact.phone !== 'N/A' && /\d{3}/.test(contact.phone))
  const hasLocation = Boolean(contact.location && contact.location !== 'N/A' && contact.location.length > 2)

  return {
    summary: {
      exists: summaryExists,
      characterCount: summaryClean.length,
      wordCount: summaryWords,
    },
    experience: {
      exists: expItems > 0,
      items: expItems,
      bullets: expBullets,
    },
    projects: {
      exists: projItems > 0,
      items: projItems,
      bullets: projBullets,
    },
    education: {
      exists: eduItems > 0,
      items: eduItems,
    },
    skills: {
      exists: skillItems > 0,
      items: skillItems,
    },
    certifications: {
      exists: certItems > 0,
      items: certItems,
    },
    contact: {
      hasEmail,
      hasPhone,
      hasLocation,
    },
  }
}

export default analyzeSections
