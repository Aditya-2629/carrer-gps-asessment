import { create } from 'zustand'

export const GUIDE_EMOTIONS = {
  IDLE: 'idle',
  ALERT: 'alert',
  INSPECT: 'inspect',
  COACH: 'coach',
  VICTORY: 'victory',
  MOVE: 'move',
}

export const GUIDE_MODES = {
  PROBLEM: 'problem',
  SOLUTION: 'solution',
}

// Brand color tokens from src/index.css
export const EMOTION_PALETTES = {
  idle: { shell: '#6366F1', bulb: '#EEF2FF', lamp: '#6366F1', ring: '#818CF8' },
  alert: { shell: '#F43F5E', bulb: '#FFF1F2', lamp: '#F43F5E', ring: '#FB7185' },
  inspect: { shell: '#F59E0B', bulb: '#FFFBEB', lamp: '#F59E0B', ring: '#FBBF24' },
  coach: { shell: '#7C3AED', bulb: '#F5F3FF', lamp: '#7C3AED', ring: '#A78BFA' },
  victory: { shell: '#10B981', bulb: '#ECFDF5', lamp: '#10B981', ring: '#34D399' },
  move: { shell: '#38BDF8', bulb: '#F0F9FF', lamp: '#38BDF8', ring: '#7DD3FC' },
}

// Mapping our 6 emotions to Wobnimo MascotState
export const EMOTION_TO_WOBNIMO = {
  idle: 'idle',
  alert: 'error',
  inspect: 'thinking',
  coach: 'speaking',
  victory: 'celebrating',
  move: 'working',
}

let settleTimer = null

export const useReportGuideStore = create((set, get) => ({
  emotion: 'idle',
  mode: 'problem',
  headline: 'Executive Diagnostic Workspace Ready',
  metricChip: 'System Calibrated',
  activeNodeId: null,
  palette: EMOTION_PALETTES.idle,

  setMode: (mode) => {
    const isSolution = mode === 'solution'
    get().triggerGuide({
      nodeId: null,
      emotion: isSolution ? 'coach' : 'inspect',
      headline: isSolution
        ? 'Solution Mode: Prioritizing 7-day high-leverage interventions.'
        : 'Problem Mode: Auditing conversion barriers, leaks, and line diagnoses.',
      metricChip: isSolution ? 'Focus: High-Impact Recovery' : 'Focus: Root Cause Diagnosis',
      autoSettleMs: 4000,
    })
    set({ mode })
  },

  setEmotion: (emotion) => {
    const palette = EMOTION_PALETTES[emotion] || EMOTION_PALETTES.idle
    set({ emotion, palette })
  },

  triggerGuide: ({ nodeId, emotion = 'inspect', headline, metricChip, autoSettleMs = 3500 }) => {
    if (settleTimer) {
      clearTimeout(settleTimer)
      settleTimer = null
    }

    // Step 1: Brief anticipation transition
    set({
      emotion: 'move',
      palette: EMOTION_PALETTES.move,
      activeNodeId: nodeId || null,
      headline: headline || get().headline,
      metricChip: metricChip || get().metricChip,
    })

    setTimeout(() => {
      const palette = EMOTION_PALETTES[emotion] || EMOTION_PALETTES.idle
      set({
        emotion,
        palette,
        headline: headline || get().headline,
        metricChip: metricChip || get().metricChip,
        activeNodeId: nodeId || null,
      })

      if (autoSettleMs > 0 && emotion !== 'idle') {
        settleTimer = setTimeout(() => {
          set({
            emotion: 'idle',
            palette: EMOTION_PALETTES.idle,
          })
          settleTimer = null
        }, autoSettleMs)
      }
    }, 150)
  },

  resetGuide: () => {
    if (settleTimer) clearTimeout(settleTimer)
    set({
      emotion: 'idle',
      mode: 'problem',
      headline: 'Executive Diagnostic Workspace Ready',
      metricChip: 'System Calibrated',
      activeNodeId: null,
      palette: EMOTION_PALETTES.idle,
    })
  },
}))
