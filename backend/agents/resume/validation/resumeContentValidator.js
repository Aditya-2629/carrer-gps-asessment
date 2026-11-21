/**
 * Resume Content Validator
 * Deterministically verifies whether uploaded document text is actually a candidate resume
 * vs empty/scanned PDFs, receipts, invoices, boarding passes, bank statements, essays, etc.
 * 0 LLM calls, deterministic regex & structural heuristics.
 */

export class ResumeValidationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ResumeValidationError'
    this.code = code
    this.statusCode = 422
  }
}

// Obvious non-resume patterns: invoices, receipts, tax forms, tickets, bank statements, legal agreements
const NON_RESUME_PATTERNS = [
  // Invoices & Receipts
  /\b(?:tax\s+invoice|invoice\s+(?:number|no|#)|receipt\s+(?:number|no|#)|amount\s+due|subtotal|balance\s+due|payment\s+due|bill\s+to:|remit\s+to:)\b/i,
  // Bank Statements
  /\b(?:bank\s+statement|account\s+statement|statement\s+period|opening\s+balance|closing\s+balance|total\s+withdrawals|total\s+deposits|available\s+balance)\b/i,
  // Tax Forms (W2, 1040)
  /\b(?:form\s+w-?2|wage\s+and\s+tax\s+statement|internal\s+revenue\s+service|form\s+1040|taxpayer\s+identification|federal\s+income\s+tax\s+withheld)\b/i,
  // Flight tickets / Boarding passes
  /\b(?:boarding\s+pass|flight\s+(?:number|no)|airline\s+ticket|eticket|e-ticket\s+receipt|passenger\s+name\s+record|booking\s+reference|seat:\s*\d+[a-z]|gate:\s*[a-z0-9]+)\b/i,
  // Order Confirmations
  /\b(?:order\s+confirmation|order\s+(?:number|no|#)|shipping\s+address[\s\S]*billing\s+address|tracking\s+number[\s\S]*carrier|items\s+ordered)\b/i,
  // Utility Bills
  /\b(?:utility\s+bill|electricity\s+bill|water\s+bill|gas\s+bill|meter\s+reading|account\s+number:\s*\d{6,})\b/i,
  // Legal Agreements / Leases
  /\b(?:lease\s+agreement|tenancy\s+agreement|residential\s+lease|nondisclosure\s+agreement|this\s+agreement\s+is\s+made\s+and\s+entered|parties\s+hereto\s+agree|lessor\b[\s\S]*lessee\b)\b/i,
]

/**
 * Validates whether the raw text extracted from a document represents a legitimate resume.
 *
 * @param {string} rawText - Extracted text content of the document
 * @param {string} [filename=''] - Optional original filename
 * @returns {{ valid: boolean, code?: string, message?: string, positiveSignalsCount?: number, signals?: Object }}
 */
export function validateResumeContent(rawText, filename = '') {
  const text = typeof rawText === 'string' ? rawText.trim() : ''

  // Check 1: Empty text or scanned image with no text layer (< 120 chars)
  if (!text || text.length < 120) {
    return {
      valid: false,
      code: 'SCANNED_OR_EMPTY_FILE',
      message: 'The uploaded file appears to be empty or a scanned image with no readable text. Please upload a text-based PDF or Word (.docx) document.',
    }
  }

  // Check positive resume signals (must have at least 2 of 5)
  // 1. Work Experience / Employment section or clear job date ranges
  const hasExpHeader = /\b(?:work\s+experience|professional\s+experience|employment\s+history|work\s+history|experience\s+summary|relevant\s+experience|experience)\b/i.test(text)
  const hasJobDates =
    /\b(?:(?:19|20)\d{2}\s*[-–—/to\s]+\s*(?:(?:19|20)\d{2}|present|current))\b/i.test(text) ||
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}\b/i.test(text)
  const hasExperience = hasExpHeader || hasJobDates

  // 2. Education / Degree / University section
  const hasEduHeader = /\b(?:education|academic\s+background|qualifications|academic\s+credentials|academic\s+history)\b/i.test(text)
  const hasDegree = /\b(?:bachelor(?:'s)?|master(?:'s)?|ph\.?d|b\.?s\.?|m\.?s\.?|b\.?tech|m\.?tech|b\.?e\.?|m\.?e\.?|b\.?a\.?|m\.?a\.?|degree|university|college|polytechnic|gpa)\b/i.test(text)
  const hasEducation = hasEduHeader || hasDegree

  // 3. Skills / Technologies section
  const hasSkillsHeader = /\b(?:skills|technical\s+skills|core\s+competencies|technologies|tools\s+(&|and)\s+technologies|tech\s+stack|proficiencies|programming\s+languages)\b/i.test(text)
  const techMatches = text.match(/\b(?:python|javascript|typescript|react|node|sql|aws|docker|kubernetes|java|c\+\+|html|css|git|c#|golang|graphql|mongodb|postgresql|linux|azure|gcp|spring|angular|vue|django|flask|express)\b/gi) || []
  const hasSkills = hasSkillsHeader || (new Set(techMatches.map((t) => t.toLowerCase())).size >= 3)

  // 4. Projects / Professional Summary section
  const hasProjectsOrSummary = /\b(?:projects|key\s+projects|selected\s+projects|personal\s+projects|summary|professional\s+summary|executive\s+summary|about\s+me|career\s+objective)\b/i.test(text)

  // 5. Candidate contact info (email, phone, linkedin)
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)
  const hasPhone = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{4,5}|\b\d{10,12}\b/.test(text)
  const hasLinkedin = /(?:linkedin\.com\/(?:in\/[a-zA-Z0-9_%-]+|[a-zA-Z0-9_%-]+))/i.test(text)
  const hasContact = hasEmail || hasPhone || hasLinkedin

  const positiveSignals = [hasExperience, hasEducation, hasSkills, hasProjectsOrSummary, hasContact]
  const positiveSignalsCount = positiveSignals.filter(Boolean).length

  // Check non-resume indicators
  const isObviousNonResume = NON_RESUME_PATTERNS.some((p) => p.test(text))

  if (isObviousNonResume && positiveSignalsCount < 3) {
    return {
      valid: false,
      code: 'NOT_A_RESUME',
      message: 'This document does not look like a resume (detected receipt, invoice, statement, or non-resume document). Please upload your actual resume in PDF or .docx format.',
    }
  }

  if (positiveSignalsCount < 2) {
    return {
      valid: false,
      code: 'NOT_A_RESUME',
      message: 'This document does not look like a resume (missing Experience, Education, or Skills sections). Please upload your actual resume in PDF or .docx format.',
    }
  }

  return {
    valid: true,
    positiveSignalsCount,
    signals: {
      hasExperience,
      hasEducation,
      hasSkills,
      hasProjectsOrSummary,
      hasContact,
    },
  }
}
