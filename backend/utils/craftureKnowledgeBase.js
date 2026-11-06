/**
 * craftureKnowledgeBase.js
 *
 * Dedicated Crafture Career GPS Knowledge Base, Persona & Compliance Engine
 * Encapsulates:
 *  - CRAFTURE_BRAND: Multi-domain scope, contact channels, brand principles
 *  - CAREER_GPS_PHASES: 6-Phase end-to-end candidate hiring journey
 *  - CRAFTURE_PROGRAMS: Official catalog ($0 Free, $150 AI, $300 Elite)
 *  - CRAFTURE_SAFETY_RULES: Legal, immigration, and ethical guardrails
 *  - mapToCareerGpsPhase: Deterministic bottleneck-to-phase heuristic mapper
 *  - getCraftureFaqContext: Intent-targeted grounded snippet retrieval
 */

export const CRAFTURE_BRAND = {
  name: 'Crafture',
  product: 'Career GPS',
  domainScope: 'Multi-domain across all U.S. professional fields (engineering, data, finance, healthcare, operations, marketing, product, and design). Never IT-only.',
  supportEmail: 'support@crafture.me',
  portalUrl: 'https://crafture.me',
  tagline: 'Precision Career Intelligence & Strategic Navigation',
  values: [
    'Radical Candor & Grounded Truth',
    'Evidence-Backed Execution',
    'Multi-Domain Expertise',
    'Strict Legal & Regulatory Integrity',
  ],
}

export const CAREER_GPS_PHASES = {
  PHASE_1: {
    number: 1,
    name: 'Resume → Application Readiness',
    key: 'phase_1_application_readiness',
    objective: 'Establish ATS keyword alignment, parseable architecture, and authentic metric-driven positioning.',
    typicalBottlenecks: [
      'Image-based or multi-column PDFs failing ATS parsers',
      'Missing core technical and functional market keywords',
      'Task-focused bullet points lacking quantified outcomes',
    ],
    tacticalFixes: [
      'Single-column linear typography with standard section headings',
      'Google XYZ metric structure: Accomplished [X], measured by [Y], by doing [Z]',
      'Strict elimination of English stop-word keyword stuffing',
    ],
  },
  PHASE_2: {
    number: 2,
    name: 'Application → Recruiter Screening Call',
    key: 'phase_2_screening_conversion',
    objective: 'Convert top-of-funnel submissions into initial recruiter screening calls through targeted velocity and outbound channels.',
    typicalBottlenecks: [
      'Over-reliance on low-conversion "Easy Apply" job portals (<2% conversion)',
      'Submitting applications without warm internal referrals or hiring manager touchpoints',
      'Low targeted submission volume (<30 applications per week)',
    ],
    tacticalFixes: [
      'Direct company portal applications combined with 50-word InMail to team leads',
      'Targeted referral outreach to university alumni and past colleagues',
      'Maintaining a steady velocity of 40-60 precision-tailored applications weekly',
    ],
  },
  PHASE_3: {
    number: 3,
    name: 'Screening Call → Technical / Role Interview',
    key: 'phase_3_technical_clearance',
    objective: 'Substantiate resume claims with poise and convert recruiter screens into formal technical or functional assessments.',
    typicalBottlenecks: [
      'Inability to clearly articulate career trajectory and motivations in 90 seconds',
      'Discrepancies between LinkedIn profile claims and resume bullet details',
      'Hesitation or vagueness when asked about work authorization or compensation expectations',
    ],
    tacticalFixes: [
      'Structured 90-second "Tell Me About Yourself" executive pitch',
      'Pre-scripted, factual answers regarding visa status (e.g. F-1 STEM OPT with valid EAD)',
      'Proactive defense of stranded technical keywords using verified project context',
    ],
  },
  PHASE_4: {
    number: 4,
    name: 'First Interview → Subsequent / Final Rounds',
    key: 'phase_4_final_round_conversion',
    objective: 'Clear rigorous technical system design, coding, or case study evaluations with architectural trade-off justification.',
    typicalBottlenecks: [
      'Giving purely theoretical answers without sharing real production constraints',
      'Failing to articulate why an architecture or tool was chosen over industry alternatives',
      'Rushing into implementation without clarifying functional scope and edge cases',
    ],
    tacticalFixes: [
      'Structured STAR format (Situation, Task, Action, Result) emphasizing the business outcome',
      'Explicit trade-off matrices (e.g., latency vs. storage cost, simplicity vs. scalability)',
      'Live problem decomposition with active stakeholder communication',
    ],
  },
  PHASE_5: {
    number: 5,
    name: 'Final Round → Written Offer',
    key: 'phase_5_offer_negotiation',
    objective: 'Demonstrate executive fit, culture alignment, and cross-functional leadership to secure competitive written job offers.',
    typicalBottlenecks: [
      'Appearing disconnected from the hiring manager’s core business and revenue objectives',
      'Passive stance during final executive interviews rather than consultative partnership',
      'Premature concessions on base salary, equity, or start date before a formal offer is drafted',
    ],
    tacticalFixes: [
      'Consultative 30-60-90 day strategic vision presentation',
      'Inquiring into unblocking team bottlenecks and executive KPIs',
      'Batched, objective counter-offers backed by verified market salary bands',
    ],
  },
  PHASE_6: {
    number: 6,
    name: 'Offer → Background Verification & Joining',
    key: 'phase_6_onboarding_documentation',
    objective: 'Ensure seamless background verification clearance, immigration compliance, and high-impact day-one onboarding.',
    typicalBottlenecks: [
      'Discrepancies in employment dates, official job titles, or entity names on third-party checks',
      'Delay in securing work authorization transfers (H-1B change of employer, STEM OPT I-20 updates)',
      'Lack of day-one transition and relationship management at the new organization',
    ],
    tacticalFixes: [
      'Complete alignment between payroll documentation (W-2s, 1099s), resume, and LinkedIn',
      'Timely coordination with immigration counsel for petition filing with USCIS',
      'Structured first 30-day onboarding relationship mapping and milestone delivery',
    ],
  },
}

export const CRAFTURE_PROGRAMS = {
  starter: {
    name: 'Crafture Career GPS Starter',
    price: '$0 (Free Forever)',
    cadence: 'One-time & Ongoing Free Access',
    description: 'Comprehensive candidate self-diagnosis and market benchmarking report.',
    features: [
      '100-Point Weighted Career Health Scorecard',
      'ATS Resume Keyword & Formatting Deep Diagnosis',
      'LinkedIn SEO & Discrepancy Cross-Analysis',
      'Primary Funnel Bottleneck Identification',
      'Self-guided 7-Day Action Plan',
      'Interactive Chatbot Support (Atlas Copilot)',
    ],
    bestFor: 'Candidates seeking an immediate, data-driven audit of their current job search materials.',
  },
  ai: {
    name: 'Crafture Career GPS AI',
    price: '$150 / month',
    cadence: 'Monthly Subscription (Cancel Anytime)',
    description: 'Autonomous AI-powered pipeline execution, continuous resume tailoring, and high-velocity outreach tools.',
    features: [
      'Everything in Starter',
      'Continuous dynamic resume tailoring for every job application',
      'Tailored 50-word InMail and cold email generator for hiring managers',
      'Automated weekly application tracking and pipeline analytics',
      'Daily curated job match recommendations calibrated to your seniority tier',
      'Live AI mock interview practice with instant trade-off feedback',
    ],
    bestFor: 'Active job seekers applying to 30-60 roles weekly who want an autonomous AI copilot to maximize response rates.',
  },
  elite: {
    name: 'Crafture Elite (AI + Dedicated Human Partner)',
    price: '$300 / month',
    cadence: 'Monthly Retainer (Cancel Anytime)',
    description: 'Full-spectrum career strategy combining autonomous AI tools with dedicated 1-on-1 U.S.-based executive talent consultants.',
    features: [
      'Everything in Career GPS AI ($150 value)',
      'Dedicated U.S.-based senior talent advisor assigned to your search',
      'Bi-weekly 1-on-1 strategy and pipeline review calls',
      'Comprehensive human-reviewed resume and LinkedIn portfolio overhaul',
      'Live 1-on-1 behavioral and technical mock interviews with personalized critique',
      'Direct offer evaluation and salary negotiation representation',
      'Priority email and Slack support with <12 hour response time',
    ],
    bestFor: 'Senior, lead, or career-transition candidates who want end-to-end human partnership, accountability, and maximum offer leverage.',
  },
}

export const CRAFTURE_SAFETY_RULES = {
  noGuarantees: 'Zero employment or interview guarantees unless explicitly stated in a signed, written legal contract. Crafture is an optimization and intelligence platform that drives process mastery, not a placement agency.',
  visaGuardrails: 'Educational career guidance only on OPT, STEM OPT, H-1B, H-4 EAD, and CPT. Never provide formal legal counsel. Always direct complex immigration questions to licensed immigration attorneys or Designated School Officials (DSOs). Never guarantee visa sponsorship or USCIS petition approval.',
  multiDomainOnly: 'Crafture serves professionals across Engineering, Data, Healthcare, Finance, Marketing, Product, Operations, and Legal. Never describe Crafture as serving only IT candidates or software developers.',
  transparentPricing: 'Strictly adhere to official Crafture pricing: Free Starter ($0), Career GPS AI ($150/mo), and Elite AI+Human ($300/mo). Never quote unverified placement fees, cut-of-salary models, or arbitrary add-ons.',
}

/**
 * Maps any candidate bottleneck, leak stage, or query to the official 6-Phase Career GPS Framework.
 *
 * @param {string} text - Diagnostic bottleneck, leak description, or candidate question
 * @returns {object} Phase object from CAREER_GPS_PHASES
 */
export function mapToCareerGpsPhase(text = '') {
  const norm = String(text || '').toLowerCase()

  if (/\b(phase\s*6|background check|verificat\w*|joining|onboarding|w-2|1099|documentation|i-20|h-1b transfer\w*)/i.test(norm)) {
    return CAREER_GPS_PHASES.PHASE_6
  }
  if (/\b(phase\s*5|offers?|negotiat\w*|compensation|salary|equity|bonus|counter-offer\w*|executive round)/i.test(norm)) {
    return CAREER_GPS_PHASES.PHASE_5
  }
  if (/\b(phase\s*4|technical|system design|coding|case study|panel|trade-off\w*|star method|subsequent round\w*)/i.test(norm)) {
    return CAREER_GPS_PHASES.PHASE_4
  }
  if (/\b(phase\s*3|substantiat\w*|first interview|initial interview|role interview)/i.test(norm)) {
    return CAREER_GPS_PHASES.PHASE_3
  }
  if (/\b(phase\s*2|application\w*|apply\w*|recruiter screen\w*|screening call\w*|recruiter call\w*|portal|easy apply|outreach|inmail|ghosting)/i.test(norm)) {
    return CAREER_GPS_PHASES.PHASE_2
  }
  if (/\b(phase\s*1|resume|ats|keyword\w*|formatting|single-column|readability|applicant tracking)/i.test(norm)) {
    return CAREER_GPS_PHASES.PHASE_1
  }

  // Default to Phase 1 for general foundational optimization
  return CAREER_GPS_PHASES.PHASE_1
}

/**
 * Retrieves grounded Crafture FAQ and policy context matching user intent.
 * Grounded in the 90-Question Crafture FAQ knowledge base.
 *
 * @param {string} query - Raw candidate question
 * @returns {string} Clean formatted context snippet for injection into chat prompts
 */
export function getCraftureFaqContext(query = '') {
  const q = String(query || '').toLowerCase()
  const snippets = []

  // 1. Programs & Pricing Intent
  if (/\b(pricing|price|cost|tier|programs?|plans?|\$150|\$300|free|starter|elite|membership|subscription|charge|fee)\b/i.test(q)) {
    snippets.push(`
[CRAFTURE OFFICIAL PROGRAMS & PRICING]
- Starter Experience: Free ($0). Includes 100-Point Weighted Career Health Report, ATS resume audit, LinkedIn cross-diagnosis, bottleneck breakdown, and 7-day triage.
- Career GPS AI: $150/month. Adds dynamic tailored resume generators, automated application tracking, cold InMail generators, and live AI interview drills. Cancel anytime.
- Elite (AI + Dedicated Human Consultant): $300/month. Pairs candidate with a dedicated U.S.-based executive talent consultant, bi-weekly 1-on-1 strategy sessions, live mock interview critiques, complete resume overhaul, and hands-on salary negotiation representation. Cancel anytime.
- Policy: No percentage-of-salary fees, no hidden placement cuts, month-to-month flexibility.`)
  }

  // 2. Cancellation & Refund Intent
  if (/\b(refund|cancel|money back|contract|commitment|guarantee fee)\b/i.test(q)) {
    snippets.push(`
[CRAFTURE CANCELLATION & REFUND POLICY]
- All paid Crafture subscriptions ($150/mo AI and $300/mo Elite) operate on a flexible month-to-month basis with zero long-term lock-in.
- Candidates can cancel anytime with one click in their portal settings prior to their next monthly renewal.
- Direct contact for billing inquiries: support@crafture.me.`)
  }

  // 3. Visa & Work Authorization Intent
  if (/\b(visa|opt|stem opt|h-?1b|h4|ead|cpt|sponsorship|sponsor|uscis|dso|legal|attorney)\b/i.test(q)) {
    snippets.push(`
[CRAFTURE VISA & WORK AUTHORIZATION GUIDANCE]
- Educational Guidance: Candidates on F-1 OPT / STEM OPT must clearly communicate their current work authorization status without raising premature recruiter hesitation. E-Verify employers are the safest target for STEM extensions.
- Sponsorship Strategy: We guide candidates to target companies with a documented history of filing LCA and H-1B petitions (visible via the USCIS H-1B Employer Data Hub).
- MANDATORY LEGAL DISCLAIMER: Crafture provides educational career strategy only, not legal or immigration advice. Candidates must always verify specific visa steps with their Designated School Official (DSO) or a licensed U.S. immigration attorney. We never guarantee visa sponsorship.`)
  }

  // 4. Guarantees & Placement Promises Intent
  if (/\b(guarantee|promise|placement|find me a job|guaranteed offer|how long to get a job)\b/i.test(q)) {
    snippets.push(`
[CRAFTURE GUARANTEE & TIMELINE POLICY]
- Zero Job Guarantees: Crafture does NOT promise or guarantee job placement, interview invites, or specific compensation figures. Such guarantees are unethical and violate our standards unless covered by an explicit written contract.
- Expected Impact: Our system provides measurable process optimization—improving ATS keyword match, conversion from application to recruiter screen (typically shifting from <2% to 12-18%), and structured STAR technical performance. Candidates disciplined in our 6-Phase Framework typically experience significant funnel traction within 14-28 days.`)
  }

  // 5. Multi-Domain Scope Intent
  if (/\b(domain\w*|field\w*|non-tech|tech only|it only|only for it|only it|software only|only tech|healthcare|finance|marketing|sales|operations|design)\b/i.test(q)) {
    snippets.push(`
[CRAFTURE MULTI-DOMAIN SCOPE]
- Crafture Career GPS is a UNIVERSAL career diagnostic and execution platform serving candidates across ALL professional domains: Engineering & Technology, Data & Analytics, Finance & Accounting, Healthcare & Clinical Operations, Product & Design, Sales & GTM, and Legal.
- Never state that Crafture serves only IT or software candidates. Each domain is analyzed using dedicated domain rubrics, role archetypes, and industry-specific proof artifacts.`)
  }

  // 6. 6-Phase Framework Intent
  if (/\b(phase|framework|journey|6 phases|choke point|pipeline|leak)\b/i.test(q)) {
    snippets.push(`
[CRAFTURE 6-PHASE CAREER GPS FRAMEWORK]
- Phase 1: Resume → Application Readiness (ATS architecture, linear typography, Google XYZ bullets)
- Phase 2: Application → Screening Call (Velocity, warm alumni referrals, 50-word InMail to team leads)
- Phase 3: Screening Call → Technical / Role Interview (90-sec executive pitch, experience substantiation)
- Phase 4: First Interview → Subsequent / Final Rounds (STAR format, architectural trade-offs, proof artifacts)
- Phase 5: Final Round → Written Offer (Executive positioning, value thesis, batched counter-offer strategy)
- Phase 6: Offer → Background Verification & Joining (Payroll documentation alignment, I-20 / H-1B transfers)`)
  }

  // 7. Human Consultant & Elite Tier Intent
  if (/\b(human|coach|advisor|consultant|1-on-1|talk to a person|elite tier)\b/i.test(q)) {
    snippets.push(`
[CRAFTURE ELITE CONSULTANT PARTNERSHIP]
- Elite Members ($300/mo) work directly with a dedicated U.S.-based executive talent consultant.
- Includes 1-on-1 strategy sessions, direct line for resume overhauls, live mock interview drills, and real-time negotiation coaching when offers arrive.
- Candidates can schedule an initial strategy consultation directly from their dashboard.`)
  }

  return snippets.join('\n\n').trim()
}

export default {
  CRAFTURE_BRAND,
  CAREER_GPS_PHASES,
  CRAFTURE_PROGRAMS,
  CRAFTURE_SAFETY_RULES,
  mapToCareerGpsPhase,
  getCraftureFaqContext,
}
