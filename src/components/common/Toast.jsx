import React, { useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'

export default function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => onClose(), 3000)
    return () => clearTimeout(timer)
  }, [message, onClose])

  if (!message) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-gray-900 text-white px-4 py-3 shadow-2xl border border-gray-700/60 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200">
      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      <span className="text-xs font-semibold tracking-wide">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
        aria-label="Close notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
