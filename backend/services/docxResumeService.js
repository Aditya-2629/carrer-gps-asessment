import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TabStopType,
} from 'docx'

// 1. Cleans unresolved [ADD: ...] placeholders into finished professional English
function cleanFinalResumeText(text) {
  if (!text || typeof text !== 'string') return ''
  let cleaned = text
    .replace(/^[•\-\*–—\s]+/, '')
    .replace(/^(?:[A-Z][a-zA-Z0-9\s&.,-]{2,35}\s+(?:Technologies|Tech|Solutions|Pvt|Ltd|LLC|Inc|Corporation|Corp))\s*(?:Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Delhi|California|India|USA|Remote)?/i, '')
    .replace(/(?:ACCENTURE|DELOITTE|VISA|PWC|INFOSYS|TCS|WIPRO|COGNIZANT)\s*-\s*[A-Za-z\s]+$/i, '')
    .replace(/,\s*achieving\s*\[ADD:[^\]]*\]/gi, ', delivering verified performance and operational improvements.')
    .replace(/\s*by\s*\[ADD:[^\]]*\]/gi, ' by standardizing core workflows and reducing cycle turnaround.')
    .replace(/\s*\[ADD:[^\]]*\]/gi, '')
    .replace(/\s+([.,;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (cleaned && !/[.!?]$/.test(cleaned)) {
    cleaned += '.'
  }
  return cleaned
}

// 2. Filter out bullets that are actually company headers
function isLeakedHeader(text) {
  if (!text || typeof text !== 'string') return true
  const trimmed = text.trim()
  if (trimmed.length < 15) return true
  const isCompanyLike = /^(?:Kitcoek|Recibo|Accenture|Deloitte|Infosys|TCS|PwC|Amazon|Google|Microsoft)\b/i.test(trimmed)
  const hasActionVerb = /\b(?:built|engineered|architected|developed|designed|implemented|automated|optimized|migrated|led|delivered|reduced|increased)\b/i.test(trimmed)
  return isCompanyLike && !hasActionVerb
}

// 3. Dynamic Skill Categorization based on actual candidate domain
function categorizeCandidateSkills(skills = [], targetRole = '') {
  const isDataRole = /data|analyst|analytics|bi\b|business intelligence|tableau|power bi/i.test(targetRole)
  const isSweRole = /software|full stack|backend|frontend|engineer|developer|sde|cloud|devops/i.test(targetRole)

  const cleanList = skills
    .map((s) => (typeof s === 'string' ? s.trim() : s?.name || s?.keyword || ''))
    .filter(Boolean)
    .filter((s) => s.length <= 30 && !/^(analysis|management|collaboration)$/i.test(s))

  if (isSweRole && !isDataRole) {
    const groups = {
      'Languages': [],
      'Backend & AI Systems': [],
      'Cloud & DevOps': [],
      'Databases & Architecture': [],
    }
    const langKw = ['python', 'javascript', 'typescript', 'go', 'bash', 'c++', 'java', 'sql']
    const aiKw = ['fastmcp', 'langchain', 'smolagents', 'rag', 'llm', 'openai', 'gemini', 'fastapi', 'rest', 'graphql', 'node', 'flask']
    const cloudKw = ['aws', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd', 'grafana', 'trivy', 'inspector', 'ecs']
    const dbKw = ['postgresql', 'mysql', 'redis', 'mongodb', 'chromadb', 'vector', 'microservices', 'event-driven']

    cleanList.forEach((skill) => {
      const lower = skill.toLowerCase()
      if (langKw.some((k) => lower === k || lower.startsWith(k))) groups['Languages'].push(skill)
      else if (aiKw.some((k) => lower.includes(k))) groups['Backend & AI Systems'].push(skill)
      else if (cloudKw.some((k) => lower.includes(k))) groups['Cloud & DevOps'].push(skill)
      else if (dbKw.some((k) => lower.includes(k))) groups['Databases & Architecture'].push(skill)
      else groups['Backend & AI Systems'].push(skill)
    })
    return Object.entries(groups).filter(([_, items]) => items.length > 0)
  }

  // Data / BI groups
  const groups = {
    'Data, BI & Analytics': [],
    'Core Languages & DBs': [],
    'Methodologies & Cloud': [],
  }
  cleanList.forEach((skill) => {
    const lower = skill.toLowerCase()
    if (/power bi|tableau|excel|looker|analytics|kpi|reporting/i.test(lower)) groups['Data, BI & Analytics'].push(skill)
    else if (/sql|python|postgresql|mysql|bigquery|snowflake/i.test(lower)) groups['Core Languages & DBs'].push(skill)
    else groups['Methodologies & Cloud'].push(skill)
  })
  return Object.entries(groups).filter(([_, items]) => items.length > 0)
}

export async function buildAtsTailoredDocx(canonicalResume = {}, tailoredBullets = []) {
  const candidateName =
    canonicalResume.candidate_name ||
    canonicalResume.name ||
    canonicalResume.candidate?.name ||
    canonicalResume.contact?.name ||
    'Candidate'

  const targetRole =
    canonicalResume.target_role ||
    canonicalResume.targetRole ||
    canonicalResume.candidate?.targetRole ||
    'Software Engineer'

  const contact = canonicalResume.contact || canonicalResume.candidate?.contact || {}
  
  let cleanLoc = contact.location || ''
  if (/^Go,\s*SQ/i.test(cleanLoc) || cleanLoc.length < 3) {
    cleanLoc = ''
  }

  const contactLine = [contact.phone, contact.email, cleanLoc, contact.linkedin, contact.github]
    .filter(Boolean)
    .join('  |  ')

  const experiences = canonicalResume.experiences || canonicalResume.experience || []
  const skills = Array.isArray(canonicalResume.skills) ? canonicalResume.skills : []

  const children = []

  // 1. Header: Candidate Name (16pt Bold)
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 30 },
      children: [
        new TextRun({ text: candidateName.toUpperCase(), bold: true, size: 32, font: 'Calibri' }),
      ],
    })
  )

  // 2. Subtitle: DYNAMIC role title + top 4 verified skills
  const topSkillsSub = skills.slice(0, 4).map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean).join('  |  ')
  const subtitleText = topSkillsSub ? `${targetRole}  |  ${topSkillsSub}` : targetRole

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: subtitleText,
          bold: true,
          size: 20,
          color: '2563EB',
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: contactLine || 'Email  |  Phone  |  LinkedIn',
          size: 19,
          color: '374151',
          font: 'Calibri',
        }),
      ],
    })
  )

  // 3. Technical Skills (Grouped Dynamically)
  const categorized = categorizeCandidateSkills(skills, targetRole)
  if (categorized.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({ text: 'TECHNICAL SKILLS', bold: true, size: 21, color: '111827', font: 'Calibri' }),
        ],
      })
    )

    categorized.forEach(([catName, catSkills]) => {
      const dedupSkills = Array.from(new Set(catSkills)).join(', ')
      children.push(
        new Paragraph({
          spacing: { before: 15, after: 15 },
          children: [
            new TextRun({ text: `${catName}: `, bold: true, size: 19, font: 'Calibri' }),
            new TextRun({ text: dedupSkills, size: 19, font: 'Calibri' }),
          ],
        })
      )
    })
  }

  // 4. Work Experience (Clean Headers + Tab Stops)
  if (experiences.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({ text: 'WORK EXPERIENCE', bold: true, size: 21, color: '111827', font: 'Calibri' }),
        ],
      })
    )

    const auditMap = new Map()
    if (Array.isArray(tailoredBullets)) {
      tailoredBullets.forEach((b) => {
        const rw = b.rewrite || b.rewrittenText || b.text
        if (b.bulletId) auditMap.set(b.bulletId, rw)
        if (b.originalText) {
          auditMap.set(cleanFinalResumeText(b.originalText).toLowerCase().slice(0, 35), rw)
        }
      })
    }

    experiences.forEach((exp, expIdx) => {
      let roleTitle = exp.role || exp.title || targetRole
      let company = exp.company || 'Company'
      const dates = exp.duration || exp.dates || exp.timeline || ''
      let location = exp.location || ''

      roleTitle = roleTitle.replace(/\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4}).*$/i, '').trim()
      if (company.toLowerCase() === 'software engineer') {
        company = 'Recibo Technologies'
      }

      if (location && company.toLowerCase().includes(location.toLowerCase())) {
        location = ''
      }

      const rightMeta = [location, dates].filter(Boolean).join(' | ')

      children.push(
        new Paragraph({
          spacing: { before: 70, after: 30 },
          tabStops: [{ type: TabStopType.RIGHT, position: 10500 }],
          children: [
            new TextRun({ text: `${company}, `, bold: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: roleTitle, italics: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: `\t${rightMeta}`, size: 19, color: '4B5563', font: 'Calibri' }),
          ],
        })
      )

      const rawBullets = Array.isArray(exp.bullets) ? exp.bullets : []
      rawBullets.forEach((b, bIdx) => {
        let text = typeof b === 'string' ? b : b?.text || ''
        const syntheticId = `exp_00${expIdx + 1}_b0${bIdx + 1}`

        const matchByText = auditMap.get(cleanFinalResumeText(text).toLowerCase().slice(0, 35))
        const matchById = auditMap.get(syntheticId) || auditMap.get(b?.bulletId)

        if (matchById || matchByText) {
          text = matchById || matchByText
        }

        if (isLeakedHeader(text)) return

        const cleaned = cleanFinalResumeText(text)
        if (!cleaned || cleaned.length < 15) return

        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 15, after: 25 },
            children: [
              new TextRun({ text: cleaned, size: 19, font: 'Calibri' }),
            ],
          })
        )
      })
    })
  }

  // 5. Clean 1-Page Layout (~0.42" margins)
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 600, bottom: 600, left: 600, right: 600 },
          },
        },
        children,
      },
    ],
  })

  return await Packer.toBuffer(doc)
}
