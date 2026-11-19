import React from 'react'
import useAppStore, { showToast } from '../store/useAppStore'
import { getFriendlyErrorMessage } from './errorMessages'

/**
 * downloadFullReport.js
 * Generates a clean, vector-rendered A4 PDF directly using @react-pdf/renderer
 * without triggering browser print preview or freezing the main thread.
 */

let isCurrentlyGenerating = false

export async function downloadFullVisualReport(reportDataOrName, candidateNameParam) {
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

    // Dynamically load @react-pdf/renderer and CareerReportPdf so initial page load remains instant
    const [{ pdf }, { default: CareerReportPdf }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('../components/pdf/CareerReportPdf.jsx'),
    ])

    const element = React.createElement(CareerReportPdf, { reportData })
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
