import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TabStopType,
} from 'docx'

function cleanBulletText(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/^[•\-\*–—\s]+/, '')
    .replace(/(?:ACCENTURE|DELOITTE|VISA|PWC|INFOSYS|TCS|WIPRO|COGNIZANT)\s*-\s*[A-Za-z\s]+$/i, '')
    .trim()
}

function categorizeSkills(skills = [], targetRole = '') {
  const groups = {
    'Business Analysis & Delivery': [],
    'Data, BI & Analytics': [],
    'Methodologies & Tools': [],
    'Domain & Technologies': [],
  }

  const dataKeywords = ['sql', 'power bi', 'tableau', 'excel', 'bigquery', 'looker', 'python', 'analytics', 'postgresql']
  const baKeywords = ['requirements', 'user stories', 'brd', 'frd', 'jira', 'confluence', 'sdlc', 'uat', 'agile', 'scrum']
  const toolKeywords = ['git', 'visio', 'lucidchart', 'postman', 'aws', 'azure', 'docker', 'api', 'etl']

  skills.forEach((skill) => {
    const s = typeof skill === 'string' ? skill : skill?.name || skill?.keyword || ''
    if (!s) return
    const lower = s.toLowerCase()

    if (dataKeywords.some((k) => lower.includes(k))) {
      groups['Data, BI & Analytics'].push(s)
    } else if (baKeywords.some((k) => lower.includes(k))) {
      groups['Business Analysis & Delivery'].push(s)
    } else if (toolKeywords.some((k) => lower.includes(k))) {
      groups['Methodologies & Tools'].push(s)
    } else {
      groups['Domain & Technologies'].push(s)
    }
  })

  return Object.entries(groups).filter(([_, items]) => items.length > 0)
}

export async function buildAtsTailoredDocx(canonicalResume = {}, tailoredBullets = []) {
  const candidateName =
    canonicalResume.candidate_name ||
    canonicalResume.name ||
    canonicalResume.candidate?.name ||
    'Candidate'

  const targetRole =
    canonicalResume.target_role ||
    canonicalResume.targetRole ||
    'Business Analyst'

  const contact = canonicalResume.contact || canonicalResume.candidate?.contact || {}
  const contactLine = [contact.phone, contact.email, contact.location, contact.linkedin]
    .filter(Boolean)
    .join(' | ')

  const experiences = canonicalResume.experiences || canonicalResume.experience || []
  const skills = Array.isArray(canonicalResume.skills)
    ? canonicalResume.skills.map((s) => (typeof s === 'string' ? s : s?.name || s?.keyword || '')).filter(Boolean)
    : []

  const children = []

  // 1. Candidate Name (16pt Bold) & Subtitle
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 30 },
      children: [
        new TextRun({ text: candidateName.toUpperCase(), bold: true, size: 32, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text: `${targetRole} | SQL | Power BI | Tableau | Business Analysis`,
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
          text: contactLine || 'Phone | Email | Location | LinkedIn',
          size: 19,
          color: '374151',
          font: 'Calibri',
        }),
      ],
    })
  )

  // 2. Technical Skills (Grouped with Bold Labels)
  const categorized = categorizeSkills(skills, targetRole)
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
      children.push(
        new Paragraph({
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({ text: `${catName}: `, bold: true, size: 19, font: 'Calibri' }),
            new TextRun({ text: catSkills.join(', '), size: 19, font: 'Calibri' }),
          ],
        })
      )
    })
  }

  // 3. Work Experience (Right Tab Stop at 10,500 dxa)
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
        const rewrite = b.rewrite || b.rewrittenText || b.text || b.correctedText
        if (b.bulletId) auditMap.set(b.bulletId, rewrite)
        if (b.id) auditMap.set(b.id, rewrite)
        if (b.originalText) {
          auditMap.set(cleanBulletText(b.originalText).toLowerCase().slice(0, 40), rewrite)
        }
      })
    }

    experiences.forEach((exp, expIdx) => {
      const roleTitle = exp.role || exp.title || targetRole
      const company = exp.company || 'Company'
      const dates = exp.duration || exp.dates || exp.timeline || ''
      const location = exp.location || ''
      const rightMeta = [location, dates].filter(Boolean).join(' | ')

      children.push(
        new Paragraph({
          spacing: { before: 60, after: 30 },
          tabStops: [
            {
              type: TabStopType.RIGHT,
              position: 10500,
            },
          ],
          children: [
            new TextRun({ text: `${company}, `, bold: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: roleTitle, italics: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: `\t${rightMeta}`, size: 19, color: '4B5563', font: 'Calibri' }),
          ],
        })
      )

      const bullets = Array.isArray(exp.bullets) ? exp.bullets : []
      bullets.forEach((b, bIdx) => {
        let text = typeof b === 'string' ? b : b?.text || ''
        const syntheticId = `exp_00${expIdx + 1}_b0${bIdx + 1}`
        
        const matchByText = auditMap.get(cleanBulletText(text).toLowerCase().slice(0, 40))
        const matchById = auditMap.get(syntheticId) || auditMap.get(b?.bulletId) || auditMap.get(b?.id)
        
        if (matchById || matchByText) {
          text = matchById || matchByText
        }

        const cleaned = cleanBulletText(text)
        if (!cleaned) return

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

  // 4. Compact 1-Page Layout (~0.42 inch margins)
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
