import PromptExample from '../models/PromptExample.js'
import mongoose from 'mongoose'

export async function getDynamicFewShotExamples(roleKey = '', sectionType = 'bullet_rewrite', limit = 2) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return ''

  try {
    const cleanRole = String(roleKey || 'software-engineer').toLowerCase().trim()
    const examples = await PromptExample.find({
      roleKey: cleanRole,
      sectionType,
      upVotes: { $gte: 3 },
      $expr: { $gt: ['$upVotes', { $multiply: ['$downVotes', 2] }] },
    })
      .sort({ score: -1, upVotes: -1 })
      .limit(limit)
      .lean()

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
}
