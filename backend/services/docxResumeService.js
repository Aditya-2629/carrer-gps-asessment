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
} from './resumeValidator.js'
import {
  measurePageCountAsync,
  estimateHeightBudget,
} from './pageFit.js'

const PAGE_CONFIG = {
  letter: { width: 12240, height: 15840 },
  marginNormal: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5 in
  marginTight: { top: 648, bottom: 648, left: 648, right: 648 },   // 0.45 in
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
  const isSweRole = /software|full stack|backend|frontend|engineer|developer|sde|cloud|devops/i.test(targetRole)

  if (isDataRole) {
    const buckets = {
      'SQL & Core Database': [],
      'BI & Visualization': [],
      'Analytics & Machine Learning': [],
      'Cloud & Data Engineering': [],
      'Business Analysis & Process': [],
    }
    unique.forEach((s) => {
      const low = s.toLowerCase()
      if (/sql|snowflake|bigquery|postgresql|mysql|t-sql|queries/i.test(low)) buckets['SQL & Core Database'].push(s)
      else if (/power bi|tableau|looker|excel|dashboards|reporting|dax/i.test(low)) buckets['BI & Visualization'].push(s)
      else if (/python|machine learning|predictive|regression|hypothesis|a\/b|pandas|numpy/i.test(low)) buckets['Analytics & Machine Learning'].push(s)
      else if (/aws|azure|dbt|alteryx|airflow|etl|databricks|spark/i.test(low)) buckets['Cloud & Data Engineering'].push(s)
      else buckets['Business Analysis & Process'].push(s)
    })
    return Object.entries(buckets).filter(([_, items]) => items.length > 0)
  }

  if (isSweRole) {
    const buckets = {
      'Programming Languages': [],
      'AI & Machine Learning Systems': [],
      'Backend & Architecture': [],
      'Cloud & DevOps': [],
      'Databases & Caching': [],
    }
    unique.forEach((s) => {
      const low = s.toLowerCase()
      if (/python|javascript|typescript|go|bash|c\+\+|java|\bc\b|\br\b/i.test(low)) buckets['Programming Languages'].push(s)
      else if (/langchain|fastmcp|smolagents|rag|llm|tensorflow|openai|gemini/i.test(low)) buckets['AI & Machine Learning Systems'].push(s)
      else if (/fastapi|node|flask|rest|graphql|microservices|system design/i.test(low)) buckets['Backend & Architecture'].push(s)
      else if (/aws|docker|kubernetes|terraform|ci\/cd|jenkins|git/i.test(low)) buckets['Cloud & DevOps'].push(s)
      else buckets['Databases & Caching'].push(s)
    })
    return Object.entries(buckets).filter(([_, items]) => items.length > 0)
  }

  // Fallback 3 Groups
  const buckets = {
    'Core Technical Stack': unique.slice(0, 8),
    'Frameworks & Libraries': unique.slice(8, 16),
    'Tools & Methodologies': unique.slice(16),
  }
  return Object.entries(buckets).filter(([_, items]) => items.length > 0)
}

function createHyperlink(text, url) {
  if (!url) return new TextRun({ text, font: 'Calibri', size: 19, color: '000000' })
  const cleanUrl = url.startsWith('http') || url.startsWith('mailto:') ? url : `https://${url}`
  return new ExternalHyperlink({
    link: cleanUrl,
    children: [
      new TextRun({ text, font: 'Calibri', size: 19, color: '0563C1', underline: {} }),
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
      new TextRun({ text: title.toUpperCase(), bold: true, size: 21, font: 'Calibri', color: '000000' }),
    ],
  })
}

function buildSelectiveBoldRuns(text, candidateSkills = []) {
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
      runs.push(new TextRun({ text: part, bold: isBold, size: 20, font: 'Calibri', color: '000000' }))
    })
    return runs
  }

  // Case B: Dynamic selection (1 tool + 1 result metric)
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

function buildDocxModel(sanitizedResume = {}, config = {}) {
  const margin = config.tightMargin ? PAGE_CONFIG.marginTight : PAGE_CONFIG.marginNormal
  const contentWidth = PAGE_CONFIG.letter.width - (margin.left + margin.right)

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

  // 1. Header (Centered)
  if (candidateName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 20 },
        children: [
          new TextRun({ text: candidateName.toUpperCase(), bold: true, size: 38, font: 'Calibri', color: '000000' }),
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
          new TextRun({ text: subtitle, bold: true, size: 21, color: '000000', font: 'Calibri' }),
        ],
      })
    )
  }

  // Contact line
  const contactRuns = []
  if (contact.location) contactRuns.push(new TextRun({ text: contact.location, size: 19, font: 'Calibri', color: '000000' }))
  if (contact.phone) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: 19, font: 'Calibri', color: '000000' }))
    contactRuns.push(new TextRun({ text: contact.phone, size: 19, font: 'Calibri', color: '000000' }))
  }
  if (contact.email) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: 19, font: 'Calibri', color: '000000' }))
    contactRuns.push(createHyperlink(contact.email, `mailto:${contact.email}`))
  }
  if (contact.linkedin) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: 19, font: 'Calibri', color: '000000' }))
    contactRuns.push(createHyperlink('LinkedIn', contact.linkedin))
  }
  if (contact.github) {
    if (contactRuns.length > 0) contactRuns.push(new TextRun({ text: ' | ', size: 19, font: 'Calibri', color: '000000' }))
    contactRuns.push(createHyperlink('GitHub', contact.github))
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

  // 2. Summary
  if (summary && summary.trim()) {
    let cleanSummary = summary.trim()
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

  // 4. Experience
  if (experiences.length > 0) {
    children.push(createSectionHeading('Professional Experience', config.tightSpacing ? 100 : 120, 40))

    experiences.forEach((exp) => {
      const company = exp.company || ''
      const role = exp.role || ''
      const rightMeta = [exp.location, exp.duration].filter(Boolean).join(' | ')

      children.push(
        new Paragraph({
          spacing: { before: config.tightSpacing ? 60 : 80, after: 25 },
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: [
            new TextRun({ text: company ? `${company}, ` : '', bold: true, size: 20, font: 'Calibri', color: '000000' }),
            new TextRun({ text: role, bold: false, size: 20, font: 'Calibri', color: '111827' }),
            new TextRun({ text: `\t${rightMeta}`, size: 19, color: '000000', font: 'Calibri' }),
          ],
        })
      )

      ;(exp.bullets || []).forEach((b) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 8, after: 16 },
            indent: { left: 288, hanging: 216 }, // Custom tight bullet indent
            children: buildSelectiveBoldRuns(b, allAtomicSkills),
          })
        )
      })
    })
  }

  // 5. Projects (Preserved — Never Deleted to Save Space)
  if (projects.length > 0) {
    children.push(createSectionHeading('Projects', config.tightSpacing ? 100 : 120, 40))

    projects.forEach((proj) => {
      const rightMeta = [proj.label, proj.dates].filter(Boolean).join(' | ')

      children.push(
        new Paragraph({
          spacing: { before: config.tightSpacing ? 50 : 60, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: [
            new TextRun({ text: proj.title, bold: true, size: 20, font: 'Calibri', color: '000000' }),
            proj.techStack ? new TextRun({ text: ` | ${proj.techStack}`, size: 19, color: '000000', font: 'Calibri' }) : new TextRun(''),
            proj.link ? new TextRun({ text: '  ' }) : new TextRun(''),
            proj.link ? createHyperlink('Demo / Code', proj.link) : new TextRun(''),
            rightMeta ? new TextRun({ text: `\t${rightMeta}`, size: 19, color: '000000', font: 'Calibri' }) : new TextRun(''),
          ],
        })
      )

      ;(proj.bullets || []).slice(0, 2).forEach((pb) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 6, after: 14 },
            indent: { left: 288, hanging: 216 },
            children: buildSelectiveBoldRuns(pb, allAtomicSkills),
          })
        )
      })
    })
  }

  // 6. Education & Certifications
  if (education.length > 0 || certifications.length > 0) {
    children.push(createSectionHeading('Education & Certifications', config.tightSpacing ? 100 : 120, 40))

    education.forEach((edu) => {
      const rightMeta = [edu.location, edu.dates].filter(Boolean).join(' | ')
      children.push(
        new Paragraph({
          spacing: { before: 30, after: 15 },
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          children: [
            new TextRun({ text: edu.degree ? `${edu.degree}, ` : '', bold: true, size: 20, font: 'Calibri', color: '000000' }),
            new TextRun({ text: edu.school, size: 20, font: 'Calibri', color: '000000' }),
            new TextRun({ text: `\t${rightMeta}`, size: 19, color: '000000', font: 'Calibri' }),
          ],
        })
      )
    })

    if (certifications.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 20, after: 15 },
          children: [
            new TextRun({ text: 'Certifications: ', bold: true, size: 20, font: 'Calibri', color: '000000' }),
            new TextRun({ text: certifications.join(' | '), size: 20, font: 'Calibri', color: '000000' }),
          ],
        })
      )
    }
  }

  return new Document({
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
}

/**
 * Main ATS Resume Generator with Dynamic Fit Loop
 */
export async function buildAtsTailoredDocx(canonicalResume = {}, tailoredBullets = []) {
  // 1. Sanitize & Apply Rewrites by ID
  const { sanitizedResume, warnings } = sanitizeAndValidateResume(canonicalResume, tailoredBullets)

  // 2. Determine target page count
  const yoe = parseFloat(String(sanitizedResume.years_of_experience || '').match(/\d+(?:\.\d+)?/)?.[0] || '3')
  const targetPages = yoe <= 8 ? 1 : 2

  // 3. Tightening order
  const tighteningLevels = [
    { tightSpacing: false, tightMargin: false, shortenSummary: false },
    { tightSpacing: false, tightMargin: false, shortenSummary: true },
    { tightSpacing: true, tightMargin: false, shortenSummary: true },
    { tightSpacing: true, tightMargin: true, shortenSummary: true },
  ]

  let bestBuffer = null
  let finalPages = 1
  let fitMode = 'measured'

  for (const config of tighteningLevels) {
    const doc = buildDocxModel(sanitizedResume, config)
    const buffer = await Packer.toBuffer(doc)
    bestBuffer = buffer

    // Check page count via Async Isolated LibreOffice + pdfinfo
    const measured = await measurePageCountAsync(buffer)
    if (measured !== null) {
      finalPages = measured
      fitMode = 'measured'
    } else {
      finalPages = estimateHeightBudget(sanitizedResume, config)
      fitMode = 'estimated'
    }

    if (finalPages <= targetPages) {
      break
    }
  }

  if (finalPages > targetPages) {
    warnings.push(`Content spilled to ${finalPages} pages after all tightening attempts.`)
  }

  return {
    buffer: bestBuffer,
    pages: finalPages,
    mode: fitMode,
    warnings,
  }
}