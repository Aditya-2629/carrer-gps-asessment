/**
 * humanizeReportCopy.js
 *
 * Dynamic Sanitizer & Copy Humanizer for Career GPS Reports.
 * 1. Resolves internal IDs (exp_001_b01, proj_002_b01, iss_001) to natural human references
 *    using the candidate's canonical resume context (e.g. "your CloudScale Networks bullet").
 * 2. Cleans AI buzzwords and corporate filler (leveraging, powerhouse, cutting-edge, etc.)
 *    without modifying technical terms.
 * 3. Deep-traverses report JSON objects to clean all user-facing strings.
 * 4. Synthesizes a crisp, accurate "Why it works" explanation from before/after bullet diffs.
 */

const AI_BUZZWORD_REPLACEMENTS = [
  { regex: /\bpowerhouse\s+/gi, replace: '' },
  { regex: /\bcutting-edge\s+/gi, replace: 'modern ' },
  { regex: /\bcutting edge\s+/gi, replace: 'modern ' },
  { regex: /\bgame-changing\s+/gi, replace: 'high-impact ' },
  { regex: /\bgame changing\s+/gi, replace: 'high-impact ' },
  { regex: /\bsynergistic\s+/gi, replace: 'collaborative ' },
  { regex: /\bsynergies\b/gi, replace: 'results' },
  { regex: /\bsynergy\b/gi, replace: 'teamwork' },
  { regex: /\brevolutionize\b/gi, replace: 'transform' },
  { regex: /\brevolutionizing\b/gi, replace: 'transforming' },
  { regex: /\brevolutionized\b/gi, replace: 'transformed' },
  { regex: /\bdelve into\b/gi, replace: 'examine' },
  { regex: /\bdelving into\b/gi, replace: 'examining' },
  { regex: /\bdelve\b/gi, replace: 'explore' },
  { regex: /\btapestry of\b/gi, replace: 'range of' },
  { regex: /\bseamlessly\b/gi, replace: 'smoothly' },
  { regex: /\bseamless\b/gi, replace: 'smooth' },
  { regex: /\bmagic of\b/gi, replace: 'efficiency of' },
  { regex: /\bmagic\b/gi, replace: 'efficiency' },
  { regex: /\bunlocking\b/gi, replace: 'achieving' },
  { regex: /\bunlock\b/gi, replace: 'achieve' },
  { regex: /\bleveraging\b/gi, replace: 'using' },
  { regex: /\bleveraged\b/gi, replace: 'used' },
  { regex: /\bleverage\b/gi, replace: 'use' },
  { regex: /\butilizing\b/gi, replace: 'using' },
  { regex: /\butilized\b/gi, replace: 'used' },
  { regex: /\butilize\b/gi, replace: 'use' },
  { regex: /\butilization\b/gi, replace: 'use' },
  { regex: /\bspearheaded\b/gi, replace: 'led' },
  { regex: /\bspearheading\b/gi, replace: 'leading' },
  { regex: /\bspearhead\b/gi, replace: 'lead' },
  { regex: /\bholistic\b/gi, replace: 'complete' },
  { regex: /\bparadigms\b/gi, replace: 'methods' },
  { regex: /\bparadigm\b/gi, replace: 'approach' },
  { regex: /\btrajectories\b/gi, replace: 'paths' },
  { regex: /\btrajectory\b/gi, replace: 'path' },
  { regex: /\bactionable insights\b/gi, replace: 'practical steps' },
  { regex: /\bactionable insight\b/gi, replace: 'practical step' },
  { regex: /\bexecutive dossier\b/gi, replace: 'candidate profile' },
  { regex: /\bdiagnostic synthesis\b/gi, replace: 'report summary' },
  { regex: /\bpipeline velocity\b/gi, replace: 'pipeline speed' },
  { regex: /\bcallback velocity\b/gi, replace: 'callback speed' },
  { regex: /\bunveiling\b/gi, replace: 'revealing' },
  { regex: /\bunveiled\b/gi, replace: 'revealed' },
  { regex: /\bunveil\b/gi, replace: 'reveal' },
  { regex: /\bfostering\b/gi, replace: 'building' },
  { regex: /\bfostered\b/gi, replace: 'built' },
  { regex: /\bfoster\b/gi, replace: 'build' },
  { regex: /\brobust\b/gi, replace: 'strong' },
  { regex: /\belevating\b/gi, replace: 'improving' },
  { regex: /\belevated\b/gi, replace: 'improved' },
  { regex: /\belevate\b/gi, replace: 'improve' },
  { regex: /\btestament to\b/gi, replace: 'proof of' },
  { regex: /\bit is crucial that\b/gi, replace: 'you should' },
  { regex: /\bpivotal\b/gi, replace: 'key' },
]

export function cleanAiBuzzwords(text) {
  if (!text || typeof text !== 'string') return text
  let result = text
  for (const { regex, replace } of AI_BUZZWORD_REPLACEMENTS) {
    result = result.replace(regex, (match) => {
      if (match[0] === match[0].toUpperCase() && replace.length > 0) {
        return replace[0].toUpperCase() + replace.slice(1)
      }
      return replace
    })
  }
  return result
}

export function buildIdLookupMap(canonicalResume = {}) {
  const map = new Map()
  const experiences =
    canonicalResume?.experience ||
    canonicalResume?.experiences ||
    canonicalResume?.workExperience ||
    []
  if (Array.isArray(experiences)) {
    experiences.forEach((exp, idx) => {
      const company = exp.company || exp.employer || exp.companyName || exp.role || exp.title || 'experience'
      const cleanCompany = String(company).split('|')[0].trim()
      const expKeys = [`exp_${idx}`, `exp_${String(idx + 1).padStart(3, '0')}`, `exp_${idx + 1}`]
      expKeys.forEach((k) => map.set(k.toLowerCase(), cleanCompany))

      const bullets = exp.bullets || exp.bulletPoints || []
      if (Array.isArray(bullets)) {
        bullets.forEach((_, bIdx) => {
          const bulletKeys = [
            `exp_${idx}_b${bIdx}`,
            `exp_${String(idx + 1).padStart(3, '0')}_b${String(bIdx + 1).padStart(2, '0')}`,
            `exp_${idx + 1}_b${bIdx + 1}`,
          ]
          bulletKeys.forEach((bk) => map.set(bk.toLowerCase(), `your ${cleanCompany} bullet`))
        })
      }
    })
  }

  const projects = canonicalResume?.projects || []
  if (Array.isArray(projects)) {
    projects.forEach((proj, idx) => {
      const title = proj.title || proj.name || 'project'
      const cleanTitle = String(title).split('|')[0].trim()
      const projKeys = [`proj_${idx}`, `proj_${String(idx + 1).padStart(3, '0')}`, `proj_${idx + 1}`]
      projKeys.forEach((k) => map.set(k.toLowerCase(), cleanTitle))

      const bullets = proj.bullets || []
      if (Array.isArray(bullets)) {
        bullets.forEach((_, bIdx) => {
          const bulletKeys = [
            `proj_${idx}_b${bIdx}`,
            `proj_${String(idx + 1).padStart(3, '0')}_b${String(bIdx + 1).padStart(2, '0')}`,
            `proj_${idx + 1}_b${bIdx + 1}`,
          ]
          bulletKeys.forEach((bk) => map.set(bk.toLowerCase(), `your ${cleanTitle} project bullet`))
        })
      }
    })
  }

  return map
}

export function humanizeInternalIds(text, canonicalResume = {}) {
  if (!text || typeof text !== 'string') return text
  const lookup = buildIdLookupMap(canonicalResume)

  return text.replace(/\b(?:exp|proj|iss|edu|summary|skills)_\d+(?:_b\d+)?\b/gi, (matched) => {
    const key = matched.toLowerCase()
    if (lookup.has(key)) {
      return lookup.get(key)
    }
    if (/^exp_\d+_b\d+$/i.test(key)) return 'your experience bullet'
    if (/^proj_\d+_b\d+$/i.test(key)) return 'your project bullet'
    if (/^exp_\d+$/i.test(key)) return 'your experience role'
    if (/^proj_\d+$/i.test(key)) return 'your project'
    if (/^iss_\d+$/i.test(key)) return 'this priority issue'
    return 'your bullet point'
  })
}

export function humanizeCopy(text, canonicalResume = {}) {
  if (!text || typeof text !== 'string') return text
  let out = humanizeInternalIds(text, canonicalResume)
  out = cleanAiBuzzwords(out)
  return out
}

export function sanitizeReportObject(obj, canonicalResume = {}, depth = 0) {
  if (!obj || depth > 8) return obj
  if (typeof obj === 'string') return humanizeCopy(obj, canonicalResume)
  if (Array.isArray(obj)) return obj.map((item) => sanitizeReportObject(item, canonicalResume, depth + 1))
  if (typeof obj === 'object') {
    const res = {}
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'id' || key === 'bulletId' || key === 'itemId') {
        res[key] = val
      } else {
        res[key] = sanitizeReportObject(val, canonicalResume, depth + 1)
      }
    }
    return res
  }
  return obj
}

export function synthesizeWhyItWorks(original = '', rewritten = '', existingWhyItWorks = '') {
  if (existingWhyItWorks && typeof existingWhyItWorks === 'string' && existingWhyItWorks.trim().length >= 15) {
    return existingWhyItWorks.trim()
  }

  if (!rewritten || rewritten === original) {
    return 'Maintains verified technical stack while highlighting domain expertise.'
  }

  const cleanOrig = String(original || '').trim().replace(/^[•\-*▪–—·\s]+/, '')
  const cleanRw = String(rewritten || '').trim().replace(/^[•\-*▪–—·\s]+/, '')

  const origFirstWord = cleanOrig.split(/\s+/)[0] || ''
  const rwFirstWord = cleanRw.split(/\s+/)[0] || ''

  const hadMetric = /\d+%?|\$\d+/i.test(cleanOrig)
  const hasMetric = /\d+%?|\$\d+/i.test(cleanRw)

  const verbChanged = origFirstWord.toLowerCase() !== rwFirstWord.toLowerCase()

  if (verbChanged && !hadMetric && hasMetric) {
    return `Replaces passive opener ('${origFirstWord}') with active verb ('${rwFirstWord}') and anchors quantified production metrics.`
  }
  if (!hadMetric && hasMetric) {
    return `Anchors technical scope with verified production metrics to pass recruiter 6-second scans.`
  }
  if (verbChanged) {
    return `Leads with decisive action verb ('${rwFirstWord}') and clearly defines technical ownership and deliverables.`
  }
  return `Clarifies technical execution mechanism and operational scope using verified stack components.`
}

export default {
  cleanAiBuzzwords,
  buildIdLookupMap,
  humanizeInternalIds,
  humanizeCopy,
  sanitizeReportObject,
  synthesizeWhyItWorks,
}
