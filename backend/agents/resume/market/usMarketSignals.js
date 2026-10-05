/**
 * US Market Signals — V3.1 (Phase 1: Voice & US-Market Upgrade)
 *
 * Deterministically detects resume conventions that are common outside the
 * US market but work against the candidate with US recruiters and ATS
 * platforms. The project currently targets the US market, so these signals
 * let the synthesis agent coach the candidate — gently, in conditional
 * language, without claiming anything about the original document's layout.
 *
 * Evidence scope: these detections run on EXTRACTED TEXT (compact resume).
 * Like contact-merge handling in V2.5, every observation must be phrased as
 * an observation about the extracted text, never as a claim about the
 * original file's visual structure.
 */

export const US_MARKET_SIGNALS_VERSION = 'us-market-signals-v1'

// ── Detection patterns ───────────────────────────────────────────────────────

const PERSONAL_DETAILS_PATTERNS = [
  { id: 'date_of_birth', pattern: /\b(d\.?o\.?b\.?|date\s+of\s+birth|birth\s*date)\b\s*[:\-]?\s*\S{0,20}/i, label: 'date of birth' },
  { id: 'age', pattern: /\bage\s*[:\-]?\s*\d{1,2}\b/i, label: 'age' },
  { id: 'marital_status', pattern: /\b(marital\s+status|marital\s+status\s*:|unmarried|married\s*\/?\s*single)\b/i, label: 'marital status' },
  { id: 'gender', pattern: /\bgender\s*[:\-]/i, label: 'gender' },
  { id: 'nationality', pattern: /\bnationality\s*[:\-]/i, label: 'nationality' },
  { id: 'fathers_name', pattern: /\b(father'?s?\s+name|mother'?s?\s+name)\b/i, label: "parent's name" },
  { id: 'passport_or_id', pattern: /\b(passport\s*(no\.?|number)|aadhaar|pan\s*(no\.?|card)|voter\s+id)\b/i, label: 'government ID number' },
  { id: 'blood_group', pattern: /\bblood\s+group\b/i, label: 'blood group' },
  { id: 'photo_reference', pattern: /\b(photograph|headshot|passport\s+size\s+photo)\b/i, label: 'photo reference' },
  { id: 'languages_known', pattern: /\blanguages?\s+known\s*[:\-]/i, label: "'languages known' block" },
  { id: 'hobbies', pattern: /^(hobbies|interests)\s*[:\-]/im, label: "'hobbies' block" },
]

const DECLARATION_PATTERNS = [
  /\bi\s+hereby\s+(declare|affirm|state)\b/i,
  /\bdeclaration\s*[:\-]?\s*$/im,
  /\bplace\s*[:\-]\s*\S+\s+date\s*[:\-]/i,
  /\bsignature\s*[:\-]?\s*$/im,
]

const OBJECTIVE_SECTION_PATTERNS = [
  /^\s*(career\s+)?objective\s*[:\-]?\s*$/im,
  /^\s*(career\s+)?objective\s*[:\-]\s+\S/im,
]

// Non-US location and education conventions. Detection is best-effort on
// extracted text; the synthesis agent must use conditional language.
const NON_US_LOCATION_PATTERNS = [
  /\b(india|indian|bharat|mumbai|delhi|bangalore|bengaluru|hyderabad|chennai|pune|kolkata|ahmedabad|jaipur|noida|gurgaon|gurugram|nigeria|lagos|kenya|nairobi|philippines|manila|pakistan|karachi|lahore|bangladesh|dhaka|sri\s+lanka|colombo|nepal|kathmandu|vietnam|egypt|cairo|dubai|abu\s+dhabi|sharjah|saudi\s+arabia|riyadh|qatar|doha|ukraine|kyiv)\b/i,
]

const NON_US_EDUCATION_PATTERNS = [
  { id: 'school_grades', pattern: /\b(10th|12th|x(th)?|xii(th)?|ssc|hsc|sslc|icse|cbse|intermediate)\b/i, label: 'secondary-school conventions (10th/12th/SSC/HSC/CBSE)' },
  { id: 'percentage_scores', pattern: /\b\d{1,2}(\.\d{1,2})?\s?%\b/g, label: 'percentage-based academic scores', contextRequired: /%/, minCount: 2 },
  { id: 'cgpa_10_scale', pattern: /\bcgpa\s*[:\-]?\s*\d(\.\d{1,2})?\s*(\/|out\s+of)?\s*10\b/i, label: 'CGPA on a 10-point scale' },
  { id: 'college_year_style', pattern: /\b(b\.(?:e|tech)|m\.(?:e|tech)|bachelor\s+of\s+engineering)\b\.?/i, label: 'degree naming conventions common outside the US (B.E./B.Tech)' },
]

const US_STATE_ABBREV = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY),?\s+\d{5}\b/

// ── Detection ────────────────────────────────────────────────────────────────

/**
 * Runs all US-market convention checks against the extracted resume text.
 *
 * @param {Object} params
 * @param {string} params.resumeText  - Extracted resume text (compact or raw)
 * @param {number|null} [params.pageCount] - Page count from the document parser, when available
 * @param {string|null} [params.location]  - Candidate location from canonical resume
 * @returns {{
 *   version: string,
 *   flags: Object,
 *   observations: Array<{type: string, weight: string, description: string, llmGuidance: string, category: string}>,
 *   summary: { nonUsConventionsDetected: number, personalDetailsCount: number }
 * }}
 */
export function detectUsMarketSignals({ resumeText = '', pageCount = null, location = null } = {}) {
  const text = (resumeText || '').toString()
  const flags = {}
  const observations = []

  // 1. Personal details block (DOB, marital status, etc.)
  const personalHits = []
  for (const { id, pattern, label } of PERSONAL_DETAILS_PATTERNS) {
    if (pattern.test(text)) {
      personalHits.push(label)
      flags[id] = true
    }
  }
  flags.personalDetailsDetected = personalHits.length > 0

  // 2. Declaration / signature block
  flags.declarationBlockDetected = DECLARATION_PATTERNS.some((p) => p.test(text))

  // 3. "Objective" section (dated style for the US market)
  flags.objectiveSectionDetected = OBJECTIVE_SECTION_PATTERNS.some((p) => p.test(text))

  // 4. Non-US location signals
  const locationLower = (location || '').toLowerCase()
  flags.nonUsLocationDetected =
    NON_US_LOCATION_PATTERNS.some((p) => p.test(text)) ||
    (locationLower.length > 0 && NON_US_LOCATION_PATTERNS.some((p) => p.test(locationLower)))
  flags.usStyleLocationDetected = US_STATE_ABBREV.test(text) || /,\s*(united states|usa)\b/i.test(text)

  // 5. Non-US education conventions
  const educationHits = []
  for (const { id, pattern, label, minCount } of NON_US_EDUCATION_PATTERNS) {
    if (id === 'percentage_scores') {
      const count = (text.match(pattern) || []).length
      if (count >= (minCount || 2)) {
        educationHits.push(label)
        flags[id] = true
      }
    } else if (pattern.test(text)) {
      educationHits.push(label)
      flags[id] = true
    }
  }
  flags.nonUsEducationConventionsDetected = educationHits.length > 0

  // ── Build observations (all conditional language, extracted-text scope) ────

  if (flags.personalDetailsDetected) {
    observations.push({
      type: 'us_market_personal_details',
      weight: 'high',
      description: `Extracted resume text includes personal details that US recruiters and ATS expect to be omitted: ${personalHits.join(', ')}. In the US market these are typically removed (and can invite bias-related rejection).`,
      llmGuidance: 'US_MARKET_COACHING: Surface as a US-market alignment issue (category us_market_alignment, severity medium-to-high). Use conditional language about the extracted text. Explain briefly WHY US norms differ (bias-safe hiring). Never mock or alarm the candidate.',
      category: 'us_market_alignment',
    })
  }

  if (flags.declarationBlockDetected) {
    observations.push({
      type: 'us_market_declaration_block',
      weight: 'medium',
      description: "Extracted resume text appears to include a declaration/signature block ('I hereby declare…'). This is a convention in several countries but is not used on US resumes.",
      llmGuidance: 'US_MARKET_COACHING: Surface as a low-to-medium us_market_alignment issue with conditional language ("appears to include"). Recommend removing it to save space and match US norms.',
      category: 'us_market_alignment',
    })
  }

  if (flags.objectiveSectionDetected) {
    observations.push({
      type: 'us_market_objective_section',
      weight: 'medium',
      description: "The resume uses an 'Objective' section. US hiring practice has largely replaced objectives with a short professional summary that leads with value, not what the candidate wants.",
      llmGuidance: 'US_MARKET_COACHING: Surface as a low-to-medium us_market_alignment issue. Recommend converting the objective into a 2-3 line summary focused on what the candidate offers. If a strong summary already exists, this may be redundant — use judgment.',
      category: 'us_market_alignment',
    })
  }

  if (flags.nonUsLocationDetected && !flags.usStyleLocationDetected) {
    observations.push({
      type: 'us_market_location_signal',
      weight: 'low',
      description: 'Contact or education details suggest the candidate may currently be outside the US. US recruiters read location quickly, so if the candidate is targeting US roles, how (and whether) location is presented matters.',
      llmGuidance: 'US_MARKET_COACHING: Only surface if the candidate\u2019s target role suggests US employment AND the resume shows no US location. Keep it to ONE brief, supportive observation or fold into overallReview. Do NOT give visa/legal advice. Never imply the candidate should hide their background — the issue is clarity about work authorization/location intent, not identity.',
      category: 'us_market_alignment',
    })
  }

  if (flags.nonUsEducationConventionsDetected) {
    observations.push({
      type: 'us_market_education_conventions',
      weight: 'low',
      description: `Education section uses conventions common outside the US: ${educationHits.join('; ')}. US recruiters are more familiar with GPA (on a 4.0 scale), month-year ranges, and degree names without school-level scores.`,
      llmGuidance: 'US_MARKET_COACHING: Surface as a low us_market_alignment issue ONLY if the resume is clearly targeting US roles. Recommend leading with the highest degree and month-year dates; older school-level scores can usually be removed entirely. Conditional language only.',
      category: 'us_market_alignment',
    })
  }

  if (typeof pageCount === 'number' && pageCount > 2) {
    observations.push({
      type: 'us_market_page_count',
      weight: 'medium',
      description: `Parsed document reports approximately ${pageCount} pages. For most US roles outside academia and senior executive search, 1-2 pages is the norm; recruiters rarely read past page two.`,
      llmGuidance: 'US_MARKET_COACHING: Surface as a medium us_market_alignment issue with conditional language ("the parsed document suggests"). Recommend trimming to the 2 most relevant pages. Skip entirely for academic/medical CVs where long CVs are the norm.',
      category: 'us_market_alignment',
    })
  }

  return {
    version: US_MARKET_SIGNALS_VERSION,
    flags,
    observations,
    summary: {
      nonUsConventionsDetected: observations.length,
      personalDetailsCount: personalHits.length,
    },
  }
}

/**
 * Formats US-market signals as a compact prompt block for the synthesis agent.
 * @param {Object} usSignals - Output of detectUsMarketSignals()
 * @returns {string}
 */
export function formatUsMarketSignalsForPrompt(usSignals) {
  if (!usSignals || !usSignals.observations?.length) {
    return '## US MARKET SIGNALS\nNo non-US conventions detected in the extracted text. The resume already aligns with standard US-market expectations — do NOT invent alignment issues.'
  }

  const lines = ['## US MARKET SIGNALS (deterministic, extracted-text evidence only)']
  lines.push('This project targets the US job market. The following non-US conventions were detected. Review each and decide whether to surface it. All US-market issues MUST use category "us_market_alignment" and conditional language about the extracted text — never claims about the original document layout, and never visa/legal advice.\n')

  for (const obs of usSignals.observations) {
    lines.push(`[${obs.weight.toUpperCase()}] [${obs.type}]`)
    lines.push(`   ${obs.description}`)
    lines.push(`   GUIDANCE: ${obs.llmGuidance}`)
    lines.push('')
  }

  return lines.join('\n')
}

export default { detectUsMarketSignals, formatUsMarketSignalsForPrompt, US_MARKET_SIGNALS_VERSION }
