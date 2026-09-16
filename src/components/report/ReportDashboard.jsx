import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import {
  NavigationArrow,
  FileText,
  Warning,
  MapTrifold,
  CalendarBlank,
  Sun,
  Moon,
} from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'

// Import 8 Slide Components matching the exact Career Intelligence Report layout
import ReportHeaderCard from './ReportHeaderCard'
import CareerJourneyPhases from './CareerJourneyPhases'
import CareerHealthBreakdown from './CareerHealthBreakdown'
import FunnelLeakDiagram from './FunnelLeakDiagram'
import RejectionDonutChart from './RejectionDonutChart'
import RiskHeatMap from './RiskHeatMap'
import MissionBoard from './MissionBoard'
import GoalRoadmapPath from './GoalRoadmapPath'

import CriticalIssues from './CriticalIssues'
import ResumeAIBreakdown from './ResumeAIBreakdown'
import brandLogo from '../../assets/images/crafture-logo.jpg'

// Fallback report structure
const MOCK_REPORT = {
  career_health_score: 41,
  score_label: 'Emerging',
  scores: {
    resume: { score: 34, diagnosis: 'Lacks quantitative metrics and ATS context keywords.' },
    linkedin: { score: 38, diagnosis: 'Decent profile completeness but low weekly networking activity.' },
    outreach: { score: 22, diagnosis: 'Outreach volume is critically low, relying mostly on applications.' },
    interview: { score: 42, diagnosis: 'Good mock interview performance, needs structure for behavioral stories.' }
  },
  market_reality_check: {
    headline: 'U.S. IT Layoff Winter: You Must Be Visible To Survive',
    brutal_facts: [
      'Modern ATS algorithms auto-reject up to 75% of resumes containing visual charts or layout anomalies.',
      'Average job postings get 350+ applications within 4 hours, making standard Easy Apply useless.',
      'Layoffs in senior tech roles mean you are competing directly with overqualified talent.'
    ],
    application_velocity: 'Apply to at least 15-20 highly targeted roles weekly rather than standard spamming.',
    resume_blackhole: 'Standard templates without customized keyword matching get rejected instantly by parsers.'
  },
  critical_issues: [
    {
      id: 'ci1',
      title: 'Low Application-to-Interview Conversion',
      description: 'Your application volume is high but your response rate is critically low. Your resume likely lacks ATS optimization for specific roles.',
      severity: 'High',
      icon: 'alert-triangle',
      action_steps: ['Remove graphs and double columns from your resume.', 'Optimize layout for standard ATS parsing formats.']
    },
    {
      id: 'ci2',
      title: 'Outreach Strategy Gap',
      description: 'You are not leveraging cold outreach or LinkedIn networking at scale. 80% of jobs are filled before they are posted.',
      severity: 'High',
      icon: 'zap-off',
      action_steps: ['Identify 5 direct recruiters at target companies weekly.', 'Send brief personalized connection notes.']
    },
    {
      id: 'ci3',
      title: 'Resume Lacks Quantified Impact',
      description: 'Bullet points without measurable metrics are ignored by ATS and hiring managers. Add numbers: revenue, percentages, team sizes.',
      severity: 'Medium',
      icon: 'shield-off',
      action_steps: ['Rephrase achievement bullets using the STAR/Google XYZ formula.', 'Add explicit dollar values or percentage metrics.']
    },
  ],
  roadmap: [
    { week: 'Week 1', title: 'Foundation Sprint', tasks: ['ATS-optimize your resume for top 3 target roles', 'Complete LinkedIn profile to 100% (All-Star status)', 'Build a list of 50 target companies', 'Set up job alert automations on LinkedIn & Indeed'] },
    { week: 'Week 2', title: 'Outreach Blitz', tasks: ['Send 20 personalized cold emails to recruiters daily', 'Connect with 10 alumni at target companies', 'Request 2 informational interviews', 'Join 3 niche Slack/Discord job search communities'] },
    { week: 'Week 3', title: 'Interview Mastery', tasks: ['Complete 3 mock interviews (behavioral + technical)', 'Prepare STAR stories for top 10 interview questions', 'Research salary benchmarks with Levels.fyi & Glassdoor', 'Practice live coding on LeetCode (Easy-Medium)'] },
    { week: 'Week 4', title: 'Pipeline Acceleration', tasks: ['Follow up on all pending applications (email template)', 'Apply to 15 stretch roles and 15 target roles', 'Request LinkedIn recommendations from 2 former colleagues', 'Schedule a mock negotiation session'] },
  ],
  recommended_tools: [
    { name: 'Jobscan', category: 'ATS Resume Scanner', url: 'https://jobscan.co', icon: '🎯' },
    { name: 'Teal HQ', category: 'Job Tracker', url: 'https://tealhq.com', icon: '📊' },
    { name: 'Otta', category: 'Smart Job Board', url: 'https://otta.com', icon: '💼' },
    { name: 'Lemlist', category: 'Cold Email Outreach', url: 'https://lemlist.com', icon: '📧' },
    { name: 'Pramp', category: 'Mock Interviews', url: 'https://pramp.com', icon: '🎤' },
    { name: 'Levels.fyi', category: 'Salary Intelligence', url: 'https://levels.fyi', icon: '💰' },
  ],
  coach_intervention: {
    urgency_statement: 'Self-guided job search duration currently averages 6-9 months in the current climate.',
    value_prop: 'Consulting with a recruiter partner cuts search times in half by matching you to unlisted direct channels.',
    cta_text: 'Book Free Strategy Call'
  },
  summary: 'Your job search has a strong application volume but a critical conversion gap. Prioritize resume quality over quantity, activate your network, and introduce structured outreach to 3x your interview rate.',
}

export default function ReportDashboard() {
  const reportData = useAppStore((s) => s.reportData) || MOCK_REPORT
  const email = useAppStore((s) => s.email)
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const containerRef = useRef(null)

  const handleBookCall = async () => {
    if (email) {
      try {
        await api.bookCall({ email })
      } catch (err) {
        console.error('Failed to register book call lead:', err)
      }
    }
  }

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Stagger reveal all sections
      gsap.from('.gsap-reveal', {
        opacity: 0,
        y: 40,
        duration: 0.7,
        stagger: 0.12,
        ease: 'power3.out',
        delay: 0.2,
      })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="min-h-screen pb-16 bg-[var(--surface-base)] text-[var(--text-primary)]">
      {/* Sticky Header */}
      <header
        role="banner"
        className="sticky top-0 z-50 px-4 py-4 gsap-reveal bg-[var(--surface-base)] border-b border-[var(--border-default)] backdrop-blur-md"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={brandLogo}
              alt="Career GPS"
              className="w-8 h-8 rounded-lg shadow-sm object-cover border border-[var(--border-default)]"
            />
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, letterSpacing: '-0.02em' }} className="text-base sm:text-lg text-[var(--text-primary)]">
              CAREER <span className="text-[var(--primary)]">GPS</span> <span className="text-[var(--text-muted)] font-semibold text-xs sm:text-sm tracking-wider uppercase ml-1">INTELLIGENCE REPORT</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => useAppStore.getState().setPhase(PHASES.ASSESSMENT)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Return to assessment to re-test or edit inputs"
            >
              <span>⚡ Retest / Edit Assessment</span>
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-strong)] transition-all cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
            </button>
            <div
              className="hidden sm:block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[var(--emerald-bg)] border border-[var(--border-default)] text-[var(--emerald)]"
            >
              Confidential Report
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* SLIDE 01: Cover Header & Candidate Context Card */}
        <section className="gsap-reveal">
          <ReportHeaderCard candidateData={reportData.resume_json} />
        </section>

        {/* Executive Summary */}
        <section className="gsap-reveal quiz-card p-6 sm:p-8 border border-emerald-500/25 bg-emerald-500/5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-[var(--emerald)] shrink-0 mt-0.5">
              <FileText size={24} weight="bold" />
            </div>
            <div className="space-y-1.5 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--emerald)] block">
                Executive Strategic Summary
              </span>
              <p className="text-base sm:text-lg leading-relaxed text-[var(--text-primary)] font-medium">
                {reportData.summary}
              </p>
            </div>
          </div>
        </section>

        {/* SLIDE 02: Where Am I In My Career Journey? (Phases Pipeline) */}
        <section className="gsap-reveal">
          <CareerJourneyPhases data={reportData.career_journey} />
        </section>

        {/* SLIDE 03: Career Health Dashboard (Circular Gauge + 10 Metrics) */}
        <section className="gsap-reveal">
          <CareerHealthBreakdown
            healthScore={reportData.career_health_score}
            scoreLabel={reportData.score_label}
            scores={reportData.scores}
          />
        </section>

        {/* AI Resume JSON Breakdown & Text Assistant */}
        <section className="gsap-reveal">
          <ResumeAIBreakdown resumeJsonData={reportData.resume_json} />
        </section>

        {/* SLIDE 04: Where Am I Losing Interviews? (Inverted Funnel Diagram) */}
        <section className="gsap-reveal">
          <FunnelLeakDiagram data={reportData.funnel_stages} />
        </section>

        {/* SLIDE 05: Why Am I Not Getting Hired? (Rejection Factor Donut Chart) */}
        <section className="gsap-reveal">
          <RejectionDonutChart factors={reportData.rejection_factors} insight={reportData.rejection_insight} />
        </section>

        {/* SLIDE 06: Career Risk Heat Map (2x2 Matrix Grid) */}
        <section className="gsap-reveal">
          <RiskHeatMap data={reportData.risk_heatmap} />
        </section>

        {/* SLIDE 07: Top 10 Priorities (Your Mission Board + XP Level) */}
        <section className="gsap-reveal">
          <MissionBoard data={reportData.mission_board} />
        </section>

        {/* SLIDE 08: Your Roadmap To The Goal (4-Phase Pathway) */}
        <section className="gsap-reveal">
          <GoalRoadmapPath data={reportData.roadmap} currentPhaseId={reportData.career_journey?.current_phase_id} />
        </section>

        {/* Critical Issues Identified */}
        <section className="gsap-reveal">
          <h2
            className="text-2xl font-bold mb-5 flex items-center gap-3 text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            <Warning size={26} className="text-amber-500 shrink-0" weight="fill" />
            <span>Critical Bottlenecks Identified</span>
          </h2>
          <CriticalIssues issues={reportData.critical_issues} />
        </section>

        {/* Free Strategy Call CTA */}
        <section className="gsap-reveal quiz-card p-8 sm:p-10 text-center relative overflow-hidden border border-[var(--primary)]/20 shadow-lg">
          <div className="max-w-2xl mx-auto space-y-4">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
              Ready to fix these gaps & land your dream offer?
            </h3>
            {reportData.coach_intervention && (
              <div className="space-y-2">
                <p className="text-base sm:text-lg font-bold text-[var(--primary)]">
                  {reportData.coach_intervention.urgency_statement}
                </p>
                <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                  {reportData.coach_intervention.value_prop}
                </p>
              </div>
            )}
            <div className="pt-2">
              <a
                href="https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleBookCall}
                className="btn-primary text-base px-8 py-4 no-underline inline-flex items-center gap-2.5 shadow-md hover:scale-105 transition-all"
              >
                <CalendarBlank size={22} weight="bold" />
                <span>{reportData.coach_intervention?.cta_text || 'Book Free Strategy Call'}</span>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
