/**
 * backend/services/keywordInjector.js
 * Injects verified JD keywords naturally into bullets/skills without hallucinations.
 */

// Regex for extracting numbers (percentages, currency, multipliers, integers, with optional trailing +)
const NUM_REGEX = /(?:\$?\d+(?:,\d+)*(?:\.\d+)?(?:k|m|b)?%?\+?|\b\d+x\b)/gi

export function extractNumbers(text) {
  if (!text || typeof text !== 'string') return []
  const matches = text.match(NUM_REGEX) || []
  return matches.map((n) => n.toLowerCase().replace(/[,+]/g, '').trim())
}

export function findNumberViolations(originalText, rewrittenText) {
  const origNums = extractNumbers(originalText)
  const rewNums = extractNumbers(rewrittenText)

  // Every number in rewritten text must exist in original text
  const origSet = new Set(origNums)
  const violations = []

  for (const num of rewNums) {
    if (!origSet.has(num)) {
      violations.push(num)
    }
  }

  return violations
}

export function injectKeywordNaturally(bulletText, keyword) {
  if (!bulletText || !keyword) return { text: bulletText, injected: false }

  // Check if keyword is already present
  const kwRegex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i')
  if (kwRegex.test(bulletText)) {
    return { text: bulletText, injected: false }
  }

  // 1. Natural insertion into tool/method clauses: "using X, Y..." -> "using X, Y, and [Keyword]..."
  const usingMatch = bulletText.match(/(using|with|via|through)\s+([^,.;]+(?:,\s*[^,.;]+)*)/i)
  if (usingMatch) {
    const clause = usingMatch[0]
    // Append keyword naturally
    const updatedClause = clause.replace(/(\s+and\s+)/i, ', ') + `, and ${keyword}`
    const updatedText = bulletText.replace(clause, updatedClause)
    return { text: updatedText, injected: true }
  }

  // 2. Fallback: Prepend to process description if sentence has clear action verb
  return { text: bulletText, injected: false }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
