/**
 * Standardized Zero-Whitespace Executive Career GPS Report PDF Generator
 * Built with PDFKit (lightweight pure Node vector engine, <15MB RAM).
 */

import PDFDocument from 'pdfkit'

// Helper to format answers cleanly without [object Object]
export function formatAssessmentAnswer(key, val, semanticProfile = null) {
  if (val === null || val === undefined) return 'Not Provided'

  // If semanticProfile provides normalized strings
  if (semanticProfile && semanticProfile[key]?.displayValue) {
    return String(semanticProfile[key].displayValue)
  }

  // Handle quantitative structured objects: { raw, period, per_week, per_month, formatted }
  if (typeof val === 'object' && !Array.isArray(val)) {
    if (val.formatted) return String(val.formatted)
    if (val.raw !== undefined && val.period) {
      const pw = val.per_week ?? val.perWeek
      const pm = val.per_month ?? val.perMonth
      return `${val.raw} per ${val.period}${pw !== undefined ? ` (~${pw}/wk, ~${pm}/mo)` : ''}`
    }
    // Return empty for internal blobs
    if (key === 'linkedinData' || key === 'resume' || key === 'precomputedResumeJson') {
      return null
    }
    return JSON.stringify(val)
  }

  if (Array.isArray(val)) {
    return val.filter(Boolean).join(', ')
  }

  return String(val)
}

function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage()
  }
}

/**
 * Generates a multi-page, print-perfect Career GPS report PDF
 * @param {Object} params
 * @param {Object} params.user
 * @param {Object} params.answers
 * @param {Object} [params.semanticProfile]
 * @param {Object} params.aiReport
 * @returns {Promise<Buffer>}
 */
export async function generateStandardReportPdf({ user = {}, answers = {}, semanticProfile = null, aiReport = {} }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 28, bottom: 28, left: 28, right: 28 },
        bufferPages: true,
        autoFirstPage: true,
      })

      const chunks = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', (err) => reject(err))

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
      const resumeAgent = aiReport.resume_agent || null
      const linkedinAgent = aiReport.linkedin_agent || null
      const candidateName =
        resumeAgent?.candidateSnapshot?.name ||
        answers.fullName ||
        answers.name ||
        user.name ||
        (user.email ? user.email.split('@')[0] : 'Candidate')
      const targetRole =
        resumeAgent?.candidateSnapshot?.targetRole ||
        answers.targetRole ||
        answers.target_role ||
        'Senior Software Engineer'
      const userEmail = user.email || answers.email || 'N/A'
      const reportDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const overallScore = aiReport.career_health_score ?? 65
      const scoreLabel = aiReport.score_label ?? 'Competitive'

      // ==========================================
      // HEADER BANNER (Navy Dark Block #0f172a)
      // ==========================================
      const headerHeight = 78
      doc.rect(28, 28, pageWidth, headerHeight).fill('#0f172a')

      doc.fillColor('#10b981').fontSize(14).font('Helvetica-Bold').text('CRAFTURE CAREER GPS', 40, 38, { continued: true })
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('  |  EXECUTIVE INTELLIGENCE REPORT', { baseline: 'middle' })

      doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold').text(candidateName, 40, 56, { continued: true })
      doc.fillColor('#cbd5e1').fontSize(9).font('Helvetica').text(`  •  Target: ${targetRole}  •  ${reportDate}`)

      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(`Email: ${userEmail}  |  Status: Verified Report`, 40, 74)

      // Score strip in header
      const scoreBoxX = pageWidth - 145 + 28
      doc.rect(scoreBoxX, 36, 135, 62).fill('#1e293b')
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica-Bold').text('HEALTH SCORE', scoreBoxX + 8, 42)
      doc.fillColor('#10b981').fontSize(20).font('Helvetica-Bold').text(`${overallScore}/100`, scoreBoxX + 8, 52)
      doc.fillColor('#f8fafc').fontSize(8).font('Helvetica').text(scoreLabel, scoreBoxX + 8, 76)

      doc.y = 118

      // ==========================================
      // SECTION 1: 4-DIMENSION SNAPSHOT & BOTTLENECK
      // ==========================================
      ensureSpace(doc, 90)
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('1. 4-DIMENSION HEALTH SNAPSHOT')
      doc.moveDown(0.3)

      const cardW = (pageWidth - 18) / 4
      const dimensions = [
        { title: 'Resume Impact', score: resumeAgent?.score ?? aiReport.score_breakdown?.resume?.score ?? 60, grade: resumeAgent?.grade || 'C' },
        { title: 'LinkedIn Presence', score: linkedinAgent?.score ?? aiReport.score_breakdown?.linkedin?.score ?? 55, grade: linkedinAgent?.grade || 'C' },
        { title: 'Outreach Velocity', score: aiReport.score_breakdown?.outreach?.score ?? 50, grade: 'C' },
        { title: 'Interview Readiness', score: aiReport.score_breakdown?.interviews?.score ?? 55, grade: 'C' },
      ]

      const startY = doc.y
      dimensions.forEach((dim, idx) => {
        const x = 28 + idx * (cardW + 6)
        doc.rect(x, startY, cardW, 44).fillAndStroke('#f8fafc', '#e2e8f0')
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text(dim.title.toUpperCase(), x + 8, startY + 6)
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(`${dim.score}`, x + 8, startY + 18, { continued: true })
        doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(`/100 (Grade ${dim.grade})`)
      })

      doc.y = startY + 54

      // Primary Bottleneck Box
      ensureSpace(doc, 60)
      const bottleneckTitle = aiReport.primary_bottleneck?.title || aiReport.critical_issues?.[0]?.title || 'Positioning & ATS Keywords Leak'
      const bottleneckDiag = aiReport.primary_bottleneck?.diagnosis || aiReport.critical_issues?.[0]?.diagnosis || 'Candidate applications are dropping before technical screening.'
      const bottleneckAction = aiReport.primary_bottleneck?.what_to_do || aiReport.critical_issues?.[0]?.action_steps?.[0] || 'Align resume and LinkedIn headline with target role keywords.'

      doc.rect(28, doc.y, pageWidth, 52).fillAndStroke('#fffbeb', '#fde68a')
      const bY = doc.y + 6
      doc.fillColor('#b45309').fontSize(8.5).font('Helvetica-Bold').text(`PRIMARY BOTTLENECK: ${bottleneckTitle.toUpperCase()}`, 38, bY)
      doc.fillColor('#451a03').fontSize(8).font('Helvetica').text(bottleneckDiag, 38, bY + 13, { width: pageWidth - 20 })
      doc.fillColor('#92400e').fontSize(7.5).font('Helvetica-Bold').text(`Immediate Fix: ${bottleneckAction}`, 38, bY + 33, { width: pageWidth - 20 })

      doc.y = bY + 52

      // ==========================================
      // SECTION 2: TOP PRIORITIES & ROADMAP
      // ==========================================
      ensureSpace(doc, 100)
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('2. TOP PRIORITIES & 90-DAY EXECUTION ROADMAP')
      doc.moveDown(0.3)

      const priorities = (aiReport.critical_issues || []).slice(0, 3)
      const pCardW = (pageWidth - 12) / 3
      const pStartY = doc.y

      priorities.forEach((p, idx) => {
        const x = 28 + idx * (pCardW + 6)
        doc.rect(x, pStartY, pCardW, 76).fillAndStroke('#f1f5f9', '#cbd5e1')
        doc.fillColor('#ef4444').fontSize(8).font('Helvetica-Bold').text(`PRIORITY #${idx + 1} (${p.severity || 'HIGH'})`, x + 6, pStartY + 6)
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text((p.title || 'Action Item').slice(0, 38), x + 6, pStartY + 18, { width: pCardW - 12 })
        doc.fillColor('#475569').fontSize(7).font('Helvetica').text((p.diagnosis || '').slice(0, 110), x + 6, pStartY + 32, { width: pCardW - 12 })
        if (p.action_steps?.[0]) {
          doc.fillColor('#0369a1').fontSize(6.5).font('Helvetica-Bold').text(`• ${(p.action_steps[0]).slice(0, 85)}`, x + 6, pStartY + 58, { width: pCardW - 12 })
        }
      })

      doc.y = pStartY + 84

      // 30 / 60 / 90 Roadmap Columns
      const roadmapWeeks = Array.isArray(aiReport.roadmap) ? aiReport.roadmap.slice(0, 3) : []
      if (roadmapWeeks.length > 0) {
        ensureSpace(doc, 75)
        const rStartY = doc.y
        roadmapWeeks.forEach((r, idx) => {
          const x = 28 + idx * (pCardW + 6)
          doc.rect(x, rStartY, pCardW, 68).fillAndStroke('#f8fafc', '#e2e8f0')
          doc.fillColor('#10b981').fontSize(8).font('Helvetica-Bold').text(`PHASE ${idx + 1} (${r.week || `Month ${idx + 1}`})`, x + 6, rStartY + 6)
          doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text((r.theme || r.goal || 'Execution').slice(0, 35), x + 6, rStartY + 18, { width: pCardW - 12 })
          const tasks = (r.tasks || []).slice(0, 2)
          let tY = rStartY + 30
          tasks.forEach((t) => {
            const taskText = typeof t === 'string' ? t : t.action || t.task || ''
            doc.fillColor('#334155').fontSize(6.5).font('Helvetica').text(`- ${taskText.slice(0, 80)}`, x + 6, tY, { width: pCardW - 12 })
            tY += 16
          })
        })
        doc.y = rStartY + 76
      }

      // ==========================================
      // SECTION 3: RESUME AGENT DIAGNOSIS & BULLETS
      // ==========================================
      ensureSpace(doc, 110)
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('3. AI RESUME DEEP DIAGNOSIS & LINE-BY-LINE AUDIT')
      doc.moveDown(0.3)

      if (resumeAgent?.overallReview) {
        doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(resumeAgent.overallReview.slice(0, 320), { width: pageWidth })
        doc.moveDown(0.4)
      }

      // Bullet Audit Rows
      const bulletAudit = resumeAgent?.bulletAudit || []
      const displayBullets = bulletAudit.filter((b) => b.needsRewrite || b.rewrittenText).slice(0, 5)

      if (displayBullets.length > 0) {
        ensureSpace(doc, 30)
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Key Experience Bullet Rewrites (Google XYZ Formula):')
        doc.moveDown(0.2)

        displayBullets.forEach((bullet) => {
          ensureSpace(doc, 48)
          const bStartY = doc.y
          const colW = (pageWidth - 8) / 2

          // Original Box
          doc.rect(28, bStartY, colW, 44).fillAndStroke('#fef2f2', '#fecaca')
          doc.fillColor('#991b1b').fontSize(6.5).font('Helvetica-Bold').text(`ORIGINAL (${bullet.company || 'Role'})`, 34, bStartY + 5)
          doc.fillColor('#7f1d1d').fontSize(6.5).font('Helvetica').text((bullet.originalText || '').slice(0, 130), 34, bStartY + 15, { width: colW - 12 })

          // Rewritten Box
          const rX = 28 + colW + 8
          doc.rect(rX, bStartY, colW, 44).fillAndStroke('#f0fdf4', '#bbf7d0')
          doc.fillColor('#166534').fontSize(6.5).font('Helvetica-Bold').text('RECRUITER STAR/XYZ REWRITE', rX + 6, bStartY + 5)
          doc.fillColor('#14532d').fontSize(6.5).font('Helvetica').text((bullet.rewrittenText || bullet.originalText || '').slice(0, 130), rX + 6, bStartY + 15, { width: colW - 12 })

          doc.y = bStartY + 48
        })
      }

      // ==========================================
      // SECTION 4: LINKEDIN AGENT DISCREPANCIES & OPTIMIZATIONS
      // ==========================================
      ensureSpace(doc, 100)
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('4. LINKEDIN RECRUITER AUDIT & CROSS-CHANNEL DISCREPANCIES')
      doc.moveDown(0.3)

      const discrepancies = (linkedinAgent?.discrepancies || []).slice(0, 4)
      if (discrepancies.length > 0) {
        discrepancies.forEach((d) => {
          ensureSpace(doc, 34)
          const dY = doc.y
          doc.rect(28, dY, pageWidth, 30).fillAndStroke('#f8fafc', '#e2e8f0')
          const isHigh = d.severity === 'high'
          doc.fillColor(isHigh ? '#dc2626' : '#d97706').fontSize(7).font('Helvetica-Bold').text(`[${(d.severity || 'WARN').toUpperCase()}] ${d.title}`, 34, dY + 4)
          doc.fillColor('#334155').fontSize(6.5).font('Helvetica').text(`Resume: ${d.resumeClaim || 'N/A'}  vs  LinkedIn: ${d.linkedinClaim || 'N/A'}`, 34, dY + 13, { width: pageWidth - 14 })
          doc.fillColor('#059669').fontSize(6.5).font('Helvetica-Bold').text(`Fix: ${(d.recommendation || d.fix || '').slice(0, 140)}`, 34, dY + 21, { width: pageWidth - 14 })
          doc.y = dY + 34
        })
      }

      // Headline & About Optimizations
      const headlines = linkedinAgent?.optimizations?.headlines || []
      const aboutRewrite = linkedinAgent?.optimizations?.aboutRewrite || null
      if (headlines.length > 0 || aboutRewrite) {
        ensureSpace(doc, 60)
        doc.moveDown(0.2)
        if (headlines[0]) {
          doc.fillColor('#0369a1').fontSize(7.5).font('Helvetica-Bold').text('Recommended 220-Char LinkedIn Headline:')
          doc.fillColor('#0f172a').fontSize(7).font('Helvetica').text(headlines[0].headline || headlines[0], { width: pageWidth })
          doc.moveDown(0.2)
        }
        if (aboutRewrite?.hook || typeof aboutRewrite === 'string') {
          doc.fillColor('#0369a1').fontSize(7.5).font('Helvetica-Bold').text('LinkedIn About Section Narrative Hook:')
          const hookText = typeof aboutRewrite === 'string' ? aboutRewrite : `${aboutRewrite.hook || ''} ${aboutRewrite.proof || ''}`
          doc.fillColor('#0f172a').fontSize(7).font('Helvetica').text(hookText.slice(0, 240), { width: pageWidth })
        }
      }

      // ==========================================
      // SECTION 5: COMPLETE 31-QUESTION ASSESSMENT ANSWERS
      // ==========================================
      doc.addPage() // Dedicated clean page for full candidate answers
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('5. COMPLETE CANDIDATE ASSESSMENT PROFILE & RAW ANSWERS')
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('Recorded assessment responses used for career health scoring and recruiter bottleneck diagnosis.')
      doc.moveDown(0.4)

      const answerEntries = Object.entries(answers).filter(([key]) => {
        return !['linkedinData', 'resume', 'precomputedResumeJson', 'resumeJson', 'file'].includes(key)
      })

      const halfW = (pageWidth - 8) / 2
      let qY = doc.y

      answerEntries.forEach(([key, val], idx) => {
        ensureSpace(doc, 26)
        qY = doc.y
        const col = idx % 2 === 0 ? 0 : 1
        const x = 28 + col * (halfW + 8)

        const formattedKey = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
        const formattedVal = formatAssessmentAnswer(key, val, semanticProfile) || 'Not Provided'

        doc.rect(x, qY, halfW, 22).fillAndStroke('#f8fafc', '#e2e8f0')
        doc.fillColor('#475569').fontSize(6.5).font('Helvetica-Bold').text(formattedKey.slice(0, 32), x + 6, qY + 4, { width: halfW - 12 })
        doc.fillColor('#0f172a').fontSize(7).font('Helvetica').text(formattedVal.slice(0, 50), x + 6, qY + 12, { width: halfW - 12 })

        if (col === 1 || idx === answerEntries.length - 1) {
          doc.y = qY + 26
        }
      })

      // Final Footer
      doc.y = doc.page.height - 40
      doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('Confidential Career GPS Intelligence Report  •  Generated by Crafture AI  •  https://crafture.com', 28, doc.y, { align: 'center', width: pageWidth })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
