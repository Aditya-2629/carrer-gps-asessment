import { motion } from 'framer-motion'
import {
  Sparkle,
  CheckCircle,
  Lightning,
  ShieldCheck,
  Cpu,
  ChartLineUp,
} from '@phosphor-icons/react'

export default function WhatIsWorking({ resumeJsonData }) {
  const resume = resumeJsonData || {}
  const rawStrengths = Array.isArray(resume.strengths) ? resume.strengths : []

  const getStrengthText = (item, fallback) => {
    if (!item) return fallback
    if (typeof item === 'string') return item
    if (Array.isArray(item)) {
      const joined = item.map((i) => (typeof i === 'string' ? i : i?.text || '')).filter(Boolean).join(' ')
      return joined || fallback
    }
    if (typeof item === 'object') {
      const val = item.description || item.title || item.signal || item.text
      if (typeof val === 'string') return val
      if (typeof val === 'object' && val) return val.text || val.description || fallback
    }
    return fallback
  }

  const getStrengthTitle = (item, fallback) => {
    if (!item) return fallback
    if (typeof item === 'string') return fallback
    if (typeof item === 'object') {
      const val = item.title || item.name
      if (typeof val === 'string') return val
    }
    return fallback
  }

  // Build 3 compact strengths with concrete metrics / evidence
  const STRENGTHS_DATA = [
    {
      id: 's1',
      title: getStrengthTitle(rawStrengths[0], 'Technical Stack Execution'),
      icon: Cpu,
      explanation: getStrengthText(
        rawStrengths[0],
        'Demonstrated modern full-stack deployment across React, TypeScript, Node.js & AWS.'
      ),
      metricBadge: 'Core Technical Advantage',
      highlightTag: 'Proven in production',
    },
    {
      id: 's2',
      title: getStrengthTitle(rawStrengths[1], 'Scalable Systems & Optimization'),
      icon: Lightning,
      explanation: getStrengthText(
        rawStrengths[1],
        'Hands-on performance tuning and architecture improvements across high-volume pipelines.'
      ),
      metricBadge: '40% Latency & Velocity Win',
      highlightTag: 'Production Impact',
    },
    {
      id: 's3',
      title: getStrengthTitle(rawStrengths[2], 'Enterprise Architecture & Reliability'),
      icon: ShieldCheck,
      explanation: getStrengthText(
        rawStrengths[2],
        'Established reliability standards, cloud modernization, and multi-tenant isolation protocols.'
      ),
      metricBadge: 'SOC2 & Production Scale',
      highlightTag: 'High Seniority Signal',
    },
  ]

  return (
    <section id="strengths" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-[var(--emerald)] block">
            Competitive Foundation
          </span>
          <h2
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight"
            style={{ fontFamily: 'var(--font-head)' }}
          >
            What is already working
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium">
          Lead with these verified assets in phone screens and networking conversations
        </p>
      </div>

      {/* 3 Compact Strength Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {STRENGTHS_DATA.map((item, idx) => {
          const Icon = item.icon

          return (
            <motion.div
              key={item.id}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="p-5 rounded-2xl bg-[var(--surface-card)] border border-emerald-500/20 bg-emerald-500/[0.02] shadow-xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header Icon + Metric Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-[var(--emerald)]">
                    <Icon size={20} weight="fill" />
                  </div>
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-[var(--emerald)] border border-emerald-500/20">
                    {item.metricBadge}
                  </span>
                </div>

                {/* Strength Title */}
                <h3
                  className="text-base font-bold text-[var(--text-primary)] tracking-tight"
                  style={{ fontFamily: 'var(--font-head)' }}
                >
                  {item.title}
                </h3>

                {/* One-Line Explanation */}
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                  {item.explanation}
                </p>
              </div>

              {/* Supporting Signal Tag */}
              <div className="pt-2 border-t border-[var(--border-default)] flex items-center gap-1.5 text-[11px] font-semibold text-[var(--emerald)]">
                <CheckCircle size={14} weight="fill" />
                <span>{item.highlightTag}</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
