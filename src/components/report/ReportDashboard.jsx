import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import {
  NavigationArrow,
  FileText,
  Warning,
  MapTrifold,
  Wrench,
  CalendarBlank,
} from '@phosphor-icons/react'
import useAppStore from '../../store/useAppStore'
import { api } from '../../lib/api'
import HeroScore from './HeroScore'
import ScoreCards from './ScoreCards'
import CriticalIssues from './CriticalIssues'
import RoadmapTimeline from './RoadmapTimeline'
import ToolStack from './ToolStack'

// Mock report for when API isn't available
const MOCK_REPORT = {
  career_health_score: 62,
  score_label: 'Survival Mode',
  scores: {
    resume: { score: 58, diagnosis: 'Lacks quantitative metrics and context keywords.' },
    linkedin: { score: 71, diagnosis: 'Decent profile completeness but low weekly networking activity.' },
    outreach: { score: 45, diagnosis: 'Outreach volume is critically low, relying mostly on applications.' },
    interview: { score: 74, diagnosis: 'Good mock interview performance, needs structure for behavioral stories.' }
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
    { week: 1, title: 'Foundation Sprint', tasks: ['ATS-optimize your resume for top 3 target roles', 'Complete LinkedIn profile to 100% (All-Star status)', 'Build a list of 50 target companies', 'Set up job alert automations on LinkedIn & Indeed'] },
    { week: 2, title: 'Outreach Blitz', tasks: ['Send 20 personalized cold emails to recruiters daily', 'Connect with 10 alumni at target companies', 'Request 2 informational interviews', 'Join 3 niche Slack/Discord job search communities'] },
    { week: 3, title: 'Interview Mastery', tasks: ['Complete 3 mock interviews (behavioral + technical)', 'Prepare STAR stories for top 10 interview questions', 'Research salary benchmarks with Levels.fyi & Glassdoor', 'Practice live coding on LeetCode (Easy-Medium)'] },
    { week: 4, title: 'Pipeline Acceleration', tasks: ['Follow up on all pending applications (email template)', 'Apply to 15 stretch roles and 15 target roles', 'Request LinkedIn recommendations from 2 former colleagues', 'Schedule a mock negotiation session'] },
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
    cta_text: 'Book Free Survival Strategy Call'
  },
  summary: 'Your job search has a strong application volume but a critical conversion gap. Prioritize resume quality over quantity, activate your network, and introduce structured outreach to 3x your interview rate.',
}

export default function ReportDashboard() {
  const reportData = useAppStore((s) => s.reportData) || MOCK_REPORT
  const email = useAppStore((s) => s.email)
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
    <div ref={containerRef} className="min-h-screen">
      {/* Header */}
      <header
        role="banner"
        className="sticky top-0 z-50 px-4 py-4 gsap-reveal"
        style={{ background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <NavigationArrow size={14} weight="fill" style={{ color: '#10b981' }} />
            </div>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              Career GPS Report
            </span>
          </div>
          <div
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}
          >
            AI-Generated
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        {/* Summary */}
        <section className="gsap-reveal glass p-6 rounded-2xl" aria-label="Executive Summary">
          <div className="flex gap-3">
            <FileText size={20} className="shrink-0 text-emerald-500 mt-0.5" />
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <span className="font-semibold text-emerald-500">Executive Summary — </span>
              {reportData.summary}
            </p>
          </div>
        </section>

        {/* Hero Score + Score Cards */}
        <section className="gsap-reveal" aria-label="Career Health Score Overview">
          <HeroScore score={reportData.career_health_score} scoreLabel={reportData.score_label} />
        </section>

        <section className="gsap-reveal" aria-label="Detailed Scores">
          <ScoreCards scores={reportData.scores} />
        </section>

        {/* Market Reality Check */}
        {reportData.market_reality_check && (
          <section className="gsap-reveal glass p-6 rounded-2xl border-red-500/10" style={{ background: 'rgba(239,68,68,0.02)' }} aria-labelledby="reality-check-title">
            <div className="flex items-center gap-2.5 mb-4 text-red-500">
              <Warning size={20} weight="bold" />
              <h2
                id="reality-check-title"
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {reportData.market_reality_check.headline || 'Market Reality Check'}
              </h2>
            </div>
            <div className="space-y-4">
              <ul className="space-y-3 list-none pl-0">
                {(reportData.market_reality_check.brutal_facts || []).map((fact, idx) => (
                  <li key={idx} className="text-sm text-white/70 flex items-start gap-2.5">
                    <span className="text-red-500 font-bold shrink-0 mt-0.5">•</span>
                    <span className="leading-relaxed">{fact}</span>
                  </li>
                ))}
              </ul>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 pt-4 border-t border-white/5">
                <div>
                  <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">Application Velocity Requirements</h4>
                  <p className="text-xs text-white/60 leading-relaxed">{reportData.market_reality_check.application_velocity}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">Resume Blackhole Risk</h4>
                  <p className="text-xs text-white/60 leading-relaxed">{reportData.market_reality_check.resume_blackhole}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Critical Issues */}
        <section className="gsap-reveal" aria-labelledby="critical-issues-title">
          <h2
            id="critical-issues-title"
            className="text-xl font-bold mb-5 flex items-center gap-2.5"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.9)' }}
          >
            <Warning size={20} className="text-amber-500" />
            <span>Critical Issues Identified</span>
          </h2>
          <CriticalIssues issues={reportData.critical_issues} />
        </section>

        {/* Roadmap */}
        <section className="gsap-reveal" aria-labelledby="roadmap-title">
          <h2
            id="roadmap-title"
            className="text-xl font-bold mb-5 flex items-center gap-2.5"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.9)' }}
          >
            <MapTrifold size={20} className="text-emerald-500" />
            <span>Your 4-Week Action Roadmap</span>
          </h2>
          <RoadmapTimeline weeks={reportData.roadmap} />
        </section>

        {/* Tools */}
        <section className="gsap-reveal" aria-labelledby="tools-title">
          <h2
            id="tools-title"
            className="text-xl font-bold mb-5 flex items-center gap-2.5"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'rgba(255,255,255,0.9)' }}
          >
            <Wrench size={20} className="text-emerald-500" />
            <span>Recommended Tool Stack</span>
          </h2>
          <ToolStack tools={reportData.recommended_tools} />
        </section>

        {/* CTA */}
        <section className="gsap-reveal glass p-8 rounded-2xl text-center emerald-glow" aria-label="Book a strategy call">
          <h3 className="text-2xl font-bold mb-3 text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Ready to accelerate your job search?
          </h3>
          {reportData.coach_intervention && (
            <div className="mb-6 max-w-xl mx-auto space-y-3">
              <p className="text-sm font-semibold text-emerald-400">
                {reportData.coach_intervention.urgency_statement}
              </p>
              <p className="text-xs text-white/60 leading-relaxed">
                {reportData.coach_intervention.value_prop}
              </p>
            </div>
          )}
          <a
            href="https://superprofile.bio/bookings/crafture?sessionId=678f9349e36a40199ee74cbe"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleBookCall}
            className="btn-primary text-base px-8 py-4 no-underline"
          >
            <CalendarBlank size={18} weight="bold" />
            <span>{reportData.coach_intervention?.cta_text || 'Book Free Strategy Call'}</span>
          </a>
        </section>

        <div className="pb-8" />
      </main>
    </div>
  )
}

