import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

export async function buildAtsTailoredDocx(canonicalResume = {}, tailoredBullets = []) {
  const candidateName =
    canonicalResume.candidate_name ||
    canonicalResume.name ||
    canonicalResume.candidate?.name ||
    'Candidate'
  const targetRole =
    canonicalResume.target_role ||
    canonicalResume.targetRole ||
    canonicalResume.candidate?.targetRole ||
    'Software Engineer'
  const contact = canonicalResume.contact || canonicalResume.candidate?.contact || {}
  const contactLine = [contact.email, contact.phone, contact.location, contact.linkedin, contact.github]
    .filter(Boolean)
    .join('  |  ')

  const summary =
    canonicalResume.summary ||
    canonicalResume.professional_summary ||
    canonicalResume.summaryText ||
    ''
  const experiences = canonicalResume.experiences || canonicalResume.experience || []
  const skills = Array.isArray(canonicalResume.skills)
    ? canonicalResume.skills.map((s) => (typeof s === 'string' ? s : s?.name || s?.keyword || '')).filter(Boolean)
    : []

  const children = []

  // Header: Name (18pt Bold) & Contact (10pt)
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: candidateName.toUpperCase(), bold: true, size: 36, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: contactLine || 'Email | Phone | Location | LinkedIn',
          size: 20,
          color: '4B5563',
          font: 'Calibri',
        }),
      ],
    })
  )

  // Professional Summary
  if (summary) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({ text: 'PROFESSIONAL SUMMARY', bold: true, size: 22, color: '111827', font: 'Calibri' }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: summary, size: 21, font: 'Calibri' })],
      })
    )
  }

  // Work Experience
  if (experiences.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({ text: 'WORK EXPERIENCE', bold: true, size: 22, color: '111827', font: 'Calibri' }),
        ],
      })
    )

    // Build audit lookup map if tailoredBullets / improvedBullets provided
    const auditMap = new Map()
    if (Array.isArray(tailoredBullets) && tailoredBullets.length > 0) {
      for (const b of tailoredBullets) {
        if (b && (b.bulletId || b.id)) {
          auditMap.set(b.bulletId || b.id, b.rewrite || b.text)
        }
      }
    }

    experiences.forEach((exp) => {
      const roleTitle = exp.role || exp.title || targetRole
      const company = exp.company || 'Company'
      const dates = exp.duration || exp.dates || exp.timeline || ''
      const location = exp.location || ''

      children.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: `${roleTitle} `, bold: true, size: 22, font: 'Calibri' }),
            new TextRun({ text: `— ${company}`, italics: true, size: 22, font: 'Calibri' }),
            new TextRun({
              text: dates ? `  (${dates}${location ? ` | ${location}` : ''})` : '',
              size: 20,
              color: '6B7280',
              font: 'Calibri',
            }),
          ],
        })
      )

      const bullets = Array.isArray(exp.bullets) ? exp.bullets : []
      bullets.forEach((b) => {
        let text = typeof b === 'string' ? b : (b?.text || '')
        if (typeof b === 'object' && (b?.id || b?.bulletId)) {
          const improved = auditMap.get(b.id || b.bulletId)
          if (improved) text = improved
        }
        if (!text) return
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [
              new TextRun({ text: text.replace(/^[•\-*]\s*/, ''), size: 21, font: 'Calibri' }),
            ],
          })
        )
      })
    })
  }

  // Technical Skills (Grouped & Cleaned)
  if (skills.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({ text: 'TECHNICAL SKILLS', bold: true, size: 22, color: '111827', font: 'Calibri' }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: skills.join('  •  '), size: 21, font: 'Calibri' }),
        ],
      })
    )
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5-inch margins
        },
      },
      children,
    }],
  })

  return await Packer.toBuffer(doc)
}
