import natural from 'natural'
import { extractSkillsFromJd } from './jdNormalizer.js'
import { COMMON_STOP_WORDS } from './dynamicSkillExtractor.js'

export function analyzeMarketJdCorpus(jdTexts = [], candidateResumeSkills = []) {
  if (!Array.isArray(jdTexts) || jdTexts.length === 0) {
    return {
      totalAnalyzed: 0,
      topDemandedSkills: [],
      missingHighDemandSkills: [],
      topToolPairings: [],
    }
  }

  const totalJds = jdTexts.length
  const candidateLowerSet = new Set(
    (candidateResumeSkills || []).map((s) => (typeof s === 'string' ? s.toLowerCase().trim() : ''))
  )

  // Dynamically collect all candidate tools across all JDs in the corpus using extractSkillsFromJd
  const corpusToolFrequencies = new Map()

  for (const text of jdTexts) {
    const detectedSkills = extractSkillsFromJd(text)
    const seenInThisJd = new Set()

    detectedSkills.forEach((skill) => {
      const low = skill.toLowerCase()
      if (!seenInThisJd.has(low)) {
        seenInThisJd.add(low)
        const current = corpusToolFrequencies.get(low) || { tool: skill, count: 0 }
        current.count++
        corpusToolFrequencies.set(low, current)
      }
    })
  }

  // Calculate percentages dynamically based on actual corpus demand
  const toolFrequency = Array.from(corpusToolFrequencies.values())
    .map((item) => ({
      tool: item.tool,
      count: item.count,
      percentage: Math.round((item.count / totalJds) * 100),
    }))
    .filter((t) => t.percentage >= 15) // Mentioned in at least 15% of market postings
    .sort((a, b) => b.percentage - a.percentage || b.count - a.count)

  // Top tool pairings via Bigram analysis
  const NGrams = natural.NGrams
  const bigramCounts = new Map()

  for (const text of jdTexts) {
    const tokens = (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !COMMON_STOP_WORDS.has(t))

    const bigrams = NGrams.bigrams(tokens)
    for (const bg of bigrams) {
      if (!COMMON_STOP_WORDS.has(bg[0]) && !COMMON_STOP_WORDS.has(bg[1])) {
        const phrase = bg.join(' ')
        bigramCounts.set(phrase, (bigramCounts.get(phrase) || 0) + 1)
      }
    }
  }

  const topToolPairings = Array.from(bigramCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([phrase, count]) => ({
      phrase: phrase.replace(/\b\w/g, (c) => c.toUpperCase()),
      frequencyPct: Math.round((count / totalJds) * 100),
    }))

  const missingHighDemandSkills = toolFrequency
    .filter((t) => t.percentage >= 30 && !candidateLowerSet.has(t.tool.toLowerCase()))
    .slice(0, 5)

  return {
    totalAnalyzed: totalJds,
    topDemandedSkills: toolFrequency.slice(0, 8),
    missingHighDemandSkills,
    topToolPairings,
  }
}

export const extractDynamicSkillsFromText = extractSkillsFromJd

export default {
  analyzeMarketJdCorpus,
  extractDynamicSkillsFromText,
}
