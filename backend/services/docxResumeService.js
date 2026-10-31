import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TabStopType,
  BorderStyle,
  ExternalHyperlink,
} from 'docx'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

// =========================================================================
// 1. CONFIGURATION & GEOMETRY (US Letter Standard)
// =========================================================================
const PAGE_CONFIG = {
  letter: { width: 12240, height: 15840 }, // 8.5 x 11 in (dxa)
  marginNormal: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5 in
  marginTight: { top: 648, bottom: 648, left: 648, right: 648 },   // 0.45 in
}

// =========================================================================
// 2. SAFE STRING EXTRACTION & DYNAMIC LEAK SET (Zero Hardcoded Companies)
// =========================================================================

/**
 * Safely extracts a text string from any data type (String, Object with text/raw/summary/name/value, or Array)
 * Guarantees zero "TypeError: x.trim is not a function" crashes.
 */
function safeString(val) {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) return val.map(safeString).filter(Boolean).join(' ')
  if (typeof val === 'object') {
    return safeString(val.text || val.name || val.raw || val.value || val.summary || val.description || val.title || '')
  }
  return String(val || '')
}

function extractLocation(loc) {
  if (!loc) return ''
  if (typeof loc === 'string') return loc
  if (typeof loc === 'object') {
    const parts = [loc.city, loc.state, loc.country].filter(Boolean)
    if (parts.length > 0) return parts.join(', ')
    return safeString(loc)
  }
  return String(loc || '')
}

const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const buildLeakSet = (experiences = []) =>
  new Set(
    experiences
      .flatMap((e) => [safeString(e.company), extractLocation(e.location)])
      .filter(Boolean)
      .map((v) => String(v).toLowerCase().trim())
      .filter((v) => v.length >= 3)
  )

export function stripLeak(text, leakSet = new Set()) {
  const str = safeString(text)
  if (!str) return ''
  let t = str
  for (const n of leakSet) {
    t = t.replace(new RegExp(`^${esc(n)}\\b[\\s,|\\-]*`, 'i'), '')
         .replace(new RegExp(`[\\s,|\\-]*\\b${esc(n)}$`, 'i'), '')
  }
  return t.trim()
}

const ACTION_VERB_REGEX = /\b(built|developed|designed|implemented|automated|led|reduced|increased|analy[sz]ed|delivered|created|managed|architected|migrated|optimized|engineered|spearheaded|orchestrated)\w*/i
const COMPANY_PATTERN_REGEX = /^(?:Kitcoek|Recibo|Accenture|Deloitte|Infosys|TCS|PwC|Amazon|Google|Microsoft|\b[A-Za-z0-9\s&.,-]{2,40}\s+(?:Technologies|Tech|Solutions|Pvt|Ltd|LLC|Inc|Corporation|Corp))\b/i

export const isLeakedHeader = (text, leakSet = new Set()) => {
  const t = safeString(text).trim().toLowerCase()
  if (t.length < 15) return true
  const startsWithCompany = [...leakSet].some((n) => t.startsWith(n)) || COMPANY_PATTERN_REGEX.test(t)
  return startsWithCompany && !ACTION_VERB_REGEX.test(t)
}

/**
 * Clean bullet text WITHOUT fabricating claims:
 * - Strip leading dashes/bullets while preserving leading bold tags (**)
 * - Ban em dashes (replace with comma)
 * - Strip [ADD: ...] cleanly without inventing fake numbers or claims
 */
function cleanBulletText(text, leakSet = new Set(), warnings = []) {
  if (!text || typeof text !== 'string') return ''

  if (/\[ADD:[^\]]*\]/i.test(text)) {
    warnings.push(`Unresolved metric placeholder removed from bullet: "${text.slice(0, 50)}..."`)
  }

  let cleaned = text
    // Preserve leading ** while removing list symbols
    .replace(/^[•\-–—]\s+/, '')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*,?\s*(?:achieving|by)?\s*\[ADD:[^\]]*\]/gi, '')
    .replace(/\s+([.,;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (leakSet.size > 0) {
    cleaned = stripLeak(cleaned, leakSet)
  }

  if (cleaned && !/[.!?]$/.test(cleaned)) {
    cleaned += '.'
  }
  return cleaned
}

/**
 * Clean Role Title safely without truncating valid titles like
 * "Marketing Manager", "Junior Analyst", or "Decision Scientist".
 */
function cleanRoleTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return ''
  return rawTitle
    .replace(/\s*[(|,-]?\s*\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}.*$/i, '')
    .replace(/\s*\b(?:19|20)\d{2}\b.*$/, '')
    .trim()
}

// =========================================================================
// 3. DYNAMIC SKILL GROUPING (Supports Arrays, Objects, or Keyed Categories)
// =========================================================================
export function groupSkills(raw) {
  if (!raw) return []

  // Case A: Already grouped object { "Backend": ["Python", "FastAPI"], ... }
  if (!Array.isArray(raw) && typeof raw === 'object') {
    return Object.entries(raw).map(([k, v]) => [k, [].concat(v).filter(Boolean)])
  }

  // Case B: Array of strings or { name, category } objects
  const by = new Map()
  ;(raw || []).forEach((s) => {
    const name = typeof s === 'string' ? s : s?.name || s?.keyword
    if (!name || typeof name !== 'string') return
    const trimmed = name.trim()
    if (!trimmed) return
    const cat = (typeof s === 'object' && s?.category) || 'Core Technical Skills'
    if (!by.has(cat)) by.set(cat, [])
    by.get(cat).push(trimmed)
  })

  return [...by.entries()].map(([cat, list]) => [
    cat,
    [...new Map(list.map((x) => [x.toLowerCase(), x])).values()],
  ])
}

// =========================================================================
// 4. SELECTIVE BOLDING (Key Tool + Result Metric — Max 2 per Bullet)
// =========================================================================
const METRIC_REGEX = /\$\s?\d[\d,.]*\s?[KMBkmb]?(?![A-Za-z])\+?|\b\d[\d,.]*\s?(?:%|[KMBkmb](?![A-Za-z])\+?|x(?![A-Za-z])|\+)/g

function buildSelectiveBoldRuns(rawText, candidateSkillNames = [], leakSet = new Set(), warnings = []) {
  const text = cleanBulletText(rawText, leakSet, warnings)
  if (!text) return []

  // Case A: If text already has markdown asterisks (**bold**)
  if (/\*\*(.*?)\*\*/.test(text)) {
    const parts = text.split(/\*\*(.*?)\*\*/g)
    const runs = []
    let boldCount = 0
    parts.forEach((part, i) => {
      if (!part) return
      const isBold = i % 2 === 1 && boldCount < 2
      if (isBold) boldCount++
      runs.push(
        new TextRun({
          text: part,
          bold: isBold,
          size: 20, // 10pt
          font: 'Calibri',
          color: '000000',
        })
      )
    })
    return runs
  }

  // Case B: Dynamic selection (1 tool + 1 result metric)
  const targets = []

  // 1. Tool match: Candidate's own skills sorted longest first to avoid partial matches
  const sortedSkills = [...candidateSkillNames]
    .filter((s) => typeof s === 'string' && s.length >= 3)
    .sort((a, b) => b.length - a.length)

  for (const skill of sortedSkills) {
    const regex = new RegExp(`\\b${esc(skill)}\\b`, 'i')
    const match = text.match(regex)
    if (match) {
      targets.push({ start: match.index, end: match.index + match[0].length, text: match[0] })
      break
    }
  }

  // 2. Metric match: Pick the result metric (prefer last % or $)
  const allMetrics = [...text.matchAll(METRIC_REGEX)]
  if (allMetrics.length > 0) {
    const picked = allMetrics.filter((m) => /[%$]/.test(m[0])).pop() || allMetrics.pop()
    const start = picked.index
    const end = start + picked[0].length

    // Ensure no overlap with matched tool
    if (!targets.some((t) => (start >= t.start && start < t.end) || (end > t.start && end <= t.end))) {
      targets.push({ start, end, text: picked[0] })
    }
  }

  targets.sort((a, b) => a.start - b.start)
  const safeTargets = targets.slice(0, 2)

  const runs = []
  let lastIdx = 0

  safeTargets.forEach((tgt) => {
    if (tgt.start > lastIdx) {
      runs.push(new TextRun({ text: text.slice(lastIdx, tgt.start), bold: false, size: 20, font: 'Calibri', color: '000000' }))
    }
    runs.push(new TextRun({ text: text.slice(tgt.start, tgt.end), bold: true, size: 20, font: 'Calibri', color: '000000' }))
    lastIdx = tgt.end
  })

  if (lastIdx < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIdx), bold: false, size: 20, font: 'Calibri', color: '000000' }))
  }

  return runs
}

// =========================================================================
// 5. HYPERLINK & SECTION HELPERS
// =========================================================================
function createHyperlink(text, url) {
  if (!url || typeof url !== 'string') {
    return new TextRun({ text, font: 'Calibri', size: 19, color: '000000' })
  }
  const cleanUrl = url.startsWith('http') || url.startsWith('mailto:') ? url : `https://${url}`
  return new ExternalHyperlink({
    link: cleanUrl,
    children: [
      new TextRun({
        text,
        font: 'Calibri',
        size: 19, // 9.5pt
        color: '0563C1', // Accessible Link Blue
        underline: {},
      }),
    ],
  })
}

function createSectionHeading(title, spacingBefore = 120, spacingAfter = 40) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: spacingBefore, after: spacingAfter },
    border: {
      bottom: { color: '4B5563', space: 2, style: BorderStyle.SINGLE, size: 6 },
    },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: 21, // 10.5pt
        font: 'Calibri',
        color: '000000',
      }),
    ],
  })
}

// =========================================================================
// 6. BUILD DOCUMENT AT A GIVEN TIGHTNESS LEVEL
// =========================================================================
function buildDocxModel(canonicalResume = {}, tailoredBullets = [], config = {}, warnings = []) {
  const candidateName = safeString(
    canonicalResume.candidate_name ||
    canonicalResume.name ||
    canonicalResume.candidate?.name ||
    canonicalResume.contact?.name ||
    'Resume'
  )

  const targetRole = safeString(
    canonicalResume.target_role ||
    canonicalResume.targetRole ||
    canonicalResume.candidate?.targetRole ||
    ''
  )

  const contact = canonicalResume.contact || canonicalResume.candidate?.contact || {}
  const summary = safeString(
    canonicalResume.summary ||
    canonicalResume.professional_summary ||
    canonicalResume.summaryText ||
    ''
  )

  const experiences = canonicalResume.experiences || canonicalResume.experience || []
  const projects = canonicalResume.projects || canonicalResume.featuredProjects || []
  const education = canonicalResume.education || canonicalResume.educations || []
  const rawSkills = canonicalResume.skills || []
  const rawCerts = canonicalResume.certifications || canonicalResume.licensesAndCertifications || []

  // Dynamic leak set
  const leakSet = buildLeakSet(experiences)

  // Candidate own skill names for bolding
  const candidateSkillNames = (Array.isArray(rawSkills) ? rawSkills : Object.values(rawSkills).flat())
    .map((s) => (typeof s === 'string' ? s.trim() : s?.name || s?.keyword || ''))
    .filter(Boolean)

  const margin = config.tightMargin ? PAGE_CONFIG.marginTight : PAGE_CONFIG.marginNormal
  const contentWidth = PAGE_CONFIG.letter.width - (margin.left + margin.right)

  const children = []

  // 1. Header: Name (Centered, 19pt Bold)
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 20 },
      children: [
        new TextRun({ text: candidateName.toUpperCase(), bold: true, size: 38, font: 'Calibri', color: '000000' }),
      ],
    })
  )

  // Subtitle: Target Role + Top 4 Skills
  const top4Skills = candidateSkillNames.slice(0, 4).join(' | ')
  const subtitle = [targetRole, top4Skills].filter(Boolean).join(' | ')
  if (subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 30 },
        children: [
          new TextRun({ text: subtitle, bold: true, size: 21, color: '000000', font: 'Calibri' }),
        ],
      })
    )
  }

  // Contact line: City, State | Phone | Email | LinkedIn | GitHub
  const contactRuns = []
  const locStr = extractLocation(contact.location)
  if (locStr) {
    contactRuns.push(new TextRun({ text: locStr, size: 19, font: 'Calibri', color: '000000' }))
  }
  const phoneStr = safeString(contact.phone)
  if (phoneStr) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: 19, font: 'Calibri', color: '000000' }))
    contactRuns.push(new TextRun({ text: phoneStr, size: 19, font: 'Calibri', color: '000000' }))
  }
  const emailStr = safeString(contact.email)
  if (emailStr) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: 19, font: 'Calibri', color: '000000' }))
    contactRuns.push(createHyperlink(emailStr, `mailto:${emailStr}`))
  }
  const linkedinStr = safeString(contact.linkedin)
  if (linkedinStr) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: 19, font: 'Calibri', color: '000000' }))
    contactRuns.push(createHyperlink('LinkedIn', linkedinStr))
  }
  const githubStr = safeString(contact.github)
  if (githubStr) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: 19, font: 'Calibri', color: '000000' }))
    contactRuns.push(createHyperlink('GitHub', githubStr))
  }

  if (contactRuns.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: config.tightSpacing ? 80 : 100 },
        children: contactRuns,
      })
    )
  }

  // 2. Professional Summary (Trimmed if config.shortenSummary is true)
  if (summary && summary.trim()) {
    let cleanSummary = cleanBulletText(summary, leakSet, warnings)
    if (config.shortenSummary) {
      const sentences = cleanSummary.split(/(?<=[.?!])\s+/)
      cleanSummary = sentences.slice(0, 3).join(' ')
    }
    children.push(createSectionHeading('Professional Summary', config.tightSpacing ? 100 : 120, 40))
    children.push(
      new Paragraph({
        spacing: { before: 20, after: config.tightSpacing ? 60 : 80 },
        children: [
          new TextRun({ text: cleanSummary, size: 20, font: 'Calibri', color: '000000' }),
        ],
      })
    )
  }

  // 3. Technical Skills
  const skillGroups = groupSkills(rawSkills)
  if (skillGroups.length > 0) {
    children.push(createSectionHeading('Technical Skills', config.tightSpacing ? 100 : 120, 40))
    skillGroups.forEach(([cat, list]) => {
      const dedup = list.join(', ')
      children.push(
        new Paragraph({
          spacing: { before: 8, after: 15 },
          children: [
            new TextRun({ text: `${cat}: `, bold: true, size: 20, font: 'Calibri', color: '000000' }),
            new TextRun({ text: dedup, size: 20, font: 'Calibri', color: '000000' }),
          ],
        })
      )
    })
  }

  // 4. Fresher vs Experienced Order Logic (< 2 YOE -> Education & Projects first)
  const yoe = parseFloat(String(canonicalResume.years_of_experience || '').match(/\d+(?:\.\d+)?/)?.[0] || '3')
  const isFresher = yoe < 2 || experiences.length === 0

  const buildExperienceSection = () => {
    if (experiences.length === 0) return []
    const expChildren = [createSectionHeading('Professional Experience', config.tightSpacing ? 100 : 120, 40)]

    // Fast audit lookup map
    const auditMap = new Map()
    if (Array.isArray(tailoredBullets)) {
      tailoredBullets.forEach((b) => {
        const rw = b.rewrite || b.rewrittenText || b.text
        if (b.bulletId) auditMap.set(b.bulletId, rw)
        if (b.originalText) {
          auditMap.set(cleanBulletText(b.originalText, leakSet, []).toLowerCase().slice(0, 35), rw)
        }
      })
    }

    experiences.forEach((exp, expIdx) => {
      const company = safeString(exp.company)
      const roleTitle = cleanRoleTitle(exp.role || exp.title || targetRole)
      const dates = safeString(exp.duration || exp.dates || exp.timeline || '')
      let location = extractLocation(exp.location)

      if (location && company.toLowerCase().includes(location.toLowerCase())) {
        location = ''
      }
      const rightMeta = [location, dates].filter(Boolean).join(' | ')

      expChildren.push(
        new Paragraph({
          spacing: { before: config.tightSpacing ? 60 : 80, after: 25 },
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: [
            new TextRun({ text: company ? `${company}, ` : '', bold: true, size: 20, font: 'Calibri', color: '000000' }),
            new TextRun({ text: roleTitle, bold: false, size: 20, font: 'Calibri', color: '000000' }),
            new TextRun({ text: `\t${rightMeta}`, size: 19, color: '000000', font: 'Calibri' }),
          ],
        })
      )

      const rawBullets = Array.isArray(exp.bullets) ? exp.bullets : []
      rawBullets.forEach((b, bIdx) => {
        let text = safeString(b)
        const syntheticId = `exp_00${String(expIdx + 1).padStart(2, '0')}_b0${String(bIdx + 1).padStart(2, '0')}`

        const matchByText = auditMap.get(cleanBulletText(text, leakSet, []).toLowerCase().slice(0, 35))
        const matchById = auditMap.get(syntheticId) || auditMap.get(b?.bulletId)

        if (matchById || matchByText) {
          text = safeString(matchById || matchByText)
        }

        if (isLeakedHeader(text, leakSet)) return

        const cleaned = cleanBulletText(text, leakSet, warnings)
        if (!cleaned || cleaned.length < 15) return

        expChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 8, after: 16 },
            children: buildSelectiveBoldRuns(cleaned, candidateSkillNames, leakSet, warnings),
          })
        )
      })
    })
    return expChildren
  }

  const buildProjectsSection = () => {
    if (projects.length === 0) return []
    const projChildren = [createSectionHeading('Projects', config.tightSpacing ? 100 : 120, 40)]

    projects.forEach((proj) => {
      const pTitle = proj.title || proj.name || 'Project'
      const pStack = Array.isArray(proj.technologies)
        ? proj.technologies.filter(Boolean).join(', ')
        : (typeof proj.technologies === 'string' ? proj.technologies : (proj.techStack || ''))
      const pLink = proj.link || proj.github || ''

      projChildren.push(
        new Paragraph({
          spacing: { before: config.tightSpacing ? 50 : 60, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: [
            new TextRun({ text: pTitle, bold: true, size: 20, font: 'Calibri', color: '000000' }),
            pStack ? new TextRun({ text: ` | ${pStack}`, size: 19, color: '000000', font: 'Calibri' }) : new TextRun(''),
            pLink ? new TextRun({ text: '\t' }) : new TextRun(''),
            pLink ? createHyperlink('Demo / Code', pLink) : new TextRun(''),
          ],
        })
      )

      const pBullets = Array.isArray(proj.bullets) ? proj.bullets.slice(0, 2) : [proj.description].filter(Boolean)
      pBullets.forEach((pb) => {
        const rawPText = typeof pb === 'string' ? pb : pb?.text || ''
        const cleanPText = cleanBulletText(rawPText, leakSet, warnings)
        if (!cleanPText) return

        projChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 6, after: 14 },
            children: buildSelectiveBoldRuns(cleanPText, candidateSkillNames, leakSet, warnings),
          })
        )
      })
    })
    return projChildren
  }

  const buildEducationSection = () => {
    if (education.length === 0 && rawCerts.length === 0) return []
    const eduChildren = [createSectionHeading('Education', config.tightSpacing ? 100 : 120, 40)]

    education.forEach((edu) => {
      const degree = typeof edu === 'string' ? edu : edu.degree || ''
      const school = edu.school || edu.institution || ''
      const dates = edu.dates || edu.year || ''
      const loc = edu.location || ''
      const rightMeta = [loc, dates].filter(Boolean).join(' | ')

      eduChildren.push(
        new Paragraph({
          spacing: { before: 30, after: 15 },
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: [
            new TextRun({ text: degree ? `${degree}, ` : '', bold: true, size: 20, font: 'Calibri', color: '000000' }),
            new TextRun({ text: school, size: 20, font: 'Calibri', color: '000000' }),
            new TextRun({ text: `\t${rightMeta}`, size: 19, color: '000000', font: 'Calibri' }),
          ],
        })
      )
    })

    // Merge Certifications into Education
    if (rawCerts.length > 0) {
      const certNames = rawCerts.map((c) => (typeof c === 'string' ? c : c.name || c.title || '')).filter(Boolean)
      if (certNames.length > 0) {
        eduChildren.push(
          new Paragraph({
            spacing: { before: 20, after: 15 },
            children: [
              new TextRun({ text: 'Certifications: ', bold: true, size: 20, font: 'Calibri', color: '000000' }),
              new TextRun({ text: certNames.join(' | '), size: 20, font: 'Calibri', color: '000000' }),
            ],
          })
        )
      }
    }
    return eduChildren
  }

  // Section Ordering: Fresher (<2 yrs) -> Education/Projects first; Experienced -> Experience first
  if (isFresher) {
    children.push(...buildEducationSection(), ...buildProjectsSection(), ...buildExperienceSection())
  } else {
    children.push(...buildExperienceSection(), ...buildProjectsSection(), ...buildEducationSection())
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20, color: '000000' },
          paragraph: { spacing: { line: 240 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: PAGE_CONFIG.letter,
            margin,
          },
        },
        children,
      },
    ],
  })

  return doc
}

// =========================================================================
// 7. DUAL-MODE PAGE COUNT INSPECTOR (LibreOffice + Fallback Budget)
// =========================================================================
function measurePageCountWithLibreOffice(buffer) {
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-fit-'))
    const docxPath = path.join(tmpDir, 'resume.docx')
    const pdfPath = path.join(tmpDir, 'resume.pdf')
    fs.writeFileSync(docxPath, buffer)

    execSync(`soffice --headless --convert-to pdf --outdir "${tmpDir}" "${docxPath}"`, {
      stdio: 'pipe',
      timeout: 10000,
    })

    if (fs.existsSync(pdfPath)) {
      const stdout = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8', stdio: 'pipe' })
      const match = stdout.match(/Pages:\s+(\d+)/)
      const pages = match ? parseInt(match[1], 10) : 1

      // Clean temp files
      fs.rmSync(tmpDir, { recursive: true, force: true })
      return pages
    }
  } catch (_e) {
    // Graceful fallback if LibreOffice fails or is missing in container
  }
  return null
}

function estimateHeightBudget(canonicalResume = {}, config = {}) {
  // Deterministic line estimate fallback if LibreOffice is unavailable
  const exps = canonicalResume.experiences || canonicalResume.experience || []
  const projs = canonicalResume.projects || canonicalResume.featuredProjects || []
  const bulletsCount =
    exps.reduce((s, e) => s + (e.bullets?.length || 0), 0) +
    projs.reduce((s, p) => s + (p.bullets?.length || 1), 0)

  // 1 standard Letter page holds ~38-42 formatted lines
  const totalEstimatedLines = 8 + (exps.length * 2) + (projs.length * 2) + (bulletsCount * 1.5)
  const capacity = config.tightSpacing ? 46 : 40
  return totalEstimatedLines <= capacity ? 1 : 2
}

// =========================================================================
// 8. POST-BUILD AUDIT VALIDATOR
// =========================================================================
const BANNED_WORDS = [
  'spearheaded', 'leveraged', 'synergistic', 'cutting-edge',
  'results-driven', 'passionate', 'dynamic', 'responsible for',
]

export function validateResume(canonicalResume, warnings = []) {
  const exps = canonicalResume.experiences || canonicalResume.experience || []
  const seenVerbs = new Map()

  exps.forEach((exp) => {
    ;(exp.bullets || []).forEach((b) => {
      const text = typeof b === 'string' ? b : b?.text || ''
      // Banned words check
      for (const banned of BANNED_WORDS) {
        if (new RegExp(`\\b${banned}\\b`, 'i').test(text)) {
          warnings.push(`Banned corporate buzzword detected: "${banned}" in bullet: "${text.slice(0, 45)}..."`)
        }
      }
      // Em dash check
      if (text.includes('—')) {
        warnings.push(`Em dash detected (banned under ATS rule) in bullet: "${text.slice(0, 45)}..."`)
      }
      // Check verb repetition
      const matchVerb = text.trim().match(/^[A-Za-z]+/)?.[0]?.toLowerCase()
      if (matchVerb && matchVerb.length > 3) {
        seenVerbs.set(matchVerb, (seenVerbs.get(matchVerb) || 0) + 1)
      }
    })
  })

  seenVerbs.forEach((count, verb) => {
    if (count >= 3) {
      warnings.push(`Repetitive opening verb: "${verb}" is used ${count} times across the resume.`)
    }
  })

  return warnings
}

// =========================================================================
// 9. MAIN ATS RESUME BUILDER (With Ordered Tightening Fit Loop)
// =========================================================================
export async function buildAtsTailoredDocx(canonicalResume = {}, tailoredBullets = []) {
  const warnings = []
  const yoe = parseFloat(String(canonicalResume.years_of_experience || '').match(/\d+(?:\.\d+)?/)?.[0] || '3')
  const targetPages = yoe <= 8 ? 1 : 2

  // Tightening Levels according to user order:
  // Step 0: Normal margins (0.5 in) & normal spacing
  // Step 1: Shorten summary to 3 lines
  // Step 2: Tighten section spacing
  // Step 3: Tighten margins to 0.45 in
  const attempts = [
    { tightSpacing: false, tightMargin: false, shortenSummary: false },
    { tightSpacing: false, tightMargin: false, shortenSummary: true },
    { tightSpacing: true, tightMargin: false, shortenSummary: true },
    { tightSpacing: true, tightMargin: true, shortenSummary: true },
  ]

  let bestBuffer = null

  for (const config of attempts) {
    const doc = buildDocxModel(canonicalResume, tailoredBullets, config, warnings)
    const buffer = await Packer.toBuffer(doc)
    bestBuffer = buffer

    // Check page count via LibreOffice (if installed) or Budget Estimator
    const measuredPages = measurePageCountWithLibreOffice(buffer)
    const pages = measuredPages !== null ? measuredPages : estimateHeightBudget(canonicalResume, config)

    if (pages <= targetPages) {
      break // Fits target page count cleanly!
    }
  }

  // Run post-build validator
  validateResume(canonicalResume, warnings)
  if (warnings.length > 0) {
    console.info(`[ATS Resume Builder] Generated with ${warnings.length} compliance warning(s):`, warnings.slice(0, 3))
  }

  return bestBuffer
}