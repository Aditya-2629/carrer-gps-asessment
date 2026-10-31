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
import {
  sanitizeAndValidateResume,
  tokenizeSkillsSafe,
  determineSkillBucket,
} from './resumeValidator.js'
import {
  measurePageCountAsync,
  estimateHeightBudget,
} from './pageFit.js'

const PAGE_CONFIG = {
  letter: { width: 12240, height: 15840 },
  marginNormal: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.50 in (10800 dxa content width)
  marginTight: { top: 648, bottom: 648, left: 648, right: 648 },   // 0.45 in (10944 dxa content width)
}

/**
 * Group skills by category with JD demand order, eliminating the "General" catch-all
 */
export function groupByCategory(skills = [], targetRole = '') {
  if (!skills) return []

  // Case A: Pre-grouped object
  if (!Array.isArray(skills) && typeof skills === 'object') {
    return Object.entries(skills)
      .filter(([k]) => !/general|other/i.test(k))
      .map(([k, v]) => [k, [].concat(v).filter(Boolean)])
  }

  // Tokenize safely
  const flatTokens = []
  ;(Array.isArray(skills) ? skills : [skills]).forEach((item) => {
    const str = typeof item === 'string' ? item : item?.name || item?.keyword || ''
    if (str.includes(',') && str.includes('(')) {
      flatTokens.push(...tokenizeSkillsSafe(str))
    } else if (str.includes(',') && !str.includes('A/B') && !str.includes('CI/CD')) {
      flatTokens.push(...tokenizeSkillsSafe(str))
    } else if (str) {
      flatTokens.push(str.trim())
    }
  })

  const unique = Array.from(new Set(flatTokens)).filter((s) => s.length >= 1)
  const isDataRole = /data|analyst|analytics|bi\b|sql|tableau|power bi/i.test(targetRole)

  if (isDataRole) {
    const buckets = {
      'SQL & Core Database': [],
      'BI & Visualization': [],
      'Analytics & Machine Learning': [],
      'Cloud & Data Engineering': [],
      'Business Analysis & Process': [],
    }
    unique.forEach((s) => {
      const bucket = determineSkillBucket(s, targetRole)
      if (buckets[bucket]) buckets[bucket].push(s)
      else buckets['Business Analysis & Process'].push(s)
    })
    return Object.entries(buckets).filter(([_, items]) => items.length > 0)
  }

  // SWE / AI / Full Stack
  const buckets = {
    'Programming Languages': [],
    'AI & Machine Learning Systems': [],
    'Backend & Architecture': [],
    'Cloud & DevOps': [],
    'Databases & Caching': [],
  }
  unique.forEach((s) => {
    const bucket = determineSkillBucket(s, targetRole)
    if (buckets[bucket]) buckets[bucket].push(s)
    else buckets['Databases & Caching'].push(s)
  })
  return Object.entries(buckets).filter(([_, items]) => items.length > 0)
}

function createHyperlink(text, url, size = 19) {
  if (!url) return new TextRun({ text, font: 'Calibri', size, color: '000000' })
  const cleanUrl = url.startsWith('http') || url.startsWith('mailto:') ? url : `https://${url}`
  return new ExternalHyperlink({
    link: cleanUrl,
    children: [
      new TextRun({ text, font: 'Calibri', size, color: '0563C1', underline: {} }),
    ],
  })
}

function createSectionHeading(title, spacingBefore = 110, spacingAfter = 30) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: spacingBefore, after: spacingAfter },
    border: {
      bottom: { color: '4B5563', space: 2, style: BorderStyle.SINGLE, size: 6 }, // 0.5pt bottom rule
    },
    children: [
      new TextRun({ text: title.toUpperCase(), bold: true, size: 21, font: 'Calibri', color: '000000' }), // 10.5pt Bold
    ],
  })
}

function buildSelectiveBoldRuns(text, candidateSkills = [], bodySize = 20) {
  if (!text) return []

  // Case A: Model already supplied **bold** markers
  if (/\*\*(.*?)\*\*/.test(text)) {
    const parts = text.split(/\*\*(.*?)\*\*/g)
    const runs = []
    let boldCount = 0
    parts.forEach((part, i) => {
      if (!part) return
      const isBold = i % 2 === 1 && boldCount < 2
      if (isBold) boldCount++
      runs.push(new TextRun({ text: part, bold: isBold, size: bodySize, font: 'Calibri', color: '000000' }))
    })
    return runs
  }

  // Case B: Dynamic selection (max 2: 1 tool + 1 result metric)
  const targets = []
  const sortedSkills = [...candidateSkills].sort((a, b) => b.length - a.length)

  for (const skill of sortedSkills) {
    if (skill.length < 2) continue
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    const match = text.match(regex)
    if (match) {
      targets.push({ start: match.index, end: match.index + match[0].length, text: match[0] })
      break
    }
  }

  const METRIC_REGEX = /\$\s?\d[\d,.]*\s?[KMBkmb]?(?![A-Za-z])\+?|\b\d[\d,.]*\s?(?:%|[KMBkmb](?![A-Za-z])\+?|x(?![A-Za-z])|\+)/g
  const allMetrics = [...text.matchAll(METRIC_REGEX)]
  if (allMetrics.length > 0) {
    const picked = allMetrics.filter((m) => /[%$]/.test(m[0])).pop() || allMetrics.pop()
    const start = picked.index
    const end = start + picked[0].length
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
      runs.push(new TextRun({ text: text.slice(lastIdx, tgt.start), bold: false, size: bodySize, font: 'Calibri', color: '000000' }))
    }
    runs.push(new TextRun({ text: text.slice(tgt.start, tgt.end), bold: true, size: bodySize, font: 'Calibri', color: '000000' }))
    lastIdx = tgt.end
  })
  if (lastIdx < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIdx), bold: false, size: bodySize, font: 'Calibri', color: '000000' }))
  }
  return runs
}

function buildDocxModel(sanitizedResume = {}, config = {}) {
  const margin = config.tightMargin ? PAGE_CONFIG.marginTight : PAGE_CONFIG.marginNormal
  const contentWidth = PAGE_CONFIG.letter.width - (margin.left + margin.right)
  const bodySize = config.tightFont ? 19 : 20 // 9.5pt tight, 10pt normal

  const candidateName = sanitizedResume.candidate_name || ''
  const targetRole = sanitizedResume.target_role || ''
  const contact = sanitizedResume.contact || {}
  const summary = sanitizedResume.summary || ''
  const experiences = sanitizedResume.experiences || []
  const projects = sanitizedResume.projects || []
  const education = sanitizedResume.education || []
  const certifications = sanitizedResume.certifications || []

  const rawSkills = sanitizedResume.skills || []
  const skillGroups = groupByCategory(rawSkills, targetRole)
  const allAtomicSkills = skillGroups.flatMap(([_, items]) => items).filter((s) => s.length <= 22 && !s.includes(';'))

  const topSkillsSub = allAtomicSkills.slice(0, 4).join(' | ')
  const subtitle = [targetRole, topSkillsSub].filter(Boolean).join(' | ')

  const children = []

  // 1. Header (Centered, Calibri only)
  if (candidateName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 20 },
        children: [
          new TextRun({ text: candidateName.toUpperCase(), bold: true, size: 38, font: 'Calibri', color: '000000' }), // 19pt Bold
        ],
      })
    )
  }

  if (subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 30 },
        children: [
          new TextRun({ text: subtitle, bold: true, size: 21, color: '000000', font: 'Calibri' }), // 10.5pt Bold
        ],
      })
    )
  }

  // Contact line (pipe-separated with external hyperlinks)
  const contactRuns = []
  if (contact.location) contactRuns.push(new TextRun({ text: contact.location, size: bodySize - 1, font: 'Calibri', color: '000000' }))
  if (contact.phone) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: bodySize - 1, font: 'Calibri', color: '000000' }))
    contactRuns.push(new TextRun({ text: contact.phone, size: bodySize - 1, font: 'Calibri', color: '000000' }))
  }
  if (contact.email) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: bodySize - 1, font: 'Calibri', color: '000000' }))
    contactRuns.push(createHyperlink(contact.email, `mailto:${contact.email}`, bodySize - 1))
  }
  if (contact.linkedin) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: bodySize - 1, font: 'Calibri', color: '000000' }))
    contactRuns.push(createHyperlink('LinkedIn', contact.linkedin, bodySize - 1))
  }
  if (contact.github) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: bodySize - 1, font: 'Calibri', color: '000000' }))
    contactRuns.push(createHyperlink('GitHub', contact.github, bodySize - 1))
  }

  if (contactRuns.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: config.tightSpacing ? 70 : 90 },
        children: contactRuns,
      })
    )
  }

  // 2. Summary
  if (summary && summary.trim()) {
    let cleanSummary = summary.trim()
    if (config.shortenSummary) {
      const sentences = cleanSummary.split(/(?<=[.?!])\s+/)
      cleanSummary = sentences.slice(0, 3).join(' ')
    }
    children.push(createSectionHeading('Professional Summary', config.tightSpacing ? 90 : 110, 30))
    children.push(
      new Paragraph({
        spacing: { before: 15, after: config.tightSpacing ? 50 : 70 },
        children: [
          new TextRun({ text: cleanSummary, size: bodySize, font: 'Calibri', color: '000000' }),
        ],
      })
    )
  }

  // 3. Technical Skills
  if (skillGroups.length > 0) {
    children.push(createSectionHeading('Technical Skills', config.tightSpacing ? 90 : 110, 30))
    skillGroups.forEach(([cat, list]) => {
      const dedup = list.join(', ')
      children.push(
        new Paragraph({
          spacing: { before: 6, after: 12 },
          children: [
            new TextRun({ text: `${cat}: `, bold: true, size: bodySize, font: 'Calibri', color: '000000' }),
            new TextRun({ text: dedup, size: bodySize, font: 'Calibri', color: '000000' }),
          ],
        })
      )
    })
  }

  // 4. Experience (NEVER drop a role)
  if (experiences.length > 0) {
    children.push(createSectionHeading('Professional Experience', config.tightSpacing ? 90 : 110, 30))

    experiences.forEach((exp) => {
      const company = exp.company || ''
      const role = exp.role || ''
      const rightMeta = [exp.location, exp.duration].filter(Boolean).join(' | ')

      children.push(
        new Paragraph({
          spacing: { before: config.tightSpacing ? 50 : 70, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: [
            new TextRun({ text: company ? `${company}, ` : '', bold: true, size: bodySize, font: 'Calibri', color: '000000' }),
            new TextRun({ text: role, bold: false, size: bodySize, font: 'Calibri', color: '111827' }),
            new TextRun({ text: `\t${rightMeta}`, size: bodySize - 1, color: '000000', font: 'Calibri' }),
          ],
        })
      )

      ;(exp.bullets || []).forEach((b) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 6, after: 12 },
            indent: { left: 288, hanging: 216 },
            children: buildSelectiveBoldRuns(b, allAtomicSkills, bodySize),
          })
        )
      })
    })
  }

  // 5. Projects (Preserved — Never Deleted to Save Space)
  if (projects.length > 0) {
    children.push(createSectionHeading('Projects', config.tightSpacing ? 90 : 110, 30))

    projects.forEach((proj) => {
      const rightMeta = [proj.label, proj.dates].filter(Boolean).join(' | ')
      const headerRuns = [
        new TextRun({ text: proj.title, bold: true, size: bodySize, font: 'Calibri', color: '000000' }),
      ]
      if (proj.techStack) {
        headerRuns.push(
          new TextRun({ text: ` | ${proj.techStack}`, bold: false, size: bodySize, font: 'Calibri', color: '000000' })
        )
      }
      if (proj.link) {
        headerRuns.push(new TextRun({ text: '  ' }))
        headerRuns.push(createHyperlink('Demo / Code', proj.link, bodySize - 1))
      }
      if (rightMeta) {
        headerRuns.push(new TextRun({ text: `\t${rightMeta}`, size: bodySize - 1, color: '000000', font: 'Calibri' }))
      }

      children.push(
        new Paragraph({
          spacing: { before: config.tightSpacing ? 40 : 55, after: 18 },
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: headerRuns,
        })
      )

      ;(proj.bullets || []).forEach((pb) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 5, after: 12 },
            indent: { left: 288, hanging: 216 },
            children: buildSelectiveBoldRuns(pb, allAtomicSkills, bodySize),
          })
        )
      })
    })
  }

  // 6. Education & Certifications
  if (education.length > 0 || certifications.length > 0) {
    children.push(createSectionHeading('Education & Certifications', config.tightSpacing ? 90 : 110, 30))

    education.forEach((edu) => {
      const rightMeta = [edu.location, edu.dates].filter(Boolean).join(' | ')
      children.push(
        new Paragraph({
          spacing: { before: 25, after: 12 },
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: [
            new TextRun({ text: edu.degree ? `${edu.degree}, ` : '', bold: true, size: bodySize, font: 'Calibri', color: '000000' }),
            new TextRun({ text: edu.school, size: bodySize, font: 'Calibri', color: '000000' }),
            new TextRun({ text: `\t${rightMeta}`, size: bodySize - 1, color: '000000', font: 'Calibri' }),
          ],
        })
      )
    })

    if (certifications.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 18, after: 12 },
          children: [
            new TextRun({ text: 'Certifications: ', bold: true, size: bodySize, font: 'Calibri', color: '000000' }),
            new TextRun({ text: certifications.join(' | '), size: bodySize, font: 'Calibri', color: '000000' }),
          ],
        })
      )
    }
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: bodySize, color: '000000' },
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
}

/**
 * Main ATS Resume Generator with Dynamic Fit Loop
 * Contract: returns { buffer, pages, mode, warnings, appliedKeywords, pendingKeywords }
 */
export async function buildAtsTailoredDocx(canonicalResume = {}, tailoredBullets = [], jdKeywords = []) {
  // 1. Sanitize & Apply Rewrites by ID + Natural Keyword Injection
  const { sanitizedResume, warnings, appliedKeywords, pendingKeywords } = sanitizeAndValidateResume(
    canonicalResume,
    tailoredBullets,
    jdKeywords
  )

  // 2. Determine target page count based on genuine experience & roles
  const yoe = parseFloat(String(sanitizedResume.years_of_experience || '').match(/\d+(?:\.\d+)?/)?.[0] || '3')
  const numRoles = (sanitizedResume.experiences || []).length
  const allowTwoPages = yoe >= 8 && numRoles >= 4
  const targetPages = allowTwoPages ? 2 : 1

  // 3. Progressive Tightening Passes
  const standardConfig = { tightMargin: false, tightFont: false, tightSpacing: false, shortenSummary: false }
  const summaryShortenConfig = { tightMargin: false, tightFont: false, tightSpacing: false, shortenSummary: true }
  const tightSpacingConfig = { tightMargin: false, tightFont: false, tightSpacing: true, shortenSummary: true }
  const fullTightConfig = { tightMargin: true, tightFont: true, tightSpacing: true, shortenSummary: true }

  const configs = [standardConfig, summaryShortenConfig, tightSpacingConfig, fullTightConfig]

  let bestBuffer = null
  let finalPages = 1
  let fitMode = 'measured'

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i]
    const doc = buildDocxModel(sanitizedResume, config)
    const buffer = await Packer.toBuffer(doc)
    bestBuffer = buffer

    // Measure page count via Async Isolated LibreOffice
    const measured = await measurePageCountAsync(buffer)

    if (measured !== null) {
      finalPages = measured
      fitMode = 'measured'
    } else {
      finalPages = estimateHeightBudget(sanitizedResume, config)
      fitMode = 'estimated'
      if (!warnings.some((w) => w?.type === 'page_fit_fallback')) {
        warnings.push({
          type: 'page_fit_fallback',
          message: 'LibreOffice measurement timed out or was unavailable; fell back to calibrated height budget estimation.',
        })
      }
    }

    // If within target pages, we're done
    if (finalPages <= targetPages) {
      break
    }
  }

  if (finalPages > targetPages) {
    warnings.push({
      type: 'page_overflow',
      pages: finalPages,
      targetPages,
      message: `Resume content rendered across ${finalPages} pages after all tightening passes.`,
    })
  }

  return {
    buffer: bestBuffer,
    pages: finalPages,
    mode: fitMode,
    warnings,
    appliedKeywords,
    pendingKeywords,
  }
}