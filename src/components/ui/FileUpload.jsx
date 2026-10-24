import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UploadSimple,
  FilePdf,
  FileDoc,
  FileText,
  CheckCircle,
  WarningCircle,
  Sparkle,
  ArrowSquareOut,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'

export default function FileUpload({ value, onChange, error, step, onNext }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')
  const abortControllerRef = useRef(null)

  const { formData, resumeAnalysis, setResumeAnalysis } = useAppStore()

  const startBackgroundAnalysis = useCallback(
    async (file) => {
      if (!file) return

      // Abort any ongoing request for a previous file
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setResumeAnalysis({
        status: 'analyzing',
        filename: file.name,
        error: null,
        data: null,
      })

      try {
        // Clear stale targetRole on new resume upload unless user explicitly locked it or pasted a custom JD
        const isCustomLocked = Boolean(formData.isCustomTargetRoleLocked || formData.customTargetRoleLocked)
        const customJd = formData.targetJobDescription || formData.targetJd || ''
        const targetRole = isCustomLocked
          ? (formData.targetRole || formData.target_role || formData.role || '')
          : ''

        const result = await api.evaluateResume({
          file,
          targetRole,
          targetJobDescription: customJd,
          signal: controller.signal,
        })

        if (result && result.analysis) {
          setResumeAnalysis({
            status: 'completed',
            filename: file.name,
            data: result,
            error: null,
          })

          // Dynamically populate LinkedIn and candidate info into assessment questions
          const detectedLinkedin =
            result.canonicalResume?.candidate?.contact?.linkedin ||
            result.analysis?.candidateSnapshot?.linkedinUrl ||
            ''
          const detectedName =
            result.canonicalResume?.candidate?.name ||
            result.analysis?.candidateSnapshot?.name ||
            ''
          const detectedTarget =
            result.canonicalResume?.candidate?.targetRole ||
            result.analysis?.candidateSnapshot?.targetRole ||
            ''

          const bulkUpdates = {}
          if (detectedLinkedin) {
            bulkUpdates.linkedin = detectedLinkedin
          }
          if (detectedName && !formData.name && !formData.fullName) {
            bulkUpdates.name = detectedName
          }
          if (detectedTarget && (!isCustomLocked || !formData.targetRole)) {
            bulkUpdates.targetRole = detectedTarget
          }
          if (Object.keys(bulkUpdates).length > 0) {
            useAppStore.getState().setBulkFormData(bulkUpdates)
          }

          try {
            sessionStorage.setItem(
              'craftureResumeReport',
              JSON.stringify({
                analysis: result.analysis,
                meta: {
                  filename: file.name,
                  analyzedAt: new Date().toISOString(),
                  marketContext: result.marketContext || null,
                  canonicalResume: result.canonicalResume || null,
                },
              })
            )
          } catch (_e) {}
        } else {
          throw new Error('Analysis returned incomplete payload.')
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return
        console.warn('[FileUpload] Background resume analysis warning:', err.message)
        setResumeAnalysis({
          status: 'error',
          filename: file.name,
          error: err.message || 'Background analysis failed.',
          data: null,
        })
      }
    },
    [formData, setResumeAnalysis]
  )

  const validateAndSet = useCallback(
    (file) => {
      if (!file) return
      const maxBytes = (step?.maxSizeMB || 5) * 1024 * 1024
      if (file.size > maxBytes) {
        setFileError(`File too large. Maximum size is ${step?.maxSizeMB || 5}MB.`)
        return
      }

      const lowerName = file.name.toLowerCase()
      const isAllowedExt =
        lowerName.endsWith('.pdf') ||
        lowerName.endsWith('.docx') ||
        lowerName.endsWith('.doc') ||
        lowerName.endsWith('.txt')

      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ]

      if (!isAllowedExt && !allowedMimes.includes(file.type)) {
        setFileError('Please upload a PDF or DOCX Word document.')
        return
      }

      setFileError('')
      onChange(file)
      useAppStore.getState().setResumeFile(file)
      if (typeof window !== 'undefined') {
        window.__uploadedResumeFile = file
      }
      startBackgroundAnalysis(file)
    },
    [step, onChange, startBackgroundAnalysis]
  )

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSet(e.dataTransfer.files[0])
    }
  }

  const handleInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSet(e.target.files[0])
    }
  }

  const storeFile = useAppStore((s) => s.resumeFile)
  const effectiveFile = value instanceof File ? value : (storeFile instanceof File ? storeFile : null)
  const hasFile = Boolean(effectiveFile || (value && typeof value === 'object' && value.name))
  const fileName = effectiveFile?.name || value?.name || ''
  const fileSize = effectiveFile?.size || value?.size || 0
  const lowerFileName = fileName.toLowerCase()
  const isDocx = lowerFileName.endsWith('.docx') || lowerFileName.endsWith('.doc')

  return (
    <div className="space-y-3">
      <label
        htmlFor={`file-input-${step?.id || 'resume'}`}
        className={`file-drop block ${dragOver ? 'drag-over' : ''} ${hasFile ? 'uploaded' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{ cursor: 'pointer' }}
      >
        <input
          id={`file-input-${step?.id || 'resume'}`}
          type="file"
          accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleInput}
          className="sr-only"
        />

        <AnimatePresence mode="wait">
          {hasFile ? (
            <motion.div
              key="uploaded"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform hover:scale-105"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
              >
                {isDocx ? <FileDoc size={28} weight="fill" /> : <FilePdf size={28} weight="fill" />}
              </div>
              <div className="text-center">
                <p className="font-medium text-sm flex items-center justify-center gap-1.5" style={{ color: '#10b981' }}>
                  <CheckCircle size={16} weight="fill" />
                  <span className="font-semibold">{fileName}</span>
                </p>
                <p className="text-xs mt-1 text-[var(--text-muted)]">
                  {(fileSize / 1024 / 1024).toFixed(2)} MB · Click or drop to replace
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                style={{
                  background: 'var(--surface-strong)',
                  color: 'var(--primary)',
                  border: '1.5px solid var(--border-default)',
                }}
              >
                <UploadSimple size={28} />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm text-[var(--text-primary)]">
                  Drop your resume (PDF or DOCX), or{' '}
                  <span className="text-[var(--primary)] font-semibold underline decoration-[var(--primary)]/40">browse</span>
                </p>
                <p className="text-xs mt-1 text-[var(--text-muted)]">
                  PDF or Word DOCX · Max {step?.maxSizeMB || 5}MB · AI parses and audits immediately
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </label>

      {/* Real-Time Background Resume Agent Status Card */}
      {hasFile && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border transition-all"
          style={{
            background:
              resumeAnalysis?.status === 'completed'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)'
                : resumeAnalysis?.status === 'analyzing'
                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%)'
                : 'var(--surface-card)',
            borderColor:
              resumeAnalysis?.status === 'completed'
                ? 'rgba(16, 185, 129, 0.3)'
                : resumeAnalysis?.status === 'analyzing'
                ? 'rgba(99, 102, 241, 0.3)'
                : 'var(--border-default)',
          }}
        >
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              {/* Status Indicator Icon */}
              <div className="shrink-0 mt-0.5 sm:mt-0">
                {resumeAnalysis?.status === 'analyzing' && (
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Sparkle size={18} weight="fill" className="animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                )}
                {resumeAnalysis?.status === 'completed' && (
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle size={20} weight="fill" />
                  </div>
                )}
                {resumeAnalysis?.status === 'error' && (
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <WarningCircle size={20} weight="fill" />
                  </div>
                )}
                {(!resumeAnalysis || resumeAnalysis.status === 'idle') && (
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface-strong)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)]">
                    <Sparkle size={18} />
                  </div>
                )}
              </div>

              {/* Status Narrative & Progress */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    {resumeAnalysis?.status === 'analyzing' && '⚡ AI Resume Agent Analyzing in Background'}
                    {resumeAnalysis?.status === 'completed' && '✅ Resume Audit & Parsing Complete'}
                    {resumeAnalysis?.status === 'error' && 'Resume Saved · Background Audit Pending'}
                    {(!resumeAnalysis || resumeAnalysis.status === 'idle') && 'Resume Document Ready'}
                  </span>
                  {resumeAnalysis?.status === 'completed' &&
                    resumeAnalysis.data?.analysis?.dashboard?.score !== undefined && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        Score: {resumeAnalysis.data.analysis.dashboard.score}/100 (
                        {resumeAnalysis.data.analysis.dashboard.grade || 'A'})
                      </span>
                    )}
                </div>

                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  {resumeAnalysis?.status === 'analyzing' && (
                    <span>
                      Extracting sections, scoring ATS metrics, and drafting recruiter rewrites.{' '}
                      <strong>You can continue answering the assessment questions</strong> — your full report will be ready when you finish!
                    </span>
                  )}
                  {resumeAnalysis?.status === 'completed' && (
                    <span>
                      Audited {resumeAnalysis.data?.analysis?.dashboard?.bulletAudit?.length || 'all'} bullet points & identified{' '}
                      {resumeAnalysis.data?.analysis?.issues?.length || 0} high-impact improvements. Ready for your executive report!
                    </span>
                  )}
                  {resumeAnalysis?.status === 'error' && (
                    <span>
                      Document parsed and stored. Background pre-check timed out, but your report will generate normally at the final step.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto">
              {resumeAnalysis?.status === 'completed' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    window.open('/resume-report', '_blank')
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Open the polished full-page diagnosis report in a new tab"
                >
                  <span>Full Diagnosis</span>
                  <ArrowSquareOut size={13} weight="bold" />
                </button>
              )}
              {resumeAnalysis?.status === 'error' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    if (value instanceof File) startBackgroundAnalysis(value)
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--surface-strong)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-default)] flex items-center gap-1 cursor-pointer transition-all"
                >
                  <ArrowsClockwise size={13} />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {(fileError || error) && (
        <div className="flex items-center gap-2 mt-2 text-sm text-red-500" role="alert">
          <WarningCircle size={15} weight="fill" />
          <span>{fileError || error}</span>
        </div>
      )}
    </div>
  )
}
