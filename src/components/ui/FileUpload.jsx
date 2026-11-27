import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadSimple, FileDoc, FilePdf, CheckCircle, WarningCircle, Sparkle } from '@phosphor-icons/react'
import useAppStore, { showToast } from '../../store/useAppStore'
import { api } from '../../lib/api'
import { normalizeLinkedInUrl } from '../../lib/linkedinUrlUtils'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import { fastScanResumeFile } from '../../lib/fastResumeScanner'
import { trackAnalytics } from '../../lib/analytics'

const RING_RADIUS = 44
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const getStageText = (progress) => {
  if (progress < 35) return 'Uploading resume...'
  if (progress < 65) return 'Extracting skills & bullet structure...'
  if (progress < 100) return 'Preparing career signals...'
  return '100% • Resume Processed'
}

export default function FileUpload({ value, onChange, error, step, onNext }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const progressTimerRef = useRef(null)
  const { formData, resumeAnalysis, setResumeAnalysis } = useAppStore()

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
    }
  }, [])

  const startBackgroundAnalysis = useCallback(
    async (file, fastLinkedIn = '', fastPhone = '') => {
      if (!file) return

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }

      setUploadProgress(5)
      setResumeAnalysis({
        status: 'analyzing',
        filename: file.name,
        error: null,
        data: null,
      })

      const startParsingTimer = () => {
        if (progressTimerRef.current) return
        progressTimerRef.current = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) return prev
            if (prev < 35) return 35
            if (prev < 65) {
              const step = Math.max(1, Math.round((65 - prev) * 0.14))
              return prev + step
            }
            const step = Math.max(1, Math.round((92 - prev) * 0.08))
            return Math.min(90, prev + step)
          })
        }, 250)
      }

      const onProgress = ({ percent }) => {
        setUploadProgress((prev) => Math.max(prev, percent))
        if (percent >= 35) {
          startParsingTimer()
        }
      }

      // Safety kick: start asymptotic timer after brief upload window if onUploadProgress was instant
      const safetyKickTimeout = setTimeout(() => {
        setUploadProgress((prev) => Math.max(prev, 35))
        startParsingTimer()
      }, 300)

      try {
        const result = await api.parseResumeDeterministic(file, { onProgress })
        clearTimeout(safetyKickTimeout)
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current)
          progressTimerRef.current = null
        }

        // Display brief 100% Forest Green completion before advancing state
        setUploadProgress(100)
        await new Promise((resolve) => setTimeout(resolve, 450))

        if (result && (result.canonicalResume || result.analysis)) {
          setResumeAnalysis({
            status: 'completed',
            filename: file.name,
            error: null,
            data: result,
          })

          const isCustomLocked = Boolean(useAppStore.getState().customTargetRoleLocked)
          const detectedLinkedin = normalizeLinkedInUrl(
            result.canonicalResume?.candidate?.linkedin ||
            result.canonicalResume?.linkedin ||
            result.analysis?.candidateSnapshot?.linkedinUrl ||
            fastLinkedIn ||
            ''
          )
          const detectedName =
            result.canonicalResume?.candidate?.name ||
            result.analysis?.candidateSnapshot?.name ||
            ''
          const detectedEmail =
            result.canonicalResume?.candidate?.email ||
            result.canonicalResume?.candidate?.contact?.email ||
            result.canonicalResume?.email ||
            result.analysis?.candidateSnapshot?.email ||
            ''
          // Automatically infer target role from the candidate's last (most recent) experience role
          const mostRecentRole =
            result.canonicalResume?.experiences?.[0]?.role ||
            result.canonicalResume?.experience?.[0]?.role ||
            result.analysis?.candidateSnapshot?.presentRole ||
            result.analysis?.candidateSnapshot?.targetRole ||
            result.canonicalResume?.candidate?.targetRole ||
            'Software Engineer'

          const bulkUpdates = {}
          if (detectedLinkedin) {
            bulkUpdates.linkedin = detectedLinkedin
            if (typeof window !== 'undefined') {
              if (window.__linkedinScrapeInProgress !== detectedLinkedin && !window.__linkedinScrapePromise) {
                window.__linkedinScrapeInProgress = detectedLinkedin
                window.__linkedinScrapePromise = api.scrapeLinkedInProfile(detectedLinkedin).then((res) => {
                  window.__linkedinScrapeInProgress = null
                  if (res?.profile) {
                    useAppStore.getState().setFormData('linkedinData', res.profile)
                    try {
                      sessionStorage.setItem('craftureLinkedinScrape', JSON.stringify(res.profile))
                    } catch (_e) {}
                  }
                  return res?.profile || null
                }).catch(() => {
                  window.__linkedinScrapeInProgress = null
                  return null
                })
              }
            }
          } else {
            bulkUpdates.linkedin = ''
            bulkUpdates.linkedinData = null
          }
          // Always overwrite identity fields from newly parsed resume (never keep stale test candidate)
          if (detectedName) {
            bulkUpdates.name = detectedName
            bulkUpdates.fullName = detectedName
          }
          if (detectedEmail) {
            bulkUpdates.email = detectedEmail
          }
          // Always infer target role from last work experience
          if (mostRecentRole && (!isCustomLocked || !formData.targetRole)) {
            bulkUpdates.targetRole = mostRecentRole
          }

          const rawPhone =
            result.canonicalResume?.candidate?.phone ||
            result.canonicalResume?.candidate?.contact?.phone ||
            result.canonicalResume?.phone ||
            result.analysis?.candidateSnapshot?.phone ||
            ''
          const cleanDigits = String(rawPhone).replace(/\D/g, '')
          // Only set phone if it contains 10-15 valid digits and is not 'N/A' or a date range
          if (
            rawPhone &&
            rawPhone !== 'N/A' &&
            cleanDigits.length >= 10 &&
            cleanDigits.length <= 15 &&
            !/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/.test(rawPhone.trim())
          ) {
            bulkUpdates.phone = rawPhone
          } else if (fastPhone) {
            bulkUpdates.phone = fastPhone
          } else {
            bulkUpdates.phone = ''
          }

          const detectedLocation =
            result.canonicalResume?.candidate?.location ||
            result.canonicalResume?.location ||
            result.analysis?.candidateSnapshot?.location ||
            ''
          if (detectedLocation) {
            bulkUpdates.location = detectedLocation
          }

          if (Object.keys(bulkUpdates).length > 0) {
            useAppStore.getState().setBulkFormData(bulkUpdates)
          }

          trackAnalytics({
            currentPhase: 'assessment',
            currentStep: '1',
            abandonedDraft: {
              resumeFilename: file.name,
              name: detectedName || '',
              email: detectedEmail || '',
              phone: bulkUpdates.phone || '',
              linkedin: detectedLinkedin || '',
              targetRole: bulkUpdates.targetRole || mostRecentRole || '',
            },
          })

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
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current)
          progressTimerRef.current = null
        }
        setUploadProgress(0)
        if (err.name === 'CanceledError' || err.name === 'AbortError') return
        console.warn('[FileUpload] Background resume analysis warning:', err.message)
        const friendlyMsg = err.response?.data?.message || err.message || getFriendlyErrorMessage(err, 'Background analysis failed.')
        setFileError(friendlyMsg)
        setResumeAnalysis({
          status: 'error',
          filename: file.name,
          error: friendlyMsg,
          code: err.code || err.response?.data?.code || 'NOT_A_RESUME',
          data: null,
        })
        // Clear any auto-populated data from this invalid file
        useAppStore.getState().setBulkFormData({
          name: '',
          fullName: '',
          email: '',
          location: '',
          linkedin: '',
          linkedinData: null,
          targetRole: '',
          phone: '',
        })
        showToast(friendlyMsg, 'error')
      }
    },
    [formData, setResumeAnalysis]
  )

  const validateAndSet = useCallback(
    async (file) => {
      if (!file) return
      const maxBytes = (step?.maxSizeMB || 5) * 1024 * 1024
      if (file.size > maxBytes) {
        const msg = `File too large. Maximum size is ${step?.maxSizeMB || 5}MB.`
        setFileError(msg)
        showToast(msg, 'error')
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
        const msg = 'Please upload a PDF or DOCX Word document.'
        setFileError(msg)
        showToast(msg, 'error')
        return
      }

      setFileError('')
      onChange(file)
      useAppStore.getState().setResumeFile(file)
      if (typeof window !== 'undefined') {
        window.__uploadedResumeFile = file
      }

      // 1. Clear all previous candidate session storage entries immediately when a new file is selected
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('craftureResumeReport')
        sessionStorage.removeItem('craftureLinkedinScrape')
      }
      if (typeof window !== 'undefined') {
        window.__linkedinScrapeInProgress = null
        window.__linkedinScrapePromise = null
      }

      // 2. Reset the store state to ensure no previous candidate metadata is sent
      useAppStore.getState().setResumeAnalysis({
        status: 'idle',
        data: null,
        error: null,
        filename: file.name,
      })
      useAppStore.getState().setBulkFormData({
        name: '',
        fullName: '',
        email: '',
        location: '',
        linkedin: '',
        linkedinData: null,
        targetRole: '',
        phone: '',
      })

      // 2. Client-side instant scan for LinkedIn URL & Phone
      let fastLinkedIn = ''
      let fastPhone = ''
      try {
        const fastInfo = await fastScanResumeFile(file)
        if (fastInfo.linkedin) {
          fastLinkedIn = fastInfo.linkedin
          useAppStore.getState().setFormData('linkedin', fastLinkedIn)
          if (typeof window !== 'undefined') {
            if (window.__linkedinScrapeInProgress !== fastLinkedIn && !window.__linkedinScrapePromise) {
              window.__linkedinScrapeInProgress = fastLinkedIn
              window.__linkedinScrapePromise = api.scrapeLinkedInProfile(fastLinkedIn).then((res) => {
                window.__linkedinScrapeInProgress = null
                if (res?.profile) {
                  useAppStore.getState().setFormData('linkedinData', res.profile)
                  try {
                    sessionStorage.setItem('craftureLinkedinScrape', JSON.stringify(res.profile))
                  } catch (_e) {}
                }
                return res?.profile || null
              }).catch(() => {
                window.__linkedinScrapeInProgress = null
                return null
              })
            }
          }
        }
        if (fastInfo.phone) {
          fastPhone = fastInfo.phone
          useAppStore.getState().setFormData('phone', fastPhone)
        }
      } catch (scanErr) {
        console.warn('[FileUpload] Fast client scan error:', scanErr.message)
      }

      startBackgroundAnalysis(file, fastLinkedIn, fastPhone)
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

  const isAnalyzing = resumeAnalysis?.status === 'analyzing'
  const isError = !isAnalyzing && Boolean(fileError || (resumeAnalysis?.status === 'error' && resumeAnalysis?.error))
  const stageText = getStageText(uploadProgress)
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, uploadProgress)) / 100)

  return (
    <div className="space-y-3">
      <label
        htmlFor={`file-input-${step?.id || 'resume'}`}
        className={`file-drop block ${dragOver ? 'drag-over' : ''} ${
          isAnalyzing
            ? 'border-solid border-[#15803D]/60 dark:border-emerald-500/50 bg-emerald-50/20 dark:bg-[#0B1711]'
            : hasFile && !isError
            ? 'uploaded'
            : ''
        } ${isError ? 'border-red-500/50 bg-red-500/5' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!isAnalyzing) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{ cursor: isAnalyzing ? 'default' : 'pointer' }}
      >
        <input
          id={`file-input-${step?.id || 'resume'}`}
          type="file"
          accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleInput}
          disabled={isAnalyzing}
          className="sr-only"
        />

        <AnimatePresence mode="wait">
          {isAnalyzing ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center gap-3 py-1"
            >
              {/* Centered Forest Green Progress Ring */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 108 108" className="w-28 h-28 sm:w-32 sm:h-32 -rotate-90">
                  <circle
                    cx="54"
                    cy="54"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    className="text-slate-200/90 dark:text-[#102118]"
                  />
                  <circle
                    cx="54"
                    cy="54"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="#15803D"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 280ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                    className="dark:stroke-emerald-400"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-[#F0FDF4] tracking-tight">
                    {uploadProgress}%
                  </span>
                </div>
              </div>

              {/* Stage Description & File Info */}
              <div className="text-center space-y-1.5 px-4 w-full max-w-xs sm:max-w-sm">
                <p className="font-semibold text-xs sm:text-sm text-[#15803D] dark:text-emerald-400 flex items-center justify-center gap-1.5 min-h-[20px]">
                  {uploadProgress === 100 ? (
                    <CheckCircle size={16} weight="fill" className="text-[#15803D] dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Sparkle size={15} weight="fill" className="animate-spin text-[#15803D] dark:text-emerald-400 shrink-0" />
                  )}
                  <span className="truncate">{stageText}</span>
                </p>
                <p className="text-xs text-[var(--text-muted)] dark:text-[#94B4A2] font-medium truncate">
                  {fileName} {fileSize > 0 ? `· ${(fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
                </p>

                {/* Crisp horizontal progress bar */}
                <div className="w-full h-1.5 bg-slate-200/80 dark:bg-[#102118] rounded-full overflow-hidden border border-slate-200/60 dark:border-[#1B3326] mt-2.5">
                  <div
                    className="h-full bg-[#15803D] dark:bg-emerald-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </motion.div>
          ) : hasFile ? (
            <motion.div
              key="uploaded"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-3"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform hover:scale-105"
                style={{
                  background: isError ? 'rgba(239,68,68,0.12)' : 'rgba(21,128,61,0.12)',
                  color: isError ? '#ef4444' : '#15803D',
                }}
              >
                {isError ? (
                  <WarningCircle size={28} weight="fill" />
                ) : isDocx ? (
                  <FileDoc size={28} weight="fill" />
                ) : (
                  <FilePdf size={28} weight="fill" />
                )}
              </div>
              <div className="text-center">
                <p
                  className="font-medium text-sm flex items-center justify-center gap-1.5"
                  style={{ color: isError ? '#ef4444' : '#15803D' }}
                >
                  {isError ? <WarningCircle size={16} weight="fill" /> : <CheckCircle size={16} weight="fill" className="text-[#15803D] dark:text-emerald-400" />}
                  <span className="font-semibold text-slate-900 dark:text-[#F0FDF4]">{fileName}</span>
                </p>
                <p className="text-xs mt-1 text-[var(--text-muted)] dark:text-[#94B4A2]">
                  {isError ? 'Invalid document · Click or drop to replace' : `${(fileSize / 1024 / 1024).toFixed(2)} MB · Click or drop to replace`}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                  <span style={{ color: 'var(--primary)' }} className="underline font-semibold">
                    browse
                  </span>
                </p>
                <p className="text-xs mt-1 text-[var(--text-muted)]">Max 5MB · Text-based PDF or Word docx preferred</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </label>

      {/* Real-time background analysis indicator */}
      {hasFile && isAnalyzing && !isError && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 animate-pulse">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkle size={14} weight="fill" className="animate-spin shrink-0 text-[#15803D] dark:text-emerald-400" />
            <span className="truncate font-medium">{stageText}</span>
          </div>
          <span className="text-xs font-mono font-bold tabular-nums shrink-0 ml-2 text-[#15803D] dark:text-emerald-400">
            {uploadProgress}%
          </span>
        </div>
      )}

      {hasFile && resumeAnalysis?.status === 'completed' && !isError && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} weight="fill" className="shrink-0 text-[#15803D] dark:text-emerald-400" />
            <span className="font-medium">Resume calibrated: Contact & last experience role auto-detected</span>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-[#15803D] dark:text-emerald-300">
            100% Ready
          </span>
        </div>
      )}

      {/* Prominent WCAG AA Inline Error Alert Banner */}
      {isError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs leading-relaxed"
        >
          <WarningCircle size={18} weight="fill" className="shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-700 dark:text-red-300">
              {resumeAnalysis?.code === 'SCANNED_OR_EMPTY_FILE' ? 'Scanned or Empty Document' : 'Invalid Resume Document'}
            </p>
            <p className="mt-0.5 text-red-600 dark:text-red-400">
              {fileError || resumeAnalysis?.error || error}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
