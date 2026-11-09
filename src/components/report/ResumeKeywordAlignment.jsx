import React from 'react'
import { CheckCircle, WarningCircle, Sparkle } from '@phosphor-icons/react'

export default function ResumeKeywordAlignment({
  alignmentData,
  keywordAlignment,
  reportData: propReportData,
}) {
  const rawClusters =
    alignmentData?.competencyClusters?.clusters ||
    alignmentData?.competencyClusters ||
    keywordAlignment?.competencyClusters?.clusters ||
    keywordAlignment?.competencyClusters ||
    propReportData?.competencyClusters?.clusters ||
    propReportData?.competencyClusters ||
    propReportData?.competency_clusters_audit ||
    null

  const fallbackClusters = [
    {
      name: 'Data Visualization & Business Intelligence',
      demandPercentage: 56,
      isSatisfied: true,
      matchedSkills: ['Power BI'],
      tools: ['Power BI', 'Tableau', 'Looker', 'Metabase'],
      advice: null,
    },
    {
      name: 'Relational Database Querying & SQL',
      demandPercentage: 71,
      isSatisfied: true,
      matchedSkills: ['PostgreSQL'],
      tools: ['SQL', 'PostgreSQL', 'MySQL', 'SQL Server'],
      advice: null,
    },
    {
      name: 'Spreadsheet Analysis & Modeling',
      demandPercentage: 58,
      isSatisfied: true,
      matchedSkills: ['Excel'],
      tools: ['Excel', 'Google Sheets', 'Power Query'],
      advice: null,
    },
    {
      name: 'Analytical Programming & Data Manipulation',
      demandPercentage: 48,
      isSatisfied: true,
      matchedSkills: ['Python'],
      tools: ['Python', 'R', 'Pandas', 'NumPy'],
      advice: null,
    },
    {
      name: 'Cloud Data Warehousing',
      demandPercentage: 35,
      isSatisfied: false,
      matchedSkills: [],
      tools: ['Snowflake', 'BigQuery', 'Amazon Redshift', 'dbt'],
      advice: 'Highlight dimensional modeling experience across cloud data warehouses.',
    },
  ]

  const clusters =
    Array.isArray(rawClusters) && rawClusters.length > 0
      ? rawClusters.map((c) => {
          const isSat = Boolean(c.isSatisfied ?? c.satisfied)
          const matched =
            Array.isArray(c.matchedSkills) && c.matchedSkills.length > 0
              ? c.matchedSkills
              : Array.isArray(c.matchedTools) && c.matchedTools.length > 0
              ? c.matchedTools
              : typeof c.matchedTool === 'string' && c.matchedTool
              ? [c.matchedTool.split(',')[0].trim()]
              : []
          const toolsList =
            Array.isArray(c.tools) && c.tools.length > 0
              ? c.tools
              : Array.isArray(c.interchangeableGroup) && c.interchangeableGroup.length > 0
              ? c.interchangeableGroup
              : []
          return {
            name: c.name || c.clusterName || c.cluster_title || 'Core Competency',
            demandPercentage: c.demandPercentage || c.demand || 50,
            isSatisfied: isSat,
            matchedSkills: matched,
            tools: toolsList,
            advice: c.advice || c.recommendation || null,
          }
        })
      : fallbackClusters

  const satisfiedCount = clusters.filter((c) => c.isSatisfied).length
  const totalCount = Math.max(1, clusters.length)

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkle size={18} className="text-indigo-600 dark:text-indigo-400" weight="fill" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Core Competency Clusters ("OR" Grouping)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Modern hiring managers look for interchangeable competencies rather than rigid individual tools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {satisfiedCount} of {totalCount} Satisfied
          </span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            {Math.round((satisfiedCount / totalCount) * 100)}% Coverage
          </span>
        </div>
      </div>

      {/* Cluster Progress Bars */}
      <div className="space-y-4">
        {clusters.map((cluster) => {
          return (
            <div
              key={cluster.name}
              className={`p-4 rounded-2xl border transition-all ${
                cluster.isSatisfied
                  ? 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  : 'bg-rose-50/40 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/50 hover:border-rose-300 dark:hover:border-rose-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {cluster.isSatisfied ? (
                    <CheckCircle size={18} weight="fill" className="text-emerald-500 shrink-0" />
                  ) : (
                    <WarningCircle size={18} weight="fill" className="text-rose-500 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{cluster.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold font-mono text-slate-500 dark:text-slate-400">
                    {cluster.demandPercentage}% Market Demand
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      cluster.isSatisfied
                        ? 'bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {cluster.isSatisfied
                      ? `Satisfied via ${cluster.matchedSkills[0] || 'Verified Skill'}`
                      : 'Missing Core Pillar'}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${
                    cluster.isSatisfied ? 'bg-emerald-500' : 'bg-rose-400'
                  }`}
                  style={{ width: `${cluster.demandPercentage}%` }}
                />
              </div>

              {/* Member Tools & Coaching Advice */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  Equivalent Tools: {cluster.tools.join(', ')}
                </span>
                {cluster.advice && (
                  <span className="text-rose-700 dark:text-rose-400 font-medium">{cluster.advice}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
