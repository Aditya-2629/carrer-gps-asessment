import nodemailer from 'nodemailer'

const DEFAULT_RESEND_FROM = 'Crafture Career GPS <reports@mail.crafture.space>'
const DEFAULT_RESEND_REPLY_TO = 'adityacrafture@gmail.com'

/**
 * Send a transactional email via Resend REST API with HTML + plain-text fallback.
 * Returns { ok: true, emailId } or { ok: false, error } without ever faking success.
 */
export async function sendResendEmail({
  to,
  subject,
  html,
  text,
  attachments = [],
  from,
  replyTo,
} = {}) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not configured.' }
  }
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean)
  if (recipients.length === 0) {
    return { ok: false, error: 'Recipient email address is required.' }
  }

  const normalizedAttachments = (Array.isArray(attachments) ? attachments : [])
    .filter((a) => a && a.filename && a.content)
    .map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : String(a.content),
    }))

  const payload = {
    from: (from || process.env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM).trim(),
    reply_to: (replyTo || process.env.RESEND_REPLY_TO || DEFAULT_RESEND_REPLY_TO).trim(),
    to: recipients,
    subject: String(subject || 'Crafture Career GPS'),
    html: String(html || ''),
    text: String(text || ''),
  }
  if (normalizedAttachments.length > 0) {
    payload.attachments = normalizedAttachments
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = data?.message || data?.error?.message || `Resend HTTP ${res.status}`
      return { ok: false, error: msg }
    }
    return { ok: true, emailId: data?.id || null }
  } catch (err) {
    return { ok: false, error: err.message || 'Resend request failed' }
  }
}

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

import { formatAssessmentAnswer, VALID_FORM_KEYS } from './assessmentFormatting.js'

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

    // Attach candidate's uploaded resume and generated Career GPS PDF if present
    const attachments = []
    if (resumeBuffer) {
      attachments.push({
        filename: resumeName || 'Candidate_Resume.pdf',
        content: resumeBuffer,
      })
    }

    try {
      const { renderCareerReportPdfBuffer } = await import('./renderCareerReportPdf.js')
      const reportBuffer = await renderCareerReportPdfBuffer(aiReport)
      if (reportBuffer) {
        const candidateName = aiReport?.resume_agent?.candidateSnapshot?.name || 'Candidate'
        const safeName = String(candidateName).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
        attachments.push({
          filename: `Career_GPS_Report_${safeName || 'Candidate'}.pdf`,
          content: reportBuffer,
        })
      }
    } catch (_pdfErr) {
      // PDF attachment is optional; don't block email delivery
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
          <p style="font-size:12px; color:#9ca3af;">Candidate assessment data and uploaded resume (if provided) are attached.</p>
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
