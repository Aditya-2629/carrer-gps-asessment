import { create } from 'zustand'

export const GUIDE_EMOTIONS = {
  IDLE: 'idle',
  ALERT: 'alert',
  CONCERNED: 'concerned',
  INSPECT: 'inspect',
  THINKING: 'thinking',
  CURIOUS: 'curious',
  COACH: 'coach',
  PROUD: 'proud',
  HAPPY: 'happy',
  VICTORY: 'victory',
  CTA: 'cta',
  MOVE: 'move',
}

export const GUIDE_MODES = {
  PROBLEM: 'problem',
  SOLUTION: 'solution',
}

// Brand color tokens
export const EMOTION_PALETTES = {
  idle: { shell: '#15803D', bulb: '#F0FDF4', lamp: '#15803D', ring: '#22C55E' },
  alert: { shell: '#F43F5E', bulb: '#FFF1F2', lamp: '#F43F5E', ring: '#FB7185' },
  concerned: { shell: '#F43F5E', bulb: '#FFF1F2', lamp: '#F43F5E', ring: '#FB7185' },
  surprised: { shell: '#F43F5E', bulb: '#FFF1F2', lamp: '#F43F5E', ring: '#FB7185' },
  listening: { shell: '#F43F5E', bulb: '#FFF1F2', lamp: '#F43F5E', ring: '#FB7185' },
  inspect: { shell: '#F59E0B', bulb: '#FFFBEB', lamp: '#F59E0B', ring: '#FBBF24' },
  thinking: { shell: '#15803D', bulb: '#F0FDF4', lamp: '#15803D', ring: '#22C55E' },
  curious: { shell: '#0D9488', bulb: '#F0FDFA', lamp: '#0D9488', ring: '#14B8A6' },
  coach: { shell: '#15803D', bulb: '#F0FDF4', lamp: '#15803D', ring: '#22C55E' },
  speaking: { shell: '#15803D', bulb: '#F0FDF4', lamp: '#15803D', ring: '#22C55E' },
  proud: { shell: '#10B981', bulb: '#ECFDF5', lamp: '#10B981', ring: '#34D399' },
  happy: { shell: '#10B981', bulb: '#ECFDF5', lamp: '#10B981', ring: '#34D399' },
  victory: { shell: '#10B981', bulb: '#ECFDF5', lamp: '#10B981', ring: '#34D399' },
  celebrating: { shell: '#10B981', bulb: '#ECFDF5', lamp: '#10B981', ring: '#34D399' },
  cta: { shell: '#15803D', bulb: '#F0FDF4', lamp: '#15803D', ring: '#22C55E' },
  sleep: { shell: '#64748B', bulb: '#F1F5F9', lamp: '#64748B', ring: '#94A3B8' },
  sleeping: { shell: '#64748B', bulb: '#F1F5F9', lamp: '#64748B', ring: '#94A3B8' },
  move: { shell: '#38BDF8', bulb: '#F0F9FF', lamp: '#38BDF8', ring: '#7DD3FC' },
}

// Mapping emotions to Wobnimo MascotState
export const EMOTION_TO_WOBNIMO = {
  idle: 'idle',
  alert: 'error',
  concerned: 'listening',
  listening: 'listening',
  inspect: 'thinking',
  thinking: 'thinking',
  curious: 'thinking',
  surprised: 'surprised',
  coach: 'speaking',
  speaking: 'speaking',
  proud: 'celebrating',
  happy: 'celebrating',
  victory: 'celebrating',
  celebrating: 'celebrating',
  sleep: 'sleeping',
  sleeping: 'sleeping',
  cta: 'celebrating',
  move: 'working',
}

export const INITIAL_SECTION_INSIGHTS = {
  // Tab 1: Overview & Action Plan
  'overview-pulse': {
    id: 'overview-pulse',
    name: 'Overview & Pulse',
    chip: 'Executive Pulse',
    category: 'pulse',
    problem: 'Screening conversion lags behind top-decile candidate benchmarks.',
    solution: 'Targeted bullet tuning and ATS alignment projected to lift callbacks by 2.4x.',
    thought: 'Career Health Telemetry calibrated. Reviewing 6 core hiring axes.',
    emotion: 'speaking',
    chatPrompt: 'Analyze my Executive Pulse and tell me why recruiters are dropping off at screening.',
  },
  'overview-bottleneck': {
    id: 'overview-bottleneck',
    name: 'Primary Bottleneck',
    chip: 'Root Bottleneck',
    category: 'alert',
    problem: 'Pipeline stalls at screening: applications get viewed but fail to advance to technical loops.',
    solution: 'Re-align positioning and inject verified CAR metrics to clear automated screening filters.',
    thought: 'Critical root bottleneck detected. Resolving this unlocks your interview conversion.',
    emotion: 'alert',
    chatPrompt: 'What is my single highest leverage fix to unblock technical interviews this week?',
  },
  'top-priorities': {
    id: 'top-priorities',
    name: 'Top Priorities',
    chip: 'Top Priorities',
    category: 'thinking',
    problem: 'Foundational execution blockers are stalling outbound momentum.',
    solution: 'Execute top 3 high-ROI actions first to generate immediate recruiter callbacks.',
    thought: 'Tackle Priority #1 first: restructuring top bullets yields highest immediate callback ROI.',
    emotion: 'coach',
    chatPrompt: 'Which of my top priorities should I execute first today?',
  },
  'funnel-leak': {
    id: 'funnel-leak',
    name: 'Funnel & Conversion',
    chip: 'Funnel Economics',
    category: 'alert',
    problem: 'High application volume yielding low callback velocity.',
    solution: 'Calibrating ATS keywords and direct manager outreach lifts callbacks above 5.0%.',
    thought: 'Pipeline conversion leak detected: optimize top-of-funnel conversion to reach benchmark velocity.',
    emotion: 'alert',
    chatPrompt: 'Walk me through my funnel leak and show me how to prepare for technical interview rounds.',
  },
  'sprint-roadmap': {
    id: 'sprint-roadmap',
    name: 'Action Roadmap',
    chip: 'Action Roadmap',
    category: 'thinking',
    problem: 'Ad-hoc job hunting without compounding milestones extends search duration.',
    solution: 'Follow the 7-day quick plan and 30/60/90 pathway for systematic offer conversion.',
    thought: 'Action Roadmap: structured 7-day sprints turn tactical fixes into compounding interview momentum.',
    emotion: 'thinking',
    chatPrompt: 'What are my top high-leverage milestones to execute first from the action plan?',
  },
  'next-action': {
    id: 'next-action',
    name: 'Strategy Session',
    chip: 'Execution Bridge',
    category: 'cta',
    problem: 'Self-directed job searching takes 6–9 months without live recruiter calibration.',
    solution: 'Work directly 1-on-1 with an executive coach to overhaul your positioning live.',
    thought: 'Ready to break your pipeline deadlock? Work live 1-on-1 with an executive coach.',
    emotion: 'coach',
    chatPrompt: 'How does the 1-on-1 Strategy Session help me unblock my interviews?',
  },

  // Tab 2: Resume Lab
  'resume-scorecard': {
    id: 'resume-scorecard',
    name: 'Resume Lab',
    chip: 'ATS Scorecard',
    category: 'thinking',
    problem: 'Impact metrics and quantification score lag behind top 10% benchmark engineering resumes.',
    solution: 'Restructure achievement density using verified CAR metrics to reach 90+ ATS score.',
    thought: 'Inspecting 6 Resume Pillars: quantifying achievements lifts your ATS ranking into the top quartile.',
    emotion: 'thinking',
    chatPrompt: 'Break down my 6 Resume Pillars and show me which ones are hurting my ATS rank.',
  },
  'resume-audit': {
    id: 'resume-audit',
    name: 'Section Audit',
    chip: 'Section Audit',
    category: 'thinking',
    problem: 'Core resume sections lack quantified achievement density and business outcomes.',
    solution: 'Apply the required section improvements to elevate every section above 8/10.',
    thought: 'Section breakdown: experience clarity and metric visibility need immediate tuning.',
    emotion: 'thinking',
    chatPrompt: 'Show me what is hurting in my resume sections.',
  },
  'resume-summary': {
    id: 'resume-summary',
    name: 'Summary Rewrite',
    chip: 'Summary Rewrite',
    category: 'curious',
    problem: 'Original summary lacks target role keywords and 6-second hook metrics.',
    solution: 'Deploy the pre-engineered executive summary rewrite anchored on your target role.',
    thought: 'Executive summary rewrite ready: copy and paste to instantly anchor your target level.',
    emotion: 'coach',
    chatPrompt: 'How does this summary rewrite help my recruiter scan velocity?',
  },
  'resume-keywords': {
    id: 'resume-keywords',
    name: 'Keyword Alignment',
    chip: 'Keyword Match',
    category: 'thinking',
    problem: 'Critical market tech tools are missing from your resume text.',
    solution: 'Weave missing keywords into both skills bank and experience achievement bullets.',
    thought: 'Keyword match analysis: adding verified critical skills eliminates ATS drop-offs.',
    emotion: 'thinking',
    chatPrompt: 'Which missing keywords should I weave into my experience bullets first?',
  },
  'resume-bullets': {
    id: 'resume-bullets',
    name: 'Paper X-Ray',
    chip: 'Line Audit',
    category: 'curious',
    problem: 'Hurting bullets identified: passive phrasing, missing outcomes, and tool dumps.',
    solution: 'Adopt the 5-Part anatomy rewrites calibrated for senior engineering hiring bars.',
    thought: 'Line-by-line audit: 5-part winning rewrites turn passive duties into proven business outcomes.',
    emotion: 'thinking',
    chatPrompt: 'Help me rewrite my weakest resume bullets using the 5-part winning formula.',
  },
  'resume-defense': {
    id: 'resume-defense',
    name: 'Interview Defense',
    chip: 'Interview Defense',
    category: 'thinking',
    problem: 'Skills listed without project proof risk candidate failure during deep technical loops.',
    solution: 'Use the STAR defense blueprint to prepare concrete architecture trade-offs.',
    thought: 'Interview defense ledger: prepare your architectural talk tracks before hiring manager rounds.',
    emotion: 'coach',
    chatPrompt: 'How do I defend skills that are on my resume but not in my bullets?',
  },

  // Tab 3: LinkedIn Studio
  'linkedin-scorecard': {
    id: 'linkedin-scorecard',
    name: 'LinkedIn Scorecard',
    chip: 'LinkedIn SEO',
    category: 'thinking',
    problem: 'Recruiter search discoverability is limited by missing indexing keywords.',
    solution: 'Deploy proof-first headline, 4-pillar narrative, and top 3 pinned skills to hit All-Star.',
    thought: 'LinkedIn profile scored. Let us optimize your inbound recruiter discovery.',
    emotion: 'thinking',
    chatPrompt: 'How can I optimize my LinkedIn profile to attract executive recruiters and direct outreach?',
  },
  'linkedin-audit': {
    id: 'linkedin-audit',
    name: 'Profile Audit',
    chip: 'Profile Audit',
    category: 'thinking',
    problem: 'Headline positioning and activity cadence fall below recruiter engagement bars.',
    solution: 'Address What is Hurting items across the 5 core sections to maximize recruiter glance value.',
    thought: 'Auditing 5 LinkedIn sections: headline SEO and network activity need the biggest lift.',
    emotion: 'thinking',
    chatPrompt: 'What are the main issues hurting my LinkedIn profile search ranking?',
  },
  'linkedin-headlines': {
    id: 'linkedin-headlines',
    name: 'Headlines Studio',
    chip: 'Headline SEO',
    category: 'proud',
    problem: 'Generic job titles give recruiters zero search keywords or proof metrics.',
    solution: 'Copy one of 3 pre-engineered 15–20 word formulas to triple inbound search clicks.',
    thought: '3 recruiter-searchable headlines calibrated for your target role. One-click copy ready.',
    emotion: 'coach',
    chatPrompt: 'Which headline formula works best for my experience level?',
  },
  'linkedin-about': {
    id: 'linkedin-about',
    name: 'About Narrative',
    chip: 'Story Narrative',
    category: 'proud',
    problem: 'Standard bio reads like a dry resume duplicate instead of an executive narrative.',
    solution: 'Deploy the 4-part Story Architecture (Hook, Audience, Methodology, Closing CTA).',
    thought: 'Executive 4-part narrative: communicates business outcomes to decision-makers within 8 seconds.',
    emotion: 'speaking',
    chatPrompt: 'Help me refine my LinkedIn About story.',
  },
  'linkedin-skills': {
    id: 'linkedin-skills',
    name: 'Skills Bank',
    chip: 'Skills SEO Bank',
    category: 'thinking',
    problem: 'Missing top pinned recruiter anchors reduces semantic search matching in LinkedIn Recruiter.',
    solution: 'Pin top 3 core skills and populate all 50 slots using verified market keywords.',
    thought: 'Pin your top 3 core technical skills to anchor your profile on recruiter search cards.',
    emotion: 'thinking',
    chatPrompt: 'What are the best 3 skills to pin on my LinkedIn profile?',
  },
  'linkedin-crafture-network': {
    id: 'linkedin-crafture-network',
    name: 'Crafture Network',
    chip: 'Crafture Network',
    category: 'proud',
    problem: 'Dormant activity decay reduces profile impressions to hiring managers by up to 75%.',
    solution: 'Activate Crafture Network to safely automate daily connection and networking limits.',
    thought: 'Crafture Network automated networking: stay active on recruiter feeds without manual burnout.',
    emotion: 'coach',
    chatPrompt: 'How does Crafture Network safely automate my LinkedIn networking?',
  },
}

export let SECTION_INSIGHTS = { ...INITIAL_SECTION_INSIGHTS }

// Aliases for backward compatibility
SECTION_INSIGHTS['overview'] = SECTION_INSIGHTS['overview-pulse']
SECTION_INSIGHTS['bottleneck'] = SECTION_INSIGHTS['overview-bottleneck']
SECTION_INSIGHTS['priorities'] = SECTION_INSIGHTS['top-priorities']
SECTION_INSIGHTS['funnel'] = SECTION_INSIGHTS['funnel-leak']
SECTION_INSIGHTS['roadmap'] = SECTION_INSIGHTS['sprint-roadmap']
SECTION_INSIGHTS['action-sprint'] = SECTION_INSIGHTS['sprint-roadmap']
SECTION_INSIGHTS['resume'] = SECTION_INSIGHTS['resume-scorecard']
SECTION_INSIGHTS['resume-ai'] = SECTION_INSIGHTS['resume-scorecard']
SECTION_INSIGHTS['linkedin'] = SECTION_INSIGHTS['linkedin-scorecard']
SECTION_INSIGHTS['linkedin-studio'] = SECTION_INSIGHTS['linkedin-scorecard']
SECTION_INSIGHTS['linkedin-ai'] = SECTION_INSIGHTS['linkedin-scorecard']

let settleTimer = null

export const useReportGuideStore = create((set, get) => ({
  emotion: 'idle',
  mode: 'problem',
  headline: 'Executive Diagnostic Workspace Ready',
  metricChip: 'System Calibrated',
  activeNodeId: 'overview-pulse',
  palette: EMOTION_PALETTES.idle,
  insights: { ...SECTION_INSIGHTS },

  isChatOpen: false,
  chatInitialPrompt: '',

  hydrateDynamicInsights: (reportData) => {
    if (!reportData) return

    const overallScore =
      reportData?.heroScore?.overall ??
      reportData?.career_health_score?.overall ??
      (typeof reportData?.career_health_score === 'number' ? reportData.career_health_score : null) ??
      reportData?.score ??
      74

    const phaseId = reportData?.phase?.id || reportData?.career_journey?.current_phase_id || 1
    const phaseTitle = reportData?.phase?.shortName || reportData?.phase?.name || `Phase ${phaseId}`
    const bottleneckTitle = reportData?.primary_bottleneck?.title || 'Screening Conversion Velocity'

    const answers = reportData?.user_answers || reportData?.answers || {}
    const funnelStages = reportData?.funnel_stages || {}
    const totalAppsMonthly = Number(answers.apps30d || answers.applications_count || funnelStages.applications30d || funnelStages.applications_count || 45)
    const screens = Number(funnelStages.recruiterScreens ?? 4)
    const screenRate = totalAppsMonthly > 0 ? ((screens / totalAppsMonthly) * 100).toFixed(1) : '8.8'

    const resumeScore = reportData?.resume_agent?.dashboard?.score || reportData?.score_breakdown?.resume?.score || 72
    const bullets = reportData?.resume_agent?.dashboard?.bulletAudit || reportData?.resume_agent?.bulletRewrites || []
    const weakBulletsCount = bullets.filter((b) => b?.verdict === 'hurting' || b?.status === 'fail' || b?.status === 'warn' || (typeof b?.impactScore === 'number' && b.impactScore < 75)).length || 4

    const kw = reportData?.resume_agent?.dashboard?.keywordAlignment || reportData?.resume_agent?.keywordAlignment || {}
    const missingSkillsCount = Array.isArray(kw.criticalMissing) ? kw.criticalMissing.length : 4
    const matchRate = kw.matchPercent || 68

    const linkedinScore = reportData?.linkedin_agent?.score || reportData?.linkedin_agent?.dashboard?.score || reportData?.score_breakdown?.linkedin?.score || 68
    const targetRole = reportData?.resume_agent?.candidateSnapshot?.targetRole || reportData?.user_answers?.targetRole || reportData?.targetRole || 'Target Role'

    const updated = {
      ...SECTION_INSIGHTS,
      'overview-pulse': {
        ...SECTION_INSIGHTS['overview-pulse'],
        problem: `Career Health Index at ${overallScore}/100: primary drop-off occurs at ${phaseTitle}.`,
        solution: `Closing priority gaps unlocks a projected index lift to ${Math.min(96, overallScore + 18)}/100.`,
        thought: `Overall Career Index calibrated at ${overallScore}/100 for ${targetRole}.`,
      },
      'overview-bottleneck': {
        ...SECTION_INSIGHTS['overview-bottleneck'],
        problem: `Stalled at Phase ${phaseId} (${phaseTitle}): "${bottleneckTitle}".`,
        thought: `Critical root bottleneck: "${bottleneckTitle}". Resolving this unblocks your pipeline.`,
      },
      'funnel-leak': {
        ...SECTION_INSIGHTS['funnel-leak'],
        problem: `${totalAppsMonthly} monthly applications yielding only ${screenRate}% screen callback velocity.`,
        thought: `Pipeline conversion is ${screenRate}% across ${totalAppsMonthly} applications. Target is >= 5.0%.`,
      },
      'resume-scorecard': {
        ...SECTION_INSIGHTS['resume-scorecard'],
        problem: `Resume score calibrated at ${resumeScore}/100: impact metrics lag top 10% benchmark.`,
        thought: `Resume scored at ${resumeScore}/100. Single-column ATS structure verified.`,
      },
      'resume-keywords': {
        ...SECTION_INSIGHTS['resume-keywords'],
        problem: `Current keyword match is ${matchRate}%: ${missingSkillsCount} critical market tools missing.`,
        thought: `Keyword match rate is ${matchRate}%. Adding ${missingSkillsCount} critical skills eliminates ATS drop-offs.`,
      },
      'resume-bullets': {
        ...SECTION_INSIGHTS['resume-bullets'],
        problem: `${weakBulletsCount} hurting bullets detected: passive phrasing, routine duties, and zero metrics.`,
        thought: `${weakBulletsCount} hurting lines identified. Replace task descriptions with active outcome diffs.`,
      },
      'linkedin-scorecard': {
        ...SECTION_INSIGHTS['linkedin-scorecard'],
        problem: `Profile score at ${linkedinScore}/100: recruiter search discoverability is severely limited.`,
        thought: `LinkedIn profile scored at ${linkedinScore}/100. Let's optimize your inbound recruiter rank.`,
      },
      'linkedin-headlines': {
        ...SECTION_INSIGHTS['linkedin-headlines'],
        thought: `3 recruiter-searchable headlines calibrated for ${targetRole}. One-click copy ready.`,
      },
    }

    SECTION_INSIGHTS = updated
    set({ insights: updated })
  },

  setMode: (mode) => {
    const isSolution = mode === 'solution'
    const currentSection = get().insights[get().activeNodeId] || SECTION_INSIGHTS['overview-pulse']
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

  bulletFilter: 'ALL',
  setBulletFilter: (bulletFilter) => set({ bulletFilter }),

  setActiveSection: (sectionId) => {
    const section = get().insights[sectionId] || SECTION_INSIGHTS[sectionId]
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
