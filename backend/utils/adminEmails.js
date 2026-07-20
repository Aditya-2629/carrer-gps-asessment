const ADMIN_EMAIL = 'inspiracustomer@gmail.com'

// Helper to send email via Brevo HTTP API
const sendBrevoEmail = async ({ to, subject, htmlContent, attachments = [] }) => {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { 
          name: 'Career GPS System', 
          email: process.env.BREVO_FROM || 'inspiracustomer@gmail.com' 
        },
        to: [{ email: to }],
        subject,
        htmlContent,
        attachments
      })
    })

    const result = await response.json()
    if (!response.ok) {
      console.error('[Brevo API] Failed to send email:', result)
    } else {
      console.log(`[Brevo API] Email sent successfully to ${to}. Message ID:`, result.messageId)
    }
  } catch (error) {
    console.error('[Brevo API] Request failed:', error)
  }
}

// 1. Send Admin Report Email
export const sendAdminReportEmail = async (userEmail, answers, aiReport, resumeBuffer, resumeName) => {
  // Convert Answers to HTML table format
  let answersHtml = "<table style='width:100%; border-collapse:collapse; margin-bottom:20px; font-family: sans-serif; font-size: 13px;'>"
  answersHtml += "<tr style='background:#10b981; color:white;'><th style='padding:10px; border:1px solid #ddd; text-align:left;'>Question</th><th style='padding:10px; border:1px solid #ddd; text-align:left;'>Answer</th></tr>"
  
  for (const [key, value] of Object.entries(answers)) {
    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const displayValue = Array.isArray(value) ? value.join(', ') : (value || 'N/A')
    answersHtml += `<tr><td style='padding:8px; border:1px solid #ddd; font-weight: bold; color: #374151;'>${formattedKey}</td><td style='padding:8px; border:1px solid #ddd; color: #1f2937;'>${displayValue}</td></tr>`
  }
  answersHtml += '</table>'

  // AI Report Summary HTML
  let reportHtml = `
    <div style="background:#f9fafb; padding:20px; border:1px solid #e5e7eb; border-radius:12px; margin-top:20px; font-family: sans-serif;">
      <h3 style="color:#10b981; margin-top:0; border-bottom: 2px solid #10b981; padding-bottom: 8px;">AI Career GPS Report</h3>
      <p style="font-size: 15px;"><strong>Overall Score:</strong> <span style="color:#10b981; font-weight:bold; font-size:18px;">${aiReport.career_health_score}/100</span> (${aiReport.score_label})</p>
      <table style="width:100%; border-collapse:collapse; margin: 15px 0;">
        <tr>
          <td style="padding: 6px 0; color: #4b5563;"><strong>Resume Score:</strong></td>
          <td style="padding: 6px 0;">${aiReport.score_breakdown?.resume?.score ?? 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #4b5563;"><strong>LinkedIn Score:</strong></td>
          <td style="padding: 6px 0;">${aiReport.score_breakdown?.linkedin?.score ?? 'N/A'}</td>
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

  // Format attachments for Brevo (Base64 encoding required)
  const attachments = []
  if (resumeBuffer) {
    try {
      const base64Content = resumeBuffer.toString('base64')
      attachments.push({
        name: resumeName || 'Resume.pdf',
        content: base64Content
      })
    } catch (err) {
      console.error('[Brevo API] Failed to encode resume buffer to base64:', err)
    }
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #ffffff; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #f3f4f6; border-radius: 8px;">
      <h2 style="color: #111827; margin-top: 0;">New Assessment Completed</h2>
      <p style="font-size: 14px;"><strong>User Email:</strong> <a href="mailto:${userEmail}" style="color: #10b981; font-weight: bold; text-decoration: none;">${userEmail}</a></p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <h3 style="color:#111827;">Assessment Answers:</h3>
      ${answersHtml}
      ${reportHtml}
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size:12px; color:#9ca3af;">Resume is attached to this email if uploaded by the candidate.</p>
    </div>
  `

  await sendBrevoEmail({
    to: ADMIN_EMAIL,
    subject: `🚨 NEW ASSESSMENT: ${userEmail} completed Career GPS`,
    htmlContent,
    attachments
  })
}

// 2. Send Book Call Request Notification
export const sendBookCallNotification = async (userEmail) => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #fffbeb; color: #92400e; border: 1px solid #fef3c7; border-radius: 8px; max-width: 600px; margin: 0 auto;">
      <h2 style="margin-top:0; color:#b45309;">🔥 Hot Lead: Book Call Request</h2>
      <p style="font-size:15px; color:#4b5563;">A user clicked <strong>"Book Strategy Call"</strong> on their AI Career GPS Report page.</p>
      <p style="font-size:16px;"><strong>User Email:</strong> <a href="mailto:${userEmail}" style="color:#b45309; font-weight:bold; text-decoration: underline;">${userEmail}</a></p>
      <p style="font-size:13px; font-weight: bold; margin-top: 15px; color:#b45309;">Contact them immediately to convert this lead!</p>
    </div>
  `

  await sendBrevoEmail({
    to: ADMIN_EMAIL,
    subject: `📞 BOOK CALL REQUEST: ${userEmail} wants to talk!`,
    htmlContent
  })
}
