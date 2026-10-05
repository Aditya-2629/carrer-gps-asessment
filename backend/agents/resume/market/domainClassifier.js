/**
 * Domain Classifier — V3.1 (Phase 1: Voice & US-Market Upgrade)
 *
 * Deterministically classifies the candidate's professional domain from the
 * canonical resume so the synthesis prompt can use domain-aware impact
 * taxonomies and metric-discovery questions.
 *
 * Why: the pre-V3.1 pipeline was IT-skewed (latency, uptime, CI/CD as the
 * canonical impact vocabulary). A nurse, an accountant, or a retail manager
 * received tech-flavored coaching. This module detects the domain first and
 * attaches the matching playbook so impact advice fits the candidate's field.
 *
 * Provider-neutral and deterministic — no LLM call. An LLM fallback may be
 * layered later; the classifier output is always safe to expose because it
 * only names a domain, never asserts candidate facts.
 */

export const DOMAIN_CLASSIFIER_VERSION = 'domain-classifier-v1'

/**
 * Domain playbooks. Each playbook supplies:
 * - label: human-readable domain name
 * - isTechnical: whether the domain is IT/software
 * - keywords: weighted detection vocabulary (higher weight = stronger signal)
 * - impactCategories: first-class impact types for this domain
 * - metricDiscovery: question templates the synthesis agent may adapt when
 *   coaching the candidate on quantifying their work
 */
export const DOMAIN_PLAYBOOKS = {
  it_software: {
    label: 'IT & Software',
    isTechnical: true,
    keywords: {
      high: ['software engineer', 'full stack', 'backend', 'frontend', 'devops', 'machine learning', 'data scientist', 'software developer', 'web developer', 'mobile developer', 'qa engineer', 'site reliability', 'cloud engineer', 'sdet'],
      medium: ['api', 'microservices', 'kubernetes', 'docker', 'aws', 'azure', 'react', 'node', 'python', 'java', 'sql', 'ci/cd', 'agile sprint', 'git', 'rest', 'graphql', 'typescript', 'javascript', 'linux', 'database'],
      low: ['code', 'deployment', 'repository', 'debug', 'algorithm', 'framework', 'sdk'],
    },
    impactCategories: [
      'performance & latency improvements', 'reliability & uptime', 'automation of manual work',
      'deployment/CI-CD velocity', 'scalability', 'security & compliance', 'developer productivity',
      'cost reduction (infra)', 'user/customer outcomes', 'code quality & defect reduction',
    ],
    metricDiscovery: [
      'How many users, requests, or records did this system handle?',
      'How much did latency, error rate, or processing time improve?',
      'How many hours of manual work did this automation remove, and how often does it run?',
    ],
  },
  healthcare: {
    label: 'Healthcare & Clinical',
    isTechnical: false,
    keywords: {
      high: ['registered nurse', 'rn', 'nurse practitioner', 'physician', 'medical assistant', 'clinical', 'patient care', 'lpn', 'cna', 'pharmacist', 'physical therapist', 'healthcare', 'hospital', 'ehr', 'hipaa', 'medical billing', 'care coordinator'],
      medium: ['patients', 'patient outcomes', 'vitals', 'triage', 'iv', 'medication administration', 'charting', 'icu', 'emergency department', 'onduty', 'patient satisfaction', 'hipaa compliance', 'cms', 'joint commission', 'infection control', 'care plan', 'discharge', 'bedside'],
      low: ['clinic', 'ward', 'physician orders', 'phlebotomy', 'vaccination', 'admissions', 'bedside manner'],
    },
    impactCategories: [
      'patient outcomes & safety (falls, infections, readmissions)', 'quality of care scores (HCAHPS, patient satisfaction)',
      'staffing & patient ratios managed', 'care coordination & discharge efficiency',
      'compliance & documentation accuracy', 'training & mentoring of staff',
      'cost containment (supply usage, length of stay)', 'service volume handled (census, visits, procedures)',
    ],
    metricDiscovery: [
      'How many patients did you care for per shift, and on what unit?',
      'Did patient satisfaction, safety, or readmission metrics improve on your watch — by how much?',
      'How many staff did you precept, train, or supervise, and what changed for them?',
    ],
  },
  finance_accounting: {
    label: 'Finance & Accounting',
    isTechnical: false,
    keywords: {
      high: ['accountant', 'cpa', 'financial analyst', 'controller', 'bookkeeper', 'auditor', 'tax', 'accounts payable', 'accounts receivable', 'payroll', 'fp&a', 'finance manager', 'cfa', 'credit analyst', 'budget analyst'],
      medium: ['gaap', 'ifrs', 'reconciliation', 'general ledger', 'month-end close', 'financial statements', 'variance', 'forecast', 'audit', 'sox', 'budget', 'ar', 'ap', 'invoicing', 'erp', 'quickbooks', 'sap fico', 'cost savings'],
      low: ['journal entries', 'trial balance', 'depreciation', 'fiscal', 'treasury', 'compliance reporting'],
    },
    impactCategories: [
      'cost savings & spend reduction', 'close cycle time improvement', 'audit outcomes & error reduction',
      'cash flow & working capital improvement', 'process automation (AP/AR, reconciliations)',
      'forecast accuracy', 'compliance (GAAP, SOX, tax filings)', 'revenue or margin contribution',
    ],
    metricDiscovery: [
      'How large was the budget, portfolio, or transaction volume you handled?',
      'How much time or money did your process improvement save, per month or per year?',
      'Did you shorten the close, reduce audit findings, or improve forecast accuracy — by how much?',
    ],
  },
  sales_marketing: {
    label: 'Sales & Marketing',
    isTechnical: false,
    keywords: {
      high: ['sales manager', 'account executive', 'account manager', 'business development', 'sales representative', 'digital marketing', 'marketing manager', 'brand manager', 'seo', 'inside sales', 'regional sales', 'territory manager', 'growth marketing', 'demand generation'],
      medium: ['quota', 'pipeline', 'crm', 'salesforce', 'hubspot', 'lead generation', 'conversion rate', 'upsell', 'b2b', 'b2c', 'cold calling', 'kpi', 'roi', 'campaign', 'market share', 'cac', 'roas', 'ctr', 'retention rate', 'cross-sell'],
      low: ['prospect', 'demo', 'negotiation', 'client relationship', 'brand awareness', 'social media', 'email marketing'],
    },
    impactCategories: [
      'quota attainment & revenue growth', 'pipeline building & conversion rates', 'account retention & expansion',
      'market/territory expansion', 'campaign performance (CTR, ROAS, CPL)', 'average deal size / ACV',
      'sales cycle time reduction', 'lead volume & quality improvement',
    ],
    metricDiscovery: [
      'What was your quota, and what percentage did you achieve — for how many consecutive periods?',
      'How much revenue did you personally close, manage, or grow?',
      'How did your conversion rate, retention, or average deal size compare before and after your changes?',
    ],
  },
  education: {
    label: 'Education & Training',
    isTechnical: false,
    keywords: {
      high: ['teacher', 'professor', 'lecturer', 'principal', 'instructor', 'tutor', 'curriculum', 'educator', 'school counselor', 'academic', 'superintendent', 'dean', 'teaching assistant'],
      medium: ['lesson plans', 'classroom', 'students', 'iep', 'curriculum development', 'standardized test', 'literacy', 'stem', 'classroom management', 'differentiated instruction', 'student achievement', 'assessment', 'faculty', 'accreditation', 'gpa improvement'],
      low: ['syllabus', 'grading', 'parent-teacher', ' pedagogy', 'extracurricular'],
    },
    impactCategories: [
      'student achievement gains (test scores, pass rates, GPAs)', 'class sizes & caseloads managed',
      'curriculum & program development adopted by others', 'student engagement & retention',
      'college/career readiness outcomes', 'grant funding secured', 'staff development & mentoring',
    ],
    metricDiscovery: [
      'How many students did you teach or advise, and in what class sizes?',
      'Did test scores, pass rates, or reading levels improve under your instruction — by how much?',
      'Did you design programs or materials other teachers adopted, or win grant funding?',
    ],
  },
  operations_manufacturing: {
    label: 'Operations, Supply Chain & Manufacturing',
    isTechnical: false,
    keywords: {
      high: ['operations manager', 'supply chain', 'logistics', 'warehouse manager', 'plant manager', 'production manager', 'procurement', 'quality assurance manager', 'inventory manager', 'lean', 'six sigma', 'logistics coordinator', 'distribution'],
      medium: ['kpi', 'oee', 'sla', 'inventory turnover', 'cycle time', 'erp', 'sap', 'fulfillment', 'on-time delivery', 'yield', 'scrap rate', 'downtime', 'continuous improvement', 'kaizen', 'p&l', 'vendor management', 'safety record', 'osha'],
      low: ['shift', 'throughput', 'dispatch', 'stocking', 'forklift', 'assembly', 'maintenance schedule'],
    },
    impactCategories: [
      'throughput & cycle time improvement', 'cost reduction (labor, freight, materials)', 'inventory accuracy & turnover',
      'on-time delivery & SLA attainment', 'safety outcomes (recordables, OSHA)', 'quality/yield improvement & scrap reduction',
      'process automation & lean improvements', 'team size & shifts supervised',
    ],
    metricDiscovery: [
      'How large was the operation — team size, volume shipped/produced, or budget managed?',
      'How much did cost, defects, downtime, or delivery time improve from your changes?',
      'What safety or quality record did the team achieve under your supervision?',
    ],
  },
  hr_people: {
    label: 'HR & People Operations',
    isTechnical: false,
    keywords: {
      high: ['human resources', 'hr manager', 'recruiter', 'talent acquisition', 'hr business partner', 'people operations', 'hr generalist', 'compensation', 'employee relations', 'shrm', 'phr', 'talent manager', 'onboarding specialist'],
      medium: ['ats', 'applicant tracking', 'time-to-fill', 'retention rate', 'turnover', 'engagement survey', 'performance management', 'workday', 'succession planning', 'onboarding', 'benefits administration', 'eEO', 'labor relations', 'headcount'],
      low: ['hiring', 'interviewing', 'policy', 'payroll administration', 'employee handbook'],
    },
    impactCategories: [
      'time-to-fill & cost-per-hire reduction', 'retention/turnover improvement', 'headcount scaled',
      'engagement score improvements', 'compensation & benefits program outcomes', 'compliance & audit readiness',
      'onboarding & internal mobility programs', 'quality of hire & performance outcomes',
    ],
    metricDiscovery: [
      'How many hires did you make per year, and what roles or levels?',
      'How did time-to-fill, retention, or engagement scores move during your tenure?',
      'How many employees or managers did your programs or policies affect?',
    ],
  },
  design_creative: {
    label: 'Design, Creative & Media',
    isTechnical: false,
    keywords: {
      high: ['graphic designer', 'ux designer', 'ui designer', 'product designer', 'creative director', 'art director', 'video editor', 'content writer', 'copywriter', 'content creator', 'photographer', 'illustrator', 'motion designer', 'web designer'],
      medium: ['figma', 'adobe', 'photoshop', 'illustrator', 'sketch', 'wireframe', 'prototype', 'usability', 'brand identity', 'typography', 'user research', 'design system', 'portfolio', 'engagement metrics', 'viewership'],
      low: ['mood board', 'layout', 'color palette', 'storyboard', 'shoot', 'editing'],
    },
    impactCategories: [
      'user engagement & conversion lift from design', 'brand growth (reach, followers, impressions)',
      'usability & accessibility improvements', 'design system & consistency gains',
      'production efficiency & turnaround time', 'content volume & quality shipped',
      'client/customer satisfaction & repeat business',
    ],
    metricDiscovery: [
      'How did engagement, conversion, or satisfaction change after your design or content shipped?',
      'How many projects, assets, or publications did you deliver, at what cadence?',
      'Did your work get adopted as a standard (design system, template, style guide) — used by whom?',
    ],
  },
  business_admin: {
    label: 'Business & Administration',
    isTechnical: false,
    keywords: {
      high: ['office manager', 'administrative assistant', 'executive assistant', 'project coordinator', 'program manager', 'business analyst', 'consultant', 'general manager', 'store manager', 'customer service manager', 'property manager', 'administrative'],
      medium: ['project management', 'stakeholder', 'budget', 'scheduling', 'vendor', 'process improvement', 'ms office', 'excel', 'customer satisfaction', 'nps', 'cost control', 'reporting', 'coordination', 'kpi'],
      low: ['filing', 'data entry', 'reception', 'correspondence', 'front desk'],
    },
    impactCategories: [
      'cost & time savings from process improvements', 'customer satisfaction (NPS, CSAT) gains',
      'revenue/occupancy/utilization improvement', 'team productivity & scheduling efficiency',
      'vendor & contract savings', 'project delivery on time & on budget',
      'documentation & compliance quality',
    ],
    metricDiscovery: [
      'How many people, locations, or customers did you support or manage?',
      'How much time or budget did your process change save, and how often is it used?',
      'Did satisfaction, retention, or utilization numbers move while you ran it?',
    ],
  },
}

// Ordering used for tie-breaking (most specific first)
const DOMAIN_ORDER = Object.keys(DOMAIN_PLAYBOOKS)

/**
 * Builds the corpus of resume text used for classification.
 * Titles and summary carry the most signal; bullets and skills add context.
 * @param {Object} canonicalResume
 * @returns {string}
 */
function buildCorpus(canonicalResume) {
  const parts = []
  const c = canonicalResume || {}
  if (c.candidate?.targetRole) parts.push(c.candidate.targetRole, c.candidate.targetRole)
  if (c.candidate?.primaryProfile) parts.push(c.candidate.primaryProfile, c.candidate.primaryProfile)
  if (c.summary) parts.push(typeof c.summary === 'string' ? c.summary : JSON.stringify(c.summary))
  for (const exp of c.experience || []) {
    if (exp.jobTitle || exp.title) parts.push(exp.jobTitle || exp.title, exp.jobTitle || exp.title)
    if (exp.company) parts.push(exp.company)
    for (const b of exp.bullets || []) parts.push(b.text || '')
  }
  for (const proj of c.projects || []) {
    if (proj.name) parts.push(proj.name)
    for (const b of proj.bullets || []) parts.push(b.text || '')
  }
  if (c.skills) {
    if (typeof c.skills === 'string') parts.push(c.skills)
    else for (const s of c.skills.items || c.skills || []) {
      parts.push(typeof s === 'string' ? s : (s.text || s.name || ''))
    }
  }
  if (c.education) {
    for (const e of c.education) {
      parts.push([e.degree, e.field, e.institution].filter(Boolean).join(' '))
    }
  }
  return parts.join(' ').toLowerCase()
}

/**
 * Classifies the candidate's primary domain from the canonical resume.
 *
 * @param {Object} canonicalResume
 * @returns {{
 *   version: string,
 *   domain: string,
 *   domainLabel: string,
 *   isTechnical: boolean,
 *   confidence: number,
 *   matchedKeywords: Array<{keyword: string, weight: string}>,
 *   runnerUp: {domain: string, domainLabel: string, score: number}|null,
 *   playbook: {impactCategories: string[], metricDiscovery: string[]}
 * }}
 */
export function classifyDomain(canonicalResume) {
  const corpus = buildCorpus(canonicalResume)

  const scores = {}
  const matched = {}

  for (const domain of DOMAIN_ORDER) {
    const { keywords } = DOMAIN_PLAYBOOKS[domain]
    let score = 0
    matched[domain] = []
    for (const kw of keywords.high || []) {
      if (corpus.includes(kw)) {
        score += 5
        matched[domain].push({ keyword: kw, weight: 'high' })
      }
    }
    for (const kw of keywords.medium || []) {
      // Medium/low keywords use word-boundary matching to avoid substring noise
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`(?:^|[^a-z])${escaped}(?:$|[^a-z])`, 'i').test(corpus)) {
        score += 2
        matched[domain].push({ keyword: kw, weight: 'medium' })
      }
    }
    for (const kw of keywords.low || []) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`(?:^|[^a-z])${escaped}(?:$|[^a-z])`, 'i').test(corpus)) {
        score += 1
        matched[domain].push({ keyword: kw, weight: 'low' })
      }
    }
    scores[domain] = score
  }

  const ranked = [...DOMAIN_ORDER].sort((a, b) => scores[b] - scores[a] || DOMAIN_ORDER.indexOf(a) - DOMAIN_ORDER.indexOf(b))
  const top = ranked[0]
  const runnerUpDomain = ranked[1]
  const topScore = scores[top]

  // Confidence: how clearly the top domain leads. No matches at all → general.
  let domain = top
  let confidence = 0
  if (topScore > 0) {
    const runnerScore = scores[runnerUpDomain] || 0
    confidence = Math.min(1, Number((topScore / (topScore + runnerScore || 1)).toFixed(2)))
    // If the lead is weak, treat as general business rather than guess
    if (topScore < 4 || confidence < 0.55) {
      domain = 'business_admin'
      confidence = Math.min(confidence, 0.4)
    }
  } else {
    domain = 'business_admin'
  }

  const playbook = DOMAIN_PLAYBOOKS[domain]
  const runnerPlaybook = DOMAIN_PLAYBOOKS[runnerUpDomain]

  return {
    version: DOMAIN_CLASSIFIER_VERSION,
    domain,
    domainLabel: playbook.label,
    isTechnical: playbook.isTechnical,
    confidence,
    matchedKeywords: (matched[domain] || [])
      .filter((m) => m.weight !== 'low')
      .slice(0, 8),
    runnerUp: topScore > 0 && scores[runnerUpDomain] > 0
      ? { domain: runnerUpDomain, domainLabel: runnerPlaybook.label, score: scores[runnerUpDomain] }
      : null,
    playbook: {
      impactCategories: playbook.impactCategories,
      metricDiscovery: playbook.metricDiscovery,
    },
  }
}

/**
 * Formats the domain profile as a compact prompt block for the synthesis agent.
 * @param {Object} domainProfile - Output of classifyDomain()
 * @returns {string}
 */
export function formatDomainContextForPrompt(domainProfile) {
  if (!domainProfile || !domainProfile.domainLabel) return ''

  const lines = [`## DOMAIN CONTEXT (deterministically detected: ${domainProfile.domainLabel})`]

  lines.push(`Candidate's apparent professional domain: ${domainProfile.domainLabel} (confidence: ${domainProfile.confidence}).`)
  lines.push(domainProfile.isTechnical
    ? 'This appears to be a technical/IT profile. Standard technical impact vocabulary applies.'
    : 'IMPORTANT: This is a NON-IT profile. Do NOT force technical impact vocabulary (latency, uptime, CI/CD, code quality). Use the impact categories and metric questions below, adapted to the candidate\u2019s actual work.')

  if (domainProfile.matchedKeywords?.length) {
    lines.push(`Detection basis: ${domainProfile.matchedKeywords.map((m) => `"${m.keyword}"`).join(', ')}`)
  }

  lines.push('First-class impact categories for this domain:')
  for (const c of domainProfile.playbook.impactCategories) {
    lines.push(`- ${c}`)
  }

  lines.push('Metric-discovery question templates for this domain (adapt to the candidate\u2019s actual bullets — do NOT paste verbatim):')
  for (const q of domainProfile.playbook.metricDiscovery) {
    lines.push(`- ${q}`)
  }

  if (domainProfile.runnerUp) {
    lines.push(`Note: secondary signals also point to ${domainProfile.runnerUp.domainLabel} — use judgment if the resume spans both.`)
  }

  return lines.join('\n')
}

export default { classifyDomain, formatDomainContextForPrompt, DOMAIN_PLAYBOOKS, DOMAIN_CLASSIFIER_VERSION }
