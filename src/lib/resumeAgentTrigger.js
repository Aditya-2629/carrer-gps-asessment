import useAppStore from '../store/useAppStore'
import { api } from './api'

/**
 * Triggers the AI Resume Agent when the user moves forward from the LinkedIn URL assessment question.
 *
 * Requirements satisfied:
 * 1. Executes in background without blocking user progression to question 12+.
 * 2. Uses the uploaded resume File (from Zustand memory, formData, or global cache).
 * 3. Enriches Resume Agent with the candidate's verified LinkedIn URL and target role.
 * 4. Precomputes canonical resume & analysis for instant report loading.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force=false] - If true, re-runs even if already completed
 * @returns {Promise<Object|null>}
 */
export async function triggerResumeAgentFromLinkedInStep({ force = false } = {}) {
  const store = useAppStore.getState()

  // 1. Resolve resume file or text
  let file = store.resumeFile || null
  if (!file && store.formData?.resume instanceof File) {
    file = store.formData.resume
  }
  if (!file && Array.isArray(store.formData?.resume) && store.formData.resume[0] instanceof File) {
    file = store.formData.resume[0]
  }
  if (!file && typeof window !== 'undefined' && window.__uploadedResumeFile instanceof File) {
    file = window.__uploadedResumeFile
  }

  const resumeText = store.formData?.resumeText || ''

  if (!file && !resumeText) {
    console.log('[ResumeAgent] No resume file or text available to analyze at LinkedIn step.')
    return null
  }

  // 2. Check if analysis is already running or completed
  if (store.resumeAnalysis?.status === 'analyzing') {
    console.log('[ResumeAgent] Analysis is already in progress in the background.')
    return null
  }

  if (!force && store.resumeAnalysis?.status === 'completed' && store.resumeAnalysis?.data) {
    console.log('[ResumeAgent] Resume Agent evaluation already completed. Reusing cached analysis.')
    return store.resumeAnalysis.data
  }

  const filename = file?.name || 'resume.pdf'

  // 3. Mark store as analyzing in background
  store.setResumeAnalysis({
    status: 'analyzing',
    filename,
    error: null,
    data: null,
  })

  // 4. Extract context facts
  const linkedinUrl = typeof store.formData?.linkedin === 'string' ? store.formData.linkedin.trim() : ''
  const isCustomLocked = Boolean(store.formData?.isCustomTargetRoleLocked || store.formData?.customTargetRoleLocked)
  const customJd = store.formData?.targetJobDescription || store.formData?.targetJd || ''
  const targetRole = isCustomLocked
    ? (store.formData?.targetRole || store.formData?.target_role || store.formData?.role || '')
    : ''

  console.log('[ResumeAgent] Running Resume Agent upon LinkedIn step advance:', {
    filename,
    linkedinUrl,
    targetRole,
  })

  try {
    const result = await api.evaluateResume({
      file,
      resumeText,
      targetRole,
      targetJobDescription: customJd,
      linkedinUrl,
    })

    if (result && result.analysis) {
      console.log('[ResumeAgent] Resume Agent evaluation completed successfully in background!')
      useAppStore.getState().setResumeAnalysis({
        status: 'completed',
        filename,
        data: result,
        error: null,
      })

      // Dynamically populate detected profile facts if missing from user form
      const detectedName =
        result.canonicalResume?.candidate?.name ||
        result.analysis?.candidateSnapshot?.name ||
        ''
      const detectedTarget =
        result.canonicalResume?.candidate?.targetRole ||
        result.analysis?.candidateSnapshot?.targetRole ||
        ''

      const bulkUpdates = {}
      if (detectedName && !store.formData?.name && !store.formData?.fullName) {
        bulkUpdates.name = detectedName
      }
      if (detectedTarget && (!isCustomLocked || !store.formData?.targetRole)) {
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
              filename,
              analyzedAt: new Date().toISOString(),
              marketContext: result.marketContext || null,
              canonicalResume: result.canonicalResume || null,
            },
          })
        )
      } catch (_e) {}

      return result
    } else {
      throw new Error('Analysis returned incomplete payload.')
    }
  } catch (err) {
    if (err.name === 'CanceledError' || err.name === 'AbortError') return null
    console.warn('[ResumeAgent] Background analysis warning:', err.message)
    useAppStore.getState().setResumeAnalysis({
      status: 'error',
      filename,
      error: err.message || 'Background analysis failed.',
      data: null,
    })
    return null
  }
}
