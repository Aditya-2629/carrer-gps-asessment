import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadSimple, FileDoc, FilePdf, CheckCircle, WarningCircle, Sparkle } from '@phosphor-icons/react'
import useAppStore, { showToast } from '../../store/useAppStore'
import { api } from '../../lib/api'
import { normalizeLinkedInUrl } from '../../lib/linkedinUrlUtils'
import { getFriendlyErrorMessage } from '../../lib/errorMessages'
import { fastScanResumeFile } from '../../lib/fastResumeScanner'

export default function FileUpload({ value, onChange, error, step, onNext }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')
  const { formData, resumeAnalysis, setResumeAnalysis } = useAppStore()

  const startBackgroundAnalysis = useCallback(
    async (file, fastLinkedIn = '', fastPhone = '') => {
      if (!file) return

      setResumeAnalysis({
        status: 'analyzing',
        filename: file.name,
        error: null,
        data: null,
      })

      try {
        const result = await api.parseResumeDeterministic(file)

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

  const isError = Boolean(fileError || error || resumeAnalysis?.status === 'error')

  return (
    <div className="space-y-3">
      <label
        htmlFor={`file-input-${step?.id || 'resume'}`}
        className={`file-drop block ${dragOver ? 'drag-over' : ''} ${hasFile && !isError ? 'uploaded' : ''} ${isError ? 'border-red-500/50 bg-red-500/5' : ''}`}
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
                style={{
                  background: isError ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                  color: isError ? '#ef4444' : '#10b981',
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
                  style={{ color: isError ? '#ef4444' : '#10b981' }}
                >
                  {isError ? <WarningCircle size={16} weight="fill" /> : <CheckCircle size={16} weight="fill" />}
                  <span className="font-semibold">{fileName}</span>
                </p>
                <p className="text-xs mt-1 text-[var(--text-muted)]">
                  {isError ? 'Invalid document · Click or drop to replace' : `${(fileSize / 1024 / 1024).toFixed(2)} MB · Click or drop to replace`}
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
      {hasFile && resumeAnalysis?.status === 'analyzing' && !isError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 animate-pulse">
          <Sparkle size={14} weight="fill" className="animate-spin shrink-0" />
          <span>Extracting tech stack, experience roles & contact information...</span>
        </div>
      )}

      {hasFile && resumeAnalysis?.status === 'completed' && !isError && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} weight="fill" className="shrink-0" />
            <span>Resume calibrated: Contact & last experience role auto-detected</span>
          </div>
          <span className="text-[10px] font-mono opacity-80">Ready</span>
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
