// ─── Zustand Global Store ───
import { create } from 'zustand'
import { saveResumeFileToStorage, getResumeFileFromStorage, clearResumeFileFromStorage } from '../lib/resumeStorage'

export const PHASES = {
  GATE: 'GATE',
  ASSESSMENT: 'ASSESSMENT',
  LOADING: 'LOADING',
  REPORT: 'REPORT',
}

export const GATE_STEPS = {
  EMAIL: 'EMAIL',
  OTP: 'OTP',
}

export const STORAGE_KEYS = {
  REPORT_DATA: 'career_gps_report_data',
  USER_ID: 'career_gps_user_id',
  EMAIL: 'career_gps_email',
  FORM_DATA: 'career_gps_form_data',
  IS_VERIFIED: 'career_gps_is_verified',
}

function loadInitialState() {
  if (typeof window === 'undefined') {
    return {
      reportData: null,
      userId: null,
      email: '',
      formData: {},
      isVerified: false,
    }
  }

  let reportData = null
  let userId = null
  let email = ''
  let formData = {}
  let isVerified = false

  try {
    const rawReport = localStorage.getItem(STORAGE_KEYS.REPORT_DATA)
    if (rawReport) {
      reportData = JSON.parse(rawReport)
    }
  } catch (e) {
    console.warn('[Store] Failed to parse stored reportData:', e)
  }

  try {
    userId = localStorage.getItem(STORAGE_KEYS.USER_ID) || null
    email = localStorage.getItem(STORAGE_KEYS.EMAIL) || ''
    isVerified = localStorage.getItem(STORAGE_KEYS.IS_VERIFIED) === 'true'
    const rawForm = localStorage.getItem(STORAGE_KEYS.FORM_DATA)
    if (rawForm) {
      formData = JSON.parse(rawForm)
    }
  } catch (e) {
    console.warn('[Store] Failed to parse stored auth/formData:', e)
  }

  return { reportData, userId, email, formData, isVerified }
}

function persistFormData(data) {
  if (typeof window === 'undefined') return
  try {
    const clean = { ...data }
    // Sanitize resume if it's a File/FileList to avoid serialization exceptions
    if (clean.resume) {
      if (clean.resume instanceof File) {
        clean.resume = { name: clean.resume.name, size: clean.resume.size, type: clean.resume.type }
      } else if (clean.resume instanceof FileList && clean.resume.length > 0) {
        clean.resume = { name: clean.resume[0].name, size: clean.resume[0].size, type: clean.resume[0].type }
      } else if (Array.isArray(clean.resume) && clean.resume.length > 0 && clean.resume[0] instanceof File) {
        clean.resume = { name: clean.resume[0].name, size: clean.resume[0].size, type: clean.resume[0].type }
      } else if (typeof clean.resume !== 'object' || clean.resume === null) {
        delete clean.resume
      }
    }
    localStorage.setItem(STORAGE_KEYS.FORM_DATA, JSON.stringify(clean))
  } catch (e) {
    console.warn('[Store] Failed to persist formData:', e)
  }
}

const initial = loadInitialState()

const useAppStore = create((set) => ({
  // Phase control
  phase: PHASES.ASSESSMENT,
  gateStep: GATE_STEPS.EMAIL,
  setPhase: (phase) => set({ phase }),
  setGateStep: (gateStep) => set({ gateStep }),

  // Auth
  email: initial.email,
  userId: initial.userId,
  isVerified: initial.isVerified,
  setEmail: (email) => {
    try {
      if (typeof window !== 'undefined') {
        if (email) localStorage.setItem(STORAGE_KEYS.EMAIL, email)
        else localStorage.removeItem(STORAGE_KEYS.EMAIL)
      }
    } catch (e) {}
    set({ email })
  },
  setUserId: (userId) => {
    try {
      if (typeof window !== 'undefined') {
        if (userId) {
          localStorage.setItem(STORAGE_KEYS.USER_ID, userId)
          localStorage.setItem(STORAGE_KEYS.IS_VERIFIED, 'true')
        } else {
          localStorage.removeItem(STORAGE_KEYS.USER_ID)
          localStorage.removeItem(STORAGE_KEYS.IS_VERIFIED)
        }
      }
    } catch (e) {}
    set({ userId, isVerified: Boolean(userId) })
  },

  // Assessment
  currentStep: 0,
  direction: 1, // 1 = forward, -1 = backward
  formData: initial.formData,
  setCurrentStep: (currentStep, direction = 1) => set({ currentStep, direction }),
  setFormData: (key, value) =>
    set((state) => {
      const nextFormData = { ...state.formData, [key]: value }
      persistFormData(nextFormData)
      const extra = {}
      if (key === 'resume') {
        const rawFile =
          value instanceof File
            ? value
            : Array.isArray(value) && value[0] instanceof File
            ? value[0]
            : null
        if (rawFile) {
          extra.resumeFile = rawFile
          if (typeof window !== 'undefined') window.__uploadedResumeFile = rawFile
          saveResumeFileToStorage(rawFile)
        }
      }
      return { formData: nextFormData, ...extra }
    }),
  setBulkFormData: (data) =>
    set((state) => {
      const nextFormData = { ...state.formData, ...data }
      persistFormData(nextFormData)
      const extra = {}
      if (data.resume) {
        const rawFile =
          data.resume instanceof File
            ? data.resume
            : Array.isArray(data.resume) && data.resume[0] instanceof File
            ? data.resume[0]
            : null
        if (rawFile) {
          extra.resumeFile = rawFile
          if (typeof window !== 'undefined') window.__uploadedResumeFile = rawFile
          saveResumeFileToStorage(rawFile)
        }
      }
      return { formData: nextFormData, ...extra }
    }),

  // Raw resume File in memory (never sanitized or cleared by localStorage JSON serialization)
  resumeFile: null,
  setResumeFile: (resumeFile) => {
    if (resumeFile instanceof File) {
      if (typeof window !== 'undefined') window.__uploadedResumeFile = resumeFile
      saveResumeFileToStorage(resumeFile)
    }
    set({ resumeFile })
  },

  // Background Resume Agent Analysis state: { status: 'idle' | 'analyzing' | 'completed' | 'error', data: null, error: null, filename: null }
  resumeAnalysis: { status: 'idle', data: null, error: null, filename: null },
  setResumeAnalysis: (update) =>
    set((state) => ({
      resumeAnalysis: typeof update === 'function' ? update(state.resumeAnalysis) : { ...state.resumeAnalysis, ...update },
    })),

  // Report
  reportData: initial.reportData,
  setReportData: (reportData) => {
    try {
      if (typeof window !== 'undefined') {
        if (reportData) {
          localStorage.setItem(STORAGE_KEYS.REPORT_DATA, JSON.stringify(reportData))
        } else {
          localStorage.removeItem(STORAGE_KEYS.REPORT_DATA)
        }
      }
    } catch (e) {
      console.warn('[Store] Failed to persist reportData:', e)
    }
    set({ reportData })
  },

  // Theme ('light' | 'dark')
  theme: 'light',
  toggleTheme: () => set((state) => {
    const next = state.theme === 'light' ? 'dark' : 'light'
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    return { theme: next }
  }),

  // Dev OTP fallback
  devOtp: '',
  setDevOtp: (devOtp) => set({ devOtp }),

  // Reset
  reset: () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.REPORT_DATA)
        localStorage.removeItem(STORAGE_KEYS.USER_ID)
        localStorage.removeItem(STORAGE_KEYS.EMAIL)
        localStorage.removeItem(STORAGE_KEYS.FORM_DATA)
        localStorage.removeItem(STORAGE_KEYS.IS_VERIFIED)
        window.__uploadedResumeFile = null
      }
      clearResumeFileFromStorage()
    } catch (e) {}
    set({
      phase: PHASES.ASSESSMENT,
      gateStep: GATE_STEPS.EMAIL,
      email: '',
      userId: null,
      isVerified: false,
      currentStep: 0,
      direction: 1,
      formData: {},
      reportData: null,
      resumeFile: null,
      resumeAnalysis: { status: 'idle', data: null, error: null, filename: null },
    })
  },
}))

if (typeof window !== 'undefined') {
  window.__useAppStore = useAppStore
  // Hydrate raw resume File from IndexedDB if memory state was cleared by refresh
  getResumeFileFromStorage().then((storedFile) => {
    if (storedFile && !useAppStore.getState().resumeFile) {
      window.__uploadedResumeFile = storedFile
      useAppStore.setState({ resumeFile: storedFile })
    }
  }).catch(() => {})
}

export default useAppStore

