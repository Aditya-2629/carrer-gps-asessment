import { motion } from 'framer-motion'
import { Star } from '@phosphor-icons/react'

export default function CareerHealthBreakdown({
  healthScore,
  scoreLabel,
  fourPillars,
  scores,
  reportData,
}) {
  const resolvedFourPillars =
    fourPillars ||
    reportData?.score_breakdown ||
    reportData?.gps_scores?.four_pillars ||
    scores?.four_pillars ||
    scores ||
    {}

  const rawHealth =
    healthScore ??
    (typeof reportData?.career_health_score === 'object' && reportData?.career_health_score !== null
      ? reportData.career_health_score.overall
      : reportData?.career_health_score) ??
    reportData?.score ??
    50

  const resolvedHealthScore = Math.min(100, Math.max(0, Number(rawHealth) || 50))

  const resolvedScoreLabel =
    scoreLabel ||
    reportData?.score_label ||
    (resolvedHealthScore >= 75
      ? 'Strong'
      : resolvedHealthScore >= 50
      ? 'Developing'
      : 'Emerging')

  // 1. Core 4 Equal-Weight Pillars (25% each)
  const resumeScore =
    resolvedFourPillars?.resume?.score ??
    reportData?.resume_agent?.dashboard?.score ??
    70
  const linkedinScore =
    resolvedFourPillars?.linkedin?.score ??
    reportData?.linkedin_agent?.score ??
    65
  const outreachScore =
    resolvedFourPillars?.outreach?.score ??
    60
  const interviewScore =
    resolvedFourPillars?.interviews?.score ??
    55

  // 2. Computed Sub-dimensions from agent telemetry
  const resumeAgent = reportData?.resume_agent || {}
  const quantDensity = resumeAgent?.precomputedSignals?.quantification?.density
  const impactBulletScore = typeof quantDensity === 'number'
    ? Math.round(quantDensity * 100)
    : (resumeAgent?.dashboard?.grades?.impact?.score ?? Math.min(100, Math.round(resumeScore * 0.95)))

  const linkedinAgent = reportData?.linkedin_agent || {}
  const discrepanciesCount = Array.isArray(linkedinAgent?.discrepancies)
    ? linkedinAgent.discrepancies.length
    : (linkedinAgent?.discrepanciesCount ?? 0)
  const crossConsistencyScore = linkedinAgent?.crossAnalysis?.consistencyScore ??
    Math.max(35, 100 - discrepanciesCount * 15)

  const userAnswers = reportData?.user_answers || {}
  const f90 = userAnswers?.funnel90d || {}
  const apps = Number(f90.applications90d || userAnswers.apps30d || 20)
  const screens = Number(f90.recruiterScreens || f90.screens || userAnswers.interviews || 0)
  const techs = Number(f90.technicalRounds || f90.assessments || 0)

  const targetedAppRatio = Math.min(
    100,
    Math.max(30, Math.round(outreachScore * 1.05))
  )

  const screenToTechConversion = screens > 0
    ? Math.min(100, Math.round((techs / screens) * 100))
    : Math.min(100, Math.max(25, Math.round(interviewScore * 0.9)))

  const metrics = [
    { name: 'Resume & ATS Readability', score: resumeScore, target: 85, key: 'resume' },
    { name: 'LinkedIn & Brand Authority', score: linkedinScore, target: 80, key: 'linkedin' },
    { name: 'Outreach & Referral Velocity', score: outreachScore, target: 75, key: 'outreach' },
    { name: 'Interview & Conversion Defense', score: interviewScore, target: 75, key: 'interviews' },
    { name: 'Quantified Impact Bullets', score: impactBulletScore, target: 80, key: 'quant_impact' },
    { name: 'Cross-Channel Consistency', score: crossConsistencyScore, target: 85, key: 'consistency' },
    { name: 'Targeted Application Ratio', score: targetedAppRatio, target: 75, key: 'app_ratio' },
    { name: 'Screen-to-Tech Conversion', score: screenToTechConversion, target: 70, key: 'conversion' },
  ]

  // Find strongest metric and lagging metrics dynamically
  const sortedMetrics = [...metrics].sort((a, b) => b.score - a.score)
  const strongest = sortedMetrics[0] || metrics[0]
  const lagging = sortedMetrics.slice(-2)

  return (
    <div className="quiz-card p-6 md:p-8 border border-[var(--border-default)] space-y-6">
      {/* Executive Section Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-light)] text-xs font-bold uppercase tracking-wider text-[var(--primary)] border border-[var(--primary)]/20 shadow-2xs">
            <span>Career Intelligence Breakdown</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight" style={{ fontFamily: 'var(--font-head)' }}>
            How Healthy Is My Job Search Pipeline?
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium">
            Bar = your current calibrated score | <span className="text-[var(--text-primary)] font-semibold">Tick line = competitive hiring target</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Gauge Circle */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 quiz-card border border-[var(--border-default)] bg-[var(--surface-sunken)] text-center">
          <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Circle SVG Progress */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="var(--border-default)" strokeWidth="10" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="var(--primary)"
                strokeWidth="10"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * resolvedHealthScore) / 100}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-5xl font-extrabold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-head)' }}>
                {resolvedHealthScore}
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono font-semibold">/100</span>
            </div>
          </div>

          <span className="mt-4 text-xs font-mono uppercase font-bold tracking-wider text-[var(--text-muted)]">CAREER HEALTH INDEX</span>
          <span className="mt-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            {resolvedScoreLabel}
          </span>
        </div>

        {/* Right: Dynamic Parameter Bars */}
        <div className="lg:col-span-8 space-y-3">
          {metrics.map((item) => (
            <div key={item.name} className="flex items-center gap-3.5 text-sm">
              <span className="w-44 text-[var(--text-primary)] truncate font-semibold">{item.name}</span>

              {/* Progress Bar Container */}
              <div className="flex-1 h-4 bg-[var(--surface-sunken)] rounded-full overflow-hidden relative border border-[var(--border-default)]">
                {/* Target Marker Tick Line */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-[var(--text-muted)] z-10 opacity-70"
                  style={{ left: `${item.target}%` }}
                  title={`Target: ${item.target}`}
                />

                {/* Score Bar */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.score}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    item.score >= item.target
                      ? 'bg-[var(--emerald)] shadow-lg shadow-emerald-500/20'
                      : item.score >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500/80'
                  }`}
                />
              </div>

              <span className="w-10 text-right font-mono font-extrabold text-sm text-[var(--text-primary)]">{item.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Insight Box */}
      <div className="quiz-card p-5 border border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3.5 shadow-2xs">
        <Star size={24} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm md:text-base text-[var(--text-primary)] leading-relaxed font-medium">
          <strong className="text-[var(--emerald)] font-bold">{strongest.name} ({strongest.score})</strong> is your greatest strength. But {lagging.map((m) => m.name).join(' and ')} are currently pulling your overall score down.
        </p>
      </div>
    </div>
  )
}
