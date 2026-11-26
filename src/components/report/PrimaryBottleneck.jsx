import { motion } from 'framer-motion'
import TeaserLockBlock from '../TeaserLockBlock'
import {
  Warning,
  Lightbulb,
  CheckCircle,
  ArrowRight,
  ShieldWarning,
  EyeSlash,
  Clock,
  Wrench,
  TrendUp,
  MapPin,
  Flag,
} from '@phosphor-icons/react'

function safeText(val, fallback = '') {
  if (!val) return fallback
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) {
    const joined = val.map((v) => safeText(v)).filter(Boolean).join(' ')
    return joined || fallback
  }
  if (typeof val === 'object') {
    return (
      val.title ||
      val.text ||
      val.description ||
      val.diagnosis ||
      val.action ||
      val.step ||
      val.message ||
      fallback
    )
  }
  return fallback
}

export default function PrimaryBottleneck({ reportData, onNavigateSection, isTeaserLocked = false, bookingUrl = '', onOpenUnlockModal }) {
  const phase = reportData?.phase ?? {
    id: 1,
    name: 'Resume → Screening Call',
    shortName: 'Top of Funnel',
    stuckDescription: 'Not getting or getting very few recruiter screening calls.',
    metricGoal: 'Achieve >5% application-to-screen callback conversion.',
    confidence: 'High',
  }

  const isPhase2Healthy = Boolean(
    reportData?.funnel_stages?.isPhase2Healthy ||
    reportData?.funnel_stages?.stateMachine?.isPhase2Healthy ||
    Number(phase?.id || reportData?.phase?.id) >= 3 ||
    /technical|final|offer/i.test(phase?.name || phase?.shortName || reportData?.phase?.name || '')
  )

  let primaryBottleneck = reportData?.primary_bottleneck ?? (
    isPhase2Healthy
      ? {
          title: 'System Architecture & Technical Panel Conversion',
          whyItMatters: 'Resume passes initial screening filters, but conversion drops during deeper architectural design, failure mode defense, and live panel questioning.',
          evidence: 'Screening callback rate is healthy (>= 5.0%), but technical-to-final conversion drops below benchmark targets.',
        }
      : {
          title: reportData?.critical_issues?.[0]?.title || 'Top-of-Page ATS Filtering & Lack of Quantified Impact',
          whyItMatters: reportData?.critical_issues?.[0]?.whyItMatters || 'Recruiters scan applications in under 10 seconds. Generic task bullets without hard numbers trigger automated filtering.',
          evidence: reportData?.critical_issues?.[0]?.diagnosis || 'Achievement bullets lack hard numbers and Google XYZ outcome structure.',
        }
  )

  const answers = reportData?.user_answers || reportData?.answers || {}
  const hasValidLinkedin = Boolean(
    (answers.linkedin && typeof answers.linkedin === 'string' && answers.linkedin.trim().length > 3) ||
    (answers.linkedinUrl && typeof answers.linkedinUrl === 'string' && answers.linkedinUrl.trim().length > 3) ||
    (answers['linkedin-url'] && typeof answers['linkedin-url'] === 'string' && answers['linkedin-url'].trim().length > 3) ||
    (typeof answers.contact?.linkedin === 'string' && answers.contact.linkedin.trim().length > 3) ||
    (reportData?.linkedin_json && Object.keys(reportData.linkedin_json).length > 0) ||
    (reportData?.linkedin_agent?.dataAvailable === true) ||
    (reportData?.linkedin_agent?.inferredFromResume === true)
  )
  const isPhase3Or4 = Number(phase?.id || reportData?.phase?.id) >= 3 || /technical|final|offer/i.test(phase?.name || phase?.shortName || reportData?.phase?.name || '')

  const bottleneckTitle = safeText(primaryBottleneck.title || primaryBottleneck)
  if ((hasValidLinkedin || isPhase3Or4) && /blank linkedin|blank profile|completely blank linkedin/i.test(bottleneckTitle)) {
    primaryBottleneck = isPhase3Or4 ? {
      title: 'Technical Case-Study Depth & Architectural Tradeoff Articulation',
      category: 'technical_evaluation',
      whyItMatters: 'Later-stage rounds evaluate how you justify design tradeoffs and diagnose failure modes under ambiguity.',
      evidence: 'Candidate reaches technical/final rounds but experiences conversion friction during deep architectural probes.',
    } : {
      title: 'Top-of-Page ATS Keyword Alignment & Metric Gaps',
      category: 'ats_readability',
      whyItMatters: 'Recruiters scan applications in under 10 seconds. Missing metrics and generic task bullets cause automated screening drops before humans review.',
      evidence: reportData?.resume_agent?.issues?.[0]?.diagnosis || 'Resume bullets lack quantified metrics and Google XYZ achievement structure.',
    }
  }

  const whyItMattersText = safeText(primaryBottleneck.whyItMatters || primaryBottleneck.diagnosis)
  const phaseStuckText = safeText(phase.stuckDescription)

  // Guarantee non-repetition between Where You Are Stuck and Why You Are Stuck
  const effectivePhaseDescription =
    phaseStuckText && phaseStuckText !== whyItMattersText
      ? phaseStuckText
      : `Candidate pipeline stalls at Phase ${phase.id}: ${phase.shortName || phase.name} where conversion drops below target benchmarks.`

  const effectiveWhyItMatters =
    whyItMattersText && whyItMattersText !== phaseStuckText
      ? whyItMattersText
      : (primaryBottleneck.diagnosis || (isPhase2Healthy ? 'Technical rounds require structured architecture walkthroughs and tradeoff defense.' : 'Achievement bullets describe passive duties rather than quantified outcomes, triggering automated ATS filtering.'))

  const secondaryProblem = reportData?.secondary_problem ?? {
    title: 'Over-Reliance on Public Job Boards & Low Outreach Velocity',
    description: 'Submitting through standard Easy Apply boards produces low ATS conversion compared to direct recruiter outreach or referrals.',
  }

  // Top 3 Prioritized Actions
  const topActions = Array.isArray(reportData?.top_actions) && reportData.top_actions.length > 0
    ? reportData.top_actions.slice(0, 3)
    : (isPhase2Healthy
        ? [
            {
              title: 'System Design & Tradeoff Deep-Dives',
              category: 'Technical Interview Mastery',
              whyItMatters: 'Later-stage rounds evaluate scalable architecture, failure mode defense, and trade-off justification.',
              whatToDo: 'Prepare end-to-end architectural walkthroughs highlighting failure modes, caching strategies, and data consistency tradeoffs.',
              resourceTool: 'Crafture Technical Deep-Dive Framework',
              duration: '4–6 hours',
              successMetric: 'Pass rate on system design and technical rounds >= 40%',
            },
            {
              title: 'Behavioral Impact & STAR Alignment',
              category: 'Panel Communication',
              whyItMatters: 'Hiring managers evaluate engineering maturity, ambiguity resolution, and cross-functional leadership.',
              whatToDo: 'Structure 5 comprehensive STAR stories emphasizing technical complexity, tradeoff ownership, and verified business outcomes.',
              resourceTool: 'STAR Interview Coach',
              duration: '2–3 hours',
              successMetric: 'Consistent positive signals in panel debriefs',
            },
            {
              title: 'Live Technical Execution Rehearsal',
              category: 'Technical Execution',
              whyItMatters: 'Communicating architectural decisions out loud prevents cognitive overload during live coding.',
              whatToDo: 'Practice walking through algorithm trade-offs and edge cases out loud before writing production-grade code.',
              resourceTool: 'Live Technical Simulator',
              duration: '45 mins / day',
              successMetric: 'Zero friction in live technical problem-solving sessions',
            },
          ]
        : [
            {
              title: 'Quantify Top 5 Resume Bullets',
              category: 'Resume Optimization',
              whyItMatters: 'Recruiters screen for business ROI and verifiable scale metrics within 6 seconds.',
              whatToDo: 'Rewrite your 5 most recent role bullets using Google XYZ formula (Accomplished [X], as measured by [Y], by doing [Z]).',
              resourceTool: 'Crafture STAR Bullet Rewriter',
              duration: '3–5 hours',
              successMetric: '100% of top role bullets contain verified hard numbers',
            },
            {
              title: 'Direct Hiring Manager & Referral Pipeline',
              category: 'Networking Velocity',
              whyItMatters: 'Employee referrals and direct messages convert to interviews at 4x the rate of cold portals.',
              whatToDo: 'Identify 5 engineering hiring managers or alumni at target companies weekly and send personalized 50-word notes.',
              resourceTool: 'LinkedIn InMail Framework',
              duration: '45 mins / day',
              successMetric: '5 targeted outreach messages sent weekly with >= 15% response rate',
            },
            {
              title: 'Target JD Keyword Alignment',
              category: 'ATS Optimization',
              whyItMatters: 'ATS parsers check for keyword frequency and density matching job descriptions.',
              whatToDo: 'Incorporate core technical stack keywords evidenced in your actual work experience into bullet descriptions.',
              resourceTool: 'Crafture JD Skill Matcher',
              duration: '1–2 hours',
              successMetric: 'Match score >= 75% on target job descriptions',
            },
          ]
      )

  return (
    <section id="bottleneck" className="space-y-6">
      {/* Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs font-mono text-amber-600 dark:text-amber-400 block">
            6-Phase Root Cause Diagnosis
          </span>
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            Where & Why You Are Stuck
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Clear separation between your pipeline drop-off location and the underlying root cause
        </p>
      </div>

      {/* 2-Part Framework: WHERE YOU ARE STUCK vs WHY YOU ARE STUCK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* WHERE YOU ARE STUCK (Current Phase) */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] flex flex-col justify-between shadow-xs relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] text-xs font-mono text-[var(--text-primary)] border border-[var(--border-default)]">
                <MapPin size={14} weight="bold" />
                Where You Are Stuck
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${phase.isProvisional ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                {phase.isProvisional ? 'Provisional' : `Confidence: ${phase.confidence || 'High'}`}
              </span>
            </div>

            <div>
              <span className="text-xs font-mono text-[var(--text-muted)] block mb-1">
                Detected Hiring Phase
              </span>
              <h3
                className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                Phase {phase.id}: {phase.name}
              </h3>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)]">
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {effectivePhaseDescription}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-[var(--text-muted)] font-mono block">
                Target Phase Metric Goal:
              </span>
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                {phase.metricGoal || 'Achieve consistent progression to next interview round.'}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)] mt-4">
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              Phase priority evaluated using deterministic 90-day funnel data.
            </span>
          </div>
        </div>

        {/* WHY YOU ARE STUCK (Primary & Secondary Root Cause) */}
        <div
          className="lg:col-span-7 p-5 sm:p-6 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] flex flex-col justify-between shadow-xs relative overflow-hidden"
          data-mascot-cue={`Critical root bottleneck detected: "${safeText(primaryBottleneck.title)}". Focus your immediate efforts here.`}
          data-mascot-chip="Bottleneck Focus"
          data-mascot-emotion="alert"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-sunken)] text-xs font-mono text-[var(--text-primary)] border border-[var(--border-default)]">
                <ShieldWarning size={14} weight="bold" />
                Why You Are Stuck (Root Cause)
              </span>
              <span className="text-xs font-mono text-red-600 font-semibold">
                Primary Friction
              </span>
            </div>

            {/* Primary Root Cause */}
            <div className="space-y-2">
              <span className="text-[10px] text-red-600 font-mono block">
                1. Primary Root Cause
              </span>
              <h3
                className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] tracking-tight leading-snug"
                style={{ fontFamily: 'var(--font-head)' }}
              >
                &ldquo;{primaryBottleneck.title}&rdquo;
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {effectiveWhyItMatters}
              </p>
            </div>

            {/* Secondary Root Cause */}
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5">
              <span className="text-[10px] text-amber-600 font-mono block">
                2. Secondary Root Cause
              </span>
              <h4 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                {secondaryProblem.title}
              </h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {secondaryProblem.description}
              </p>
            </div>
          </div>

          {/* Next Best Action Banner */}
          <div className="mt-4 p-3.5 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-default)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-emerald-700 font-mono block">
                Immediate Next Best Action
              </span>
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {reportData?.next_best_action || 'Rewrite top 5 resume achievement bullets with hard numbers'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onNavigateSection) onNavigateSection('resume-ai')
                else document.getElementById('resume-ai')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="shrink-0 text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Execute</span>
              <ArrowRight size={13} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {/* Top 3 Prioritized Actions Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag size={18} weight="bold" className="text-[var(--primary)]" />
            <h3 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              Top 3 Prioritized Actions
            </h3>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Ordered by immediate hiring ROI
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topActions.map((action, idx) => {
            if (action?.locked) {
              return (
                <TeaserLockBlock
                  key={idx}
                  variant="fade"
                  isLocked={true}
                  bookingUrl={bookingUrl}
                  onUnlock={onOpenUnlockModal}
                  contextLabel="Priority Action #3"
                  label="Unlock Action #3 in your free 15-min call →"
                  heightClass="max-h-[240px]"
                >
                  <div className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] space-y-4 h-full">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-md bg-[var(--surface-sunken)] text-[var(--text-primary)] text-xs font-semibold flex items-center justify-center font-mono border border-[var(--border-default)]">
                        #3
                      </span>
                      <div className="h-5 w-24 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                    </div>
                    <div className="h-5 w-4/5 bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                    <div className="h-14 w-full bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                    <div className="h-16 w-full bg-slate-200/80 dark:bg-slate-800/70 animate-none rounded" />
                  </div>
                </TeaserLockBlock>
              )
            }
            const actionCard = (
              <div
                key={idx}
                className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-colors flex flex-col justify-between shadow-xs space-y-4 break-inside-avoid page-break-inside-avoid print-card h-full"
              >
                <div className="space-y-3">
                  {/* Header: Priority Number + Category */}
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-md bg-[var(--surface-sunken)] text-[var(--text-primary)] text-xs font-semibold flex items-center justify-center font-mono border border-[var(--border-default)]">
                      #{idx + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-muted)]">
                      {action.category || 'Strategic Fix'}
                    </span>
                  </div>

                  {/* Action Title */}
                  <h4 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] leading-snug">
                    {action.title}
                  </h4>

                  {/* Why It Matters */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                      Why It Matters:
                    </span>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {action.whyItMatters}
                    </p>
                  </div>

                  {/* Concrete What To Do */}
                  <div className="p-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] space-y-1">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                      What To Do:
                    </span>
                    <p className="text-xs font-medium text-[var(--text-primary)] leading-relaxed">
                      {action.whatToDo}
                    </p>
                  </div>
                </div>

                {/* Action Metadata: Resource, Duration, Metric */}
                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <Wrench size={13} />
                      Tool:
                    </span>
                    <span className="font-semibold text-[var(--text-secondary)] truncate max-w-[160px]">
                      {action.resourceTool || 'Crafture Framework'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock size={13} />
                      Effort:
                    </span>
                    <span className="font-semibold text-[var(--text-secondary)] font-mono">
                      {action.duration || '2–4 hours'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <TrendUp size={13} />
                      Metric:
                    </span>
                    <span className="font-semibold text-emerald-500 truncate max-w-[160px]">
                      {action.successMetric || 'Measurable callback lift'}
                    </span>
                  </div>
                </div>
              </div>
            )

            if (isTeaserLocked && idx === 2) {
              return (
                <TeaserLockBlock
                  key={idx}
                  variant="fade"
                  isLocked={true}
                  bookingUrl={bookingUrl}
                  onUnlock={onOpenUnlockModal}
                  contextLabel="Priority Action #3"
                  label="Unlock Action #3 in your free 15-min call →"
                  heightClass="max-h-[240px]"
                >
                  {actionCard}
                </TeaserLockBlock>
              )
            }

            return actionCard
          })}
        </div>
      </div>
    </section>
  )
}
