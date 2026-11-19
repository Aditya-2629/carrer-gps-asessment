import React, { useEffect } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import useAppStore from '../../store/useAppStore'

const TYPE_CONFIGS = {
  success: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-slate-900/95 text-white',
  },
  error: {
    icon: AlertCircle,
    iconColor: 'text-rose-500',
    borderColor: 'border-rose-500/30',
    bgColor: 'bg-slate-900/95 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-slate-900/95 text-white',
  },
  info: {
    icon: Info,
    iconColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    bgColor: 'bg-slate-900/95 text-white',
  },
}

export function GlobalToast() {
  const toast = useAppStore((s) => s.toast)
  const clearToast = useAppStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      clearToast()
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast?.id, clearToast])

  if (!toast) return null

  const config = TYPE_CONFIGS[toast.type] || TYPE_CONFIGS.info
  const IconComponent = config.icon

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 right-6 z-[9999] max-w-md flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md border transition-all animate-in fade-in slide-in-from-bottom-4 duration-200"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        color: '#F8FAFC',
        borderColor: toast.type === 'error' ? 'rgba(244, 63, 94, 0.4)' : toast.type === 'success' ? 'rgba(34, 197, 94, 0.4)' : toast.type === 'warning' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.4)',
      }}
    >
      <IconComponent className={`h-4 w-4 shrink-0 ${config.iconColor}`} />
      <span className="text-xs font-medium tracking-wide flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={clearToast}
        className="ml-2 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded"
        aria-label="Close notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default function Toast({ message, onClose, type = 'success' }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => onClose?.(), 3000)
    return () => clearTimeout(timer)
  }, [message, onClose])

  if (!message) return null

  const config = TYPE_CONFIGS[type] || TYPE_CONFIGS.success
  const IconComponent = config.icon

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-gray-900 text-white px-4 py-3 shadow-2xl border border-gray-700/60 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <IconComponent className={`h-4 w-4 shrink-0 ${config.iconColor}`} />
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
