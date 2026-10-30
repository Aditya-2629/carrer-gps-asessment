import natural from 'natural'

const STOP_WORDS = new Set([
  'and', 'the', 'with', 'for', 'you', 'will', 'are', 'have', 'our', 'team',
  'experience', 'years', 'work', 'working', 'ability', 'skills', 'role',
  'candidate', 'business', 'company', 'strong', 'equal', 'opportunity',
  'requirements', 'preferred', 'qualifications', 'including', 'across',
  'demonstrated', 'proficient', 'knowledge', 'responsibilities', 'duties'
])

export function analyzeMarketJdCorpus(jdTexts = [], candidateResumeSkills = []) {
  if (!Array.isArray(jdTexts) || jdTexts.length === 0) {
    return {
      totalAnalyzed: 0,
      topDemandedSkills: [],
      missingHighDemandSkills: [],
      topToolPairings: [],
    }
  }

  const tfidf = new natural.TfIdf()
  const totalJds = jdTexts.length

  jdTexts.forEach((text) => {
    tfidf.addDocument((text || '').toLowerCase())
  })

  const CORE_MARKET_TOOLS = [
    'SQL', 'Python', 'Power BI', 'Tableau', 'Excel', 'Snowflake', 'BigQuery',
    'dbt', 'Databricks', 'AWS', 'Azure', 'GCP', 'PostgreSQL', 'Docker',
    'Kubernetes', 'Airflow', 'Kafka', 'Spark', 'PySpark', 'Data Modeling',
    'ETL', 'Looker', 'Alteryx', 'Statistical Analysis', 'A/B Testing',
    'Requirements Gathering', 'JIRA', 'Git'
  ]

  const toolFrequency = []
  for (const tool of CORE_MARKET_TOOLS) {
    const regex = new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    let matchCount = 0
    for (const text of jdTexts) {
      if (regex.test(text)) matchCount++
    }
    if (matchCount > 0) {
      toolFrequency.push({
        tool,
        count: matchCount,
        percentage: Math.round((matchCount / totalJds) * 100),
      })
    }
  }

  toolFrequency.sort((a, b) => b.percentage - a.percentage)

  // Extract bi-grams (2-word combinations)
  const NGrams = natural.NGrams
  const bigramCounts = new Map()

  for (const text of jdTexts) {
    const tokens = (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))

    const bigrams = NGrams.bigrams(tokens)
    for (const bg of bigrams) {
      const phrase = bg.join(' ')
      if (!STOP_WORDS.has(bg[0]) && !STOP_WORDS.has(bg[1])) {
        bigramCounts.set(phrase, (bigramCounts.get(phrase) || 0) + 1)
      }
    }
  }

  const topToolPairings = Array.from(bigramCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count >= Math.max(2, Math.round(totalJds * 0.15)))
    .slice(0, 6)
    .map(([phrase, count]) => ({
      phrase: phrase.replace(/\b\w/g, (c) => c.toUpperCase()),
      frequencyPct: Math.round((count / totalJds) * 100),
    }))

  const candidateLowerSet = new Set(
    (candidateResumeSkills || []).map((s) => (typeof s === 'string' ? s.toLowerCase().trim() : ''))
  )

  const missingHighDemandSkills = toolFrequency
    .filter((t) => t.percentage >= 35 && !candidateLowerSet.has(t.tool.toLowerCase()))
    .slice(0, 5)

  return {
    totalAnalyzed: totalJds,
    topDemandedSkills: toolFrequency.slice(0, 8),
    missingHighDemandSkills,
    topToolPairings,
  }
}
