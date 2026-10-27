import nodemailer from 'nodemailer'

const getTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  })
}

import { generateStandardReportPdf, formatAssessmentAnswer, VALID_FORM_KEYS } from './reportPdfGenerator.js'

const ADMIN_EMAIL = 'inspiracustomer@gmail.com'

// 1. Send Admin Report Email
export const sendAdminReportEmail = async (userEmail, answers = {}, aiReport = {}, resumeBuffer = null, resumeName = null) => {
  try {
    const transporter = getTransporter()
    if (!transporter) {
      console.warn('[Email] Skipping admin report email: SMTP credentials not configured.')
      return
    }

    // Convert Answers to HTML table format (skipping raw blobs and formatting quantitative objects cleanly)
    let answersHtml = "<table style='width:100%; border-collapse:collapse; margin-bottom:20px; font-family: sans-serif; font-size: 13px;'>"
    answersHtml += "<tr style='background:#10b981; color:white;'><th style='padding:10px; border:1px solid #ddd; text-align:left;'>Question</th><th style='padding:10px; border:1px solid #ddd; text-align:left;'>Answer</th></tr>"
    
    for (const [key, value] of Object.entries(answers)) {
      if (!VALID_FORM_KEYS.has(key) || ['linkedinData', 'resume', 'precomputedResumeJson', 'resumeJson', 'file'].includes(key)) continue
      const displayValue = formatAssessmentAnswer(key, value, aiReport?.semantic_profile)
      if (!displayValue || displayValue === 'per') continue
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      answersHtml += `<tr><td style='padding:8px; border:1px solid #ddd; font-weight: bold; color: #374151;'>${formattedKey}</td><td style='padding:8px; border:1px solid #ddd; color: #1f2937;'>${displayValue}</td></tr>`
    }
    answersHtml += '</table>'

    // AI Report Summary HTML
    const resumeScoreVal = aiReport.resume_agent?.dashboard?.score ?? aiReport.resume_agent?.score ?? aiReport.score_breakdown?.resume?.score ?? 'N/A'
    let reportHtml = `
      <div style="background:#f9fafb; padding:20px; border:1px solid #e5e7eb; border-radius:12px; margin-top:20px; font-family: sans-serif;">
        <h3 style="color:#10b981; margin-top:0; border-bottom: 2px solid #10b981; padding-bottom: 8px;">AI Career GPS Report</h3>
        <p style="font-size: 15px;"><strong>Overall Score:</strong> <span style="color:#10b981; font-weight:bold; font-size:18px;">${aiReport.career_health_score}/100</span> (${aiReport.score_label})</p>
        <table style="width:100%; border-collapse:collapse; margin: 15px 0;">
          <tr>
            <td style="padding: 6px 0; color: #4b5563;"><strong>Resume Score:</strong></td>
            <td style="padding: 6px 0;">${resumeScoreVal}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #4b5563;"><strong>LinkedIn Score:</strong></td>
            <td style="padding: 6px 0;">${aiReport.linkedin_agent?.score ?? aiReport.score_breakdown?.linkedin?.score ?? 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #4b5563;"><strong>Outreach Score:</strong></td>
            <td style="padding: 6px 0;">${aiReport.score_breakdown?.outreach?.score ?? 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #4b5563;"><strong>Interview Score:</strong></td>
            <td style="padding: 6px 0;">${aiReport.score_breakdown?.interviews?.score ?? 'N/A'}</td>
          </tr>
        </table>
        <h4 style="color:#111827; margin-bottom: 8px;">Critical Issues:</h4>
        <ul style="padding-left: 20px; margin-top: 4px; color: #374151;">
          ${(aiReport.critical_issues || []).map(issue => `<li style="margin-bottom: 6px;"><strong>${issue.title}:</strong> ${issue.diagnosis}</li>`).join('') || '<li>No data</li>'}
        </ul>
        <h4 style="color:#111827; margin-bottom: 8px;">Coach Intervention:</h4>
        <p style="color:#b91c1c; font-weight: 500; font-size: 14px; margin-top: 4px;">${aiReport.coach_intervention?.urgency_statement || 'N/A'}</p>
        <p style="color:#374151; font-size: 13px;">${aiReport.coach_intervention?.value_prop || 'N/A'}</p>
      </div>
    `

    // Generate Standardized Career GPS PDF Attachment
    const attachments = []
    try {
      const reportPdfBuffer = await generateStandardReportPdf({
        user: { email: userEmail },
        answers,
        semanticProfile: aiReport?.semantic_profile || null,
        aiReport,
      })
      if (reportPdfBuffer && reportPdfBuffer.length > 0) {
        const candidateName =
          aiReport?.resume_agent?.candidateSnapshot?.name ||
          answers.fullName ||
          answers.name ||
          userEmail.split('@')[0] ||
          'Candidate'
        const safeName = candidateName.replace(/[^a-zA-Z0-9_-]/g, '_')
        attachments.push({
          filename: `Career_GPS_Report_${safeName}.pdf`,
          content: reportPdfBuffer,
          contentType: 'application/pdf',
        })
      }
    } catch (pdfErr) {
      console.warn('[Email] Could not generate report PDF attachment:', pdfErr.message)
    }

    if (resumeBuffer) {
      attachments.push({
        filename: resumeName || 'Candidate_Resume.pdf',
        content: resumeBuffer,
      })
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || `"Career GPS System" <${process.env.SMTP_USER}>`,
      to: ADMIN_EMAIL,
      subject: `🚨 NEW ASSESSMENT: ${userEmail} completed Career GPS`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #ffffff; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #f3f4f6; border-radius: 8px;">
          <h2 style="color: #111827; margin-top: 0;">New Assessment Completed</h2>
          <p style="font-size: 14px;"><strong>User Email:</strong> <a href="mailto:${userEmail}" style="color: #10b981; font-weight: bold; text-decoration: none;">${userEmail}</a></p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <h3 style="color:#111827;">Assessment Answers:</h3>
          ${answersHtml}
          ${reportHtml}
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size:12px; color:#9ca3af;">Both the candidate's uploaded resume and the Executive Career GPS Report PDF are attached.</p>
        </div>
      `,
      attachments,
    }

    await transporter.sendMail(mailOptions)
    console.log(`[Email] Admin notification sent successfully to ${ADMIN_EMAIL} for user ${userEmail}`)
  } catch (error) {
    if (error.responseCode === 535 || error.code === 'EAUTH') {
      console.warn(`[Email] Admin notification skipped: Gmail SMTP authentication failed (535 BadCredentials). Please refresh SMTP_PASS in .env.`)
    } else {
      console.warn(`[Email] Admin report notification skipped (${error.message || error.code || 'unknown error'}).`)
    }
  }
}

// 2. Send Book Call Request Notification
export const sendBookCallNotification = async (userEmail) => {
  try {
    const transporter = getTransporter()
    if (!transporter) {
      console.warn('[Email] Skipping book call notification: SMTP credentials not configured.')
      return
    }
    const mailOptions = {
      from: process.env.SMTP_FROM || `"Career GPS System" <${process.env.SMTP_USER}>`,
      to: ADMIN_EMAIL,
      subject: `📞 BOOK CALL REQUEST: ${userEmail} wants to talk!`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #fffbeb; color: #92400e; border: 1px solid #fef3c7; border-radius: 8px; max-width: 600px; margin: 0 auto;">
          <h2 style="margin-top:0; color:#b45309;">🔥 Hot Lead: Book Call Request</h2>
          <p style="font-size:15px; color:#4b5563;">A user clicked <strong>"Book Strategy Call"</strong> on their AI Career GPS Report page.</p>
          <p style="font-size:16px;"><strong>User Email:</strong> <a href="mailto:${userEmail}" style="color:#b45309; font-weight:bold; text-decoration: underline;">${userEmail}</a></p>
          <p style="font-size:13px; font-weight: bold; margin-top: 15px; color:#b45309;">Contact them immediately to convert this lead!</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`[Email] Book Call notification sent successfully to ${ADMIN_EMAIL} for ${userEmail}`)
  } catch (error) {
    if (error.responseCode === 535 || error.code === 'EAUTH') {
      console.warn(`[Email] Book call notification skipped: Gmail SMTP authentication failed (535 BadCredentials). Please refresh SMTP_PASS in .env.`)
    } else {
      console.warn(`[Email] Book call notification skipped (${error.message || error.code || 'unknown error'}).`)
    }
  }
}
