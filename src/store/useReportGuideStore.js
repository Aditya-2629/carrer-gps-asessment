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
  listening: { shell: '#F43F5E', bulb: '#FFF1F2', lamp: '#F43F5E', ring: '#FB7185' },
  inspect: { shell: '#F59E0B', bulb: '#FFFBEB', lamp: '#F59E0B', ring: '#FBBF24' },
  thinking: { shell: '#F59E0B', bulb: '#FFFBEB', lamp: '#F59E0B', ring: '#FBBF24' },
  coach: { shell: '#7C3AED', bulb: '#F5F3FF', lamp: '#7C3AED', ring: '#A78BFA' },
  victory: { shell: '#10B981', bulb: '#ECFDF5', lamp: '#10B981', ring: '#34D399' },
  celebrating: { shell: '#10B981', bulb: '#ECFDF5', lamp: '#10B981', ring: '#34D399' },
  move: { shell: '#38BDF8', bulb: '#F0F9FF', lamp: '#38BDF8', ring: '#7DD3FC' },
}

// Mapping our emotions to Wobnimo MascotState
export const EMOTION_TO_WOBNIMO = {
  idle: 'idle',
  alert: 'error',
  listening: 'listening',
  inspect: 'thinking',
  thinking: 'thinking',
  coach: 'speaking',
  victory: 'celebrating',
  celebrating: 'celebrating',
  move: 'working',
}

export const SECTION_INSIGHTS = {
  'overview-pulse': {
    id: 'overview-pulse',
    name: 'Overview & Pulse',
    chip: 'Executive Pulse',
    problem: 'Screening drop-off at 86%: resume signals are stalling recruiter conversion.',
    solution: 'Targeted 5-part bullet tuning projected to unlock a 2.4x callback rate.',
    emotion: 'alert',
    chatPrompt: 'Analyze my Executive Pulse and tell me why recruiters are dropping off at screening.',
  },
  'overview-bottleneck': {
    id: 'overview-bottleneck',
    name: 'Primary Bottleneck',
    chip: 'Core Bottleneck',
    problem: 'Stalled at Phase 2: applications get viewed but fail to convert to technical panels.',
    solution: 'Calibrate STAR metrics and sharpen senior role positioning across all channels.',
    emotion: 'alert',
    chatPrompt: 'What is my single highest leverage fix to unblock technical interviews this week?',
  },
  'resume-scorecard': {
    id: 'resume-scorecard',
    name: 'Resume Lab',
    chip: 'ATS Scorecard',
    problem: 'Quantification and Impact score lag behind top 10% benchmark engineering resumes.',
    solution: 'Restructure bullets using the 5-Part formula with verifiable business metrics.',
    emotion: 'inspect',
    chatPrompt: 'Break down my 6 Resume Pillars and show me which ones are hurting my ATS rank.',
  },
  'resume-bullets': {
    id: 'resume-bullets',
    name: 'Paper X-Ray',
    chip: 'Line Audit',
    problem: 'Hurting bullets identified: passive phrasing, missing outcomes, and tool dumps.',
    solution: 'Adopt the 5-Part anatomy rewrites calibrated for senior engineering hiring bars.',
    emotion: 'alert',
    chatPrompt: 'Help me rewrite my weakest resume bullets using the 5-part winning formula.',
  },
  'linkedin-studio': {
    id: 'linkedin-studio',
    name: 'LinkedIn Studio',
    chip: 'Executive Narrative',
    problem: 'Current bio reads like a passive resume mirror without an executive hook.',
    solution: 'Deploy the 1,600-character story-driven About narrative crafted for decision-makers.',
    emotion: 'coach',
    chatPrompt: 'How can I optimize my LinkedIn profile to attract executive recruiters and direct outreach?',
  },
  'funnel-leak': {
    id: 'funnel-leak',
    name: 'Funnel & Risks',
    chip: 'Pipeline Leak',
    problem: 'Critical Phase 3 leak: candidate loses 86% of pipeline at technical screens.',
    solution: 'Simulate callback lift and apply structured system design frameworks to reach 40%+.',
    emotion: 'alert',
    chatPrompt: 'Walk me through my funnel leak and show me how to prepare for technical interview rounds.',
  },
  'sprint-roadmap': {
    id: 'sprint-roadmap',
    name: '7-Day Sprint',
    chip: 'Action Sprint',
    problem: 'Unstructured job hunting averages 6–9 months with unpredictable conversion.',
    solution: 'Execute high-impact daily missions in order to generate interview momentum.',
    emotion: 'victory',
    chatPrompt: 'What are my top 3 high-impact missions to complete today from the 7-day sprint?',
  },
}

let settleTimer = null

export const useReportGuideStore = create((set, get) => ({
  emotion: 'idle',
  mode: 'problem',
  headline: 'Executive Diagnostic Workspace Ready',
  metricChip: 'System Calibrated',
  activeNodeId: 'overview-pulse',
  palette: EMOTION_PALETTES.idle,

  // Chatbot integration
  isChatOpen: false,
  chatInitialPrompt: '',

  setMode: (mode) => {
    const isSolution = mode === 'solution'
    const currentSection = SECTION_INSIGHTS[get().activeNodeId] || SECTION_INSIGHTS['overview-pulse']
    const headline = isSolution ? currentSection.solution : currentSection.problem
    const emotion = isSolution ? 'coach' : currentSection.emotion

    get().triggerGuide({
      nodeId: get().activeNodeId,
      emotion,
      headline,
      metricChip: currentSection.chip,
      autoSettleMs: 4000,
    })
    set({ mode })
  },

  toggleMode: () => {
    const nextMode = get().mode === 'problem' ? 'solution' : 'problem'
    get().setMode(nextMode)
  },

  setEmotion: (emotion) => {
    const palette = EMOTION_PALETTES[emotion] || EMOTION_PALETTES.idle
    set({ emotion, palette })
  },

  setActiveSection: (sectionId) => {
    const section = SECTION_INSIGHTS[sectionId]
    if (!section) return
    const mode = get().mode
    const headline = mode === 'solution' ? section.solution : section.problem

    get().triggerGuide({
      nodeId: sectionId,
      emotion: mode === 'solution' ? 'coach' : section.emotion,
      headline,
      metricChip: section.chip,
      autoSettleMs: 5000,
    })
  },

  openChat: (initialPrompt = '') => {
    set({ isChatOpen: true, chatInitialPrompt: initialPrompt })
  },

  closeChat: () => {
    set({ isChatOpen: false, chatInitialPrompt: '' })
  },

  toggleChat: () => {
    set((state) => ({ isChatOpen: !state.isChatOpen }))
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
      activeNodeId: nodeId || get().activeNodeId,
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
        activeNodeId: nodeId || get().activeNodeId,
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
}))
