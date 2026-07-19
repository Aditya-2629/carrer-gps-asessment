import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadSimple, FilePdf, CheckCircle, WarningCircle } from '@phosphor-icons/react'

export default function FileUpload({ value, onChange, error, step }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState('')

  const validateAndSet = useCallback(
    (file) => {
      if (!file) return
      const maxBytes = (step.maxSizeMB || 5) * 1024 * 1024
      if (file.size > maxBytes) {
        setFileError(`File too large. Maximum size is ${step.maxSizeMB}MB.`)
        return
      }
      const allowed = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]
      if (!allowed.includes(file.type)) {
        setFileError('Please upload a PDF or Word document.')
        return
      }
      setFileError('')
      onChange(file)
    },
    [step.maxSizeMB, onChange]
  )

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    validateAndSet(e.dataTransfer.files[0])
  }

  const handleInput = (e) => {
    validateAndSet(e.target.files[0])
  }

  const hasFile = value instanceof File

  return (
    <div>
      <label
        htmlFor={`file-input-${step.id}`}
        className={`file-drop block ${dragOver ? 'drag-over' : ''} ${hasFile ? 'uploaded' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{ cursor: 'pointer' }}
      >
        <input
          id={`file-input-${step.id}`}
          type="file"
          accept=".pdf,.doc,.docx"
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
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
              >
                <FilePdf size={28} weight="fill" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm flex items-center justify-center gap-1.5" style={{ color: '#10b981' }}>
                  <CheckCircle size={16} weight="fill" />
                  <span>{value.name}</span>
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {(value.size / 1024 / 1024).toFixed(2)} MB — Click to replace
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
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}
              >
                <UploadSimple size={28} />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Drop your resume here, or{' '}
                  <span style={{ color: '#10b981' }}>browse</span>
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  PDF or Word · Max {step.maxSizeMB}MB
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </label>

      {(fileError || error) && (
        <div className="flex items-center gap-2 mt-2 text-sm" style={{ color: '#ef4444' }} role="alert">
          <WarningCircle size={15} weight="fill" />
          <span>{fileError || error}</span>
        </div>
      )}
    </div>
  )
}

