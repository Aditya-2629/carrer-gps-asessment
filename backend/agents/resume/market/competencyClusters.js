/**
 * Universal Competency Clusters & Interchangeable Skill Taxonomy
 * Grouping interchangeable tools into unified competencies so candidates are not penalized
 * if a job requires Tableau while they know Power BI.
 */

export const DOMAIN_COMPETENCY_CLUSTERS = {
  'data-analyst': [
    {
      id: 'cluster_bi_viz',
      name: 'Data Visualization & Business Intelligence',
      category: 'BI & Analytics',
      coreDemandWeight: 0.85,
      memberSkills: ['Power BI', 'Tableau', 'Looker', 'Metabase', 'Superset', 'MicroStrategy', 'Qlik', 'Grafana'],
      primaryAnchors: ['Power BI', 'Tableau', 'Looker'],
      coachingAdvice: 'You demonstrated proficiency in [USER_SKILL]; highlight in interviews that reporting methodologies translate 1:1 to [MISSING_SKILL].',
    },
    {
      id: 'cluster_relational_db',
      name: 'Relational Database Querying & SQL',
      category: 'Databases',
      coreDemandWeight: 0.95,
      memberSkills: ['SQL', 'PostgreSQL', 'MySQL', 'SQL Server', 'T-SQL', 'PL/SQL', 'Oracle SQL', 'SQLite'],
      primaryAnchors: ['SQL', 'PostgreSQL'],
      coachingAdvice: 'Your relational database foundation in [USER_SKILL] directly satisfies enterprise SQL query requirements.',
    },
    {
      id: 'cluster_tabular_modeling',
      name: 'Spreadsheet Analysis & Financial Modeling',
      category: 'Tools',
      coreDemandWeight: 0.75,
      memberSkills: ['Excel', 'Google Sheets', 'Excel (Power Query)', 'Excel (Power Pivot)', 'Excel (VBA)'],
      primaryAnchors: ['Excel'],
      coachingAdvice: 'Leverage your advanced [USER_SKILL] skills to showcase complex data transformation and modeling.',
    },
    {
      id: 'cluster_programming_ds',
      name: 'Analytical Programming & Data Manipulation',
      category: 'Languages',
      coreDemandWeight: 0.70,
      memberSkills: ['Python', 'R', 'Python (Pandas)', 'NumPy', 'Scikit-Learn', 'Polars'],
      primaryAnchors: ['Python', 'R'],
      coachingAdvice: 'Highlight end-to-end data pipeline automation using [USER_SKILL] for automated reporting.',
    },
    {
      id: 'cluster_cloud_warehousing',
      name: 'Cloud Data Warehousing & Modern Data Stack',
      category: 'Cloud / Data',
      coreDemandWeight: 0.50,
      memberSkills: ['Snowflake', 'BigQuery', 'Amazon Redshift', 'Databricks', 'dbt'],
      primaryAnchors: ['Snowflake', 'BigQuery', 'dbt'],
      coachingAdvice: 'Mention your dimensional data modeling experience across cloud analytical data warehouses.',
    },
  ],

  'software-engineer': [
    {
      id: 'cluster_backend_languages',
      name: 'Backend Systems Programming',
      category: 'Languages',
      coreDemandWeight: 0.90,
      memberSkills: ['Go', 'Java', 'Python', 'TypeScript', 'C++', 'C#', 'Rust', 'Ruby'],
      primaryAnchors: ['Go', 'Java', 'Python', 'TypeScript'],
      coachingAdvice: 'Emphasize your strong OOP and concurrency foundation in [USER_SKILL].',
    },
    {
      id: 'cluster_cloud_infra',
      name: 'Cloud Infrastructure & Containerization',
      category: 'Cloud / DevOps',
      coreDemandWeight: 0.85,
      memberSkills: ['AWS', 'GCP', 'Microsoft Azure', 'Docker', 'Kubernetes', 'Terraform'],
      primaryAnchors: ['AWS', 'Docker', 'Kubernetes'],
      coachingAdvice: 'Your production infrastructure experience in [USER_SKILL] transfers seamlessly across cloud providers.',
    },
    {
      id: 'cluster_event_streaming',
      name: 'Event Streaming & Asynchronous Messaging',
      category: 'Architecture',
      coreDemandWeight: 0.65,
      memberSkills: ['Apache Kafka', 'RabbitMQ', 'Redis', 'AWS SQS', 'Google Pub/Sub'],
      primaryAnchors: ['Apache Kafka', 'RabbitMQ'],
      coachingAdvice: 'Showcase distributed systems architecture and fault tolerance in high-throughput messaging.',
    },
  ],
}

/**
 * Normalizes role keys to match DOMAIN_COMPETENCY_CLUSTERS keys.
 */
function normalizeClusterRoleKey(roleKey = '') {
  const clean = String(roleKey || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (clean.includes('data-analyst') || clean.includes('data-analysis') || clean.includes('bi-analyst') || clean.includes('analytics')) {
    return 'data-analyst'
  }
  if (clean.includes('software-engineer') || clean.includes('developer') || clean.includes('backend') || clean.includes('full-stack')) {
    return 'software-engineer'
  }
  return clean
}

/**
 * Resolves candidate skills against competency clusters.
 * If candidate possesses any primary anchor in a cluster, credits the competency as satisfied.
 */
export function evaluateCandidateClusters(roleKey = 'data-analyst', candidateVerifiedSkills = [], marketSkillsList = []) {
  const normKey = normalizeClusterRoleKey(roleKey)
  const clusters = DOMAIN_COMPETENCY_CLUSTERS[normKey] || DOMAIN_COMPETENCY_CLUSTERS['data-analyst'] || []
  const userSkillsLower = new Set(
    (Array.isArray(candidateVerifiedSkills) ? candidateVerifiedSkills : []).map((s) =>
      typeof s === 'string' ? s.toLowerCase() : String(s?.name || s?.skill || '').toLowerCase()
    )
  )

  const marketList = Array.isArray(marketSkillsList) ? marketSkillsList : []

  return clusters.map((cluster) => {
    // Find all member skills present in the market JDs
    const clusterMarketMembers = marketList.filter((ms) => {
      const msName = typeof ms === 'string' ? ms : (ms?.name || ms?.skill || '')
      return cluster.memberSkills.some((cs) => cs.toLowerCase() === msName.toLowerCase())
    })

    // Calculate aggregated cluster market demand
    // Formula: Max member frequency + 35% of secondary member frequencies (diminishing sum)
    const sortedMembers = [...clusterMarketMembers].sort((a, b) => {
      const bPct = typeof b === 'object' && b.percentage != null ? b.percentage : 0
      const aPct = typeof a === 'object' && a.percentage != null ? a.percentage : 0
      return bPct - aPct
    })

    let clusterPercentage = 0
    let clusterCount = 0

    if (sortedMembers.length > 0) {
      clusterPercentage = sortedMembers[0].percentage || 0
      clusterCount = sortedMembers[0].count || sortedMembers[0].frequency || 0
      for (let i = 1; i < sortedMembers.length; i++) {
        const nextPct = sortedMembers[i].percentage || 0
        const nextCount = sortedMembers[i].count || sortedMembers[i].frequency || 0
        clusterPercentage = Math.min(100, Math.round(clusterPercentage + nextPct * 0.35))
        clusterCount = Math.round(clusterCount + nextCount * 0.35)
      }
    }

    // Check candidate coverage
    const matchedMembers = cluster.memberSkills.filter((m) => userSkillsLower.has(m.toLowerCase()))
    const isSatisfied = matchedMembers.length > 0

    return {
      clusterId: cluster.id,
      name: cluster.name,
      category: cluster.category,
      demandPercentage: clusterPercentage || Math.round(cluster.coreDemandWeight * 100),
      demandCount: clusterCount,
      priority: clusterPercentage >= 30 || cluster.coreDemandWeight >= 0.75 ? 'HIGH' : 'MEDIUM',
      isCore: true,
      memberSkills: cluster.memberSkills,
      matchedSkills: matchedMembers,
      isSatisfied,
      coachingAdvice: isSatisfied
        ? null
        : cluster.coachingAdvice
            .replace('[USER_SKILL]', matchedMembers[0] || 'your technical skills')
            .replace('[MISSING_SKILL]', cluster.primaryAnchors[0]),
    }
  })
}

export default {
  DOMAIN_COMPETENCY_CLUSTERS,
  evaluateCandidateClusters,
}
