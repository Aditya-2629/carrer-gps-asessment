import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx'

/**
 * Cleans string and decodes HTML entities
 */
function cleanText(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .replace(/&(?:amp|Amp);?/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\[ADD:[^\]]*\]/gi, '') // Strip unresolved placeholders
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Builds a Harvard-ATS compliant single-column resume .docx buffer
 */
export async function generateAtsResumeDocx({
  candidateName = 'Candidate Name',
  targetRole = 'Data & Business Analyst',
  contact = {},
  summaryText = '',
  experiences = [],
  projects = [],
  skills = [],
  education = [],
  certifications = [],
}) {
  const children = []

  // 1. Header: Candidate Name & Target Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: cleanText(candidateName).toUpperCase(),
          bold: true,
          size: 32, // 16pt
          font: 'Calibri',
          color: '1E293B',
        }),
      ],
    })
  )

  // 2. Contact Line (Phone | Email | Location | LinkedIn | GitHub)
  const contactParts = [
    cleanText(contact.phone),
    cleanText(contact.email),
    cleanText(contact.location),
    cleanText(contact.linkedin || contact.linkedinUrl),
    cleanText(contact.github),
  ].filter(Boolean)

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            size: 19, // 9.5pt
            font: 'Calibri',
            color: '475569',
          }),
        ],
      })
    )
  }

  // Section Heading Helper
  const createSectionHeader = (title) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 80 },
      border: {
        bottom: { color: '94A3B8', space: 2, value: BorderStyle.SINGLE, size: 6 },
      },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 22, // 11pt
          font: 'Calibri',
          color: '0F172A',
        }),
      ],
    })

  // 3. Professional Summary
  if (summaryText && summaryText.trim()) {
    children.push(createSectionHeader('Professional Summary'))
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: cleanText(summaryText),
            size: 21, // 10.5pt
            font: 'Calibri',
            color: '334155',
          }),
        ],
      })
    )
  }

  // 4. Core Technical Skills
  const cleanSkills = Array.isArray(skills)
    ? skills.map(cleanText).filter(Boolean)
    : []
  if (cleanSkills.length > 0) {
    children.push(createSectionHeader('Technical Skills & Core Competencies'))
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: cleanSkills.join('  •  '),
            size: 21,
            font: 'Calibri',
            color: '334155',
          }),
        ],
      })
    )
  }

  // 5. Professional Work Experience (with Rewritten High-Impact Bullets)
  if (Array.isArray(experiences) && experiences.length > 0) {
    children.push(createSectionHeader('Professional Experience'))

    for (const exp of experiences) {
      const roleTitle = cleanText(exp.role || exp.title || exp.position || 'Professional')
      const companyName = cleanText(exp.company || exp.companyName || 'Enterprise')
      const dateRange = cleanText(exp.dates || exp.duration || `${exp.startDate || ''} – ${exp.endDate || ''}`)
      const location = cleanText(exp.location || '')

      children.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({ text: roleTitle, bold: true, size: 21, font: 'Calibri', color: '0F172A' }),
            new TextRun({ text: ` — ${companyName}`, bold: true, size: 21, font: 'Calibri', color: '2563EB' }),
            new TextRun({
              text: `\t${[dateRange, location].filter(Boolean).join(' | ')}`,
              size: 19,
              font: 'Calibri',
              color: '64748B',
            }),
          ],
        })
      )

      const rawBullets = Array.isArray(exp.bullets) ? exp.bullets : []
      for (const b of rawBullets) {
        const bulletText = typeof b === 'string' ? b : (b.rewrite || b.rewrittenText || b.text || '')
        const cleaned = cleanText(bulletText)
        if (!cleaned) continue

        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: cleaned,
                size: 20, // 10pt
                font: 'Calibri',
                color: '334155',
              }),
            ],
          })
        )
      }
    }
  }

  // 6. Technical & Portfolio Projects
  if (Array.isArray(projects) && projects.length > 0) {
    children.push(createSectionHeader('Selected Technical Projects'))

    for (const p of projects) {
      const pTitle = cleanText(p.title || p.name || 'Core Project')
      const pTech = cleanText(Array.isArray(p.technologies) ? p.technologies.join(', ') : p.techStack || '')

      children.push(
        new Paragraph({
          spacing: { before: 80, after: 30 },
          children: [
            new TextRun({ text: pTitle, bold: true, size: 21, font: 'Calibri', color: '0F172A' }),
            pTech ? new TextRun({ text: ` (${pTech})`, size: 19, font: 'Calibri', color: '64748B' }) : new TextRun(''),
          ],
        })
      )

      const pBullets = Array.isArray(p.bullets) ? p.bullets : [p.description || p.reason].filter(Boolean)
      for (const b of pBullets) {
        const bText = typeof b === 'string' ? b : (b.rewrite || b.text || '')
        const cleaned = cleanText(bText)
        if (!cleaned) continue

        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 30 },
            children: [
              new TextRun({ text: cleaned, size: 20, font: 'Calibri', color: '334155' }),
            ],
          })
        )
      }
    }
  }

  // 7. Education
  if (Array.isArray(education) && education.length > 0) {
    children.push(createSectionHeader('Education'))
    for (const edu of education) {
      const school = cleanText(edu.school || edu.institution || edu.schoolName || '')
      const degree = cleanText(edu.degree || edu.degreeName || '')
      const dates = cleanText(edu.dates || edu.year || '')

      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: degree ? `${degree}, ` : '', bold: true, size: 20, font: 'Calibri', color: '0F172A' }),
            new TextRun({ text: school, size: 20, font: 'Calibri', color: '334155' }),
            dates ? new TextRun({ text: `\t${dates}`, size: 19, font: 'Calibri', color: '64748B' }) : new TextRun(''),
          ],
        })
      )
    }
  }

  // 8. Certifications
  if (Array.isArray(certifications) && certifications.length > 0) {
    children.push(createSectionHeader('Certifications & Credentials'))
    const certList = certifications
      .map((c) => cleanText(typeof c === 'string' ? c : `${c.name || c.title || ''}${c.issuer ? ` (${c.issuer})` : ''}`))
      .filter(Boolean)

    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: certList.join('   |   '), size: 20, font: 'Calibri', color: '334155' }),
        ],
      })
    )
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }, // 0.5 in margins
          },
        },
        children,
      },
    ],
  })

  return await Packer.toBuffer(doc)
}
