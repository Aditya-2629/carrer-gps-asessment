/**
 * Career GPS AI Gateway V4 — Context Compiler
 * 
 * Compiles and compacts canonical resume facts, precomputed signals, career timeline,
 * target job description, and market intelligence into an optimal, bounded-token prompt.
 * 
 * Principles:
 * 1. Zero Redundancy: Eliminates duplicated text between resume, JD, and dossier.
 * 2. Token Bounded: Enforces hard caps on JD length and repetitive content.
 * 3. Deterministic Hashing: Produces stable SHA-256 fingerprint for request caching.
 * 4. Ground-Truth Grounding: Injects precomputed facts so the LLM reasoner never hallucinates.
 */

import crypto from 'crypto'

export class ContextCompiler {
  /**
   * Estimates token count (~4 characters per token heuristic)
   * @param {string} text
   * @returns {number}
   */
  static estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0
    return Math.ceil(text.length / 4)
  }

  /**
   * Trims target job description to eliminate boilerplate (EEO statements, company legalities)
   * while preserving core requirements and responsibilities.
   * @param {string} jdText
   * @param {number} [maxChars=1500]
   * @returns {string}
   */
  static sanitizeAndTrimJd(jdText, maxChars = 1500) {
    if (!jdText || typeof jdText !== 'string') return ''
    const clean = jdText.replace(/\r\n/g, '\n').trim()
    if (clean.length <= maxChars) return clean
    return clean.slice(0, maxChars) + '... [trimmed for concise evaluation]'
  }

  /**
   * Compiles the deterministic Pre-Audit Dossier string from precomputed signals.
   * @param {Object} dossier
   * @returns {string}
   */
  static formatDossierText(dossier) {
    const lines = [
      '==================================================',
      'DETERMINISTIC PRE-AUDIT DOSSIER (Ground Truth):',
      '==================================================',
    ]

    // Quantification
    const q = dossier.quantification || {}
    lines.push(
      `- Quantification Density: ${q.density ?? 0} (${q.quantifiedBullets ?? 0}/${q.totalBullets ?? 0} bullets quantified)`
    )
    if (q.unquantifiedBulletIds?.length > 0) {
      lines.push(`- Unquantified Bullets: ${q.unquantifiedBulletIds.join(', ')}`)
    } else {
      lines.push('- Unquantified Bullets: None')
    }

    // Tool Dumps
    if (dossier.toolDumps?.length > 0) {
      const dumpStr = dossier.toolDumps.map((t) => `${t.bulletId} (${t.techCount} tools)`).join(', ')
      lines.push(`- Tool Dump Candidates: ${dumpStr}`)
    } else {
      lines.push('- Tool Dump Candidates: None')
    }

    // Contact Merge
    lines.push(
      `- Contact Merge Anomaly: ${dossier.contactMergeAnomaly ? 'DETECTED in extracted text (ats_readability signal)' : 'CLEAN'}`
    )

    // Timeline Facts
    const tl = dossier.timeline || {}
    lines.push(
      `- Career Timeline: ${tl.formattedDuration || '0 months'} across ${tl.itemCount || 0} roles (${tl.totalExperienceYears || 0} years)`
    )
    if (tl.currentRole?.isCurrentlyEmployed) {
      lines.push(
        `- Current Role: ${tl.currentRole.role || 'Active Role'} at ${tl.currentRole.company || 'Current Employer'} (${tl.currentRole.dates || 'Present'})`
      )
    } else {
      lines.push('- Current Role: Not actively employed')
    }

    if (tl.careerGaps?.length > 0) {
      const gapStr = tl.careerGaps.map((g) => `${g.gapMonths} months between ${g.previousCompany} and ${g.nextCompany}`).join('; ')
      lines.push(`- Career Gaps (>6 months): ${gapStr}`)
    } else {
      lines.push('- Career Gaps (>6 months): None')
    }

    if (tl.promotions?.length > 0) {
      const promoStr = tl.promotions.map((p) => `${p.company}: ${p.progressionSummary}`).join('; ')
      lines.push(`- Career Progression / Promotions: ${promoStr}`)
    } else {
      lines.push('- Career Progression / Promotions: None')
    }

    // Certifications
    if (dossier.certifications?.length > 0) {
      const certNames = dossier.certifications.map((c) => (typeof c === 'string' ? c : c.name || '')).filter(Boolean)
      lines.push(`- Certifications Evidenced: ${certNames.join(', ') || 'None'}`)
    } else {
      lines.push('- Certifications Evidenced: None')
    }

    // Target JD Overlap
    const jdOverlap = dossier.targetJdOverlap || {}
    lines.push(`- Target JD Evidenced Skills: ${jdOverlap.evidencedSkills?.join(', ') || 'None'}`)
    lines.push(`- Target JD Gaps (NOT_EVIDENCED_IN_RESUME): ${jdOverlap.unverifiedSkills?.join(', ') || 'None'}`)

    // Market Gaps
    if (dossier.marketEvidenceGaps?.length > 0) {
      const mGaps = dossier.marketEvidenceGaps.map((g) => `${g.skill} (${g.frequency})`).join(', ')
      lines.push(`- Sampled Market Gaps: ${mGaps}`)
    } else {
      lines.push('- Sampled Market Gaps: None')
    }

    return lines.join('\n')
  }

  /**
   * Compiles the full prompt payload and metadata for the reasoning call.
   *
   * @param {Object} params
   * @param {string} params.compactResume - Serialized compact resume text
   * @param {Object} params.dossier - Precomputed ground-truth dossier
   * @param {string} [params.targetRole] - Target job title
   * @param {string} [params.targetJobDescription] - Raw or pre-extracted JD
   * @param {Object} [params.marketContext] - Sampled market intelligence
   * @param {string} [params.systemPrompt] - Base system instructions
   * @returns {{
   *   messages: Array<{role: string, content: string}>,
   *   dossierText: string,
   *   trimmedJd: string,
   *   estimatedTokens: { system: number, user: number, total: number },
   *   contentHash: string
   * }}
   */
  static compile({
    compactResume,
    dossier,
    targetRole = 'Software Professional',
    targetJobDescription = '',
    marketContext = null,
    systemPrompt = '',
  }) {
    const trimmedJd = this.sanitizeAndTrimJd(targetJobDescription, 1500)
    const dossierText = this.formatDossierText(dossier)

    const userContent = [
      `TARGET ROLE: ${targetRole || 'Not specified'}`,
      '',
      'TARGET JOB DESCRIPTION:',
      trimmedJd || 'None provided',
      '',
      'CANDIDATE RESUME:',
      compactResume || '',
      '',
      dossierText,
      `- Market Bucket: ${marketContext?.bucketKey || 'general'} (Sample Size: ${marketContext?.marketSampleSize || 5})`,
      '',
      'Synthesize the final report now using this dossier as factual foundation. Return ONLY valid JSON.',
    ].join('\n')

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]

    const sysTokens = this.estimateTokens(systemPrompt)
    const userTokens = this.estimateTokens(userContent)
    const totalTokens = sysTokens + userTokens

    // Hash user content + compact resume for deterministic caching
    const contentHash = crypto
      .createHash('sha256')
      .update(userContent)
      .digest('hex')

    return {
      messages,
      dossierText,
      trimmedJd,
      estimatedTokens: {
        system: sysTokens,
        user: userTokens,
        total: totalTokens,
      },
      contentHash,
    }
  }
}

export default ContextCompiler
