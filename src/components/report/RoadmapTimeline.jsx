import { motion } from 'framer-motion'
import {
  Check,
  Trophy,
  Target,
  Sparkle,
  Path,
  Flag,
  Lightning,
  ArrowsClockwise,
  ArrowRight,
  CalendarCheck,
} from '@phosphor-icons/react'

function extractTopSkills(reportData, fallback = 'Core Tech Stack') {
  const resumeAgent = reportData?.resume_agent
  const canonicalResume = resumeAgent?.canonicalResume
  const resumeJson = reportData?.resume_json

  const skillsSource =
    canonicalResume?.skills ||
    resumeJson?.skills ||
    resumeJson?.top_skills ||
    resumeAgent?.candidateSnapshot?.coreSkills ||
    []

  let skillsList = []

  if (Array.isArray(skillsSource)) {
    for (const item of skillsSource) {
      if (typeof item === 'string' && item.trim()) {
        skillsList.push(item.trim())
      } else if (item && typeof item === 'object') {
        if (typeof item.name === 'string') skillsList.push(item.name.trim())
        else if (typeof item.skill === 'string') skillsList.push(item.skill.trim())
        else if (Array.isArray(item.skills)) {
          skillsList.push(...item.skills.filter((s) => typeof s === 'string').map((s) => s.trim()))
        }
      }
    }
  } else if (typeof skillsSource === 'string') {
    skillsList = skillsSource.split(',').map((s) => s.trim()).filter(Boolean)
  }

  const unique = Array.from(new Set(skillsList.filter(Boolean))).slice(0, 3)
  if (unique.length > 0) {
    return unique.join(', ')
  }
  return fallback
}

export default function RoadmapTimeline({ roadmapData, currentPhaseId = 2, onNavigateSection, reportData }) {
  const safeData = Array.isArray(roadmapData) ? roadmapData : []
  const effectivePhaseId = Number(reportData?.phase?.id || reportData?.career_journey?.current_phase_id || currentPhaseId || 1)
  const targetRole = reportData?.user_answers?.targetRole || reportData?.target_role || 'Software Engineer'
  const visa = reportData?.user_answers?.visa || reportData?.user_answers?.visaStatus || ''
  const rawExternal = reportData?.user_answers?.externalHelp
  const helpString = Array.isArray(rawExternal) ? rawExternal.join(' ') : String(rawExternal || '')
  const isVisaConstrained = Boolean(visa && !visa.includes('US Citizen') && !visa.includes('Green Card'))
  const isSponsorshipRequired = Boolean(visa && /opt|cpt|h-?1b|sponsor/i.test(visa))
  const isConsultancy = Boolean(helpString && (helpString.includes('C2C') || helpString.includes('Staffing') || helpString.includes('Agency')))
  const isDataRole = /data|analyst|analytics|bi\b|business intelligence|tableau|power bi|sql/i.test(targetRole)
  const topSkills = extractTopSkills(reportData, isDataRole ? 'SQL, Python, Data Modeling' : 'TypeScript, Node.js, Cloud APIs')
  const primaryBottleneck = reportData?.primary_bottleneck?.title || 'Top-of-Funnel Conversion'

  // -------------------------------------------------------------
  // 1. Intelligent 7-Day Rapid Triage Checklist (Days 1–7)
  // -------------------------------------------------------------
  let sprintDays = []

  if (effectivePhaseId === 1) {
    // Phase 1: Top of Funnel Black Hole
    sprintDays = [
      {
        day: 'Day 1',
        title: 'Document Calibration',
        action: `Rewrite top 5 resume achievement bullets in Google XYZ format with quantified business outcomes and high ${topSkills} keyword density.`,
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
        action: `Reconstruct headline with target role keywords + ${topSkills} + verified scale metric to match recruiter boolean searches.`,
        deliverable: '220-Char Search-Optimized LinkedIn Headline',
      },
      {
        day: 'Day 4',
        title: 'Curate 20 Target US Employers',
        action: `Curate 20 target employers (15 Tier-2 high-growth mid-market + 5 Tier-1 targets${isSponsorshipRequired ? ', filtered on E-Verify/USCIS sponsor history' : ''}).`,
        deliverable: '20-Company Target Outbound Account List',
      },
      {
        day: 'Day 5',
        title: 'Launch 5-to-1 Reverse Outbound',
        action: 'Send 5 personalized 50-word notes directly to engineering managers on LinkedIn before applying to generate warm referral interest.',
        deliverable: '5 Sent Hiring Manager Reverse InMails',
      },
      {
        day: 'Day 6',
        title: 'Career Page Sourcing',
        action: `Submit 10 direct career-portal applications for ${targetRole} bypassing high-competition Easy Apply job boards.`,
        deliverable: '10 Direct ATS Career Portal Submissions',
      },
      {
        day: 'Day 7',
        title: 'Weekly Pipeline Audit',
        action: 'Track outbound callback response rates in an outbound Kanban sheet and recalibrate role keyword variations.',
        deliverable: 'Pipeline Conversion Audit & Sourcing Sheet',
      },
    ]
  } else if (effectivePhaseId === 2) {
    // Phase 2: Recruiter Screen Choke Point
    sprintDays = [
      {
        day: 'Day 1',
        title: '60-Second Verbal Elevator Pitch',
        action: `Script crisp narrative covering background, ${topSkills} expertise, and recent project architecture.`,
        deliverable: '60-Second Verbal Elevator Pitch Script',
      },
      {
        day: 'Day 2',
        title: 'Project Ownership Q&A',
        action: 'Script explicit answers defining "My individual contribution" vs. "Team scope" on top 2 projects.',
        deliverable: 'Individual Ownership & Scope Q&A Cheat Sheet',
      },
      {
        day: 'Day 3',
        title: 'Compensation & Leveling Defense',
        action: `Establish market salary baseline on Levels.fyi for ${targetRole} to prevent screening disqualification.`,
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
        action: `Drill 2 timed CodeSignal/HackerRank assessments in your primary language (${topSkills}).`,
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
  } else if (effectivePhaseId === 3) {
    // Phase 3: Technical Round Choke Point
    sprintDays = [
      {
        day: 'Day 1',
        title: 'Project Architecture One-Pager',
        action: 'Prepare a 1-page system architecture diagram for top project showing DB choice, caching, and trade-offs.',
        deliverable: '1-Page System Architecture Diagram',
      },
      {
        day: 'Day 2',
        title: 'System Trade-Offs & Data Flow',
        action: `Map latency bottlenecks, caching layers, and throughput limits using ${topSkills} to defend tech choices under questioning.`,
        deliverable: 'System Trade-Off & Mitigation Table',
      },
      {
        day: 'Day 3',
        title: 'Live System Design & Scalability Drills',
        action: 'Drill trade-off explanations: "Why SQL vs NoSQL?", throughput bottlenecks, and latency mitigation.',
        deliverable: 'Scalability & Trade-Off Defense Walkthrough',
      },
      {
        day: 'Day 4',
        title: 'Live Coding Verbalization Practice',
        action: 'Practice explaining Big-O space and time complexity out loud while solving algorithmic challenges.',
        deliverable: '3 Verbalized Algorithm Problem Solutions',
      },
      {
        day: 'Day 5',
        title: 'Live Coding & Algorithm Timed Mock',
        action: 'Complete 3 timed problem-solving rounds focusing on verbalizing reasoning out loud.',
        deliverable: '3 Completed Live LeetCode/HackerRank Mocks',
      },
      {
        day: 'Day 6',
        title: 'Technical STAR Behavioral Defense',
        action: 'Structure 5 STAR stories on production outages, system regressions, and complex code reviews.',
        deliverable: '5 Technical Leadership STAR Stories',
      },
      {
        day: 'Day 7',
        title: 'Technical Defense Debrief & Post-Mortem Template',
        action: 'Audit weak technical areas and build a personal technical defense cheat sheet for upcoming rounds.',
        deliverable: 'Technical Round Post-Mortem & Review Guide',
      },
    ]
  } else if (effectivePhaseId === 4) {
    // Phase 4: Final Round Offer Closing
    sprintDays = [
      {
        day: 'Day 1',
        title: 'Executive Alignment & Behavioral STAR Matrix',
        action: 'Build 5 stories demonstrating conflict resolution, leadership, and cross-functional trade-offs.',
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
        action: 'Prepare 5 high-impact strategic questions for VP/Director interviewers about team roadmap and technical debt.',
        deliverable: '5 Strategic VP/Director Reverse Questions',
      },
      {
        day: 'Day 4',
        title: 'Work Authorization & Sponsorship Proactive Scripting',
        action: `Prepare transparent 2-sentence script on visa transfer/E-Verify timelines${isSponsorshipRequired ? ' and USCIS processing buffers' : ''}.`,
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
        action: `Model base, equity, and sign-on bands on Levels.fyi and Blind for ${targetRole} to prepare counter-offer leverage.`,
        deliverable: 'Total Compensation Band Model',
      },
      {
        day: 'Day 7',
        title: 'Offer Negotiation & Total Compensation Model',
        action: 'Model base, equity, and sign-on bands and rehearse counter-offer negotiation scripts.',
        deliverable: 'Negotiation Script & Walk-Away Terms',
      },
    ]
  } else if (effectivePhaseId === 5) {
    // Phase 5: Offer in Hand / Onboarding
    sprintDays = [
      {
        day: 'Day 1',
        title: 'Offer Letter Legal & Comp Audit',
        action: 'Audit written offer letter covering base salary, sign-on bonus, equity vesting schedule, and IP clauses.',
        deliverable: 'Annotated Offer Term Sheet',
      },
      {
        day: 'Day 2',
        title: 'Counter-Offer Closing Strategy',
        action: 'Formulate final counter-offer request leveraging competing offers or verified market data.',
        deliverable: 'Final Counter-Offer Communication',
      },
      {
        day: 'Day 3',
        title: 'Background Verification Assembly',
        action: 'Assemble previous W2s, tax docs, degree certifications, and verified supervisor contact info.',
        deliverable: 'Complete Background Verification Dossier',
      },
      {
        day: 'Day 4',
        title: 'Work Authorization & I-9 Verification',
        action: 'Coordinate with HR and immigration counsel on E-Verify validation and start date confirmation.',
        deliverable: 'I-9 Clearance & Start Date Agreement',
      },
      {
        day: 'Day 5',
        title: 'Resignation & Transition Protocol',
        action: 'Draft professional resignation notice and prepare structured 2-week handover documentation.',
        deliverable: 'Transition & Handover Plan',
      },
      {
        day: 'Day 6',
        title: 'First 30-Day Team Onboarding Strategy',
        action: 'Review team repositories, production architecture docs, and schedule initial 1-on-1s.',
        deliverable: '30-Day Onboarding Roadmap',
      },
      {
        day: 'Day 7',
        title: 'Day 1 Readiness & Career GPS Sign-Off',
        action: 'Finalize remote workstation setup, team communication channels, and initial 90-day impact milestones.',
        deliverable: 'Day 1 Launch Checklist',
      },
    ]
  } else {
    // Phase 6 / Default: Pre-Search Foundation & Asset Calibration
    sprintDays = [
      {
        day: 'Day 1',
        title: 'Technical Competency Audit',
        action: `Audit verified technical capabilities in ${topSkills} against current US hiring market expectations for ${targetRole}.`,
        deliverable: 'Technical Gap & Skill Inventory',
      },
      {
        day: 'Day 2',
        title: 'Google XYZ Resume Overhaul',
        action: `Rewrite all experience bullets using Google XYZ format with quantified business outcomes and ${topSkills} metrics.`,
        deliverable: 'Full Resume Impact Bullet Rewrite',
      },
      {
        day: 'Day 3',
        title: 'ATS Text Ingestion Check',
        action: 'Verify single-column format parses 100% cleanly through standard ATS scanners without missing headers or corrupting dates.',
        deliverable: '100% Parsable ATS Resume File',
      },
      {
        day: 'Day 4',
        title: 'LinkedIn Recruiter SEO',
        action: `Reconstruct headline, about section, and top 5 skills with target role keywords + ${topSkills} for high search visibility.`,
        deliverable: 'Search-Optimized LinkedIn Profile',
      },
      {
        day: 'Day 5',
        title: 'Target Employer Universe Mapping',
        action: `Curate 25 target tech employers (Tier 1 & Tier 2)${isSponsorshipRequired ? ', filtered on E-Verify/USCIS sponsor history' : ''}.`,
        deliverable: '25-Company Target Universe Spreadsheet',
      },
      {
        day: 'Day 6',
        title: 'Launch 5-to-1 Reverse Outbound',
        action: 'Send 5 personalized 50-word notes directly to engineering managers on LinkedIn before applying.',
        deliverable: '5 Sent Hiring Manager Reverse InMails',
      },
      {
        day: 'Day 7',
        title: 'Weekly Pipeline Audit',
        action: 'Establish weekly 15-20 direct application rhythm with Kanban board tracking and follow-up alerts.',
        deliverable: 'Weekly Search Cadence & Tracking Dashboard',
      },
    ]
  }

  // -------------------------------------------------------------
  // 2. Dynamic 30-60-90 Day Milestone Pathway
  // -------------------------------------------------------------
  let phase30, phase60, phase90

  if (effectivePhaseId === 1) {
    // Phase 1: Top of Funnel Black Hole
    phase30 = {
      period: '30 DAYS',
      stage: 'Asset Calibration & Outbound Sourcing Engine',
      goal: 'Overcome ATS keyword drop-offs and generate consistent top-of-funnel interview volume.',
      actions: [
        `Calibrate resume in single-column format using Google XYZ metrics with verified ${topSkills} keyword density.`,
        'Deploy LinkedIn Sales Navigator & Apollo to build an account list of 30 target US companies actively hiring.',
        isSponsorshipRequired
          ? 'Filter target employer lists via USCIS H-1B Employer Hub and E-Verify databases before submitting.'
          : 'Execute 15 targeted applications weekly directly through company ATS career portals rather than Easy Apply boards.',
      ],
      deliverable: 'ATS-Calibrated Resume + 30 Target Account Outbound Tracker',
      successSignal: 'Screening callback rate >= 10% with 2-4 recruiter screens booked weekly.',
      active: true,
    }

    phase60 = {
      period: '60 DAYS',
      stage: 'Recruiter Pipeline Velocity & Multi-Threading',
      goal: 'Convert top-of-funnel inbound interest into active technical interviews across multiple companies.',
      actions: [
        'Engage 10 engineering managers and internal recruiters weekly using personalized 50-word LinkedIn InMails.',
        `Complete 15 timed technical problem sets on LeetCode/CodeSignal in ${topSkills} to ensure assessment readiness.`,
        'Conduct 2 weekly informational interviews with alumni and senior engineers at target tech companies.',
      ],
      deliverable: 'Multi-Threaded Active Pipeline of 4+ Concurrent Interview Loops',
      successSignal: 'Consistent conversion of >= 60% from recruiter screen to live technical round.',
      active: false,
    }

    phase90 = {
      period: '90 DAYS',
      stage: 'Final Rounds, Offer Leverage & Closing',
      goal: 'Advance through onsite interview loops and secure a competitive, written job offer.',
      actions: [
        'Execute comprehensive system architecture and behavioral STAR interviews with hiring managers and directors.',
        `Benchmark total compensation bands (Base, Bonus, Equity) on Levels.fyi and Blind for ${targetRole}.`,
        'Negotiate starting terms using competing interview timeline leverage and structured counter-offer scripts.',
      ],
      deliverable: 'Minimum 1 Formal Written Offer with Verified Compensation Package',
      successSignal: 'Signed target offer matching market compensation baseline.',
      isGoal: true,
      active: false,
    }
  } else if (effectivePhaseId === 2) {
    // Phase 2: Recruiter Screen Choke Point
    phase30 = {
      period: '30 DAYS',
      stage: 'Recruiter Screen Mastery & Assessment Clearance',
      goal: 'Elevate recruiter screen pass rate from <30% to >75% and clear automated technical assessments.',
      actions: [
        `Script and rehearse a 60-second verbal elevator pitch highlighting verified ${topSkills} and architecture scale.`,
        'Drill 10 timed CodeSignal / HackerRank online assessments to guarantee passing automated screen filters.',
        `Align compensation expectations upfront using Levels.fyi data for ${targetRole} to prevent screening mismatch.`,
      ],
      deliverable: 'Recorded Elevator Pitch + Recruiter Screening Rubric Answer Sheet',
      successSignal: '>= 75% of recruiter phone screens advance to live technical interview rounds.',
      active: true,
    }

    phase60 = {
      period: '60 DAYS',
      stage: 'Live Technical Problem Solving & Architecture Defense',
      goal: 'Consistently clear live coding rounds and technical deep dives.',
      actions: [
        'Conduct 5 mock technical coding interviews focusing on verbalizing reasoning out loud on LeetCode Mediums.',
        'Prepare a 1-page architecture diagram for your primary project detailing database trade-offs and caching.',
        'Rehearse project ownership responses to clearly delineate individual contributions from team scope.',
      ],
      deliverable: '1-Page Project System Architecture Blueprint + 5 Validated STAR Technical Stories',
      successSignal: 'Advance to final/onsite stage in >= 50% of technical interview loops.',
      active: false,
    }

    phase90 = {
      period: '90 DAYS',
      stage: 'Final Round Onsites & Offer Negotiation',
      goal: 'Convert final-round loops into competitive written offers with full compensation leverage.',
      actions: [
        'Present technical case studies and executive vision to Director/VP stakeholders.',
        'Benchmark total compensation packages on Levels.fyi and prepare multi-offer leverage tactics.',
        'Execute structured negotiation scripts to maximize starting base salary and equity grant.',
      ],
      deliverable: 'Minimum 1 Signed Offer with Competitive Total Compensation',
      successSignal: 'Signed written offer letter within target leveling band.',
      isGoal: true,
      active: false,
    }
  } else if (effectivePhaseId === 3) {
    // Phase 3: Technical Round Choke Point
    phase30 = {
      period: '30 DAYS',
      stage: 'Live Technical Problem Solving & System Architecture',
      goal: 'Overcome technical drop-offs by mastering live coding verbalization and system trade-offs.',
      actions: [
        'Conduct 4 mock interviews on LeetCode/Pramp verbalizing Big-O time and space trade-offs in real-time.',
        `Draft system architecture one-pagers showing latency, caching, and database trade-offs using ${topSkills}.`,
        'Prepare 5 behavioral STAR stories focusing on system outages, complex bugs, and engineering trade-offs.',
      ],
      deliverable: 'System Architecture One-Pager + Live Coding Communication Rubric',
      successSignal: 'Technical round pass rate >= 65% advancing into final round onsites.',
      active: true,
    }

    phase60 = {
      period: '60 DAYS',
      stage: 'Final Round Onsite Mastery & Stakeholder Alignment',
      goal: 'Deliver high-impact final rounds with engineering directors and cross-functional partners.',
      actions: [
        'Rehearse system design discussions for distributed systems (scaling, rate limiting, and failure modes).',
        'Prepare 5 strategic questions for engineering executives regarding technical debt and product roadmap.',
        'Expand parallel outbound pipelines via Apollo and LinkedIn Sales Navigator to ensure multi-offer closing leverage.',
      ],
      deliverable: 'Executive Q&A Matrix + Active Multi-Threaded Onsite Pipeline',
      successSignal: 'Multiple final round onsites completed across concurrent companies.',
      active: false,
    }

    phase90 = {
      period: '90 DAYS',
      stage: 'Offer Closing, Total Comp Benchmarking & Sign-Off',
      goal: 'Secure top-of-market compensation and finalize employment verification.',
      actions: [
        'Benchmark competing offers on Levels.fyi and Blind to establish counter-offer leverage.',
        'Negotiate base salary, sign-on bonus, and equity vesting schedule using proven recruiter scripts.',
        'Finalize background check verification, reference checks, and Day 1 onboarding clearance.',
      ],
      deliverable: 'Formal Written Job Offer with Maximized Total Compensation Package',
      successSignal: 'Accepted offer letter meeting or exceeding target compensation benchmark.',
      isGoal: true,
      active: false,
    }
  } else if (effectivePhaseId === 4) {
    // Phase 4: Final Round Offer Closing
    phase30 = {
      period: '30 DAYS',
      stage: 'Executive Alignment & Offer Negotiation Strategy',
      goal: 'Convert final-round loops into written offers and maximize total compensation leverage.',
      actions: [
        'Prepare 5 executive-level STAR stories demonstrating leadership, conflict resolution, and business impact.',
        `Benchmark total compensation packages on Levels.fyi for ${targetRole} to determine target bands.`,
        'Draft strategic reverse-interview questions to uncover team priorities, roadmap, and tech debt.',
      ],
      deliverable: 'Executive Interview Prep Dossier + Total Compensation Negotiation Matrix',
      successSignal: 'At least 1 formal written job offer received within 30 days.',
      active: true,
    }

    phase60 = {
      period: '60 DAYS',
      stage: 'Offer Finalization & Onboarding Clearance',
      goal: 'Resolve all employment conditions, background checks, and prepare for Day 1 onboarding.',
      actions: [
        'Assemble tax documents, reference contacts, and employment history for background verification.',
        isSponsorshipRequired
          ? 'Coordinate with immigration attorneys to initiate H-1B transfer / STEM OPT paperwork via USCIS Hub.'
          : 'Finalize employment contract terms, start date, and remote equipment logistics.',
        'Draft a 30-day team onboarding plan reviewing production architecture and key internal repos.',
      ],
      deliverable: 'Cleared Background Verification + 30-Day Onboarding Roadmap',
      successSignal: '100% background clearance and signed employment agreement.',
      active: false,
    }

    phase90 = {
      period: '90 DAYS',
      stage: 'Early Impact & Performance Acceleration',
      goal: 'Deliver first production feature and establish high credibility with manager and team.',
      actions: [
        'Ship first production pull request and complete first sprint cycle within 30 days of start.',
        'Establish weekly 1-on-1 cadence with engineering manager to align on 6-month promotion criteria.',
        'Document key workflow improvements or team tooling to demonstrate immediate engineering value.',
      ],
      deliverable: 'First Production Contribution + 90-Day Performance Review Alignment',
      successSignal: 'Strong first quarterly performance review and established team velocity.',
      isGoal: true,
      active: false,
    }
  } else {
    // Phase 5/6/Default
    phase30 = {
      period: '30 DAYS',
      stage: 'Foundation, Positioning & Asset Calibration',
      goal: 'Establish an ATS-compliant resume, verified online presence, and targeted application engine.',
      actions: [
        `Calibrate resume in single-column format using Google XYZ metrics with verified ${topSkills} keyword density.`,
        'Deploy LinkedIn Sales Navigator & Apollo to build an account list of 25 target US companies actively hiring.',
        isSponsorshipRequired
          ? 'Filter target employer lists via USCIS H-1B Employer Hub and E-Verify databases before submitting.'
          : 'Execute 15 targeted applications weekly directly through company ATS career portals rather than Easy Apply boards.',
      ],
      deliverable: 'ATS-Calibrated Resume + 25 Target Account Outbound Tracker',
      successSignal: '15+ weekly applications submitted with >= 80% role keyword match.',
      active: true,
    }

    phase60 = {
      period: '60 DAYS',
      stage: 'Recruiter Screening & Technical Interview Velocity',
      goal: 'Generate consistent weekly recruiter screenings and advance into live technical rounds.',
      actions: [
        'Script and rehearse a 60-second verbal elevator pitch highlighting verified architecture scale.',
        `Complete 10 timed technical problem sets on LeetCode/CodeSignal in ${topSkills} to ensure assessment readiness.`,
        'Engage 10 engineering managers weekly using personalized 50-word LinkedIn InMails.',
      ],
      deliverable: 'Active Pipeline of 3+ Scheduled Screens/Week',
      successSignal: 'Consistent conversion of >= 60% from recruiter screen to live technical round.',
      active: false,
    }

    phase90 = {
      period: '90 DAYS',
      stage: 'Final Round Onsites & Offer Closing',
      goal: 'Convert final round discussions into formal, written job offers with optimal compensation.',
      actions: [
        'Present technical case studies and executive vision to Director/VP stakeholders.',
        `Benchmark total compensation packages on Levels.fyi for ${targetRole} to prepare counter-offer leverage.`,
        'Execute structured negotiation scripts to maximize starting base salary and equity grant.',
      ],
      deliverable: 'Minimum 1 Formal Written Offer with Verified Compensation Package',
      successSignal: 'Signed written offer letter within target leveling band.',
      isGoal: true,
      active: false,
    }
  }

  // Seamlessly merge LLM custom roadmap tasks if present from Atlas
  const atlasRoadmap = Array.isArray(roadmapData) && roadmapData.length > 0
    ? roadmapData
    : (Array.isArray(reportData?.roadmap) ? reportData.roadmap : [])

  if (atlasRoadmap.length > 0) {
    const extractAtlasTasks = (item) => {
      if (!item) return []
      if (Array.isArray(item.tasks)) return item.tasks.filter((t) => typeof t === 'string' && t.trim())
      if (Array.isArray(item.actions)) return item.actions.filter((t) => typeof t === 'string' && t.trim())
      return []
    }

    const m30Tasks = extractAtlasTasks(atlasRoadmap[0])
    if (m30Tasks.length > 0) {
      phase30.actions = [m30Tasks[0], ...phase30.actions.slice(1, 3)]
    }

    const m60Tasks = extractAtlasTasks(atlasRoadmap[1])
    if (m60Tasks.length > 0) {
      phase60.actions = [m60Tasks[0], ...phase60.actions.slice(1, 3)]
    }

    const m90Tasks = extractAtlasTasks(atlasRoadmap[2])
    if (m90Tasks.length > 0) {
      phase90.actions = [m90Tasks[0], ...phase90.actions.slice(1, 3)]
    }
  }

  const PHASES = [phase30, phase60, phase90]

  return (
    <section id="roadmap" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--primary)] block">
            Execution Timeline & Milestones
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Action Roadmap & Quick-Win Sprint
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          From immediate 7-day conversion quick-wins to your 90-day verified job offer
        </p>
      </div>

      {/* ── 7-Day Quick-Win Action Plan Card ── */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-[var(--primary-light)]/40 via-[var(--surface-card)] to-emerald-500/10 border-2 border-[var(--primary)]/40 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Lightning size={22} weight="fill" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] font-mono block">
                Immediate Execution Sprint
              </span>
              <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight">
                7-Day Rapid Triage Checklist
              </h3>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[var(--primary)] text-white self-start md:self-auto">
            Days 1–7 • High-Leverage Triage
          </span>
        </div>

        {/* 7-Day Responsive Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pt-2">
          {sprintDays.map((item, idx) => (
            <div
              key={item.day || idx}
              className={`p-4 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-default)] space-y-2 flex flex-col justify-between transition-all hover:border-[var(--primary)]/50 ${
                idx === 6 ? 'sm:col-span-2 lg:col-span-1' : ''
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] font-mono px-2 py-0.5 rounded-md bg-[var(--primary-light)]/60">
                    {item.day}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    Mission 0{idx + 1}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                  {item.title}
                </h4>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {item.action}
                </p>
              </div>

              {item.deliverable && (
                <div className="pt-2 border-t border-[var(--border-default)] flex items-start gap-1.5">
                  <Check size={12} weight="bold" className="text-[var(--emerald)] shrink-0 mt-0.5" />
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] leading-tight">
                    {item.deliverable}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 30 / 60 / 90 Day Direction Cards Grid ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xs relative">
        <div className="mb-4">
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--text-muted)] block">
            Longer-Term Strategic Progression
          </span>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            30 / 60 / 90 Day Milestone Pathway
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {PHASES.map((p, idx) => (
            <motion.div
              key={p.period}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className={`p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-5 ${
                p.isGoal
                  ? 'bg-amber-500/5 border-amber-500/30 shadow-xs'
                  : p.active
                  ? 'bg-emerald-500/5 border-emerald-500/30 shadow-xs'
                  : 'bg-[var(--surface-sunken)] border-[var(--border-default)]'
              }`}
            >
              <div className="space-y-4">
                {/* Milestone Period Badge + Phase Tag */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full font-mono ${
                      p.isGoal
                        ? 'bg-amber-400 text-black'
                        : p.active
                        ? 'bg-[var(--emerald)] text-white'
                        : 'bg-[var(--surface-card)] text-[var(--text-muted)] border border-[var(--border-default)]'
                    }`}
                  >
                    {p.period}
                  </span>

                  {p.isGoal ? (
                    <Trophy size={20} weight="fill" className="text-amber-500" />
                  ) : (
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)]">
                      0{idx + 1}
                    </span>
                  )}
                </div>

                {/* Stage Title & Goal */}
                <div className="space-y-1">
                  <h4
                    className="text-base font-bold text-[var(--text-primary)] tracking-tight"
                    style={{ fontFamily: 'var(--font-head)' }}
                  >
                    {p.stage}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    {p.goal}
                  </p>
                </div>

                {/* Actions */}
                <ul className="space-y-2 list-none pl-0 text-xs font-medium text-[var(--text-primary)]">
                  {p.actions.map((act, aIdx) => (
                    <li key={aIdx} className="flex items-start gap-2 leading-relaxed">
                      <Check
                        size={14}
                        weight="bold"
                        className={`shrink-0 mt-0.5 ${
                          p.active || p.isGoal ? 'text-[var(--emerald)]' : 'text-[var(--text-muted)]'
                        }`}
                      />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Deliverable Callout */}
              {p.deliverable && (
                <div className="pt-3 border-t border-[var(--border-default)] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] block">
                    Key Deliverable
                  </span>
                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    {p.deliverable}
                  </p>
                </div>
              )}

              {/* Success Signal Callout */}
              <div className="pt-2 border-t border-[var(--border-default)] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--emerald)] block">
                  Success Signal
                </span>
                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                  {p.successSignal}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Reassessment Loop Trigger Card ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <ArrowsClockwise size={20} weight="bold" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              Continuous Reassessment Loop
            </h4>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              After completing your 7-Day Plan, log your new screening & interview numbers to recalculate your Hiring Phase.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onNavigateSection) onNavigateSection('funnel-risks')
            else document.getElementById('funnel-risks')?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="btn-ghost shrink-0 text-xs font-bold py-2 px-4 border border-[var(--border-default)] rounded-xl hover:border-[var(--primary)] flex items-center gap-1.5 cursor-pointer"
        >
          <span>Update Funnel Numbers</span>
          <ArrowRight size={14} weight="bold" />
        </button>
      </div>
    </section>
  )
}
