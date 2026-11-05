import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadSimple, FileDoc, FilePdf, CheckCircle, WarningCircle, Sparkle } from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'
import { normalizeLinkedInUrl } from '../../lib/linkedinUrlUtils'

export default function FileUpload({ value, onChange, error, step, onNext }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')
  const { formData, resumeAnalysis, setResumeAnalysis } = useAppStore()

  const startBackgroundAnalysis = useCallback(
    async (file, fastLinkedIn = '') => {
      if (!file) return

      setResumeAnalysis({
        status: 'analyzing',
        filename: file.name,
        error: null,
        data: null,
      })

      try {
        const result = await api.analyzeResumeFile(file)

        if (result && (result.analysis || result.canonicalResume)) {
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
          }
          if (detectedName && !formData.name && !formData.fullName) {
            bulkUpdates.name = detectedName
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
          // Only set phone if it contains 10-15 valid digits and is not 'N/A'
          if (rawPhone && rawPhone !== 'N/A' && cleanDigits.length >= 10) {
            bulkUpdates.phone = rawPhone
          } else {
            bulkUpdates.phone = ''
          }

          const detectedLocation =
            result.canonicalResume?.candidate?.location ||
            result.canonicalResume?.location ||
            result.analysis?.candidateSnapshot?.location ||
            ''
          if (detectedLocation && !formData.location) {
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
    async (file) => {
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

      // 1. Clear previous Phone & LinkedIn on new upload
      useAppStore.getState().setBulkFormData({ phone: '', linkedin: '', linkedinData: null })

      // 2. Client-side scan for clean LinkedIn URL
      let fastLinkedIn = ''
      try {
        const buf = await file.arrayBuffer()
        const text = new TextDecoder('latin1').decode(buf)

        const pdfUriMatch = text.match(/\/URI\s*\(([^)]*linkedin\.com\/in\/[^)]*)\)/i)
        const docxTargetMatch = text.match(/Target="([^"]*linkedin\.com\/in\/[^"]*)"/i)
        const plainMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%-]+/i)

        const candidateRaw = pdfUriMatch?.[1] || docxTargetMatch?.[1] || plainMatch?.[0] || ''
        fastLinkedIn = normalizeLinkedInUrl(candidateRaw)
        if (fastLinkedIn) {
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
      } catch (scanErr) {
        console.warn('[FileUpload] Fast client scan error:', scanErr.message)
      }

      startBackgroundAnalysis(file, fastLinkedIn)
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
      {hasFile && resumeAnalysis?.status === 'analyzing' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 animate-pulse">
          <Sparkle size={14} weight="fill" className="animate-spin shrink-0" />
          <span>Extracting tech stack, experience roles & contact information...</span>
        </div>
      )}

      {hasFile && resumeAnalysis?.status === 'completed' && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} weight="fill" className="shrink-0" />
            <span>Resume calibrated: Contact & last experience role auto-detected</span>
          </div>
          <span className="text-[10px] font-mono opacity-80">Ready</span>
        </div>
      )}

      {(fileError || error) && (
        <p className="field-error flex items-center gap-1.5">
          <WarningCircle size={14} weight="fill" />
          <span>{fileError || error}</span>
        </p>
      )}
    </div>
  )
}
