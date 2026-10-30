import React, { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react'

export default function AssessmentProgressModal({ userId, onComplete, onError }) {
  const [progress, setProgress] = useState(15)
  const [statusMessage, setStatusMessage] = useState('Initializing AI agents...')

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
        .catch((err) => onError(err?.message || 'Failed to generate report'))
    }

    return () => eventSource.close()
  }, [userId, onComplete, onError])

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center">
        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Generating Career Health Assessment</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{statusMessage}</p>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 mb-3 overflow-hidden">
          <div
            className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
          <span>AI Multi-Agent Pipeline</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  )
}
