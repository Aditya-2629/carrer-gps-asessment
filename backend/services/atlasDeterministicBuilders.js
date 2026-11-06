/**
 * atlasDeterministicBuilders.js
 *
 * Deterministic Atlas Template Generators for Career GPS.
 *
 * Generates static and semi-static roadmap templates, 7-Day Rapid Triage Sprints,
 * gamified mission boards, and 30-60-90 day milestone pathways without LLM invocations.
 * Pure synchronous functions with zero asynchronous or network dependencies.
 */

import { classifyRoleArchetype } from '../agents/core/roleArchetypeClassifier.js'

/**
 * Normalizes topSkills input into a clean comma-separated string.
 * @param {string|Array<string|object>} skills
 * @param {string} fallback
 * @returns {string}
 */
function normalizeSkillsString(skills, fallback = 'TypeScript, Node.js, Cloud APIs') {
  if (!skills) return fallback
  if (typeof skills === 'string') {
    const trimmed = skills.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }
  if (Array.isArray(skills)) {
    const list = []
    for (const item of skills) {
      if (typeof item === 'string' && item.trim()) {
        list.push(item.trim())
      } else if (item && typeof item === 'object') {
        const name = item.name || item.skill || item.keyword
        if (typeof name === 'string' && name.trim()) list.push(name.trim())
      }
    }
    const unique = Array.from(new Set(list)).slice(0, 5)
    return unique.length > 0 ? unique.join(', ') : fallback
  }
  return fallback
}

/**
 * Extracts numeric phase ID from number or phase object.
 * @param {number|object} phase
 * @returns {number}
 */
function extractPhaseId(phase) {
  if (typeof phase === 'object' && phase !== null) {
    return Number(phase.id || 1)
  }
  const num = Number(phase)
  return isNaN(num) || num < 1 ? 1 : num
}

/**
 * Builds the Day 1 through Day 7 sprint mission objects.
 *
 * @param {number|object} detectedPhase - Phase number or phase object
 * @param {string} [targetRole='Senior Software Engineer']
 * @param {string|Array} [topSkills='TypeScript, Node.js, Cloud APIs']
 * @returns {Array<{day: string, title: string, action: string, deliverable: string}>}
 */
export function build7DayRapidTriageSprint(
  detectedPhase = 2,
  targetRole = 'Senior Software Engineer',
  topSkills = 'TypeScript, Node.js, Cloud APIs'
) {
  const phaseId = extractPhaseId(detectedPhase)
  const role = typeof targetRole === 'string' && targetRole.trim() ? targetRole.trim() : 'Software Engineer'
  const skillsStr = normalizeSkillsString(topSkills)
  const archetype = classifyRoleArchetype(role, topSkills)

  // Phase 2: Recruiter Screen Choke Point (Canonical Golden Specification)
  if (phaseId === 2) {
    return [
      {
        day: 'Day 1',
        title: '60-Second Verbal Elevator Pitch',
        action: `Script crisp narrative covering background, ${skillsStr} expertise, and recent ${archetype.pitchFocus}.`,
        deliverable: '60-Second Verbal Elevator Pitch Script',
      },
      {
        day: 'Day 2',
        title: 'Project Ownership & Scope Q&A',
        action: 'Script explicit answers defining "My individual contribution" vs. "Team scope" on top 2 projects.',
        deliverable: 'Individual Ownership & Scope Q&A Cheat Sheet',
      },
      {
        day: 'Day 3',
        title: 'Compensation & Leveling Defense',
        action: `Establish market salary baseline on Levels.fyi benchmark for ${role} to prevent screening disqualification.`,
        deliverable: 'Total Comp Range & Leveling Guardrails',
      },
      {
        day: 'Day 4',
        title: 'Recruiter Rubric Rehearsal',
        action: 'Prepare structured responses explaining career trajectory, transitions, and production impact out loud.',
        deliverable: 'Recruiter Screening Rubric Answer Matrix',
      },
      {
        day: 'Day 5',
        title: `${archetype.label} Assessment Prep`,
        action: `${archetype.dayAssessmentPrep}.`,
        deliverable: `Completed ${archetype.label} Assessment Simulation`,
      },
      {
        day: 'Day 6',
        title: 'Mock Recruiter Screen Recording',
        action: 'Record a 15-minute mock recruiter phone screen and audit verbal pacing, filler words, and narrative clarity.',
        deliverable: 'Recorded 15-Minute Mock Phone Screen',
      },
      {
        day: 'Day 7',
        title: 'Recruiter Screen Review & Callback Calibration',
        action: 'Debrief mock recording, refine narrative hooks, and finalize your outbound screening cheat sheet.',
        deliverable: 'Finalized Recruiter Screen Cheat Sheet',
      },
    ]
  }

  // Phase 1: Top of Funnel Black Hole
  if (phaseId === 1) {
    return [
      {
        day: 'Day 1',
        title: 'Document Calibration',
        action: `Rewrite top 5 resume achievement bullets in Google XYZ format with quantified business outcomes and high ${skillsStr} keyword density.`,
        deliverable: '5 Calibrated Google XYZ Impact Bullets',
      },
      {
        day: 'Day 2',
        title: 'ATS Text Ingestion Check',
        action: 'Verify single-column format parses 100% cleanly through standard ATS scanners without corrupted section headers or drop-offs.',
        deliverable: 'Clean-Text ATS Ingestion Validated File',
      },
      {
        day: 'Day 3',
        title: 'LinkedIn Recruiter SEO',
        action: `Reconstruct headline with target role keywords + ${skillsStr} + verified scale metric to match recruiter boolean searches.`,
        deliverable: '220-Char Search-Optimized LinkedIn Headline',
      },
      {
        day: 'Day 4',
        title: 'Curate 20 Target US Employers',
        action: `Curate 20 target employers (15 Tier-2 high-growth mid-market + 5 Tier-1 enterprise targets) actively hiring for ${role}.`,
        deliverable: '20-Company Target Outbound Account List',
      },
      {
        day: 'Day 5',
        title: 'Launch 5-to-1 Reverse Outbound',
        action: `Bypass public portals: Send 5 personalized 50-word direct InMails to hiring managers at target companies highlighting your ${archetype.reverseOutreachHook}.`,
        deliverable: '5 Sent Hiring Manager Reverse InMails',
      },
      {
        day: 'Day 6',
        title: 'Career Page Sourcing',
        action: `Submit 10 direct career-portal applications for ${role} bypassing high-competition Easy Apply job boards.`,
        deliverable: '10 Direct ATS Career Portal Submissions',
      },
      {
        day: 'Day 7',
        title: 'Weekly Pipeline Audit',
        action: 'Track outbound callback response rates in an outbound Kanban sheet and recalibrate role keyword variations.',
        deliverable: 'Pipeline Conversion Audit & Sourcing Sheet',
      },
    ]
  }

  // Phase 3: Technical Architecture & Live Assessment Choke Point
  if (phaseId === 3) {
    return [
      {
        day: 'Day 1',
        title: `${archetype.label} Case Study One-Pager`,
        action: `Prepare a 1-page ${archetype.portfolioArtifact} demonstrating domain depth and measurable impact.`,
        deliverable: `1-Page ${archetype.label} Portfolio Blueprint`,
      },
      {
        day: 'Day 2',
        title: 'Methodology & System Trade-Offs',
        action: `Map key trade-offs, bottlenecks, and operational limits using ${skillsStr} to defend domain choices under questioning.`,
        deliverable: 'Methodology & Trade-Off Defense Table',
      },
      {
        day: 'Day 3',
        title: 'Live Case Study & Deep Dive Drills',
        action: `Drill trade-off defense and methodology justification: "${archetype.interviewMechanism}".`,
        deliverable: 'Methodology & Trade-Off Defense Walkthrough',
      },
      {
        day: 'Day 4',
        title: 'Domain Reasoning & Verbalization Practice',
        action: 'Practice verbalizing domain reasoning and business trade-offs out loud while addressing complex scenarios.',
        deliverable: '3 Verbalized Domain Scenario Solutions',
      },
      {
        day: 'Day 5',
        title: 'Timed Assessment & Practical Simulation',
        action: `Complete 3 timed problem-solving rounds focusing on verbalizing reasoning out loud: ${archetype.dayAssessmentPrep}.`,
        deliverable: `3 Completed Live ${archetype.label} Mocks`,
      },
      {
        day: 'Day 6',
        title: 'Technical STAR Behavioral Defense',
        action: 'Structure 5 STAR stories on production roadblocks, complex trade-offs, and cross-functional leadership.',
        deliverable: '5 Technical Leadership STAR Stories',
      },
      {
        day: 'Day 7',
        title: 'Technical Defense Debrief & Post-Mortem Template',
        action: 'Audit weak technical areas and build a personal technical defense cheat sheet for upcoming rounds.',
        deliverable: 'Technical Round Post-Mortem & Review Guide',
      },
    ]
  }

  // Phase 4: Final Round & Offer Closing
  if (phaseId === 4) {
    return [
      {
        day: 'Day 1',
        title: 'Executive Alignment & Behavioral STAR Matrix',
        action: 'Build 5 stories demonstrating conflict resolution, technical leadership, and cross-functional trade-offs.',
        deliverable: '5 Executive STAR Leadership Stories',
      },
      {
        day: 'Day 2',
        title: 'Cross-Functional Leadership Deep Dive',
        action: 'Prepare examples of stakeholder negotiation, scope trade-offs, and project delivery under tight deadlines.',
        deliverable: 'Cross-Functional Stakeholder Defense Matrix',
      },
      {
        day: 'Day 3',
        title: 'Reverse-Interview Question Strategy',
        action: 'Prepare 5 high-impact strategic questions for VP/Director interviewers about team roadmap, operational debt, and strategic priorities.',
        deliverable: '5 Strategic VP/Director Reverse Questions',
      },
      {
        day: 'Day 4',
        title: 'Work Authorization & Sponsorship Proactive Scripting',
        action: 'Prepare transparent 2-sentence script on visa transfer/E-Verify timelines and onboarding buffers.',
        deliverable: 'Work Authorization Script & Timeline Guide',
      },
      {
        day: 'Day 5',
        title: 'Multi-Threaded Pipeline Expansion',
        action: 'Activate 3 parallel warm referral threads to ensure offer leverage and avoid single-offer dependency.',
        deliverable: '3 Active Competing Interview Threads',
      },
      {
        day: 'Day 6',
        title: 'Total Compensation Benchmark Modeling',
        action: `Model base, equity, and sign-on bands on Levels.fyi and Blind for ${role} to prepare counter-offer leverage.`,
        deliverable: 'Total Compensation Band Model',
      },
      {
        day: 'Day 7',
        title: 'Offer Negotiation & Total Compensation Model',
        action: 'Model base, equity, and sign-on bands and rehearse counter-offer negotiation scripts.',
        deliverable: 'Negotiation Script & Walk-Away Terms',
      },
    ]
  }

  // Default / Phase 5 & 6 (General Executive Calibration)
  return [
    {
      day: 'Day 1',
      title: '60-Second Verbal Elevator Pitch',
      action: `Script crisp narrative covering background, ${skillsStr} expertise, and recent project architecture.`,
      deliverable: '60-Second Verbal Elevator Pitch Script',
    },
    {
      day: 'Day 2',
      title: 'Project Ownership & Scope Q&A',
      action: 'Script explicit answers defining "My individual contribution" vs. "Team scope" on top 2 projects.',
      deliverable: 'Individual Ownership & Scope Q&A Cheat Sheet',
    },
    {
      day: 'Day 3',
      title: 'Compensation & Leveling Defense',
      action: `Establish market salary baseline on Levels.fyi benchmark for ${role} to prevent screening disqualification.`,
      deliverable: 'Total Comp Range & Leveling Guardrails',
    },
    {
      day: 'Day 4',
      title: 'Recruiter Rubric Rehearsal',
      action: 'Prepare structured responses explaining career trajectory, transitions, and production impact out loud.',
      deliverable: 'Recruiter Screening Rubric Answer Matrix',
    },
    {
      day: 'Day 5',
      title: 'Timed OA / Online Assessment Prep',
      action: `Drill 2 timed CodeSignal/HackerRank assessments in your primary language (${skillsStr}).`,
      deliverable: '2 Completed Timed Technical Assessments',
    },
    {
      day: 'Day 6',
      title: 'Mock Recruiter Screen Recording',
      action: 'Record a 15-minute mock recruiter phone screen and audit verbal pacing, filler words, and narrative clarity.',
      deliverable: 'Recorded 15-Minute Mock Phone Screen',
    },
    {
      day: 'Day 7',
      title: 'Recruiter Screen Review & Callback Calibration',
      action: 'Debrief mock recording, refine narrative hooks, and finalize your outbound screening cheat sheet.',
      deliverable: 'Finalized Recruiter Screen Cheat Sheet',
    },
  ]
}

/**
 * Builds the gamified Mission Board object with Level, XP Progress, and 6 Mission cards.
 *
 * @param {Array} [priorityActions=[]] - Top candidate action recommendations
 * @param {number} [phaseId=1] - Current candidate bottleneck phase
 * @param {number} [candidateScore=70] - Overall career GPS health score
 * @returns {{xp_level: string, xp_current: number, xp_progress: string, missions: Array<object>}}
 */
export function buildGamifiedMissionBoard(priorityActions = [], phaseId = 1, candidateScore = 70) {
  const score = Math.max(0, Math.min(100, Number(candidateScore) || 70))
  const phase = Number(phaseId) || 1

  let xpLevel = 'Level 2: Strategic Positioner'
  if (score >= 85) xpLevel = 'Level 5: Executive Architect'
  else if (score >= 75) xpLevel = 'Level 4: Senior Technical Leader'
  else if (score >= 65) xpLevel = 'Level 3: Active Strategist'
  else if (score >= 50) xpLevel = 'Level 2: Strategic Positioner'
  else xpLevel = 'Level 1: Career Explorer'

  const xpCurrent = Math.min(Math.max(score * 10, 100), 950)
  const xpProgress = `${xpCurrent} / 1000 XP`

  // 6 Calibrated Mission Cards calculated from candidate phase & score
  const missions = [
    {
      title: 'Rewrite top 5 bullets using Google XYZ format',
      xp: '+25 XP',
      impact: 'High Impact',
      category: 'Resume & ATS',
    },
    {
      title: 'Reconstruct LinkedIn headline with role keywords & scale metrics',
      xp: '+20 XP',
      impact: 'High Impact',
      category: 'LinkedIn SEO',
    },
    {
      title: 'Send 5 direct reverse-outreach InMails to engineering managers',
      xp: '+20 XP',
      impact: 'High Impact',
      category: 'Outbound Velocity',
    },
    {
      title: 'Prepare 1-page system architecture diagram for primary project',
      xp: '+15 XP',
      impact: 'Medium Impact',
      category: 'Technical Architecture',
    },
    {
      title: 'Drill 2 timed technical coding assessments on CodeSignal',
      xp: '+20 XP',
      impact: 'High Impact',
      category: 'Interview Defense',
    },
    {
      title: 'Benchmark total compensation bands on Levels.fyi and Blind',
      xp: '+15 XP',
      impact: 'Medium Impact',
      category: 'Offer Strategy',
    },
  ]

  // If candidate priority actions provide specific actionable fixes, blend them in
  if (Array.isArray(priorityActions) && priorityActions.length > 0) {
    for (let i = 0; i < Math.min(priorityActions.length, 2); i++) {
      const act = priorityActions[i]
      const title = typeof act === 'string' ? act : (act?.title || act?.action || act?.task || '')
      if (title && title.length >= 10) {
        missions[i] = {
          ...missions[i],
          title: title.slice(0, 75),
        }
      }
    }
  }

  return {
    xp_level: xpLevel,
    xp_current: xpCurrent,
    xp_progress: xpProgress,
    missions,
  }
}

/**
 * Builds the standard 30-Day, 60-Day, and 90-Day phase milestones tailored to candidate phase.
 *
 * @param {number} [phaseId=1]
 * @param {string} [targetRole='Senior Software Engineer']
 * @param {string|Array} [coreSkills='TypeScript, Node.js, Cloud APIs']
 * @returns {Array<object>} 3 Milestone objects (30, 60, 90 Days)
 */
export function build30_60_90MilestonePathway(
  phaseId = 1,
  targetRole = 'Senior Software Engineer',
  coreSkills = 'TypeScript, Node.js, Cloud APIs'
) {
  const pId = Number(phaseId) || 1
  const role = typeof targetRole === 'string' && targetRole.trim() ? targetRole.trim() : 'Software Engineer'
  const skillsStr = normalizeSkillsString(coreSkills)
  const archetype = classifyRoleArchetype(role, coreSkills)

  if (pId === 2) {
    return [
      {
        period: '30 DAYS',
        stage: 'Recruiter Screen Mastery & Assessment Clearance',
        goal: 'Elevate recruiter screen pass rate from <30% to >75% and clear automated screening assessments.',
        actions: [
          `Script and rehearse a 60-second verbal elevator pitch highlighting verified ${skillsStr} and ${archetype.pitchFocus}.`,
          `Drill 10 timed ${archetype.label} domain exercises: ${archetype.dayAssessmentPrep}.`,
          `Align compensation expectations upfront using market benchmark data for ${role} to prevent screening mismatch.`,
        ],
        deliverable: `Recorded Elevator Pitch + ${archetype.label} Screening Rubric Answer Sheet`,
        successSignal: '>= 75% of recruiter phone screens advance to live assessment interview rounds.',
        active: true,
      },
      {
        period: '60 DAYS',
        stage: 'Live Problem Solving & Case Study Defense',
        goal: `Consistently clear live case studies and ${archetype.label} deep dives.`,
        actions: [
          `Conduct 5 mock interviews focusing on verbalizing reasoning out loud: ${archetype.interviewMechanism}.`,
          `Prepare a 1-page ${archetype.portfolioArtifact} detailing trade-offs and operational scale.`,
          'Rehearse project ownership responses to clearly delineate individual contributions from team scope.',
        ],
        deliverable: `1-Page ${archetype.label} Blueprint + 5 Validated STAR Leadership Stories`,
        successSignal: 'Advance to final/onsite stage in >= 50% of domain interview loops.',
        active: false,
      },
      {
        period: '90 DAYS',
        stage: 'Final Round Onsites & Offer Negotiation',
        goal: 'Convert final-round loops into competitive written offers with full compensation leverage.',
        actions: [
          'Present strategic case studies and executive vision to Director/VP stakeholders.',
          `Benchmark total compensation packages for ${role} and prepare multi-offer leverage tactics.`,
          'Execute structured negotiation scripts to maximize starting base salary and equity grant.',
        ],
        deliverable: 'Minimum 1 Signed Offer with Competitive Total Compensation',
        successSignal: 'Signed written offer letter within target leveling band.',
        isGoal: true,
        active: false,
      },
    ]
  }

  if (pId === 3) {
    return [
      {
        period: '30 DAYS',
        stage: `Live Problem Solving & ${archetype.label} Defense`,
        goal: 'Overcome interview drop-offs by mastering live scenario verbalization and trade-offs.',
        actions: [
          `Conduct 4 mock interviews verbalizing methodology, trade-offs, and reasoning: ${archetype.interviewMechanism}.`,
          `Draft 1-page ${archetype.portfolioArtifact} demonstrating real-world depth using ${skillsStr}.`,
          'Prepare 5 behavioral STAR stories focusing on system roadblocks, complex trade-offs, and domain leadership.',
        ],
        deliverable: `1-Page ${archetype.label} Blueprint + Communication Defense Rubric`,
        successSignal: 'Domain round pass rate >= 65% advancing into final round onsites.',
        active: true,
      },
      {
        period: '60 DAYS',
        stage: 'High-Volume Domain Interview Loops',
        goal: 'Maintain consistent interview performance across multiple concurrent company loops.',
        actions: [
          `Drill 15 medium-hard domain scenarios and practical simulations: ${archetype.dayAssessmentPrep}.`,
          'Rehearse domain design, execution rigor, and operational scaling patterns with peer reviewers.',
          'Participate in 2 live behavioral and leadership mock rounds weekly.',
        ],
        deliverable: 'Domain Problem Solving Log + Architectural Defense Rubric',
        successSignal: 'Advance to final round onsites in >= 60% of assessment loops.',
        active: false,
      },
      {
        period: '90 DAYS',
        stage: 'Executive Final Rounds & Offer Closing',
        goal: 'Convert onsite interview loops into written, competitive offers with multiple-offer leverage.',
        actions: [
          'Present comprehensive domain design and business impact proposals to VP/Director interview panels.',
          `Model total compensation baselines for ${role} across base salary, bonus, and incentives.`,
          'Deploy counter-offer negotiation scripts to secure top-of-band compensation.',
        ],
        deliverable: 'Minimum 1 Written Offer Letter Matching Market Compensation Targets',
        successSignal: 'Formal offer secured with verified compensation within target leveling band.',
        isGoal: true,
        active: false,
      },
    ]
  }

  // Phase 1 / Default (Top of Funnel & General Outreach)
  return [
    {
      period: '30 DAYS',
      stage: 'Asset Calibration & Outbound Sourcing Engine',
      goal: 'Overcome ATS keyword drop-offs and generate consistent top-of-funnel interview volume.',
      actions: [
        `Calibrate resume in single-column format using Google XYZ metrics with verified ${skillsStr} keyword density.`,
        'Deploy LinkedIn Sales Navigator & Apollo to build an account list of 30 target US companies actively hiring.',
        'Execute 15 targeted applications weekly directly through company ATS career portals rather than Easy Apply boards.',
      ],
      deliverable: 'ATS-Calibrated Resume + 30 Target Account Outbound Tracker',
      successSignal: 'Screening callback rate >= 10% with 2-4 recruiter screens booked weekly.',
      active: true,
    },
    {
      period: '60 DAYS',
      stage: 'Recruiter Pipeline Velocity & Multi-Threading',
      goal: 'Convert top-of-funnel inbound interest into active technical interviews across multiple companies.',
      actions: [
        `Bypass public portals: Engage 10 hiring managers and internal recruiters weekly using personalized 50-word LinkedIn InMails highlighting your ${archetype.reverseOutreachHook}.`,
        `Complete 15 timed practical problem sets: ${archetype.dayAssessmentPrep}.`,
        'Conduct 2 weekly informational interviews with alumni and senior professionals at target employers.',
      ],
      deliverable: 'Multi-Threaded Active Pipeline of 4+ Concurrent Interview Loops',
      successSignal: 'Consistent conversion of >= 60% from recruiter screen to live interview round.',
      active: false,
    },
    {
      period: '90 DAYS',
      stage: 'Final Rounds, Offer Leverage & Closing',
      goal: 'Advance through onsite interview loops and secure a competitive, written job offer.',
      actions: [
        'Execute comprehensive domain architecture and behavioral STAR interviews with hiring managers and directors.',
        `Benchmark total compensation bands for ${role} across target industry peers.`,
        'Negotiate starting terms using competing interview timeline leverage and structured counter-offer scripts.',
      ],
      deliverable: 'Minimum 1 Formal Written Offer with Verified Compensation Package',
      successSignal: 'Signed target offer matching market compensation baseline.',
      isGoal: true,
      active: false,
    },
  ]
}

/**
 * Builds the standard 4-Week Roadmap array for backward compatibility with existing PDF & report views.
 *
 * @param {number} [phaseId=1]
 * @param {string} [targetRole='Senior Software Engineer']
 * @param {string|Array} [coreSkills='TypeScript, Node.js, Cloud APIs']
 * @returns {Array<{week: string, theme: string, goal: string, tasks: Array<string>}>}
 */
export function buildStandard4WeekRoadmap(
  phaseId = 1,
  targetRole = 'Senior Software Engineer',
  coreSkills = 'TypeScript, Node.js, Cloud APIs'
) {
  const role = typeof targetRole === 'string' && targetRole.trim() ? targetRole.trim() : 'Software Engineer'
  const skillsStr = normalizeSkillsString(coreSkills)
  const archetype = classifyRoleArchetype(role, coreSkills)

  return [
    {
      week: 'Week 1',
      theme: 'Positioning & Asset Calibration',
      goal: `Calibrate resume bullets and LinkedIn profile for ${role} with high ${skillsStr} density.`,
      tasks: [
        `Rewrite experience achievements in Google XYZ format highlighting ${skillsStr} outcomes.`,
        'Verify single-column ATS parsable resume layout with zero table/column ingestion errors.',
        'Reconstruct LinkedIn headline with role keywords, core stack, and scale metrics.',
      ],
    },
    {
      week: 'Week 2',
      theme: 'Sourcing Velocity & Multi-Threading',
      goal: 'Scale outbound volume via direct hiring manager outreach and employee referrals.',
      tasks: [
        'Curate list of 25 target US employers actively hiring in your target leveling tier.',
        `Bypass public portals: Send 5 personalized 50-word reverse-outreach InMails to hiring managers highlighting your ${archetype.reverseOutreachHook}.`,
        'Submit 10 direct career portal applications bypassing public Easy Apply aggregators.',
      ],
    },
    {
      week: 'Week 3',
      theme: `${archetype.label} Interview & Case Study Mastery`,
      goal: `Master interview verbalization, ${archetype.label} case studies, and practical drills.`,
      tasks: [
        `Complete 10 timed problem-solving exercises: ${archetype.dayAssessmentPrep}.`,
        `Draft 1-page ${archetype.portfolioArtifact} demonstrating real-world depth.`,
        'Rehearse 5 technical leadership STAR stories covering domain trade-offs and complex challenges.',
      ],
    },
    {
      week: 'Week 4',
      theme: 'Executive Alignment, Negotiation & Closing',
      goal: 'Convert final-round loops into written offers with compensation leverage.',
      tasks: [
        'Prepare 5 strategic questions for VP/Director interviewers on team roadmap and operational priorities.',
        `Benchmark total compensation bands for ${role}.`,
        'Execute structured counter-offer negotiation scripts to secure top-of-band compensation.',
      ],
    },
  ]
}

