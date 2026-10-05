/**
 * Deterministic Signal Patterns & Keyword Dictionaries — V2.5 Phase 1
 *
 * Centralized configuration for regex patterns and keyword matchers
 * used in deterministic pre-processing signals (BulletSignals, ContactMergeSignal, QuantificationRollup).
 */

// ── Quantifier Patterns ────────────────────────────────────────────────────────
// Matches %, numbers followed by x/X, "hours", "users", "$", or bare numbers >= 2 digits
export const QUANTIFIER_PATTERNS = [
  // Percentage matches (e.g., "35%", "94%")
  /\b\d+(?:\.\d+)?%/g,
  // Multipliers (e.g., "3x", "10X", "3.5x")
  /\b\d+(?:\.\d+)?[xX]\b/g,
  // Currency values (e.g., "$100k", "$50", "$")
  /\$\s*[\d,]+(?:\.\d+)?(?:[kKmMbB]|k|M|B)?/g,
  /\$/g,
  // Specific impact terms: hours, hrs, users (e.g., "50+ hours", "5,000+ users", standalone "hours", "users")
  /\b\d+[\d,]*\+?\s*(?:hours|hrs|users)\b/gi,
  /\b(?:hours|hrs|users)\b/gi,
  // Standalone numbers or numbers with common metric units (e.g., "850ms", "120ms", "50ms", "170", "50", "20+", "12k")
  /\b\d{2,}(?:,\d{3})*(?:\.\d+)?(?:\+)?(?:ms|s|sec|min|k|K|m|M|B)?\b/g,
  /\b\d+(?:\.\d+)?(?:ms|sec)\b/gi,
]

// ── Outcome Verbs ──────────────────────────────────────────────────────────────
// Matches reduc*, increas*, improv*, cut, eliminat*, achiev*, sav*, enabl*, cutting, and -ing forms
export const OUTCOME_VERBS_REGEX = /\b(reduc(?:e|ed|es|ing|tion|tions)?|increas(?:e|ed|es|ing)?|improv(?:e|ed|es|ing|ement|ements)?|cut(?:s|ting)?|eliminat(?:e|ed|es|ing|ion|ions)?|achiev(?:e|ed|es|ing|ement|ements)?|sav(?:e|ed|es|ing|ings)?|enabl(?:e|ed|es|ing)?)\b/i

// ── Contact Merge Detection Patterns ───────────────────────────────────────────
// Detects email, phone number, and professional URLs in summary_001
export const CONTACT_PATTERNS = {
  // Email address pattern
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
  // Phone number pattern (various US/international phone formats)
  phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  // Professional URL or bare domain pattern (linkedin.com/, github.com/, or bare domains)
  url: /(?:linkedin\.com\/|github\.com\/|[a-zA-Z0-9-]+\.(?:com|org|io|dev|net|me|ai)\b)/i,
}

export default {
  QUANTIFIER_PATTERNS,
  OUTCOME_VERBS_REGEX,
  CONTACT_PATTERNS,
}
