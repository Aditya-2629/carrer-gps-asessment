import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts'
import { ArrowUpRight } from '@phosphor-icons/react'
import { NumberRoll } from '../number-roll'
import { useReportGuideStore, GUIDE_EMOTIONS } from '../../store/useReportGuideStore'
import { getCareerHealthAxes } from '../../lib/reportMetrics'
import CrafturePoseMascot from '../common/CrafturePoseMascot'

export default function ReportHero({ reportData, user }) {
  const { triggerGuide } = useReportGuideStore()
  const [activeMetric, setActiveMetric] = useState(null)

  const {
    axes: radarData,
    overallScore: overall,
    impactScore,
    atsScore,
    marketScore,
    positioningScore,
    outreachScore,
    interviewScore,
  } = useMemo(() => getCareerHealthAxes(reportData), [reportData])

  const role =
    user?.targetRole ||
    reportData?.targetRole ||
    reportData?.target_role ||
    reportData?.resume_agent?.candidateSnapshot?.targetRole ||
    reportData?.resume_json?.target_role ||
    'Senior Professional'

  const candidateName =
    reportData?.resume_agent?.candidateSnapshot?.name ||
    reportData?.resume_json?.candidate?.name ||
    reportData?.resume_json?.candidate_name ||
    user?.name ||
    ''

  // Dynamic Ring Stroke Color
  const ringColor =
    overall >= 80 ? 'text-emerald-500' : overall >= 60 ? 'text-indigo-600' : 'text-amber-500'
  const strokeDashoffset = 283 - (283 * overall) / 100

  // Telemetry Strip Items
  const telemetryMetrics = [
    {
      id: 'overall',
      label: 'Overall Index',
      valueNode: (
        <span className="flex items-baseline">
          <NumberRoll value={overall} duration={850} />
          <span className="text-sm font-semibold text-[var(--text-muted)]">/100</span>
        </span>
      ),
      value: `${overall}/100`,
      caption: overall >= 80 ? 'Interview Ready' : overall >= 60 ? 'Competitive' : 'Action Required',
      color: ringColor,
      onClick: () => {
        setActiveMetric('overall')
        triggerGuide({
          nodeId: 'primary-bottleneck',
          emotion: overall >= 75 ? GUIDE_EMOTIONS.VICTORY : GUIDE_EMOTIONS.ALERT,
          headline: `Overall Career Index calibrated at ${overall}/100 against active hiring benchmarks.`,
          metricChip: `Index: ${overall}`,
        })
      },
    },
    {
      id: 'ats',
      label: 'ATS Parsability',
      valueNode: (
        <span className="flex items-baseline">
          <NumberRoll value={atsScore} duration={850} />
          <span className="text-sm font-semibold text-[var(--text-muted)]">%</span>
        </span>
      ),
      value: `${atsScore}%`,
      caption: atsScore >= 80 ? 'Clean Structure' : 'Parsing Risk',
      color: atsScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
      onClick: () => {
        setActiveMetric('ats')
        triggerGuide({
          nodeId: 'resume-audit',
          emotion: GUIDE_EMOTIONS.INSPECT,
          headline: `ATS Score: ${atsScore}%. Verified single-column geometry and clean section headers.`,
          metricChip: `ATS: ${atsScore}%`,
        })
      },
    },
    {
      id: 'impact',
      label: 'Impact Density',
      valueNode: (
        <span className="flex items-baseline">
          <NumberRoll value={impactScore} duration={850} />
          <span className="text-sm font-semibold text-[var(--text-muted)]">%</span>
        </span>
      ),
      value: `${impactScore}%`,
      caption: impactScore >= 70 ? 'Solid Metrics' : 'Needs CAR Formula',
      color: impactScore >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      onClick: () => {
        setActiveMetric('impact')
        triggerGuide({
          nodeId: 'resume-audit',
          emotion: GUIDE_EMOTIONS.ALERT,
          headline: `Impact Score: ${impactScore}%. Several achievement bullets omit hard numbers or scale.`,
          metricChip: `Impact: ${impactScore}%`,
        })
      },
    },
    {
      id: 'market',
      label: 'Stack Alignment',
      valueNode: (
        <span className="flex items-baseline">
          <NumberRoll value={marketScore} duration={850} />
          <span className="text-sm font-semibold text-[var(--text-muted)]">%</span>
        </span>
      ),
      value: `${marketScore}%`,
      caption: 'JD Keyword Match',
      color: 'text-indigo-600 dark:text-indigo-400',
      onClick: () => {
        setActiveMetric('market')
        triggerGuide({
          nodeId: 'resume-audit',
          emotion: GUIDE_EMOTIONS.COACH,
          headline: `Market Match: ${marketScore}%. Core skills matched against live hiring requirements.`,
          metricChip: `Match: ${marketScore}%`,
        })
      },
    },
    {
      id: 'recovery',
      label: 'Projected Upside',
      valueNode: (
        <span className="flex items-baseline text-emerald-600 dark:text-emerald-400">
          <span>+</span>
          <NumberRoll value={Math.max(16, 92 - overall)} duration={850} />
          <span className="text-sm font-semibold ml-1">pts</span>
        </span>
      ),
      value: `+${Math.max(16, 92 - overall)} pts`,
      caption: 'Target: 90+ Index',
      color: 'text-emerald-600 dark:text-emerald-400',
      onClick: () => {
        setActiveMetric('recovery')
        triggerGuide({
          nodeId: 'funnel-sankey',
          emotion: GUIDE_EMOTIONS.VICTORY,
          headline: `Potential recovery of +${Math.max(16, 92 - overall)} points with the strategic action roadmap.`,
          metricChip: 'Target: 90+',
        })
      },
    },
  ]

  return (
    <div className="bg-[var(--surface-card)] rounded-3xl border border-[var(--border-default)] shadow-xs overflow-hidden space-y-6">
      {/* ── Top Editorial Header & Radar Section ── */}
      <div className="p-6 sm:p-8 pb-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[var(--border-default)]">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-secondary)]">
                Diagnostic Dossier
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                Target Role: {role}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight">
              {candidateName ? `${candidateName}'s Career Health Report` : 'Career Health Diagnostic Report'}
            </h1>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Objective benchmark of your resume impact, ATS layout safety, and LinkedIn positioning
              calibrated against active recruiter filters and market hiring demand.
            </p>
          </div>

          {/* Overall Index Score Dial + Mascot Welcome */}
          <div className="flex items-center gap-3 sm:gap-4 bg-[var(--surface-sunken)] p-3 sm:p-4 rounded-xl border border-[var(--border-default)] shrink-0">
            <CrafturePoseMascot
              pose="wave"
              size={76}
              animation="float"
              showShadow={false}
              className="hidden sm:inline-flex shrink-0"
              alt="Crafture Welcome Guide"
            />
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="text-slate-200 dark:text-slate-700 stroke-current"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className={`${ringColor} stroke-current transition-all duration-700 ease-out`}
                  strokeWidth="8"
                  strokeDasharray="283"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <NumberRoll
                  value={overall}
                  duration={900}
                  className="text-xl font-semibold font-mono text-[var(--text-primary)] tabular-nums"
                />
                <span className="text-[9px] font-mono text-[var(--text-muted)]">
                  Index
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-bold text-[var(--text-primary)]">
                {overall >= 80 ? 'Interview Ready' : overall >= 60 ? 'Competitive with Fixes' : 'High Friction Detected'}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] max-w-[150px] leading-snug">
                {overall >= 80 ? 'Passing top recruiter filters.' : 'Targeted fixes unlock 2x interview callback rate.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── 6-Axis Career Health Radar Visualizer ── */}
        <div className="pt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7 h-[220px] sm:h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="var(--border-default, #E2E8F0)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: 'var(--text-secondary, #475569)', fontSize: 11, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: 'var(--text-muted, #94A3B8)', fontSize: 9 }}
                />
                <Radar
                  name="Current"
                  dataKey="current"
                  stroke="#6366F1"
                  fill="#6366F1"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Radar
                  name="Post-Fix Potential"
                  dataKey="target"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface-card, #FFFFFF)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-default, #E2E8F0)',
                    color: 'var(--text-primary, #0F172A)',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="md:col-span-5 space-y-3 bg-[var(--surface-sunken)] p-4 rounded-2xl border border-[var(--border-default)]">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
              <span>6-Axis Health Breakdown</span>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 inline-block" /> Current
                </span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 inline-block" /> Post-Fix
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
              {radarData.slice(0, 4).map((d) => (
                <div
                  key={d.subject}
                  className="flex items-center justify-between py-1 border-b border-[var(--border-default)] text-[11px]"
                >
                  <span className="font-medium text-[var(--text-secondary)]">{d.subject}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[var(--text-primary)] font-semibold">{d.current}%</span>
                    <span className="text-[var(--text-muted)]">→</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{d.target}%</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] leading-normal pt-1">
              Click any metric below to trigger companion inspection on the bottleneck.
            </p>
          </div>
        </div>
      </div>

      {/* ── Unified Executive Telemetry Strip (Hairline 1px Dividers, Fira Code Metrics) ── */}
      <div className="border-t border-[var(--border-default)] bg-[var(--surface-sunken)]">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-default)]">
          {telemetryMetrics.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={m.onClick}
              className={`p-4 text-left transition-all hover:bg-[var(--surface-card)] cursor-pointer group ${
                activeMetric === m.id ? 'bg-[var(--surface-card)] shadow-xs' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-mono text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                  {m.label}
                </span>
                <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
              </div>
              <div className="font-mono text-xl sm:text-2xl font-semibold text-[var(--text-primary)] tracking-tight tabular-nums">
                {m.valueNode || m.value}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
                {m.caption}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
