/**
 * Skill Evidence Mapping & Matcher
 * Maps explicitly listed skills against experience, projects, summary, and certifications
 * to identify evidence-backed skills vs skill evidence gaps without pejorative labeling.
 */

import { SKILL_STATUS } from './signalTypes.js'

// Known canonical tech alias mappings
const SKILL_ALIASES = {
  aws: ['aws', 'amazon web services'],
  ecs: ['ecs', 'amazon ecs'],
  eks: ['eks', 'amazon eks'],
  gcp: ['gcp', 'google cloud', 'google cloud platform'],
  kubernetes: ['kubernetes', 'k8s'],
  nodejs: ['nodejs', 'node.js', 'node js', 'node'],
  react: ['react', 'reactjs', 'react.js'],
  nextjs: ['nextjs', 'next.js', 'next js', 'next'],
  vue: ['vue', 'vuejs', 'vue.js'],
  angular: ['angular', 'angularjs', 'angular.js'],
  postgres: ['postgres', 'postgresql'],
  mongodb: ['mongo', 'mongodb'],
  go: ['golang', 'go'],
  typescript: ['typescript', 'ts'],
  javascript: ['javascript', 'js'],
  rag: ['rag', 'rag architecture'],
  fastmcp: ['fastmcp', 'fast-mcp'],
  langchain: ['langchain', 'lang-chain'],
  chromadb: ['chromadb', 'chroma db', 'chroma'],
  pinecone: ['pinecone', 'pinecone db'],
  docker: ['docker', 'containerization', 'containers'],
  cicd: ['ci/cd', 'ci-cd', 'cicd', 'continuous integration', 'continuous deployment'],
  sql: ['sql', 't-sql', 'pl/sql', 'structured query language'],
}

const REVERSE_ALIASES = {}
for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
  for (const alias of aliases) {
    const slug = alias.toLowerCase().replace(/[.\s\-_/]+/g, '')
    REVERSE_ALIASES[slug] = canonical
    REVERSE_ALIASES[alias.toLowerCase()] = canonical
  }
}

/**
 * Normalizes a raw skill string by trimming, removing common punctuation and version suffixes.
 * E.g. "Python 3.11" -> "python", "Node.js" -> "nodejs", "ReactJS" -> "react"
 */
export function normalizeSkill(skillName) {
  if (!skillName || typeof skillName !== 'string') return ''
  let clean = skillName.trim()

  // Remove common category prefixes if accidentally included (e.g. "Languages: Python" -> "Python")
  clean = clean.replace(/^[A-Za-z\s&/]+:\s*/, '')

  // Remove version suffixes: "Python 3", "Python 3.11", "Java 17", "Vue 3.0", "Angular 2+", "ECMAScript 6"
  clean = clean.replace(/\s+(?:v|ver|version)?\d+(?:\.\d+)*(?:\+)?$/i, '')

  const lower = clean.toLowerCase().replace(/['"`]/g, '')
  const slug = lower.replace(/[.\s\-_/]+/g, '')

  // Check alias lookup
  if (REVERSE_ALIASES[slug]) {
    return REVERSE_ALIASES[slug]
  }
  if (REVERSE_ALIASES[lower]) {
    return REVERSE_ALIASES[lower]
  }

  return lower
}

/**
 * Extracts all unique skills explicitly listed in the canonical resume.
 *
 * @param {Object} canonicalResume
 * @returns {Array<{ originalName: string, normalized: string }>}
 */
export function extractListedSkills(canonicalResume) {
  if (!canonicalResume || typeof canonicalResume !== 'object') return []

  const rawList = []
  const skillsData = canonicalResume.skills

  if (Array.isArray(skillsData)) {
    for (const item of skillsData) {
      if (typeof item === 'string') {
        rawList.push(item)
      } else if (item && typeof item === 'object') {
        if (item.name) rawList.push(item.name)
        if (Array.isArray(item.items)) rawList.push(...item.items)
        if (typeof item.description === 'string') {
          rawList.push(...item.description.split(/[,|•▪]/).map((s) => s.trim()))
        }
      }
    }
  } else if (skillsData && typeof skillsData === 'object') {
    if (typeof skillsData.text === 'string') {
      rawList.push(...skillsData.text.split(/[,|•▪\n]/).map((s) => s.trim()))
    }
    if (Array.isArray(skillsData.items)) {
      rawList.push(...skillsData.items)
    }
  }

  // De-duplicate and parse individual skill items
  const seenNorm = new Set()
  const result = []

  for (const raw of rawList) {
    if (!raw || typeof raw !== 'string') continue

    // Unpack parenthetical lists: e.g. "Vector DBs (Pinecone, ChromaDB)" -> "Vector DBs", "Pinecone", "ChromaDB"
    const parenMatch = raw.match(/^([^(]+)\(([^)]+)\)$/)
    const rawItems = []
    if (parenMatch) {
      if (parenMatch[1].trim()) rawItems.push(parenMatch[1].trim())
      rawItems.push(...parenMatch[2].split(/[,|•▪]/).map((s) => s.trim()))
    } else {
      rawItems.push(raw)
    }

    for (const item of rawItems) {
      // If string has commas or bullets, split further
      const subParts = item.split(/[,|•▪]/).map((s) => s.trim()).filter(Boolean)
      for (const sub of subParts) {
        // Strip leading bullet characters or category labels (e.g. "Languages: Python" -> "Python")
        let clean = sub.replace(/^[-*•▪]\s*/, '').trim()
        clean = clean.replace(/^[A-Za-z\s&/]+:\s*/, '').trim()

        if (!clean || clean.length < 2 || clean.length > 50) continue
        // Avoid standalone category headers treated as skills
        if (/^(languages|frameworks|tools|databases|cloud|devops|backend|frontend|technologies|systems|other)$/i.test(clean)) {
          continue
        }

        const norm = normalizeSkill(clean).toLowerCase()
        if (norm && !seenNorm.has(norm)) {
          seenNorm.add(norm)
          result.push({
            originalName: clean,
            normalized: norm,
          })
        }
      }
    }
  }

  return result
}

/**
 * Collects all searchable blocks across experience, projects, summary, and certifications.
 *
 * @param {Object} canonicalResume
 * @returns {Array<{ itemId: string, bulletId: string, section: string, text: string }>}
 */
export function collectSearchableEvidence(canonicalResume) {
  if (!canonicalResume || typeof canonicalResume !== 'object') return []
  const blocks = []

  // 1. Summary
  const summaryText =
    (typeof canonicalResume.summary === 'string'
      ? canonicalResume.summary
      : canonicalResume.summary?.text) ||
    canonicalResume.candidate?.summary ||
    ''
  if (summaryText.trim()) {
    blocks.push({
      itemId: 'summary_001',
      bulletId: 'summary_001',
      section: 'summary',
      text: summaryText.trim(),
    })
  }

  // 2. Experience
  if (Array.isArray(canonicalResume.experience)) {
    for (const exp of canonicalResume.experience) {
      if (!exp) continue
      const itemId = exp.id || 'exp_unknown'

      // Include role and company line as searchable context
      const headerText = [exp.role, exp.company, exp.title].filter(Boolean).join(' ')
      if (headerText) {
        blocks.push({
          itemId,
          bulletId: `${itemId}_header`,
          section: 'experience',
          text: headerText,
        })
      }

      if (Array.isArray(exp.bullets)) {
        for (const b of exp.bullets) {
          if (!b) continue
          const bId = b.id || `${itemId}_b`
          const bText = (b.text || '').trim()
          if (bText) {
            blocks.push({
              itemId,
              bulletId: bId,
              section: 'experience',
              text: bText,
            })
          }
        }
      }
    }
  }

  // 3. Projects
  if (Array.isArray(canonicalResume.projects)) {
    for (const proj of canonicalResume.projects) {
      if (!proj) continue
      const itemId = proj.id || 'proj_unknown'

      const headerText = [proj.title, proj.name, proj.description].filter(Boolean).join(' ')
      if (headerText) {
        blocks.push({
          itemId,
          bulletId: `${itemId}_header`,
          section: 'projects',
          text: headerText,
        })
      }

      if (Array.isArray(proj.bullets)) {
        for (const b of proj.bullets) {
          if (!b) continue
          const bId = b.id || `${itemId}_b`
          const bText = (b.text || '').trim()
          if (bText) {
            blocks.push({
              itemId,
              bulletId: bId,
              section: 'projects',
              text: bText,
            })
          }
        }
      }
    }
  }

  // 4. Certifications
  if (Array.isArray(canonicalResume.certifications)) {
    for (const cert of canonicalResume.certifications) {
      if (!cert) continue
      const itemId = cert.id || 'cert_unknown'
      const certText = [cert.name, cert.issuer].filter(Boolean).join(' ')
      if (certText) {
        blocks.push({
          itemId,
          bulletId: itemId,
          section: 'certifications',
          text: certText,
        })
      }
    }
  }

  return blocks
}

/**
 * Checks whether a specific skill is evidenced within a given text snippet.
 * Uses exact boundaries, known aliases, and safe token matching.
 *
 * @param {string} text - The resume text snippet to search
 * @param {string} originalSkill - Original skill name (e.g. "Kubernetes")
 * @param {string} normalizedSkill - Normalized skill name (e.g. "kubernetes")
 * @returns {boolean}
 */
export function isSkillMentionedInText(text, originalSkill, normalizedSkill) {
  if (!text || typeof text !== 'string') return false
  const cleanText = text.trim()
  const lowerText = cleanText.toLowerCase()

  // Build list of terms to search for
  const termsToTest = new Set()
  termsToTest.add(originalSkill.toLowerCase().trim())
  termsToTest.add(normalizedSkill.toLowerCase().trim())

  // Add alias terms if available
  const aliasKey = normalizedSkill.toLowerCase().replace(/[.\s\-_/]+/g, '')
  if (SKILL_ALIASES[aliasKey]) {
    for (const alias of SKILL_ALIASES[aliasKey]) {
      termsToTest.add(alias.toLowerCase().trim())
    }
  }

  for (const term of termsToTest) {
    if (!term || term.length < 2) continue

    // Handle "Go" specifically: avoid matching common English word "go" ("to go", "go-to", "ongoing")
    if (term === 'go') {
      // Must match "Golang" (case-insensitive) OR capital "Go" surrounded by word boundaries and not followed by "to", "live", "ahead"
      if (/\bgolang\b/i.test(cleanText)) return true
      if (/\bGo\b(?!\s+(?:to|live|ahead|for|on|with\s+the|back))/i.test(cleanText)) {
        // Double check not part of "Google" or "Go-to"
        if (/\bGo\b/.test(cleanText) && !/\bGo-(?:to|getter)\b/i.test(cleanText)) {
          return true
        }
      }
      continue
    }

    // Handle "C" or "R" language: only match in tech context or uppercase boundary
    if (term === 'c' || term === 'r') {
      if (new RegExp(`\\b${term.toUpperCase()}\\b`).test(cleanText)) {
        return true
      }
      continue
    }

    // Escape regex special chars in term
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Standard word boundary regex (allow trailing punctuation like .js, ++, #)
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_])${escaped}(?:$|[^a-zA-Z0-9_])`, 'i')
    if (regex.test(lowerText) || regex.test(cleanText)) {
      return true
    }

    // Also check hyphen/slash joined tokens (e.g. "Python-based", "FastMCP/Docker")
    const joinedRegex = new RegExp(`\\b${escaped}\\b`, 'i')
    if (joinedRegex.test(cleanText)) {
      return true
    }
  }

  return false
}

/**
 * Main function: Maps all explicitly listed skills against evidence blocks.
 *
 * @param {Object} canonicalResume - Structured canonical resume
 * @returns {{ skills: Array, summary: { totalListed: number, withEvidence: number, evidenceGaps: number } }}
 */
export function analyzeSkillEvidence(canonicalResume) {
  const listedSkills = extractListedSkills(canonicalResume)
  const evidenceBlocks = collectSearchableEvidence(canonicalResume)

  const skillResults = []
  let withEvidenceCount = 0
  let evidenceGapCount = 0

  for (const { originalName, normalized } of listedSkills) {
    const locations = []
    const seenBullets = new Set()

    for (const block of evidenceBlocks) {
      if (isSkillMentionedInText(block.text, originalName, normalized)) {
        if (!seenBullets.has(block.bulletId)) {
          seenBullets.add(block.bulletId)
          locations.push({
            section: block.section,
            itemId: block.itemId,
            bulletId: block.bulletId,
          })
        }
      }
    }

    const evidenceFound = locations.length > 0
    if (evidenceFound) {
      withEvidenceCount++
    } else {
      evidenceGapCount++
    }

    skillResults.push({
      skill: originalName,
      normalized,
      listed: true,
      evidenceFound,
      evidenceCount: locations.length,
      evidenceLocations: locations,
      status: evidenceFound ? SKILL_STATUS.EVIDENCE_FOUND : SKILL_STATUS.SKILL_EVIDENCE_GAP,
    })
  }

  return {
    skills: skillResults,
    summary: {
      totalListed: listedSkills.length,
      withEvidence: withEvidenceCount,
      evidenceGaps: evidenceGapCount,
    },
  }
}

export default analyzeSkillEvidence
