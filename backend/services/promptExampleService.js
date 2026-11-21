import PromptExample from '../models/PromptExample.js'
import mongoose from 'mongoose'

export function normalizeRoleKey(roleKey = '') {
  if (!roleKey || typeof roleKey !== 'string') return 'general'
  return roleKey.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
}

/**
 * Resolves a high-level domain from a role title or key.
 * Guarantees strict domain isolation so software engineering examples
 * are never injected into healthcare, finance, or sales prompts.
 */
export function resolveDomainFromRole(roleOrTitle = '') {
  const low = String(roleOrTitle || '').toLowerCase().trim()
  if (!low) return 'general'

  if (/nurse|nursing|clinical|patient|hospital|physician|doctor|medical|healthcare|hipaa|ehr|epic\b|triage/i.test(low)) {
    return 'healthcare'
  }
  if (/finance|financial|fp&a|accounting|accountant|audit|gaap|cpa\b|banking|treasury|controller|budget|p&l/i.test(low)) {
    return 'finance'
  }
  if (/sales|account\s+exec|quota|pipeline|bdr\b|sdr\b|business\s+dev|client\s+exec|inside\s+sales|commercial/i.test(low)) {
    return 'sales'
  }
  if (/data\s+analyst|data\s+eng|data\s+sci|bi\s+developer|analytics|tableau|power\s*bi|snowflake|dbt|sql\b/i.test(low)) {
    return 'data'
  }
  if (/software|full\s*stack|frontend|front-end|backend|back-end|web\s+dev|devops|cloud|sre|platform|engineer|developer|architect/i.test(low)) {
    return 'software'
  }
  return 'general'
}

/**
 * Fetches vetted high-scoring few-shot examples for dynamic prompt injection.
 * Gates on upVotes >= 2 and upVotes > downVotes * 2.
 * Strictly domain-isolated: queries by roleKey first, then falls back to domain.
 * NEVER leaks cross-domain examples (e.g. software examples into healthcare).
 */
export async function getDynamicFewShotExamples(roleKey = '', sectionType = 'bullet_rewrite', limit = 2) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return ''

  try {
    const cleanRole = normalizeRoleKey(roleKey)
    const cleanDomain = resolveDomainFromRole(roleKey)

    // 1. Primary: Exact role match
    let examples = await PromptExample.find({
      roleKey: cleanRole,
      sectionType,
      upVotes: { $gte: 2 },
      $expr: { $gt: ['$upVotes', { $multiply: ['$downVotes', 2] }] },
    })
      .sort({ score: -1, upVotes: -1 })
      .limit(limit)
      .lean()

    // 2. Secondary: Fall back strictly within the same domain (e.g. any healthcare role for a nursing prompt)
    if ((!examples || examples.length === 0) && cleanDomain !== 'general') {
      examples = await PromptExample.find({
        domain: cleanDomain,
        sectionType,
        upVotes: { $gte: 2 },
        $expr: { $gt: ['$upVotes', { $multiply: ['$downVotes', 2] }] },
      })
        .sort({ score: -1, upVotes: -1 })
        .limit(limit)
        .lean()
    }

    if (!examples || examples.length === 0) return ''

    let block = `\n### DYNAMIC HIGH-SCORING EXAMPLES (Vetted by Real Recruiters & Candidates in ${cleanDomain.toUpperCase()}):\n`
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
  resolveDomainFromRole,
}
