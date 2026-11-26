import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import { redactReportForTeaser } from './teaserRedactor.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = path.resolve(__dirname, '../assets')
const DEFAULT_RESEND_FROM = 'Crafture Career GPS <reports@mail.crafture.space>'
const DEFAULT_RESEND_OTP_FROM = 'Crafture <otp@mail.crafture.space>'
const DEFAULT_RESEND_REPLY_TO = 'adityacrafture@gmail.com'
const _mascotCache = new Map()
let _logoAttachmentCache = undefined

function getCraftureLogoCidAttachment() {
  if (_logoAttachmentCache !== undefined) return _logoAttachmentCache
  try {
    const logoPath = path.resolve(__dirname, '../../src/assets/images/crafture-logo.jpg')
    const b64 = fs.readFileSync(logoPath).toString('base64')
    _logoAttachmentCache = {
      filename: 'crafture-logo.jpg',
      content: b64,
      content_id: 'crafture-logo',
    }
    return _logoAttachmentCache
  } catch {
    _logoAttachmentCache = null
    return null
  }
}

function getMascotCidAttachment(pose = 'wave') {
  if (_mascotCache.has(pose)) return _mascotCache.get(pose)
  try {
    const filePath = path.join(ASSETS_DIR, `mascot_${pose}.png`)
    const b64 = fs.readFileSync(filePath).toString('base64')
    const att = {
      filename: `mascot_${pose}.png`,
      content: b64,
      content_id: 'crafture-mascot',
      contentType: 'image/png',
    }
    _mascotCache.set(pose, att)
    return att
  } catch {
    return null
  }
}

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
    .map((a) => {
      const out = {
        filename: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : String(a.content),
      }
      if (a.content_id) out.content_id = a.content_id
      return out
    })

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

function extractReportMeta(user, aiReport, settings = {}) {
  const frontendBase = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')
  const reportUrl = `${frontendBase}/report/${user._id}`
  const candidateName =
    user.resumeJson?.candidate?.name ||
    user.resumeJson?.candidate_name ||
    aiReport?.resume_agent?.candidateSnapshot?.name ||
    user.answers?.name ||
    user.email?.split('@')[0] ||
    'Candidate'
  const safeName = String(candidateName).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'Candidate'
  const targetRole =
    user.resumeJson?.target_role ||
    aiReport?.resume_agent?.candidateSnapshot?.targetRole ||
    user.answers?.targetRole ||
    'your target role'
  const rawHealth = aiReport?.career_health_score
  const scoreVal =
    typeof rawHealth === 'object' && rawHealth !== null
      ? Math.round(Number(rawHealth.overall ?? 72))
      : Number.isFinite(Number(rawHealth))
        ? Math.round(Number(rawHealth))
        : 72
  const bottleneckHeadline =
    aiReport?.primary_bottleneck?.headline ||
    aiReport?.primary_bottleneck?.title ||
    'Phase 2 Screening Conversion'
  const bookingUrl =
    settings?.callBookingUrl ||
    'https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe'
  const cleanWa = String(settings?.whatsappCtaNumber || '').replace(/\D/g, '')
  const waMsg = `Hi Crafture team, I'm ${candidateName} targeting ${targetRole} (Career Health Score: ${scoreVal}/100) and would like to unlock my complete Career GPS Report.`
  const whatsappUrl = cleanWa
    ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(waMsg)}`
    : `https://wa.me/?text=${encodeURIComponent(waMsg)}`
  return { frontendBase, reportUrl, candidateName, safeName, targetRole, scoreVal, bottleneckHeadline, bookingUrl, whatsappUrl }
}

function buildForestGreenShell({ badge, title, hasMascot, hasLogo = false, bodyHtml, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F8FAFC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background-color:#15803D;padding:20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle">
                    ${
                      hasLogo
                        ? '<img src="cid:crafture-logo" alt="Crafture Career GPS" width="132" style="display:block;height:auto;border:0;border-radius:6px;margin-bottom:8px;" />'
                        : ''
                    }
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#DCFCE7;">${badge}</div>
                    <h1 style="margin:6px 0 0;font-size:20px;line-height:1.3;font-weight:700;color:#FFFFFF;">${title}</h1>
                  </td>
                  ${
                    hasMascot
                      ? '<td width="56" align="right" valign="middle"><img src="cid:crafture-mascot" width="48" height="48" alt="Crafture Mascot" style="display:block;border:0;border-radius:10px;background-color:#166534;padding:2px;" /></td>'
                      : ''
                  }
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;background-color:#FFFFFF;color:#0F172A;">
              ${bodyHtml}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;border-top:1px solid #E2E8F0;padding-top:14px;">
                <tr>
                  <td style="font-size:12px;line-height:1.5;color:#64748B;">${footerNote}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Send 6-digit OTP email via Resend (`otp@mail.crafture.space`) with Forest Green branding + inline mascot.
 */
export async function sendOtpEmail(email, otp) {
  const cleanEmail = String(email || '').toLowerCase().trim()
  const mascotAtt = getMascotCidAttachment('wave')
  const logoAtt = getCraftureLogoCidAttachment()
  const html = buildForestGreenShell({
    badge: 'CRAFTURE CAREER GPS • VERIFICATION',
    title: 'Your Verification Code',
    hasMascot: Boolean(mascotAtt),
    hasLogo: Boolean(logoAtt),
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0F172A;">Enter the 6-digit code below to verify your email and launch your Career GPS diagnostic:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;">
        <tr>
          <td align="center" style="background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:16px;">
            <span style="font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:800;letter-spacing:6px;color:#14532D;">${otp}</span>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#475569;">This code expires in <strong>10 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
    `,
    footerNote: 'Crafture Career GPS • Secure Authentication',
  })
  const text = `Your Crafture Career GPS verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, please ignore this email.`

  if (process.env.RESEND_API_KEY) {
    return sendResendEmail({
      to: cleanEmail,
      from: (process.env.RESEND_OTP_FROM || DEFAULT_RESEND_OTP_FROM).trim(),
      subject: `${otp} is your Crafture Career GPS verification code`,
      html,
      text,
      attachments: [mascotAtt, logoAtt].filter(Boolean),
    })
  }

  const transporter = getTransporter()
  if (!transporter) {
    return { ok: false, error: 'Email delivery is not configured (RESEND_API_KEY missing).' }
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Crafture" <${process.env.SMTP_USER}>`,
      to: cleanEmail,
      subject: `${otp} is your Crafture Career GPS verification code`,
      html,
      text,
    })
    return { ok: true, emailId: null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * A) Initial Submission Preview Email (when teaserModeEnabled && !reportUnlocked)
 * Attaches ONLY the Teaser-Redacted Preview PDF. NEVER attaches .docx or unredacted PDF.
 */
export async function sendCandidatePreviewEmail({ user, aiReport, settings = {} }) {
  if (!user?.email) return { ok: false, error: 'Missing candidate email' }
  const meta = extractReportMeta(user, aiReport, settings)
  const mascotAtt = getMascotCidAttachment('clipboard')
  const logoAtt = getCraftureLogoCidAttachment()

  let previewPdfBuffer = null
  try {
    const { renderCareerReportPdfBuffer } = await import('./renderCareerReportPdf.js')
    const rawPayload = {
      ...(aiReport || {}),
      callBookingUrl: meta.bookingUrl,
      whatsappCtaNumber: settings?.whatsappCtaNumber || '',
      socialLinksConfig: settings?.socialLinksConfig || undefined,
    }
    const redacted = redactReportForTeaser(rawPayload, { teaserModeEnabled: true, reportUnlocked: false })
    previewPdfBuffer = await renderCareerReportPdfBuffer(redacted)
  } catch (pdfErr) {
    console.warn('[Email] Preview PDF render skipped:', pdfErr.message)
  }

  const html = buildForestGreenShell({
    badge: 'CAREER GPS • EXECUTIVE PREVIEW READY',
    title: `Your Career GPS Preview Is Ready, ${meta.candidateName}`,
    hasMascot: Boolean(mascotAtt),
    hasLogo: Boolean(logoAtt),
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#0F172A;">
        We have completed your multi-agent diagnostic for <strong>${meta.targetRole}</strong>.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:14px 0 18px;background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;">
        <tr>
          <td style="padding:14px 16px;">
            <div style="font-size:12px;font-weight:700;color:#15803D;text-transform:uppercase;">Career Health Score</div>
            <div style="font-size:22px;font-weight:800;color:#0F172A;margin-top:2px;">${meta.scoreVal}/100</div>
            <div style="font-size:13px;color:#334155;margin-top:6px;"><strong>Primary Bottleneck:</strong> ${meta.bottleneckHeadline}</div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#334155;">
        Your <strong>Preview Report PDF</strong> is attached to this email. Your full Google XYZ bullet rewrites, 30/60/90-day execution roadmap, and updated ATS <code>.docx</code> resume unlock during your free 1:1 strategy call.
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 16px;">
        <tr>
          <td style="padding-right:10px;padding-bottom:8px;">
            <a href="${meta.bookingUrl}" style="display:inline-block;background-color:#15803D;color:#FFFFFF;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Book Free 1-on-1 Strategy Call -&gt;</a>
          </td>
          <td style="padding-bottom:8px;">
            <a href="${meta.whatsappUrl}" style="display:inline-block;background-color:#0F172A;color:#FFFFFF;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Connect on WhatsApp</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#475569;">
        Preview online anytime: <a href="${meta.reportUrl}" style="color:#15803D;font-weight:600;">${meta.reportUrl}</a>
      </p>
    `,
    footerNote: 'Reply directly to this email if you need help scheduling your session — Crafture Career GPS Team.',
  })

  const text = [
    `Hi ${meta.candidateName},`,
    '',
    `Your Career GPS Executive Preview for ${meta.targetRole} is ready!`,
    `Career Health Score: ${meta.scoreVal}/100`,
    `Primary Bottleneck: ${meta.bottleneckHeadline}`,
    '',
    'Your Preview Report PDF is attached. Full bullet rewrites, 30/60/90-day roadmap, and your updated ATS .docx resume unlock on your free 1:1 strategy call.',
    '',
    `Book Free 1-on-1 Strategy Call -> ${meta.bookingUrl}`,
    `Connect on WhatsApp -> ${meta.whatsappUrl}`,
    `Preview Link -> ${meta.reportUrl}`,
  ].join('\n')

  const attachments = []
  if (mascotAtt) attachments.push(mascotAtt)
  if (logoAtt) attachments.push(logoAtt)
  if (previewPdfBuffer) {
    attachments.push({ filename: `Career_GPS_Preview_${meta.safeName}.pdf`, content: previewPdfBuffer })
  }

  return sendResendEmail({
    to: user.email,
    subject: `Your Career GPS Preview (${meta.scoreVal}/100) — ${meta.targetRole}`,
    html,
    text,
    attachments,
  })
}

/**
 * B) Admin Unlocked Full Delivery Email (POST /api/admin/leads/:id/deliver)
 * Attaches BOTH 100% Full Unredacted Report PDF AND Updated ATS .docx Resume.
 */
export async function sendCandidateUnlockedEmail({ user, aiReport, settings = {}, docxBuffer = null, docxFilename = null }) {
  if (!user?.email) return { ok: false, error: 'Candidate has no email address on file.' }
  const meta = extractReportMeta(user, aiReport, settings)
  const mascotAtt = getMascotCidAttachment('thumbsup')
  const logoAtt = getCraftureLogoCidAttachment()

  let fullPdfBuffer = null
  try {
    const { renderCareerReportPdfBuffer } = await import('./renderCareerReportPdf.js')
    const fullPayload = {
      ...(aiReport || {}),
      reportUnlocked: true,
      callBookingUrl: meta.bookingUrl,
      whatsappCtaNumber: settings?.whatsappCtaNumber || '',
      socialLinksConfig: settings?.socialLinksConfig || undefined,
    }
    fullPdfBuffer = await renderCareerReportPdfBuffer(fullPayload)
  } catch (pdfErr) {
    console.warn('[Email] Full PDF render skipped:', pdfErr.message)
  }

  const html = buildForestGreenShell({
    badge: 'CRAFTURE CAREER GPS • FULL REPORT UNLOCKED',
    title: `Your Full Career GPS Report Is Unlocked, ${meta.candidateName}!`,
    hasMascot: Boolean(mascotAtt),
    hasLogo: Boolean(logoAtt),
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#0F172A;">
        Great news — your complete Career GPS diagnostic for <strong>${meta.targetRole}</strong> is now 100% unlocked.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:14px 0 18px;background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;">
        <tr>
          <td style="padding:14px 16px;">
            <div style="font-size:12px;font-weight:700;color:#15803D;text-transform:uppercase;">Career Health Score</div>
            <div style="font-size:22px;font-weight:800;color:#0F172A;margin-top:2px;">${meta.scoreVal}/100</div>
            <div style="font-size:13px;color:#334155;margin-top:6px;">
              Included: All Google XYZ bullet rewrites, full LinkedIn Studio SEO, 7-Day &amp; 30/60/90 roadmap, and your updated ATS resume.
            </div>
          </td>
        </tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 18px;">
        <tr>
          <td>
            <a href="${meta.reportUrl}" style="display:inline-block;background-color:#15803D;color:#FFFFFF;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">View Full Interactive Report -&gt;</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#334155;">
        Attached: ${fullPdfBuffer ? `<strong>Career_GPS_Report_${meta.safeName}.pdf</strong>` : ''}${fullPdfBuffer && docxBuffer ? ' &amp; ' : ''}${docxBuffer ? `<strong>${docxFilename || `${meta.safeName}_Updated_ATS_Resume.docx`}</strong>` : ''}.
      </p>
    `,
    footerNote: `Direct link: <a href="${meta.reportUrl}" style="color:#15803D;">${meta.reportUrl}</a><br/>Reply to this email anytime if you have questions — Crafture Career GPS Team.`,
  })

  const text = [
    `Hi ${meta.candidateName},`,
    '',
    `Your complete Crafture Career GPS Report for ${meta.targetRole} (Career Health Score: ${meta.scoreVal}/100) is now 100% unlocked!`,
    'Included: All Google XYZ bullet rewrites, full LinkedIn Studio SEO, 7-Day & 30/60/90 roadmap, and your updated ATS resume.',
    '',
    `View Full Interactive Report -> ${meta.reportUrl}`,
    '',
    '— Crafture Career GPS Team',
  ].join('\n')

  const attachments = []
  if (mascotAtt) attachments.push(mascotAtt)
  if (logoAtt) attachments.push(logoAtt)
  if (fullPdfBuffer) {
    attachments.push({ filename: `Career_GPS_Report_${meta.safeName}.pdf`, content: fullPdfBuffer })
  }
  if (docxBuffer) {
    attachments.push({
      filename: docxFilename || `${meta.safeName}_Updated_ATS_Resume.docx`,
      content: docxBuffer,
    })
  }

  if (process.env.RESEND_API_KEY) {
    const res = await sendResendEmail({
      to: user.email,
      subject: `Your Full Career GPS Report & Tailored ATS Resume Are Ready (${meta.scoreVal}/100)`,
      html,
      text,
      attachments,
    })
    return { ...res, pdfAttached: Boolean(fullPdfBuffer) }
  }

  const transporter = getTransporter()
  if (!transporter) {
    return { ok: false, error: 'RESEND_API_KEY is not configured.', pdfAttached: Boolean(fullPdfBuffer) }
  }
  try {
    const info = await transporter.sendMail({
      from: `"Crafture Career GPS" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: `Your Full Career GPS Report & Tailored ATS Resume Are Ready (${meta.scoreVal}/100)`,
      html,
      text,
      attachments,
    })
    return { ok: true, emailId: info?.messageId || null, pdfAttached: Boolean(fullPdfBuffer) }
  } catch (err) {
    return { ok: false, error: err.message, pdfAttached: Boolean(fullPdfBuffer) }
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
