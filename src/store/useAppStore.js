// ─── Zustand Global Store ───
import { create } from 'zustand'

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

const useAppStore = create((set) => ({
  // Phase control
  phase: PHASES.ASSESSMENT,
  gateStep: GATE_STEPS.EMAIL,
  setPhase: (phase) => set({ phase }),
  setGateStep: (gateStep) => set({ gateStep }),

  // Auth
  email: '',
  userId: null,
  isVerified: false,
  setEmail: (email) => set({ email }),
  setUserId: (userId) => set({ userId, isVerified: true }),

  // Assessment
  currentStep: 0,
  direction: 1, // 1 = forward, -1 = backward
  formData: {},
  setCurrentStep: (currentStep, direction = 1) => set({ currentStep, direction }),
  setFormData: (key, value) =>
    set((state) => ({ formData: { ...state.formData, [key]: value } })),
  setBulkFormData: (data) =>
    set((state) => ({ formData: { ...state.formData, ...data } })),

  // Report
  reportData: null,
  setReportData: (reportData) => set({ reportData }),

  // Reset
  reset: () =>
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
    }),
}))

export default useAppStore
