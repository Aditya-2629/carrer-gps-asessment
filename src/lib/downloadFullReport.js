/**
 * downloadFullReport.js
 * Unifies report printing & PDF export to the full multi-page visual layout.
 * Temporarily switches dark mode to light mode so the PDF renders on crisp white paper,
 * sets the document title to `Career_GPS_Report_<CandidateName>`, and triggers window.print().
 */

export function downloadFullVisualReport(candidateName) {
  if (typeof window === 'undefined') return

  const docEl = document.documentElement
  const wasDark = docEl.classList.contains('dark')
  const originalTitle = document.title

  // Format clean filename for browser PDF print dialog
  const safeName = (candidateName || 'Candidate')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
  const reportTitle = `Career_GPS_Report_${safeName || 'Candidate'}`

  // 1. Force light background for crisp physical/PDF printing
  if (wasDark) {
    docEl.classList.remove('dark')
  }

  // 2. Set clean document title for auto-named PDF download
  document.title = reportTitle

  let cleanupDone = false
  const cleanup = () => {
    if (cleanupDone) return
    cleanupDone = true
    if (wasDark) {
      docEl.classList.add('dark')
    }
    document.title = originalTitle
    window.removeEventListener('afterprint', cleanup)
  }

  // Listen for afterprint event
  window.addEventListener('afterprint', cleanup)

  // Fallback safety timeout in case afterprint does not fire in some embedded webviews
  setTimeout(cleanup, 60000)

  // Trigger print dialog
  window.print()
}

export default downloadFullVisualReport
