import React, { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Activity, AlertCircle } from 'lucide-react'
import { showToast } from '../store/useAppStore'
import { getFriendlyErrorMessage } from '../lib/errorMessages'

export default function AssessmentProgressModal({ userId, onComplete, onError }) {
  const [progress, setProgress] = useState(15)
  const [statusMessage, setStatusMessage] = useState('Running career diagnostic assessment...')

  useEffect(() => {
    if (!userId) return
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    const eventSource = new EventSource(`${apiBase}/assessment/generate-report-stream?userId=${encodeURIComponent(userId)}`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.percent) setProgress(data.percent)
        if (data.message) setStatusMessage(data.message)

        if (data.complete && data.report) {
          eventSource.close()
          onComplete(data.report)
        }

        if (data.error) {
          eventSource.close()
          showToast(getFriendlyErrorMessage(data.error), 'error')
          onError(data.error)
        }
      } catch (e) {
        console.error('SSE Parse Error:', e)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      // Graceful fallback to regular POST if SSE fails
      fetch(`${apiBase}/assessment/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
        .then((res) => res.json())
        .then((report) => onComplete(report))
        .catch((err) => {
          showToast(getFriendlyErrorMessage(err, 'Failed to generate report'), 'error')
          onError(err?.message || 'Failed to generate report')
        })
    }

    return () => eventSource.close()
  }, [userId, onComplete, onError])

  return (
    <div className="fixed inset-0 z-50 bg-[#050C08]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0B1711] rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-[#1B3326] text-center">
        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/60 text-[#15803D] dark:text-emerald-400 rounded-lg flex items-center justify-center mx-auto mb-4">
          <Activity className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-[#F0FDF4] mb-1">Generating Career Health Assessment</h3>
        <p className="text-xs text-slate-500 dark:text-[#94B4A2] mb-6">{statusMessage}</p>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-[#102118] rounded-full h-2 mb-3 overflow-hidden">
          <div
            className="bg-[#15803D] dark:bg-emerald-500 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 dark:text-[#648270] font-mono">
          <span>Diagnostic Engine Pipeline</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
      </div>
    </div>
  )
}
