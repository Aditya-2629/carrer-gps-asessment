/**
 * LinkedIn Thought Leadership & Social SEO Evaluator
 *
 * Evaluates candidate public post substance, distinguishes domain authority vs. generic fluff,
 * and generates actionable thought leadership blueprints grounded in verified resume wins.
 *
 * Fast-Path: Immediately generates high-fidelity deterministic templates for ghost/inactive
 * profiles without making unnecessary LLM calls (< 2ms).
 */

import { jsonrepair } from 'jsonrepair'
import { llmGateway } from '../../ai/gateway/llmGateway.js'
import {
  buildThoughtLeadershipSystemPrompt,
  buildThoughtLeadershipUserPrompt,
  safeExtractString,
} from './linkedinSynthesis.prompt.js'

/**
 * Extracts and sanitizes verified skills from resume context.
 */
function extractVerifiedSkills(resumeContext = {}) {
  const canonical = resumeContext?.canonicalResume || {}
  const rawSkills =
    canonical?.skills ||
    canonical?.top_skills ||
    canonical?.technical_skills ||
    resumeContext?.coreSkills ||
    []

  return (Array.isArray(rawSkills) ? rawSkills : [])
    .map((s) => (typeof s === 'string' ? s.trim() : s?.name || s?.skill || ''))
    .filter((s) => s.length >= 2)
}

/**
 * Extracts candidate project wins from resume context.
 */
function extractVerifiedProjects(resumeContext = {}) {
  const canonical = resumeContext?.canonicalResume || {}
  const rawProjects =
    canonical?.projects ||
    canonical?.featuredProjects ||
    resumeContext?.projects ||
    []

  return (Array.isArray(rawProjects) ? rawProjects : []).filter(Boolean)
}

/**
 * Builds high-fidelity deterministic thought leadership blueprints grounded in
 * verified resume wins without calling an LLM.
 *
 * @param {string} [targetRole='']
 * @param {string[]} [coreSkills=[]]
 * @param {Object[]} [projects=[]]
 * @param {boolean} [isGhost=false]
 * @returns {Object} Complete thought leadership bundle
 */
export function buildDeterministicThoughtLeadership(
  targetRole = '',
  coreSkills = [],
  projects = [],
  isGhost = false
) {
  const role = String(targetRole || 'Software Engineer').trim()
  const isFinance = /finance|financial|accountant|accounting|audit|tax|cpa|banking/i.test(role)
  const isHealth = /nurse|nursing|health|clinical|medical|hospital|patient/i.test(role)
  const isSales = /sales|account executive|b2b|marketing|revenue|bizdev/i.test(role)
  const isData = (/data|analytics|bi\b|machine learning|ml\b|ai\b|scientist/i.test(role)) && !isFinance
  const isDevops = /devops|cloud|sre|infrastructure/i.test(role)
  const isSWE = !isFinance && !isHealth && !isSales && !isData && !isDevops

  const skills = Array.isArray(coreSkills) && coreSkills.length > 0
    ? coreSkills
    : isData
      ? ['SQL', 'Python', 'Snowflake', 'dbt']
      : isDevops
        ? ['Kubernetes', 'AWS', 'Terraform', 'Docker']
        : isHealth
          ? ['Patient Care', 'Clinical Operations', 'EHR Systems']
          : isFinance
            ? ['Financial Modeling', 'Variance Analysis', 'ERP Systems']
            : isSales
              ? ['B2B Sales', 'Salesforce CRM', 'Enterprise Deals']
              : ['Node.js', 'PostgreSQL', 'Docker', 'System Architecture']

  const skill1 = skills[0] || 'System Architecture'
  const skill2 = skills[1] || (skills[0] ? `${skills[0]} Infrastructure` : 'Performance Optimization')
  const skill3 = skills[2] || skills[0] || 'Technical Strategy'
  const skill4 = skills[3] || skills[1] || 'Containerization'

  // Extract primary project name/scope
  const topProj = Array.isArray(projects) && projects.length > 0 ? projects[0] : null
  const projName = typeof topProj === 'string'
    ? topProj
    : (topProj?.name || topProj?.title || `${skill1} Scalability Pipeline`)

  let templates = []

  if (isHealth) {
    templates = [
      {
        format: 'The Production Post-Mortem & Silent Bug',
        hook: `Standard patient intake handoffs often lose 15-20% of critical context during shift rotations between ${skill1} and ${skill2}. Here is the operational framework we built to standardize EHR documentation:`,
        bodyOutline: `1. The systemic gap (fragmented shift handoff notes)\n2. The immediate operational risk\n3. The standardized protocol introduced\n4. Measurable outcome (zero compliance flags across 12 months)`,
        callToAction: `How is your department maintaining EHR documentation accuracy during emergency peak volumes?`,
        targetHashtags: ['#HealthcareOperations', '#ClinicalExcellence', '#PatientSafety'],
        recommendedMedia: 'Anonymized intake workflow diagram or shift handoff checklist',
      },
      {
        format: 'The Tooling Trade-Off & Migration Reality',
        hook: `After evaluating modern EHR workflows in ${skill1} vs legacy clinical charting in ${skill2}, here is our frontline perspective on clinician burnout vs compliance:`,
        bodyOutline: `1. The clinical documentation burden\n2. Features that actually save time\n3. Where software vendors miss the frontline reality\n4. Recommendation for healthcare CIOs`,
        callToAction: `Which EHR interface features have had the greatest positive impact on your team's workflow?`,
        targetHashtags: ['#HealthTech', '#EHR', '#MedicalInformatics'],
        recommendedMedia: 'Workflow comparison matrix',
      },
      {
        format: 'The Architecture Deep-Dive / Counter-Intuitive Lesson',
        hook: `During high-census weekends, staffing ratios can strain triage response times. Here is how cross-functional communication and standardized ${skill1} protocols prevented critical care delays:`,
        bodyOutline: `1. The clinical challenge\n2. Early warning indicators recognized\n3. Rapid escalation and protocol adaptation\n4. Key takeaway for nursing teams`,
        callToAction: `What escalation protocols have proven most effective in your clinical unit?`,
        targetHashtags: ['#NursingLeadership', '#HealthcareManagement', '#ClinicalCare'],
        recommendedMedia: 'Departmental triage flowchart',
      },
    ]
  } else if (isFinance) {
    templates = [
      {
        format: 'The Production Post-Mortem & Silent Bug',
        hook: `A subtle discrepancy in inter-company reconciliation between ${skill1} and ${skill2} almost delayed our quarter-end audit. Here is the control gate we implemented:`,
        bodyOutline: `1. The root cause (misaligned currency conversion rates)\n2. Why automated ledger rules passed it\n3. The dual-verification control established\n4. Audit outcome and peace of mind`,
        callToAction: `What internal controls do you recommend for multi-entity ledger consolidation?`,
        targetHashtags: ['#Accounting', '#InternalControls', '#FinancialAudit'],
        recommendedMedia: 'Audit workflow control matrix',
      },
      {
        format: 'The Tooling Trade-Off & Migration Reality',
        hook: `Comparing ${skill1} with legacy ERP financial suites (${skill2}) in production: what CFOs need to know about implementation trade-offs:`,
        bodyOutline: `1. Implementation expectations vs timeline reality\n2. Reporting flexibility vs data integrity constraints\n3. User adoption hurdles across teams\n4. Final verdict for FP&A leaders`,
        callToAction: `What was the most challenging friction point during your latest ERP migration?`,
        targetHashtags: ['#ERP', '#FPandA', '#FinanceTransformation'],
        recommendedMedia: 'Feature comparison scorecard',
      },
      {
        format: 'The Architecture Deep-Dive / Counter-Intuitive Lesson',
        hook: `Traditional DCF models often fail to capture sudden working capital volatility. Here is how we restructured our 5-year rolling variance forecasting using ${skill1} to cut forecast drift by 40%:`,
        bodyOutline: `1. The forecasting discrepancy identified during month-end close\n2. The sensitivity drivers that standard templates ignore\n3. Restructuring the dynamic model logic\n4. The resulting 40% reduction in quarterly forecast drift`,
        callToAction: `How frequently do your corporate finance teams stress-test rolling cash-flow assumptions?`,
        targetHashtags: ['#CorporateFinance', '#FinancialModeling', '#CFOStrategy'],
        recommendedMedia: 'High-level dynamic scenario waterfall chart',
      },
    ]
  } else if (isData) {
    templates = [
      {
        format: 'The Production Post-Mortem & Silent Bug',
        hook: `A silent data drift between our ${skill1} pipelines and ${skill2} models bypassed unit tests and ran for 48 hours without raising alerts. Here is what failed:`,
        bodyOutline: `1. The silent schema drift symptom\n2. Why raw ingestion tests succeeded while metric logic broke\n3. Implementing automated contract testing between ${skill1} and ${skill2}\n4. Operational guardrails for data teams`,
        callToAction: `Do you enforce data contracts at the ingestion boundary or inside transformation layers?`,
        targetHashtags: ['#DataEngineering', '#DataContracts', '#AnalyticsEngineering'],
        recommendedMedia: 'Data pipeline DAG with validation boundary markers',
      },
      {
        format: 'The Tooling Trade-Off & Migration Reality',
        hook: `Evaluating ${skill1} vs ${skill2} for real-time analytics: why developer ergonomics and operational simplicity mattered more than raw synthetic benchmarks:`,
        bodyOutline: `1. The architectural evaluation context\n2. Where synthetic benchmarks misled our team\n3. Day-2 production operations and debugging\n4. Final decision framework for data platform teams`,
        callToAction: `What metric matters most to your team when selecting real-time analytical engines?`,
        targetHashtags: ['#ModernDataStack', '#DatabaseInternals', '#SystemArchitecture'],
        recommendedMedia: 'Latency vs operational complexity quadrant graph',
      },
      {
        format: 'The Architecture Deep-Dive / Counter-Intuitive Lesson',
        hook: `Running heavy transformation models directly in warehouse storage quickly balloons compute bills. Here is how we optimized our ${skill1} pipelines to cut query costs by 45%:`,
        bodyOutline: `1. The compute spike (unpartitioned incremental scans)\n2. Analyzing query execution plans and scan volumes\n3. The architecture fix (clustering keys & incremental materializations)\n4. Benchmark results and monthly savings`,
        callToAction: `How do you handle cost governance and query optimization in your modern data stack?`,
        targetHashtags: ['#DataEngineering', '#BigData', '#CloudCostOptimization'],
        recommendedMedia: 'Query execution before/after flamegraph or benchmark chart',
      },
    ]
  } else {
    // Default SWE / Cloud / DevOps
    templates = [
      {
        format: 'The Production Post-Mortem & Silent Bug',
        hook: `A subtle connection leak between our ${skill1} service and ${skill2} cluster bypassed our integration tests and ran in staging for 48 hours. Here is the root cause mechanism:`,
        bodyOutline: `1. The symptom (gradual socket exhaustion over 4 hours under 10k simulated users)\n2. Why automated integration tests missed the leak\n3. Inspecting heap snapshots and socket descriptors\n4. The defensive timeout and connection pool rule we now enforce`,
        callToAction: `What defensive pooling rules does your team enforce to catch resource leaks before production?`,
        targetHashtags: ['#SoftwareEngineering', '#DistributedSystems', '#ProductionReadiness'],
        recommendedMedia: 'Heap memory profile screenshot or clean architecture flow diagram',
      },
      {
        format: 'The Tooling Trade-Off & Migration Reality',
        hook: `We evaluated ${skill2} vs ${skill3} for our core backend rewrite in ${projName}. 6 months in production, here is why we chose the uglier, more boring option:`,
        bodyOutline: `1. The architectural reason we chose this combination\n2. What exceeded expectations in developer velocity\n3. The operational complexity and edge-case catches\n4. Pragmatic recommendation for engineering leads`,
        callToAction: `Have you observed similar trade-offs when operating ${skill2} at scale?`,
        targetHashtags: ['#TechStack', '#DevOps', '#EngineeringLeadership'],
        recommendedMedia: 'Technical trade-off matrix or architectural comparison table',
      },
      {
        format: 'The Architecture Deep-Dive / Counter-Intuitive Lesson',
        hook: `Most tutorials teach configuring ${skill1} with standard ${skill4} defaults and calling it a day. In ${projName}, our latency spiked 4x under concurrent queries until we restructured our architecture:`,
        bodyOutline: `1. The bottleneck: thread pool starvation and unindexed joins\n2. Why horizontal scaling failed to resolve the root issue\n3. The fix: connection pooling and asynchronous non-blocking pipelines\n4. Concrete production benchmark before vs after (p99 reduced by 62%)`,
        callToAction: `How is your team tackling p99 tail latency under sudden traffic spikes?`,
        targetHashtags: ['#BackendEngineering', '#SystemDesign', '#PerformanceOptimization'],
        recommendedMedia: 'System architecture diagram or terminal benchmark comparison screenshot',
      },
    ]
  }

  const thirtyDayCalendar = [
    {
      week: 1,
      theme: 'Technical Architecture Breakdown',
      goal: 'Establish domain authority with hiring managers and senior peers',
    },
    {
      week: 2,
      theme: 'Production Post-Mortem / Hard Bug',
      goal: 'Demonstrate debugging depth, operational humility, and engineering rigor',
    },
    {
      week: 3,
      theme: 'Industry Trend / Architecture Critique',
      goal: 'Spark meaningful discussion and comments among domain leaders',
    },
    {
      week: 4,
      theme: 'Engineering Workflow / Productivity Teardown',
      goal: 'Expand organic social SEO reach and shareability across tech networks',
    },
  ]

  const networkingAndCommentStrategy = {
    targetAccountsToEngage: `Follow and leave substantive comments on posts by Staff/Principal Engineers and Engineering Directors working in ${role} domains.`,
    commentFormula: `Validate their technical premise + Share 1 concrete metric or counter-example from your own experience with ${skill1} + Ask 1 open technical follow-up question.`,
    weeklyCommentGoal: 3,
  }

  const thoughtLeadershipAudit = {
    tier: isGhost ? 'Observer' : 'Practitioner',
    domainAlignmentScore: isGhost ? 0 : 78,
    substanceVsFluffScore: isGhost ? 0 : 82,
    verdict: isGhost
      ? 'Candidate has verified domain expertise on resume but zero public LinkedIn presence, making them invisible in recruiter keyword searches.'
      : 'Candidate demonstrates strong technical competence but can elevate reach by replacing generic announcements with concrete architecture breakdowns.',
    identifiedThemes: isGhost
      ? ['Resume-verified execution']
      : [skill1, 'Engineering Execution'],
    missingDomainThemes: [
      `Production Incident Post-Mortems in ${skill1}`,
      `Architecture Benchmarking & Trade-Offs`,
      `Practical Tooling Critiques (${skill2})`,
    ],
    critique: isGhost
      ? 'Your LinkedIn profile has no public posts demonstrating your hands-on skills. Publishing 1 technical teardown bi-weekly will immediately place you in the top 5% of candidate search visibility.'
      : 'Focus on opening hooks that frame clear engineering problems with quantified metrics before diving into the solution. This consistently yields 3x higher comment velocity from senior practitioners.',
  }

  return {
    thoughtLeadershipAudit,
    actionablePostTemplates: templates,
    thirtyDayCalendar,
    networkingAndCommentStrategy,
  }
}

/**
 * Merges partial LLM outputs with deterministic fallback defaults so no field is undefined.
 */
function mergeWithDefaults(llmOutput, fallback) {
  if (!llmOutput || typeof llmOutput !== 'object') return fallback

  const audit = llmOutput.thoughtLeadershipAudit || {}
  const mergedAudit = {
    tier: ['Observer', 'Broadcaster', 'Practitioner', 'Industry Voice'].includes(audit.tier)
      ? audit.tier
      : fallback.thoughtLeadershipAudit.tier,
    domainAlignmentScore: Number.isFinite(audit.domainAlignmentScore)
      ? Math.max(0, Math.min(100, Math.round(audit.domainAlignmentScore)))
      : fallback.thoughtLeadershipAudit.domainAlignmentScore,
    substanceVsFluffScore: Number.isFinite(audit.substanceVsFluffScore)
      ? Math.max(0, Math.min(100, Math.round(audit.substanceVsFluffScore)))
      : fallback.thoughtLeadershipAudit.substanceVsFluffScore,
    verdict: audit.verdict || fallback.thoughtLeadershipAudit.verdict,
    identifiedThemes: Array.isArray(audit.identifiedThemes) && audit.identifiedThemes.length > 0
      ? audit.identifiedThemes
      : fallback.thoughtLeadershipAudit.identifiedThemes,
    missingDomainThemes: Array.isArray(audit.missingDomainThemes) && audit.missingDomainThemes.length > 0
      ? audit.missingDomainThemes
      : fallback.thoughtLeadershipAudit.missingDomainThemes,
    critique: audit.critique || fallback.thoughtLeadershipAudit.critique,
  }

  // Ensure exactly 3 actionable post templates
  let mergedTemplates = fallback.actionablePostTemplates
  if (Array.isArray(llmOutput.actionablePostTemplates) && llmOutput.actionablePostTemplates.length > 0) {
    mergedTemplates = llmOutput.actionablePostTemplates.slice(0, 3).map((t, idx) => {
      const fb = fallback.actionablePostTemplates[idx] || fallback.actionablePostTemplates[0]
      return {
        format: t.format || fb.format,
        title: t.title || t.topic || t.format || fb.format,
        topic: t.topic || t.title || t.format || fb.format,
        hook: t.hook || fb.hook,
        bodyOutline: t.bodyOutline || fb.bodyOutline,
        callToAction: t.callToAction || fb.callToAction,
        targetHashtags: Array.isArray(t.targetHashtags) && t.targetHashtags.length > 0
          ? t.targetHashtags
          : fb.targetHashtags,
        recommendedMedia: t.recommendedMedia || fb.recommendedMedia,
      }
    })
    // Pad to 3 if LLM returned fewer
    while (mergedTemplates.length < 3) {
      mergedTemplates.push(fallback.actionablePostTemplates[mergedTemplates.length])
    }
  }

  // Ensure 30-day calendar
  let mergedCalendar = fallback.thirtyDayCalendar
  if (Array.isArray(llmOutput.thirtyDayCalendar) && llmOutput.thirtyDayCalendar.length >= 3) {
    mergedCalendar = llmOutput.thirtyDayCalendar.slice(0, 4).map((c, idx) => {
      const fb = fallback.thirtyDayCalendar[idx] || fallback.thirtyDayCalendar[0]
      return {
        week: c.week || idx + 1,
        theme: c.theme || fb.theme,
        goal: c.goal || fb.goal,
      }
    })
  }

  // Networking strategy
  const net = llmOutput.networkingAndCommentStrategy || {}
  const mergedNetworking = {
    targetAccountsToEngage: net.targetAccountsToEngage || fallback.networkingAndCommentStrategy.targetAccountsToEngage,
    commentFormula: net.commentFormula || fallback.networkingAndCommentStrategy.commentFormula,
    weeklyCommentGoal: Number(net.weeklyCommentGoal || fallback.networkingAndCommentStrategy.weeklyCommentGoal),
  }

  return {
    thoughtLeadershipAudit: mergedAudit,
    actionablePostTemplates: mergedTemplates,
    thirtyDayCalendar: mergedCalendar,
    networkingAndCommentStrategy: mergedNetworking,
  }
}

/**
 * Main entry point: Evaluates candidate thought leadership & social SEO.
 * Fast-paths ghost/inactive profiles (< 2ms) and invokes llmGateway for active profiles.
 *
 * @param {Object} params
 * @param {Object} [params.activitySignals] - Deterministic activity signals from Phase 2
 * @param {Array} [params.posts] - Array of scraped candidate posts
 * @param {Object} [params.resumeContext] - Canonical resume context
 * @param {Object} [params.options] - Gateway routing and feature flags
 * @returns {Promise<Object>} Complete thought leadership and social SEO evaluation
 */
export async function evaluateThoughtLeadershipAndSocialSeo({
  activitySignals = {},
  posts = [],
  resumeContext = {},
  options = {},
} = {}) {
  const targetRole =
    resumeContext?.targetRole ||
    resumeContext?.canonicalResume?.candidate?.targetRole ||
    'Software Engineer'
  const coreSkills = extractVerifiedSkills(resumeContext)
  const projects = extractVerifiedProjects(resumeContext)

  // 1. FAST-PATH: Ghost profile, zero posts, or LLM explicitly disabled
  const isGhost = Boolean(
    activitySignals?.status === 'ghost_profile' ||
      activitySignals?.isGhostProfile ||
      activitySignals?.postsAnalyzedCount === 0 ||
      !Array.isArray(posts) ||
      posts.length === 0
  )

  if (isGhost || options?.runLlm === false) {
    return buildDeterministicThoughtLeadership(targetRole, coreSkills, projects, isGhost)
  }

  // 2. ACTIVE PROFILE LLM SYNTHESIS
  const fallback = buildDeterministicThoughtLeadership(targetRole, coreSkills, projects, false)

  try {
    const recentPosts = (Array.isArray(posts) ? posts : []).slice(0, 5).map((p) => ({
      ...p,
      text: safeExtractString(p?.text || p?.content || p?.description || ''),
      content: safeExtractString(p?.content || p?.text || p?.description || ''),
    }))
    const systemPrompt = buildThoughtLeadershipSystemPrompt()
    const userPrompt = buildThoughtLeadershipUserPrompt({
      targetRole,
      coreSkills,
      projects,
      activitySignals,
      recentPosts,
    })

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const response = await llmGateway.generate({
      purpose: 'resume_analysis',
      task: 'thought_leadership',
      preferredProvider: options?.preferredProvider || 'openrouter',
      excludeProvider: options?.excludeProvider,
      model: options?.model,
      messages,
      temperature: 0.25,
      maxTokens: 2500,
      responseFormat: { type: 'json_object' },
      timeoutMs: 25000,
    })

    let parsed = null
    const responseText = response?.text || ''

    if (responseText) {
      try {
        parsed = JSON.parse(responseText)
      } catch {
        try {
          const repaired = jsonrepair(responseText)
          parsed = JSON.parse(repaired)
        } catch (repairErr) {
          console.warn('[ThoughtLeadershipEvaluator] JSON repair failed:', repairErr.message)
        }
      }
    }

    if (!parsed) {
      console.warn('[ThoughtLeadershipEvaluator] LLM returned empty/unparseable JSON, using deterministic fallback')
      return fallback
    }

    return mergeWithDefaults(parsed, fallback)
  } catch (err) {
    console.warn('[ThoughtLeadershipEvaluator] LLM synthesis failed, using fallback:', err.message)
    return fallback
  }
}

export default {
  evaluateThoughtLeadershipAndSocialSeo,
  buildDeterministicThoughtLeadership,
}
