import { useState, useEffect, useRef } from 'react'
import {
  Sun,
  Moon,
  ArrowsClockwise,
  ShareNetwork,
  Printer,
  ShieldCheck,
  Compass,
  ArrowRight,
  SpinnerGap,
} from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { api } from '../../lib/api'
import { navigateTo } from '../../lib/navigation'
import AnalysisLoader from '../loading/AnalysisLoader'

// Redesigned Modern Report Components
import ReportHero from './ReportHero'
import StickyReportNav from './StickyReportNav'
import CareerHealthSnapshot from './CareerHealthSnapshot'
import PrimaryBottleneck from './PrimaryBottleneck'
import WhatIsWorking from './WhatIsWorking'
import OpportunitiesList from './OpportunitiesList'
import FunnelAndConversionSection from './FunnelAndConversionSection'
import TopPriorities from './TopPriorities'
import RoadmapTimeline from './RoadmapTimeline'
import DetailedDiagnosis from './DetailedDiagnosis'
import FinalNextAction from './FinalNextAction'
import ResumeDeepDiagnosis from './ResumeDeepDiagnosis'

import brandLogo from '../../assets/images/crafture-logo.jpg'

// Complete mock report fallback
const MOCK_REPORT = {
  // V3.1 Resume Specialist Agent deep diagnosis (sample from real agent run)
  resume_agent: {
    "analysisVersion": "2.2",
    "candidateSnapshot": {
      "name": "Jordan Miller",
      "targetRole": "Junior Full Stack Developer",
      "experienceLevel": "Mid-Level (2-5 years)",
      "primaryProfile": "Full Stack Software Development"
    },
    "dashboard": {
      "version": "resume-scorecard-v1",
      "computedAt": "2026-10-05T11:13:00.180Z",
      "score": 93,
      "grade": "A",
      "gradeLabel": "Excellent",
      "grades": {
        "impact": {
          "label": "Impact",
          "score": 96,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "0 of 9 bullets include a hard number",
            "Impact issues: yes"
          ]
        },
        "positioning": {
          "label": "Positioning",
          "score": 84,
          "grade": "B",
          "gradeLabel": "Good",
          "facts": [
            "Positioning/ownership issues: yes"
          ]
        },
        "ats_readability": {
          "label": "ATS Safety",
          "score": 88,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "Contact details merged with summary text",
            "ATS issues: yes"
          ]
        },
        "credibility": {
          "label": "Credibility",
          "score": 92,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "Fabrication/assumption warnings: 0",
            "Skill evidence issues: yes"
          ]
        },
        "brevity": {
          "label": "Brevity",
          "score": 100,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "Average bullet length: 9.7 words",
            "All bullets within length"
          ]
        },
        "us_market_alignment": {
          "label": "US Alignment",
          "score": 100,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "No non-US conventions detected",
            "No personal details"
          ]
        }
      },
      "checks": [
        {
          "id": "quantified_evidence",
          "label": "Quantified achievements",
          "status": "fail",
          "detail": "0 of 9 bullets include a hard number",
          "category": "impact"
        },
        {
          "id": "outcome_verbs",
          "label": "Bullets lead with outcome or action verbs",
          "status": "fail",
          "detail": "0 of 9 bullets show a clear action/outcome verb",
          "category": "impact"
        },
        {
          "id": "no_tool_dump",
          "label": "No tool-dump bullets",
          "status": "pass",
          "detail": "Every bullet explains the work, not just the stack",
          "category": "impact"
        },
        {
          "id": "contact_header",
          "label": "Contact details parse cleanly",
          "status": "warn",
          "detail": "Contact info sits alongside other text — check ATS parsing",
          "category": "ats_readability"
        },
        {
          "id": "no_personal_details",
          "label": "No personal details (US norm)",
          "status": "pass",
          "detail": "Nothing a US recruiter would expect removed",
          "category": "us_market_alignment"
        },
        {
          "id": "no_declaration",
          "label": "No declaration/signature block",
          "status": "pass",
          "detail": "None found",
          "category": "us_market_alignment"
        },
        {
          "id": "no_objective_section",
          "label": "Uses a summary, not an Objective",
          "status": "pass",
          "detail": "No Objective section found",
          "category": "us_market_alignment"
        },
        {
          "id": "skill_evidence",
          "label": "Skills backed by evidence",
          "status": "warn",
          "detail": "1 skill evidence gap(s) flagged",
          "category": "credibility"
        },
        {
          "id": "bullet_length",
          "label": "Bullet length (1-2 lines)",
          "status": "pass",
          "detail": "Average 9.7 words",
          "category": "brevity"
        },
        {
          "id": "page_count",
          "label": "1-2 page length",
          "status": "pass",
          "detail": "Parsed document is approximately 1 page(s)",
          "category": "brevity"
        },
        {
          "id": "certifications",
          "label": "Certifications / licenses included",
          "status": "warn",
          "detail": "No certifications listed — add any you hold",
          "category": "credibility"
        },
        {
          "id": "no_repetition",
          "label": "No repeated achievements",
          "status": "pass",
          "detail": "Each bullet carries distinct content",
          "category": "impact"
        }
      ],
      "bulletAudit": [
        {
          "bulletId": "exp_001_b01",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Responsible for writing code for web applications using JavaScript and React.",
          "status": "fix",
          "reason": "Core development framed as a passive duty rather than active delivery",
          "rewrite": "Built web application features using JavaScript and React across [ADD: number of web applications deployed].",
          "issueId": "iss_002",
          "category": "clarity"
        },
        {
          "bulletId": "exp_001_b02",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Assisted senior developers with backend bug fixing and routine database maintenance tasks.",
          "status": "warn",
          "reason": "No number and no outcome verb — the work is invisible at a glance",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_001_b03",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Worked with team members in daily agile standup meetings.",
          "status": "fix",
          "reason": "Routine meeting attendance listed as an achievement",
          "rewrite": null,
          "issueId": "iss_003",
          "category": "clarity"
        },
        {
          "bulletId": "exp_001_b04",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Handled customer support tickets and investigated client issues in production.",
          "status": "fix",
          "reason": "Production troubleshooting lacks operational scope and volume",
          "rewrite": "Investigated and resolved production client issues and support tickets, resolving [ADD: average number of tickets resolved per week].",
          "issueId": "iss_004",
          "category": "outcome_visibility"
        },
        {
          "bulletId": "exp_001_b05",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Built REST APIs and wrote documentation for team members.",
          "status": "warn",
          "reason": "No number and no outcome verb — the work is invisible at a glance",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_002_b01",
          "section": "experience",
          "itemName": "Experience",
          "text": "Created landing pages for clients using HTML, CSS, and basic JavaScript.",
          "status": "warn",
          "reason": "No number and no outcome verb — the work is invisible at a glance",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_002_b02",
          "section": "experience",
          "itemName": "Experience",
          "text": "Attended weekly project status meetings with project managers.",
          "status": "warn",
          "reason": "No number and no outcome verb — the work is invisible at a glance",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_002_b03",
          "section": "experience",
          "itemName": "Experience",
          "text": "Updated content and images on WordPress websites.",
          "status": "warn",
          "reason": "No number and no outcome verb — the work is invisible at a glance",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_002_b04",
          "section": "experience",
          "itemName": "Experience",
          "text": "Tested website links and browser compatibility across Chrome and Safari.",
          "status": "warn",
          "reason": "No number and no outcome verb — the work is invisible at a glance",
          "rewrite": null,
          "issueId": null,
          "category": null
        }
      ],
      "summary": {
        "fix": 3,
        "warn": 6,
        "pass": 0,
        "checksPassed": 7,
        "checksTotal": 12,
        "strengths": 2,
        "issues": 5
      }
    },
    "overallReview": {
      "summary": "Jordan, your background shows a practical progression across both frontend interfaces and backend REST APIs. Having hands-on experience building React components, documenting APIs, and investigating live production issues gives you a solid foundation for junior full stack developer roles.\n\nThe main area to sharpen is how you communicate your daily impact. Right now, all 9 of your bullets describe tasks or routine meetings rather than measurable results. Upgrading passive phrases like \"responsible for\" to active verbs, cutting out meeting attendance bullets, and adding concrete ticket or project volumes will immediately make your technical contributions stand out to US engineering recruiters.",
      "tone": "conversational"
    },
    "issues": [
      {
        "id": "iss_001",
        "severity": "low",
        "category": "ats_readability",
        "title": "Extracted contact details merged into summary section",
        "diagnosis": "Your extracted resume text places contact details directly alongside your summary, which is worth checking for ATS-parsing safety.",
        "whyItMatters": "When applicant tracking systems parse a header merged into body text, contact fields like email and phone number can get misread or discarded, making it harder for recruiters to reach you directly.",
        "recommendation": "Ensure your name, email, phone number, and location sit cleanly in their own dedicated header block separate from the summary paragraph in your document source.",
        "correctedText": null,
        "metricDiscoveryQuestions": [],
        "evidence": [
          {
            "section": "summary",
            "itemId": "summary_001",
            "bulletId": "summary_001",
            "originalText": "Jordan Miller jordan.miller@example.com | (555) 789-0123 | Chicago, IL Hardworking software engineer looking to leverage my programming skills in a dynamic full stack development position. Responsible, detail-oriented team player with experience in multiple languages."
          }
        ],
        "correctionType": "none"
      },
      {
        "id": "iss_002",
        "severity": "medium",
        "category": "clarity",
        "title": "Core development framed as a passive duty rather than active delivery",
        "diagnosis": "The bullet begins with \"Responsible for writing code\", which reads like a job description duty rather than an active engineering contribution.",
        "whyItMatters": "Engineering recruiters scan quickly for what you personally built. Duty-oriented phrasing softens ownership and makes it harder to see what features or components you delivered.",
        "recommendation": "Lead with a power action verb such as \"Engineered\" or \"Built\" and define the scope of the web applications you contributed to.",
        "correctedText": "Built web application features using JavaScript and React across [ADD: number of web applications deployed].",
        "metricDiscoveryQuestions": [
          "How many web applications or distinct features did you build using JavaScript and React?",
          "What was the typical user base size or traffic volume for these web applications?"
        ],
        "evidence": [
          {
            "section": "experience",
            "itemId": "exp_001",
            "bulletId": "exp_001_b01",
            "originalText": "Responsible for writing code for web applications using JavaScript and React."
          }
        ],
        "correctionType": "rewrite"
      },
      {
        "id": "iss_003",
        "severity": "medium",
        "category": "clarity",
        "title": "Routine meeting attendance listed as an achievement",
        "diagnosis": "\"Worked with team members in daily agile standup meetings\" describes routine attendance rather than a technical deliverable or outcome.",
        "whyItMatters": "Attending standups is an expected baseline activity in software teams. Listing it as a standalone bullet uses up valuable resume space without highlighting technical skills.",
        "recommendation": "Replace this line with an engineering accomplishment, such as sprint deliverables completed, code reviews conducted, or cross-functional feature planning.",
        "correctedText": null,
        "metricDiscoveryQuestions": [
          "What specific features or sprint deliverables did you ship through your agile team cycles?",
          "Did you collaborate on peer code reviews or sprint planning that improved delivery turnaround?"
        ],
        "evidence": [
          {
            "section": "experience",
            "itemId": "exp_001",
            "bulletId": "exp_001_b03",
            "originalText": "Worked with team members in daily agile standup meetings."
          }
        ],
        "correctionType": "none"
      }
    ],
    "priorityActions": [
      {
        "priority": 1,
        "title": "Replace duty statements with active engineering verbs",
        "action": "Revise bullets starting with \"Responsible for\" and \"Assisted\" to power verbs like \"Built\", \"Engineered\", and \"Resolved\".",
        "reason": "Shifting from job descriptions to active contributions demonstrates ownership and makes your code contributions immediately visible."
      },
      {
        "priority": 2,
        "title": "Swap meeting attendance lines for technical contributions",
        "action": "Remove bullets that only mention attending agile standups or status meetings and replace them with sprint deliverables or feature releases.",
        "reason": "Recruiters already assume you attend meetings; dedicating bullets to attendance wastes space that could showcase technical output."
      },
      {
        "priority": 3,
        "title": "Quantify production troubleshooting volume",
        "action": "Add an estimate of weekly support tickets or client issues resolved to your production support bullet.",
        "reason": "Quantifying your debugging workload demonstrates operational reliability and capability in maintaining live web applications."
      }
    ]
  },
  career_health_score: 41,
  score_label: 'Emerging',
  scores: {
    resume: { score: 34, diagnosis: 'Lacks quantitative metrics and ATS context keywords.' },
    linkedin: { score: 38, diagnosis: 'Decent profile completeness but low weekly networking activity.' },
    outreach: { score: 22, diagnosis: 'Outreach volume is critically low, relying mostly on Easy Apply.' },
    interview: { score: 42, diagnosis: 'Good mock interview performance, needs structure for behavioral stories.' },
  },
  resume_json: {
    candidate_name: 'Arjun Mehta',
    target_role: 'Senior Full Stack Engineer',
    years_of_experience: '4.5 Years',
    visa_status: 'F-1 OPT (STEM Extension)',
    contact: { email: 'arjun.mehta@example.com', phone: '+1 (555) 234-5678', location: 'San Francisco, CA' },
    top_skills: ['React.js', 'Node.js', 'TypeScript', 'GraphQL', 'AWS (EC2/S3)', 'MongoDB', 'Docker', 'PostgreSQL'],
    missing_ats_keywords: ['Quantified ROI Metrics', 'Kubernetes Orchestration', 'STAR Achievement Bullets', 'CI/CD Automation'],
    ats_score: 68,
    strengths: [
      'Strong modern JavaScript/TypeScript framework ecosystem and full-stack API design',
      'Demonstrated high-throughput microservices and latency optimization in production',
      'Enterprise cloud deployments and automated multi-region infrastructure pipelines',
    ],
    red_flags: [
      'Achievement bullets lack quantifiable business metrics (%, $, latency, team size)',
      'Over-reliance on job board Easy Apply without proactive recruiter networking',
    ],
    experience_summary: [
      'Engineered web dashboards used by over 50,000 active monthly users.',
      'Restructured backend API endpoints, improving load performance by 40%.',
    ],
    executive_ai_critique:
      "Your resume displays solid technical depth, but in today's high-competition market, ATS algorithms auto-filter up to 75% of profiles. Your bullets emphasize routine duties rather than tangible business impact. Adding hard percentage figures, latency improvements, and missing ATS keywords will immediately double your recruiter screening callbacks.",
  },
  career_journey: {
    current_phase_id: 2,
    guide_message: "We're currently in the Positioning phase. Before we accelerate outbound visibility and interviews, we need to eliminate the resume conversion bottlenecks holding you back.",
  },
  funnel_stages: {
    applications_count: 100,
    recruiter_calls_count: 5,
    interviews_count: 1,
    final_rounds_count: 0,
    offers_count: 0,
    biggest_leak_stage: 'Recruiter Calls',
    diagnosis_message:
      'Most candidates drop off right between Applications and Recruiter Calls. Fix top-of-funnel keyword density and quantified metrics to double screening invitations.',
  },
  rejection_factors: [
    { name: 'Resume Impact & ATS Keywords', pct: 38, desc: 'ATS parser drop-offs & achievement bullets lacking quantifiable metrics.' },
    { name: 'Application Strategy & Timing', pct: 22, desc: 'Late submissions on public boards facing 300+ competing applicants.' },
    { name: 'LinkedIn Profile Optimization', pct: 17, desc: 'Incomplete headline keywords and low weekly outbound networking activity.' },
    { name: 'Interview Behavioral Stories', pct: 11, desc: 'Unstructured responses to leadership and scenario questions (STAR gap).' },
  ],
  rejection_insight: 'Resume formatting and missing ATS keywords cause 38% of your initial rejections. This is the single highest-impact friction point to fix.',
  risk_heatmap: {
    critical_risk: 'Visa Sponsorship Timeline',
    high_impact_low_likelihood: ['Recruiter Ghosting', 'Offer Rescinded'],
    low_impact_high_likelihood: ['ATS Parsing Errors', 'Initial Screen Fail'],
    mitigation_plan: 'Target employers with verified e-Verify certification and explicit H-1B sponsorship history to prevent late-stage interview dropouts.',
  },
  mission_board: {
    xp_level: 'Level 4: Career Explorer',
    xp_current: 410,
    missions: [
      { title: 'Rebuild Resume Bullets', xp: '+18 XP', impact: 'High Impact' },
      { title: 'Optimize LinkedIn Headline', xp: '+12 XP', impact: 'High Impact' },
      { title: 'Fix ATS Keyword Density', xp: '+15 XP', impact: 'High Impact' },
      { title: 'Add 2 Production Projects', xp: '+10 XP', impact: 'Medium Impact' },
      { title: '3 Mock Behavioral Interviews', xp: '+15 XP', impact: 'High Impact' },
    ],
  },
  critical_issues: [
    {
      id: 'ci1',
      title: 'Low Application-to-Interview Conversion',
      description: 'Your application volume is high but your response rate is critically low (95% drop-off). Your resume lacks ATS keywords and metrics for specific roles.',
      severity: 'High',
      category: 'Resume Positioning',
      affectedSection: 'Experience Section',
      whyItMatters: 'Recruiters scan resumes in 6-8 seconds. Without immediate quantified outcomes in your top bullets, you get screened out automatically.',
      evidence: {
        section: 'experience',
        itemId: 'exp_001',
        bulletId: 'exp_001_b01',
        originalText: 'Responsible for maintaining backend services, database migrations, and collaborating with cross-functional teams on feature delivery.',
      },
      action_steps: ['Remove graphs and double columns from your resume.', 'Optimize layout for standard ATS parsing formats.'],
      recommendation: 'Rephrase your bullets using Google STAR/XYZ formula with quantified revenue, latency, or scale figures.',
      correctedText: 'Architected and optimized Go backend microservices handling 45,000 req/sec, reducing p99 database query latency by 58% across $14M billing infrastructure.',
    },
    {
      id: 'ci2',
      title: 'Direct Outreach Strategy Gap',
      description: 'You are relying primarily on public job board Easy Apply. Over 80% of senior and mid-level roles are filled through warm or direct outreach.',
      severity: 'Medium',
      category: 'Outreach Strategy',
      affectedSection: 'Outreach Cadence',
      whyItMatters: 'Public postings receive 350+ applications in hours. Direct recruiter messages cut directly to the front of the hiring queue.',
      evidence: {
        section: 'networking',
        itemId: 'net_001',
        bulletId: 'net_001_b01',
        originalText: 'Applied to 100+ roles via LinkedIn Easy Apply with minimal outreach to hiring managers.',
      },
      action_steps: ['Identify 5 direct recruiters at target companies weekly.', 'Send brief personalized connection notes.'],
      recommendation: 'Send 5 personalized recruiter notes weekly with customized 3-sentence value propositions.',
      correctedText: 'Direct Recruiter Outreach Cadence: Identify hiring manager, pitch specific architecture alignment, and request a 10-minute briefing call.',
    },
    {
      id: 'ci3',
      title: 'Project Portfolio Lacks Enterprise Context',
      description: 'Bullet points without measurable metrics are overlooked by ATS and technical managers. Add concrete numbers: throughput, percentages, team sizes.',
      severity: 'Medium',
      category: 'Project Positioning',
      affectedSection: 'Projects Section',
      whyItMatters: 'Senior engineering hiring managers evaluate side projects to gauge technical depth and architectural decision-making.',
      evidence: {
        section: 'projects',
        itemId: 'proj_001',
        bulletId: 'proj_001_b01',
        originalText: 'Built a full-stack dashboard with React and Node.js for tracking user analytics.',
      },
      action_steps: ['Rephrase achievement bullets using the STAR/Google XYZ formula.', 'Add explicit dollar values or percentage metrics.'],
      recommendation: 'State the engineering motivation, throughput benchmark, and fault-tolerance architecture implemented.',
      correctedText: 'Engineered real-time distributed analytics pipeline in React, TypeScript, and Go with Kafka event streaming, serving 250,000 MAU with zero downtime.',
    },
  ],
  roadmap: [
    {
      week: 'Week 1',
      title: 'Foundation Sprint',
      tasks: [
        'ATS-optimize your resume for top 3 target roles',
        'Complete LinkedIn profile to 100% (All-Star status)',
        'Build a list of 50 target companies with verified hiring',
      ],
    },
    {
      week: 'Week 2',
      title: 'Outreach Blitz',
      tasks: [
        'Send 5 personalized cold notes to recruiters weekly',
        'Connect with 10 alumni or peers at target companies',
        'Request 2 informational interviews',
      ],
    },
    {
      week: 'Week 3',
      title: 'Interview Mastery',
      tasks: [
        'Complete 3 mock interviews (behavioral + technical)',
        'Prepare STAR stories for top 10 leadership questions',
        'Research salary benchmarks with Levels.fyi',
      ],
    },
    {
      week: 'Week 4',
      title: 'Pipeline Acceleration',
      tasks: [
        'Follow up on all pending applications',
        'Schedule a mock negotiation session',
        'Lock in final interview rounds',
      ],
    },
  ],
  coach_intervention: {
    urgency_statement: 'Self-guided job search duration currently averages 6–9 months in this market climate.',
    value_prop: 'Consulting with a senior talent partner eliminates ATS blind spots and matches you to unlisted direct channels.',
    cta_text: 'Book Free 1-on-1 Strategy Call',
  },
}

import ReportErrorBoundary from './ReportErrorBoundary'

export default function ReportDashboard() {
  return (
    <ReportErrorBoundary>
      <ReportDashboardContent />
    </ReportErrorBoundary>
  )
}

function ReportDashboardContent() {
  const storeReportData = useAppStore((s) => s.reportData)
  const userId = useAppStore((s) => s.userId)
  const email = useAppStore((s) => s.email)
  const formData = useAppStore((s) => s.formData)
  const setReportData = useAppStore((s) => s.setReportData)
  const reset = useAppStore((s) => s.reset)
  const setPhase = useAppStore((s) => s.setPhase)
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  const isMockPreview = typeof window !== 'undefined' && (
    window.location.search.includes('mock=true') ||
    window.location.pathname.toLowerCase() === '/report-preview'
  )

  const [isRecovering, setIsRecovering] = useState(false)
  const hasAttemptedRecovery = useRef(false)

  useEffect(() => {
    if (storeReportData || isMockPreview) return
    if (hasAttemptedRecovery.current) return
    if (!userId && !email) return

    hasAttemptedRecovery.current = true
    let isMounted = true
    setIsRecovering(true)

    api.getReport({ userId, email })
      .then((report) => {
        if (isMounted && report) {
          setReportData(report)
        }
      })
      .catch((err) => {
        console.warn('[ReportDashboard] Failed to fetch persisted report:', err)
      })
      .finally(() => {
        if (isMounted) setIsRecovering(false)
      })

    return () => { isMounted = false }
  }, [storeReportData, userId, email, isMockPreview, setReportData])

  const [activeDiagnosisTab, setActiveDiagnosisTab] = useState('resume')

  // Case 1: Fetching persisted report from backend for verified user
  if (isRecovering) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--surface-base)] text-[var(--text-primary)]">
        <div className="relative mb-6 w-16 h-16 flex items-center justify-center">
          <SpinnerGap size={40} className="animate-spin text-[var(--primary)]" />
        </div>
        <h2 className="text-xl font-bold mb-2 font-['Poppins']">Recovering Your Career GPS Report...</h2>
        <p className="text-sm text-[var(--text-tertiary)] max-w-sm text-center">
          Retrieving your verified assessment diagnosis and customized roadmap.
        </p>
      </div>
    )
  }

  // Case 2: Assessment completed + verified, but report generation pending
  const hasAssessmentData = Boolean(formData && Object.keys(formData).length >= 5)
  if (!storeReportData && !isMockPreview && userId && hasAssessmentData) {
    return <AnalysisLoader />
  }

  // Case 3: No report, and no active user session (cold visit to /report)
  if (!storeReportData && !isMockPreview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--surface-base)] text-[var(--text-primary)]">
        <div className="max-w-md w-full p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[var(--primary-subtle)] text-[var(--primary)] flex items-center justify-center mx-auto border border-[var(--border-default)]">
            <Compass size={36} weight="duotone" />
          </div>
          <h2 className="text-2xl font-bold font-['Poppins'] text-[var(--text-primary)]">
            No Assessment Found
          </h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            You haven't completed a Career GPS assessment yet, or your previous session has expired. Complete our 3-minute assessment to unlock your personalized career diagnosis.
          </p>
          <button
            onClick={() => {
              reset()
              setPhase(PHASES.ASSESSMENT)
              navigateTo('/')
            }}
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Start Assessment</span>
            <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      </div>
    )
  }

  const reportData = storeReportData || (isMockPreview ? MOCK_REPORT : null)
  if (!reportData) return null

  const rawName = reportData.resume_json?.candidate_name || reportData.resume_json?.name || reportData.candidate_name
  const candidateName = typeof rawName === 'string' ? rawName : (typeof rawName === 'object' ? (rawName?.name || 'Candidate') : 'Candidate')

  const rawRole = reportData.resume_json?.target_role || reportData.target_role
  const targetRole = typeof rawRole === 'string' ? rawRole : 'Senior Full Stack Engineer'


  const handleBookCall = async () => {
    if (email) {
      try {
        await api.bookCall({ email })
      } catch (err) {
        console.error('Failed to register book call lead:', err)
      }
    }
  }

  // Cross-component smooth navigation
  const handleNavigateSection = (sectionId, tabId = null) => {
    if (tabId) {
      setActiveDiagnosisTab(tabId)
    }
    const element = document.getElementById(sectionId)
    if (element) {
      const navOffset = 90
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({
        top: elementPosition - navOffset,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] transition-colors duration-150">
      {/* ─── Top Brand Header ─── */}
      <header
        role="banner"
        className="px-4 py-3.5 bg-[var(--surface-card)] border-b border-[var(--border-default)]"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={brandLogo}
              alt="Career GPS"
              className="w-8 h-8 rounded-lg shadow-xs object-cover border border-[var(--border-default)]"
            />
            <div>
              <span
                style={{ fontFamily: 'var(--font-head)', fontWeight: 800, letterSpacing: '-0.02em' }}
                className="text-base sm:text-lg text-[var(--text-primary)] block leading-tight"
              >
                CAREER <span className="text-[var(--primary)]">GPS</span>
              </span>
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                Executive Intelligence Report
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => useAppStore.getState().setPhase(PHASES.ASSESSMENT)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Return to assessment to re-test or edit inputs"
            >
              <ArrowsClockwise size={13} weight="bold" />
              <span className="hidden sm:inline">Retest / Edit Assessment</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-all cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
            </button>

            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 text-[var(--emerald)]">
              <ShieldCheck size={14} weight="fill" />
              <span>Verified Report</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Sticky Story Navigation Bar ─── */}
      <StickyReportNav candidateName={candidateName} targetRole={targetRole} />

      {/* ─── Main Story-Driven Content Container (Max Width 1200px) ─── */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        {/* SECTION A: REPORT HERO */}
        <ReportHero reportData={reportData} />

        {/* SECTION B: CAREER HEALTH SNAPSHOT */}
        <CareerHealthSnapshot
          scores={reportData.scores || reportData.score_breakdown}
          onNavigateSection={handleNavigateSection}
        />

        {/* SECTION C: PRIMARY BOTTLENECK (MOST IMPORTANT SECTION) */}
        <PrimaryBottleneck
          reportData={reportData}
          onNavigateSection={handleNavigateSection}
        />

        {/* SECTION D: WHAT IS WORKING (COMPACT STRENGTHS) */}
        <WhatIsWorking resumeJsonData={reportData.resume_json} />

        {/* SECTION E: WHERE YOU ARE LOSING OPPORTUNITIES (PRIORITIZED + RESUME EVIDENCE) */}
        <OpportunitiesList
          issues={reportData.critical_issues}
          resumeJsonData={reportData.resume_json}
        />

        {/* SECTION E2: AI RESUME DEEP DIAGNOSIS (V3.1 SCORECARD + BULLET AUDIT) */}
        <ResumeDeepDiagnosis resumeAgent={reportData.resume_agent} />

        {/* FUNNEL JOURNEY + WHY AREN'T INTERVIEWS CONVERTING + RISK RADAR */}
        <FunnelAndConversionSection
          funnelData={reportData.funnel_stages}
          rejectionData={{
            factors: reportData.rejection_factors,
            insight: reportData.rejection_insight,
          }}
          riskData={reportData.risk_heatmap}
        />

        {/* SECTION F: TOP PRIORITIES (WHAT TO FIX FIRST) */}
        <TopPriorities
          missionBoardData={reportData.mission_board}
          onNavigateSection={handleNavigateSection}
        />

        {/* SECTION G: 30 / 60 / 90 DAY ROADMAP */}
        <RoadmapTimeline
          roadmapData={reportData.roadmap}
          currentPhaseId={reportData.career_journey?.current_phase_id}
        />

        {/* SECTION H: DETAILED DIAGNOSIS (EXPANDABLE TABS) */}
        <DetailedDiagnosis
          reportData={reportData}
          initialTab={activeDiagnosisTab}
        />

        {/* SECTION I: FINAL NEXT ACTION */}
        <FinalNextAction
          coachData={reportData.coach_intervention}
          onBookCall={handleBookCall}
        />
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[var(--border-default)] py-8 text-center text-xs text-[var(--text-muted)] space-y-2">
        <p className="font-medium">
          Crafture Career GPS AI • Confidential Candidate Career Intelligence
        </p>
        <p className="text-[11px]">
          Proprietary scoring and ATS diagnostic algorithms. &copy; {new Date().getFullYear()} Crafture Inc. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
