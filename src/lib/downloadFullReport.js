import React from 'react'
import useAppStore, { showToast } from '../store/useAppStore'
import { getFriendlyErrorMessage } from './errorMessages'

/**
 * downloadFullReport.js
 * Generates a clean, vector-rendered A4 PDF directly using @react-pdf/renderer
 * without triggering browser print preview or freezing the main thread.
 */

let isCurrentlyGenerating = false

async function resolveSafeAvatarDataUri(url) {
  if (!url || typeof url !== 'string') return null
  if (/^data:image\/(png|jpeg|jpg);base64,/i.test(url)) return url
  if (!/^https?:\/\//i.test(url)) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(url, { mode: 'cors', signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = 96
    canvas.height = 96
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, 96, 96)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export async function downloadFullVisualReport(
  reportDataOrName,
  candidateNameParam,
  { isTeaserLocked = false } = {}
) {
  if (typeof window === 'undefined') return false
  if (isCurrentlyGenerating) return false

  isCurrentlyGenerating = true

  try {
    let reportData = {}
    let candidateName = 'Candidate'

    if (typeof reportDataOrName === 'object' && reportDataOrName !== null) {
      reportData = reportDataOrName
      candidateName =
        candidateNameParam ||
        reportData?.resume_agent?.candidateSnapshot?.name ||
        reportData?.resume_json?.candidate?.name ||
        reportData?.resume_json?.candidate_name ||
        reportData?.user_answers?.name ||
        'Candidate'
    } else if (typeof reportDataOrName === 'string') {
      candidateName = reportDataOrName
      try {
        reportData = useAppStore.getState()?.reportData || {}
      } catch (_e) {}
    }

    const safeName = String(candidateName || 'Candidate')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
    const fileName = `Career_GPS_Report_${safeName || 'Candidate'}.pdf`

    // Dynamically load @react-pdf/renderer, CareerReportPdf, and the single-source-of-truth redactor
    const [{ pdf }, { default: CareerReportPdf }, { redactReportForTeaser }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('../components/pdf/CareerReportPdf.jsx'),
      import('../../backend/utils/teaserRedactor.js'),
    ])

    // Single-pass redaction: if already server-redacted (__teaserRedacted === true), use as-is;
    // otherwise if isTeaserLocked is true, redact ONCE here.
    const baseReportData = reportData?.__teaserRedacted === true
      ? reportData
      : isTeaserLocked
      ? redactReportForTeaser(reportData, { teaserModeEnabled: true, reportUnlocked: false })
      : reportData

    const rawAvatarUrl =
      baseReportData?.linkedin_agent?.profilePic ||
      baseReportData?.linkedin_agent?.avatarUrl ||
      baseReportData?.linkedinActivityData?.profilePic ||
      baseReportData?.linkedinActivityData?.avatarUrl ||
      baseReportData?.linkedin_activity_data?.profilePic ||
      baseReportData?.linkedin_activity_data?.avatarUrl ||
      null
    const resolvedLinkedinPhotoDataUri = await resolveSafeAvatarDataUri(rawAvatarUrl)

    const finalReportData = resolvedLinkedinPhotoDataUri
      ? { ...baseReportData, resolvedLinkedinPhotoDataUri }
      : baseReportData

    const element = React.createElement(CareerReportPdf, { reportData: finalReportData })
    const blob = await pdf(element).toBlob()

    // Trigger instant browser download
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 15000)

    showToast('Career GPS Report downloaded successfully!', 'success')
    return true
  } catch (err) {
    console.error('Failed to generate Career GPS PDF:', err)
    showToast(getFriendlyErrorMessage(err, 'Failed to generate Career GPS PDF.'), 'error')
    return false
  } finally {
    isCurrentlyGenerating = false
  }
}

export default downloadFullVisualReport
