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
  normalizeEducationItem,
} from './resumeValidator.js'
import {
  measurePageCountAsync,
  estimateHeightBudget,
} from './pageFit.js'

/**
 * Alekya Gold Standard Geometry:
 * US Letter: 12240 x 15840 dxa (8.5 x 11.0 in)
 * Margins: Top 460 dxa (0.32 in), Bottom 460 dxa (0.32 in), Left 620 dxa (0.43 in), Right 620 dxa (0.43 in)
 * Primary Right Tab Stop: Exactly 10224 dxa (7.1 in) right-aligned
 */
const PAGE_CONFIG = {
  letter: { width: 12240, height: 15840 },
  marginNormal: { top: 460, bottom: 460, left: 620, right: 620 },
  marginTight: { top: 380, bottom: 380, left: 540, right: 540 },
}

const RIGHT_TAB_POS = 10224

/**
 * Group skills by category with JD demand order, eliminating the "General" catch-all
 */
export function groupByCategory(skills = [], targetRole = '') {
  if (!skills) return []

  // Case A: Pre-grouped object
  if (!Array.isArray(skills) && typeof skills === 'object') {
    return Object.entries(skills)
      .filter(([k]) => !/general|other/i.test(k))
      .map(([k, v]) => {
        let mappedKey = k
        if (/backend/i.test(k)) mappedKey = 'Backend & APIs'
        else if (/database|caching/i.test(k)) mappedKey = 'Databases & Messaging'
        return [mappedKey, [].concat(v).filter(Boolean)]
      })
  }

  // Pre-process: stitch array elements where unclosed parentheses span multiple items
  // (e.g. ["AWS (ECS Fargate", "Lambda", "S3", "SQS)", "CI/CD"])
  const rawItems = Array.isArray(skills) ? skills : [skills]
  const stitchedItems = []
  let pendingGroup = null

  for (const raw of rawItems) {
    const str = typeof raw === 'string' ? raw : raw?.name || raw?.keyword || ''
    if (!str) continue

    if (pendingGroup !== null) {
      pendingGroup += `, ${str}`
      const openCount = (pendingGroup.match(/\(/g) || []).length
      const closeCount = (pendingGroup.match(/\)/g) || []).length
      if (closeCount >= openCount) {
        stitchedItems.push(pendingGroup)
        pendingGroup = null
      }
    } else {
      const openCount = (str.match(/\(/g) || []).length
      const closeCount = (str.match(/\)/g) || []).length
      if (openCount > closeCount) {
        pendingGroup = str
      } else {
        stitchedItems.push(str)
      }
    }
  }
  if (pendingGroup !== null) {
    stitchedItems.push(`${pendingGroup})`)
  }

  // Tokenize safely
  const flatTokens = []
  stitchedItems.forEach((str) => {
    if (str.includes(',') && str.includes('(')) {
      flatTokens.push(...tokenizeSkillsSafe(str))
    } else if (str.includes(',') && !str.includes('A/B') && !str.includes('CI/CD')) {
      flatTokens.push(...tokenizeSkillsSafe(str))
    } else if (str) {
      flatTokens.push(str.trim())
    }
  })

  // Normalize and balance individual tokens
  const cleanTokens = flatTokens.map((item) => {
    let s = String(item || '').trim()
    if (!s) return ''
    const openP = (s.match(/\(/g) || []).length
    const closeP = (s.match(/\)/g) || []).length
    if (openP > closeP) s += ')'.repeat(openP - closeP)
    else if (closeP > openP) {
      while (s.startsWith(')')) s = s.slice(1).trim()
      const excess = (s.match(/\)/g) || []).length - (s.match(/\(/g) || []).length
      if (excess > 0) s = s.replace(/\)+$/, '')
    }
    return s.trim()
  }).filter((s) => s.length >= 1)

  const unique = Array.from(new Set(cleanTokens))
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
    'Backend & APIs': [],
    'Cloud & DevOps': [],
    'Databases & Messaging': [],
    'AI & Machine Learning Systems': [],
  }
  unique.forEach((s) => {
    let bucket = determineSkillBucket(s, targetRole)
    if (bucket === 'Backend & Architecture') bucket = 'Backend & APIs'
    if (bucket === 'Databases & Caching') bucket = 'Databases & Messaging'

    if (buckets[bucket]) buckets[bucket].push(s)
    else if (buckets['Backend & APIs']) buckets['Backend & APIs'].push(s)
    else buckets['Databases & Messaging'].push(s)
  })
  return Object.entries(buckets).filter(([_, items]) => items.length > 0)
}

function createHyperlink(text, url, size = 19) {
  if (!url) return new TextRun({ text, font: 'Times New Roman', size, color: '555555' })
  const cleanUrl = url.startsWith('http') || url.startsWith('mailto:') ? url : `https://${url}`
  return new ExternalHyperlink({
    link: cleanUrl,
    children: [
      new TextRun({ text, font: 'Times New Roman', size, color: '555555', underline: {} }),
    ],
  })
}

function createSectionHeading(title, spacingBefore = 160, spacingAfter = 60) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: spacingBefore, after: spacingAfter },
    border: {
      bottom: { color: '1F3A5F', space: 2, style: BorderStyle.SINGLE, size: 4 }, // 0.5pt Navy Blue bottom rule
    },
    children: [
      new TextRun({ text: title.toUpperCase(), bold: true, size: 21, font: 'Times New Roman', color: '000000' }), // 10.5pt Bold
    ],
  })
}

/**
 * Semantic bolding without arbitrary bold cap:
 * Bolds model **bold** marks or non-overlapping tool names and key metrics.
 */
function buildSelectiveBoldRuns(text, candidateSkills = [], bodySize = 20) {
  const rawText = typeof text === 'string' ? text : text?.text || text?.rewrite || String(text || '')
  if (!rawText) return []

  // Case A: Model already supplied **bold** markers (no 2-bold cap)
  if (/\*\*(.*?)\*\*/.test(rawText)) {
    const parts = rawText.split(/\*\*(.*?)\*\*/g)
    const runs = []
    parts.forEach((part, i) => {
      if (!part) return
      const isBold = i % 2 === 1
      runs.push(
        new TextRun({
          text: part,
          bold: isBold,
          size: bodySize,
          font: 'Times New Roman',
          color: isBold ? '000000' : '222222',
        })
      )
    })
    return runs
  }

  // Case B: Dynamic selection (no arbitrary cap, non-overlapping matches)
  const targets = []
  const sortedSkills = [...candidateSkills].sort((a, b) => b.length - a.length)

  for (const skill of sortedSkills) {
    if (skill.length < 2) continue
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    let match
    while ((match = regex.exec(rawText)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (!targets.some((t) => (start >= t.start && start < t.end) || (end > t.start && end <= t.end))) {
        targets.push({ start, end, text: match[0] })
      }
    }
  }

  const METRIC_REGEX = /\$\s?\d[\d,.]*\s?[KMBkmb]?(?![A-Za-z])\+?|\b\d[\d,.]*\s?(?:%|[KMBkmb](?![A-Za-z])\+?|x(?![A-Za-z])|\+)/g
  const allMetrics = [...rawText.matchAll(METRIC_REGEX)]
  for (const picked of allMetrics) {
    const start = picked.index
    const end = start + picked[0].length
    if (!targets.some((t) => (start >= t.start && start < t.end) || (end > t.start && end <= t.end))) {
      targets.push({ start, end, text: picked[0] })
    }
  }

  targets.sort((a, b) => a.start - b.start)

  const runs = []
  let lastIdx = 0
  targets.forEach((tgt) => {
    if (tgt.start > lastIdx) {
      runs.push(
        new TextRun({
          text: rawText.slice(lastIdx, tgt.start),
          bold: false,
          size: bodySize,
          font: 'Times New Roman',
          color: '222222',
        })
      )
    }
    runs.push(
      new TextRun({
        text: rawText.slice(tgt.start, tgt.end),
        bold: true,
        size: bodySize,
        font: 'Times New Roman',
        color: '000000',
      })
    )
    lastIdx = tgt.end
  })
  if (lastIdx < rawText.length) {
    runs.push(
      new TextRun({
        text: rawText.slice(lastIdx),
        bold: false,
        size: bodySize,
        font: 'Times New Roman',
        color: '222222',
      })
    )
  }
  return runs
}

function buildDocxModel(sanitizedResume = {}, config = {}) {
  const margin = config.tightMargin ? PAGE_CONFIG.marginTight : PAGE_CONFIG.marginNormal
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

  // Format: TARGET ROLE — KEY SKILL 1 / KEY SKILL 2 / KEY SKILL 3
  const topSkillsSub = allAtomicSkills.slice(0, 3).join(' / ')
  let subtitle = ''
  if (targetRole && topSkillsSub) {
    subtitle = `${targetRole.toUpperCase()} — ${topSkillsSub}`
  } else if (targetRole) {
    subtitle = targetRole.toUpperCase()
  } else if (topSkillsSub) {
    subtitle = topSkillsSub
  }

  const children = []

  // 1. Header (Alekya Gold Standard Typography & Geometry)
  if (candidateName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 25 }, // 1.25pt after
        children: [
          new TextRun({ text: candidateName.toUpperCase(), bold: true, size: 40, font: 'Times New Roman', color: '000000' }), // 20pt Bold Pure Black
        ],
      })
    )
  }

  if (subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 55 }, // 2.75pt after
        children: [
          new TextRun({ text: subtitle, bold: false, size: 22, color: '222222', font: 'Times New Roman' }), // 11pt Charcoal
        ],
      })
    )
  }

  // Contact line (pipe-separated "  |  " with hyperlinks)
  const contactRuns = []
  const separator = () => new TextRun({ text: '  |  ', size: 19, font: 'Times New Roman', color: '555555' })

  if (contact.location) {
    contactRuns.push(new TextRun({ text: contact.location, size: 19, font: 'Times New Roman', color: '555555' }))
  }
  if (contact.phone) {
    if (contactRuns.length > 0) contactRuns.push(separator())
    contactRuns.push(new TextRun({ text: contact.phone, size: 19, font: 'Times New Roman', color: '555555' }))
  }
  if (contact.email) {
    if (contactRuns.length > 0) contactRuns.push(separator())
    contactRuns.push(createHyperlink(contact.email, `mailto:${contact.email}`, 19))
  }
  if (contact.linkedin) {
    if (contactRuns.length > 0) contactRuns.push(separator())
    contactRuns.push(createHyperlink('LinkedIn', contact.linkedin, 19))
  }
  if (contact.github) {
    if (contactRuns.length > 0) contactRuns.push(separator())
    contactRuns.push(createHyperlink('GitHub', contact.github, 19))
  }

  if (contactRuns.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: config.tightSpacing ? 70 : 90 }, // 4.5pt after
        children: contactRuns,
      })
    )
  }

  // 2. PROFESSIONAL SUMMARY
  if (summary && summary.trim()) {
    let cleanSummary = summary.trim()
    if (config.shortenSummary) {
      const sentences = cleanSummary.split(/(?<=[.?!])\s+/)
      cleanSummary = sentences.slice(0, 3).join(' ')
    }
    children.push(createSectionHeading('Professional Summary', config.tightSpacing ? 120 : 160, 60))
    children.push(
      new Paragraph({
        spacing: { before: 0, after: config.tightSpacing ? 50 : 70 },
        children: [
          new TextRun({ text: cleanSummary, size: bodySize, font: 'Times New Roman', color: '222222' }),
        ],
      })
    )
  }

  // 3. WORK EXPERIENCE (Strict Alekya 2-Line Format)
  if (experiences.length > 0) {
    children.push(createSectionHeading('Work Experience', config.tightSpacing ? 120 : 160, 60))

    experiences.forEach((exp) => {
      const role = exp.role || exp.title || ''
      const duration = exp.duration || ''
      const line1Runs = [
        new TextRun({ text: role, bold: true, size: 22, font: 'Times New Roman', color: '000000' }), // 11pt Bold #000000
      ]
      if (duration) {
        line1Runs.push(
          new TextRun({ text: `\t${duration}`, italics: true, size: 19, font: 'Times New Roman', color: '555555' }) // 9.5pt Italic #555555
        )
      }

      // Line 1: Job Title \t Date Range
      children.push(
        new Paragraph({
          spacing: { before: config.tightSpacing ? 80 : 120, after: 15 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POS }],
          children: line1Runs,
        })
      )

      // Line 2: Company Name | City, State/Country (Work Mode)
      const companyMeta = [exp.company, exp.location].filter(Boolean).join(' | ')
      if (companyMeta) {
        children.push(
          new Paragraph({
            spacing: { before: 0, after: 55 },
            children: [
              new TextRun({ text: companyMeta, bold: true, italics: true, size: 20, font: 'Times New Roman', color: '222222' }), // 10pt Bold+Italic #222222
            ],
          })
        )
      }

      ;(exp.bullets || []).forEach((b) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 0, after: config.tightSpacing ? 30 : 45 },
            indent: { left: 288, hanging: 216 },
            children: buildSelectiveBoldRuns(b, allAtomicSkills, bodySize),
          })
        )
      })
    })
  }

  // 4. PROJECTS
  if (projects.length > 0) {
    children.push(createSectionHeading('Projects', config.tightSpacing ? 120 : 160, 60))

    projects.forEach((proj) => {
      const headerRuns = [
        new TextRun({ text: proj.title || 'Project', bold: true, size: 20, font: 'Times New Roman', color: '000000' }), // 10pt Bold #000000
      ]
      if (proj.techStack) {
        headerRuns.push(
          new TextRun({ text: `  |  ${proj.techStack}`, bold: false, size: 20, font: 'Times New Roman', color: '555555' }) // 10pt Regular #555555
        )
      }
      if (proj.link) {
        headerRuns.push(new TextRun({ text: '  ', font: 'Times New Roman', size: 19 }))
        headerRuns.push(createHyperlink('Demo / Code', proj.link, 19))
      }
      const rightMeta = [proj.label, proj.dates].filter(Boolean).join(' | ')
      if (rightMeta) {
        headerRuns.push(
          new TextRun({ text: `\t${rightMeta}`, italics: true, size: 19, font: 'Times New Roman', color: '555555' })
        )
      }

      children.push(
        new Paragraph({
          spacing: { before: config.tightSpacing ? 50 : 80, after: 25 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POS }],
          children: headerRuns,
        })
      )

      ;(proj.bullets || []).forEach((pb) => {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 0, after: config.tightSpacing ? 30 : 45 },
            indent: { left: 288, hanging: 216 },
            children: buildSelectiveBoldRuns(pb, allAtomicSkills, bodySize),
          })
        )
      })
    })
  }

  // 5. TECHNICAL SKILLS
  if (skillGroups.length > 0) {
    children.push(createSectionHeading('Technical Skills', config.tightSpacing ? 120 : 160, 60))
    skillGroups.forEach(([cat, list]) => {
      const cleanList = list.map((item) => {
        let s = typeof item === 'string' ? item.trim() : (item?.name || item?.keyword || '').trim()
        if (!s) return ''
        const openP = (s.match(/\(/g) || []).length
        const closeP = (s.match(/\)/g) || []).length
        if (openP > closeP) {
          s += ')'.repeat(openP - closeP)
        } else if (closeP > openP) {
          while (s.startsWith(')')) s = s.slice(1).trim()
          const excess = (s.match(/\)/g) || []).length - (s.match(/\(/g) || []).length
          if (excess > 0) {
            s = s.replace(/\)+$/, '')
          }
        }
        return s.trim()
      }).filter(Boolean)

      const seen = new Set()
      const dedupList = []
      for (const item of cleanList) {
        const low = item.toLowerCase()
        if (!seen.has(low)) {
          seen.add(low)
          dedupList.push(item)
        }
      }

      let dedup = dedupList.join(', ')

      // Ensure all brackets close within the same paragraph
      let balance = 0
      let repaired = ''
      for (const char of dedup) {
        if (char === '(') {
          balance++
          repaired += char
        } else if (char === ')') {
          if (balance > 0) {
            balance--
            repaired += char
          }
        } else {
          repaired += char
        }
      }
      if (balance > 0) {
        repaired += ')'.repeat(balance)
      }
      dedup = repaired

      children.push(
        new Paragraph({
          spacing: { before: 0, after: 25 },
          children: [
            new TextRun({ text: `${cat}: `, bold: true, size: bodySize, font: 'Times New Roman', color: '222222' }),
            new TextRun({ text: dedup, size: bodySize, font: 'Times New Roman', color: '222222' }),
          ],
        })
      )
    })
  }

  // 6. EDUCATION (Strict 2-Line Format)
  if (education.length > 0) {
    children.push(createSectionHeading('Education', config.tightSpacing ? 120 : 160, 60))

    education.forEach((rawEdu) => {
      const edu = normalizeEducationItem(rawEdu)
      if (!edu.school && !edu.degree) return

      // Line 1: [College / University Name] (Bold) \t [Start Month Year – End Month Year] (Bold)
      const line1Runs = [
        new TextRun({ text: edu.school, bold: true, size: 21, font: 'Times New Roman', color: '000000' }), // 10.5pt Bold #000000
      ]
      if (edu.dates) {
        line1Runs.push(
          new TextRun({ text: `\t${edu.dates}`, bold: true, size: 21, font: 'Times New Roman', color: '000000' }) // 10.5pt Bold #000000
        )
      }

      children.push(
        new Paragraph({
          spacing: { before: 0, after: 12 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POS }],
          children: line1Runs,
        })
      )

      // Line 2: [Degree, Major] (Italic) \t [City, State/Country] (Italic)
      const line2Runs = [
        new TextRun({ text: edu.degree, italics: true, size: 21, font: 'Times New Roman', color: '444444' }), // 10.5pt Italic #444444
      ]
      if (edu.location) {
        line2Runs.push(
          new TextRun({ text: `\t${edu.location}`, italics: true, size: 21, font: 'Times New Roman', color: '444444' }) // 10.5pt Italic #444444
        )
      }

      children.push(
        new Paragraph({
          spacing: { before: 0, after: config.tightSpacing ? 45 : 65 },
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_POS }],
          children: line2Runs,
        })
      )
    })
  }

  // 7. CERTIFICATIONS (MANDATORY Separate Section at end — Never merged into Education)
  if (certifications.length > 0) {
    children.push(createSectionHeading('Certifications', config.tightSpacing ? 120 : 160, 60))
    certifications.forEach((cert) => {
      const certText = typeof cert === 'string' ? cert : cert?.name || cert?.title || ''
      if (!certText) return
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 0, after: config.tightSpacing ? 30 : 45 },
          indent: { left: 288, hanging: 216 },
          children: [
            new TextRun({ text: certText, size: bodySize, font: 'Times New Roman', color: '222222' }), // 10pt Charcoal
          ],
        })
      )
    })
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: bodySize, color: '222222' },
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
