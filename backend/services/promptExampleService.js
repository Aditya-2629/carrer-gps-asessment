import PromptExample from '../models/PromptExample.js'
import mongoose from 'mongoose'

export function normalizeRoleKey(roleKey = '') {
  if (!roleKey || typeof roleKey !== 'string') return 'software-engineer'
  return roleKey.toLowerCase().trim()
}

/**
 * Fetches vetted high-scoring few-shot examples for dynamic prompt injection.
 * Gates on upVotes >= 3 and upVotes > downVotes * 2.
 * Falls back to cross-role top examples if zero results exist for a niche roleKey.
 */
export async function getDynamicFewShotExamples(roleKey = '', sectionType = 'bullet_rewrite', limit = 2) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return ''

  try {
    const cleanRole = normalizeRoleKey(roleKey)
    let examples = await PromptExample.find({
      roleKey: cleanRole,
      sectionType,
      upVotes: { $gte: 3 },
      $expr: { $gt: ['$upVotes', { $multiply: ['$downVotes', 2] }] },
    })
      .sort({ score: -1, upVotes: -1 })
      .limit(limit)
      .lean()

    // Fallback: If 0 examples found for specific roleKey, fall back to top cross-role examples for sectionType
    if ((!examples || examples.length === 0) && cleanRole !== 'software-engineer') {
      examples = await PromptExample.find({
        sectionType,
        upVotes: { $gte: 3 },
        $expr: { $gt: ['$upVotes', { $multiply: ['$downVotes', 2] }] },
      })
        .sort({ score: -1, upVotes: -1 })
        .limit(limit)
        .lean()
    }

    if (!examples || examples.length === 0) return ''

    let block = `\n### DYNAMIC HIGH-SCORING EXAMPLES (Vetted by Real Recruiters & Candidates):\n`
    examples.forEach((ex, idx) => {
      block += `Example ${idx + 1}:\n`
      if (ex.anonymizedBefore) block += `  Original: "${ex.anonymizedBefore}"\n`
      block += `  Winning Rewrite: "${ex.anonymizedAfter}"\n`
    })
    return block
  } catch (_e) {
    return ''
  }
}

export default {
  getDynamicFewShotExamples,
  normalizeRoleKey,
}
