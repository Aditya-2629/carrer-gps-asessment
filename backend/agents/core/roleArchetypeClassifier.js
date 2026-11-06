/**
 * Universal Role Archetype Classifier
 *
 * Classifies any candidate's target role into one of 8 Core Global Archetypes:
 * 1. DATA_ANALYTICS
 * 2. SOFTWARE_ENG
 * 3. AI_ML
 * 4. PRODUCT_MGMT
 * 5. DEVOPS_SRE
 * 6. SALES_GTM
 * 7. FINANCE_BIZ
 * 8. HEALTHCARE_GEN
 * Fallback: GENERAL_PRO
 *
 * Supplies role-accurate interview clearance mechanisms, portfolio proof artifacts,
 * metric formulas, and strictly banned cross-domain jargon.
 */

export const ROLE_ARCHETYPES = {
  DATA_ANALYTICS: {
    key: 'DATA_ANALYTICS',
    label: 'Data Analytics & Business Intelligence',
    interviewMechanism: 'Live SQL window functions, dimensional modeling, KPI logic defense, and stakeholder analytics storytelling',
    portfolioArtifact: 'Interactive Power BI / Tableau dashboard walkthrough + automated SQL data reconciliation pipeline repository',
    bannedKeywords: [
      'Java', 'Spring Boot', 'microservices', 'Kubernetes', 'EKS', 'gRPC', 'Redis latency',
      'Jenkins CI/CD', 'React frontend accessibility', 'LeetCode', 'dynamic programming',
    ],
    mandatoryTools: [
      'Advanced SQL (CTEs, Window Functions)', 'Snowflake / BigQuery', 'Power BI / Tableau (DAX)',
      'dbt / Semantic Modeling', 'Data Quality & Reconciliation',
    ],
    metricFormula: 'report turnaround reduction (e.g. 50%), daily records reconciled (e.g. 500k+), dashboard executive adoption (e.g. 300+ stakeholders), recoverable revenue identified',
    reverseOutreachHook: 'highlighting your interactive dashboard audit and automated data reconciliation repo',
    pitchFocus: 'turning raw enterprise transactional data into executive decision velocity and verified revenue optimizations',
    dayAssessmentPrep: 'Live SQL window functions & dimensional modeling case study prep',
  },

  SOFTWARE_ENG: {
    key: 'SOFTWARE_ENG',
    label: 'Software Engineering & Distributed Systems',
    interviewMechanism: 'System architecture deep dives, data structure trade-offs, concurrency, and real-time failure recovery defense',
    portfolioArtifact: 'Deployed production architecture demo + clean GitHub repository with CI/CD and comprehensive unit test coverage',
    bannedKeywords: [
      'cold calling', 'sales quota', 'nursing care plans', 'clinical charts', 'patient intake', 'bookkeeping',
    ],
    mandatoryTools: [
      'System Architecture', 'API Design (REST/gRPC)', 'Distributed Databases',
      'Cloud Infrastructure', 'CI/CD Automation',
    ],
    metricFormula: 'p99 latency drop (e.g. 42%), RPS throughput (e.g. 15k req/sec), deploy cycle reduction (e.g. 55 to 14 mins), uptime SLA (99.99%)',
    reverseOutreachHook: 'highlighting your live deployed platform demo and clean repository architecture teardown',
    pitchFocus: 'architecting resilient, high-throughput backend services and slashing infrastructure latency under scale',
    dayAssessmentPrep: 'Timed algorithm & distributed system architecture review',
  },

  AI_ML: {
    key: 'AI_ML',
    label: 'Artificial Intelligence & Machine Learning',
    interviewMechanism: 'Model trade-offs, loss function optimization, inference latency, feature store design, and data leakage defense',
    portfolioArtifact: 'Reproducible end-to-end ML pipeline repository + model benchmark evaluation notebook and live inference endpoint',
    bannedKeywords: [
      'cold calling', 'sales quota', 'nursing care plans', 'clinical charts', 'bookkeeping', 'LeetCode recursion',
    ],
    mandatoryTools: [
      'Python', 'PyTorch / TensorFlow', 'MLOps / MLflow',
      'Feature Engineering', 'Model Evaluation & Drift Monitoring',
    ],
    metricFormula: 'F1/AUC precision lift, inference latency reduction (e.g. <30ms P95), training compute efficiency (e.g. -35% GPU hours), pipeline throughput',
    reverseOutreachHook: 'highlighting your reproducible model evaluation notebook and low-latency inference benchmark',
    pitchFocus: 'translating ambiguous domain problems into robust, productionized machine learning models with verified evaluation gains',
    dayAssessmentPrep: 'ML model trade-offs & live inference latency optimization defense',
  },

  PRODUCT_MGMT: {
    key: 'PRODUCT_MGMT',
    label: 'Product Management & Growth',
    interviewMechanism: 'Product sense execution, user retention metrics, cross-functional prioritization, and trade-off defense under constraints',
    portfolioArtifact: '1-page PRD teardown + user journey funnel audit + feature prioritization matrix',
    bannedKeywords: [
      'Java', 'Spring Boot', 'microservices', 'LeetCode', 'nursing care plans', 'Kubernetes', 'gRPC',
    ],
    mandatoryTools: [
      'Product Discovery', 'User Journey Mapping', 'A/B Testing & Experimentation',
      'Roadmap Prioritization (RICE)', 'Data Analytics (SQL/Amplitude)',
    ],
    metricFormula: 'user adoption lift (e.g. +28%), churn reduction (e.g. -18%), onboarding funnel completion lift (e.g. +35%), sprint delivery velocity',
    reverseOutreachHook: 'highlighting your 1-page PRD teardown and customer retention audit',
    pitchFocus: 'aligning cross-functional engineering, design, and GTM teams to deliver high-retention product features with measurable ARR impact',
    dayAssessmentPrep: 'Product design teardown & metrics prioritization rehearsal',
  },

  DEVOPS_SRE: {
    key: 'DEVOPS_SRE',
    label: 'DevOps, SRE & Cloud Platform',
    interviewMechanism: 'Infrastructure-as-code design, incident response / post-mortem defense, SLO/SLI architecture, and zero-downtime deployment strategies',
    portfolioArtifact: 'Terraform / Kubernetes IaC repository + automated multi-environment CI/CD pipeline walkthrough',
    bannedKeywords: [
      'cold calling', 'sales quota', 'nursing care plans', 'bookkeeping', 'clinical documentation',
    ],
    mandatoryTools: [
      'Terraform / OpenTofu', 'Kubernetes / Container Orchestration',
      'CI/CD Pipelines (GitHub Actions/GitLab)', 'Observability (Prometheus/Grafana/Datadog)', 'Cloud Security & IAM',
    ],
    metricFormula: 'deployment frequency increase (e.g. 4x), MTTR reduction (e.g. 45m to 8m), cloud infrastructure spend optimization (e.g. -30%), 99.99% availability',
    reverseOutreachHook: 'highlighting your automated multi-region IaC architecture blueprint and observability dashboard',
    pitchFocus: 'building self-healing, cost-efficient cloud infrastructure platforms that empower engineering teams to deploy safely at scale',
    dayAssessmentPrep: 'Incident response drill & infrastructure-as-code failure recovery walkthrough',
  },

  SALES_GTM: {
    key: 'SALES_GTM',
    label: 'Sales, Go-To-Market & Revenue Growth',
    interviewMechanism: 'Pipeline velocity defense, enterprise deal stages, ICP qualification, objection handling, and executive closing strategy',
    portfolioArtifact: '30-60-90 territory execution plan + historical enterprise quota attainment scorecard + deal qualification framework (MEDDPICC)',
    bannedKeywords: [
      'Java', 'Spring Boot', 'Kubernetes', 'LeetCode', 'microservices', 'nursing care plans', 'gRPC',
    ],
    mandatoryTools: [
      'MEDDPICC / BANT', 'Salesforce / HubSpot CRM', 'Outreach / Salesloft',
      'Territory Planning', 'Executive Discovery & Negotiation',
    ],
    metricFormula: 'quota attainment percentage (e.g. 135% of quota), net new ARR booked (e.g. $1.8M ARR), average deal size increase (+40%), sales cycle reduction (90 to 52 days)',
    reverseOutreachHook: 'highlighting your targeted 30-60-90 territory execution plan and past enterprise win teardown',
    pitchFocus: 'driving predictable top-line revenue growth by qualifying enterprise buyers, shortening deal cycles, and consistently exceeding annual quotas',
    dayAssessmentPrep: 'Discovery call roleplay & enterprise objection handling',
  },

  FINANCE_BIZ: {
    key: 'FINANCE_BIZ',
    label: 'Finance, FP&A & Corporate Strategy',
    interviewMechanism: 'Financial modeling defense, variance analysis, unit economics evaluation, and capital allocation recommendations',
    portfolioArtifact: '3-statement financial forecast model + budget scenario variance deck + cash flow optimization audit',
    bannedKeywords: [
      'Java', 'Spring Boot', 'Kubernetes', 'LeetCode', 'microservices', 'nursing care plans',
    ],
    mandatoryTools: [
      'Advanced Financial Modeling (Excel)', 'FP&A Forecasting', 'ERP Systems (NetSuite/SAP)',
      'Variance & Scenario Analysis', 'BI Reporting (Power BI/Tableau)',
    ],
    metricFormula: 'budget variance reduction (e.g. within 2.5%), annual OPEX savings identified (e.g. $850k), financial close cycle accelerated (e.g. 10 to 4 days)',
    reverseOutreachHook: 'highlighting your 3-statement financial model and cash flow variance teardown',
    pitchFocus: 'optimizing corporate capital efficiency, delivering accurate forecasting models, and providing executive leadership with actionable financial clarity',
    dayAssessmentPrep: 'Financial modeling scenario defense & variance analysis audit',
  },

  HEALTHCARE_GEN: {
    key: 'HEALTHCARE_GEN',
    label: 'Healthcare Operations & Clinical Administration',
    interviewMechanism: 'Clinical workflow compliance, regulatory audit defense, patient care coordination, and healthcare quality metrics',
    portfolioArtifact: 'Patient intake / triage process optimization playbook + HIPAA compliance and quality audit checklist',
    bannedKeywords: [
      'Spring Boot', 'Kubernetes', 'LeetCode', 'microservices', 'gRPC', 'cold calling',
    ],
    mandatoryTools: [
      'EHR Systems (Epic/Cerner)', 'HIPAA / Regulatory Compliance', 'Healthcare Quality Metrics (HEDIS)',
      'Patient Care Coordination', 'Clinical Operations',
    ],
    metricFormula: 'patient wait time reduction (e.g. -35%), chart audit compliance (99.8%), claims denial reduction, clinical documentation turnaround speed',
    reverseOutreachHook: 'highlighting your patient care workflow playbook and regulatory compliance audit checklist',
    pitchFocus: 'streamlining healthcare operations, ensuring strict regulatory compliance, and elevating patient care delivery standards',
    dayAssessmentPrep: 'Clinical workflow compliance audit & patient care coordination review',
  },

  GENERAL_PRO: {
    key: 'GENERAL_PRO',
    label: 'Professional & Operational Strategy',
    interviewMechanism: 'Stakeholder alignment defense, process efficiency metrics, project delivery scope, and cross-functional leadership',
    portfolioArtifact: 'High-impact project delivery case study + operational efficiency audit + stakeholder communication blueprint',
    bannedKeywords: ['LeetCode', 'Spring Boot', 'microservices'],
    mandatoryTools: [
      'Project Management', 'Stakeholder Communication', 'Operational Strategy',
      'Workflow Automation', 'Performance Metrics',
    ],
    metricFormula: 'project delivery cycle acceleration, operational cost reduction (e.g. -20%), stakeholder satisfaction score, process efficiency gain',
    reverseOutreachHook: 'highlighting your comprehensive project delivery case study and operations audit',
    pitchFocus: 'leading cross-functional initiatives, eliminating organizational friction, and delivering measurable strategic outcomes',
    dayAssessmentPrep: 'Strategic project scope review & cross-functional leadership defense',
  },
}

/**
 * Classifies any candidate's target role (and optional resume skills) into a Core Global Archetype.
 *
 * @param {string} targetRole - Target role string (e.g. "Senior Data Analyst", "Product Manager")
 * @param {Array<string|object>} [resumeSkills] - Optional skills claimed on resume
 * @returns {typeof ROLE_ARCHETYPES[keyof typeof ROLE_ARCHETYPES]}
 */
export function classifyRoleArchetype(targetRole = '', resumeSkills = []) {
  const roleStr = String(targetRole || '').toLowerCase().trim()
  const skillStr = Array.isArray(resumeSkills)
    ? resumeSkills.map((s) => (typeof s === 'string' ? s : s?.name || s?.skill || '')).join(' ').toLowerCase()
    : ''
  const combined = `${roleStr} ${skillStr}`

  // 1. Data Analytics & Business Intelligence (checked before software/data science)
  if (
    /(data\s+analyst|business\s+intelligence|\bbi\b|analytics\s+engineer|bi\s+developer|power\s*bi|tableau|sql\s+analyst|reporting\s+analyst|operations\s+analyst|data\s+analytics|marketing\s+analyst|insights\s+analyst)/i.test(roleStr) ||
    (/(analyst|analytics)/i.test(roleStr) && /(sql|tableau|power\s*bi|snowflake|bigquery|dbt|excel)/i.test(combined))
  ) {
    return ROLE_ARCHETYPES.DATA_ANALYTICS
  }

  // 2. AI & Machine Learning
  if (
    /(data\s+scientist|machine\s+learning|\bml\b|mlops|ai\s+researcher|deep\s+learning|\bnlp\b|computer\s+vision|ai\s+engineer|llm\s+engineer|artificial\s+intelligence)/i.test(roleStr)
  ) {
    return ROLE_ARCHETYPES.AI_ML
  }

  // 3. Product Management
  if (
    /(product\s+manager|\btpm\b|technical\s+product|product\s+owner|group\s+product|vp\s+of\s+product|head\s+of\s+product|associate\s+product\s+manager|\bapm\b|growth\s+product)/i.test(roleStr)
  ) {
    return ROLE_ARCHETYPES.PRODUCT_MGMT
  }

  // 4. DevOps, SRE & Cloud Platform
  if (
    /(devops|site\s+reliability|\bsre\b|platform\s+engineer|cloud\s+architect|cloud\s+engineer|infrastructure\s+engineer|systems\s+administrator|sysadmin|release\s+engineer)/i.test(roleStr)
  ) {
    return ROLE_ARCHETYPES.DEVOPS_SRE
  }

  // 5. Sales & Go-To-Market
  if (
    /(account\s+executive|\bsdr\b|\bbdr\b|sales\s+development|sales\s+manager|enterprise\s+sales|partnerships|business\s+development|customer\s+success|gtm\s+lead|sales\s+director)/i.test(roleStr)
  ) {
    return ROLE_ARCHETYPES.SALES_GTM
  }

  // 6. Finance & Corporate Strategy
  if (
    /(financial\s+analyst|investment\s+bank|fp&a|corporate\s+finance|accountant|controller|finance\s+manager|equity\s+research|wealth\s+management|credit\s+analyst|cfo|treasury)/i.test(roleStr)
  ) {
    return ROLE_ARCHETYPES.FINANCE_BIZ
  }

  // 7. Healthcare Operations & Clinical
  if (
    /(nurse|clinical|healthcare|medical|physician|patient\s+care|hospital|pharmacy|pharmacist|health\s+services|care\s+coordinator|health\s+informatics)/i.test(roleStr)
  ) {
    return ROLE_ARCHETYPES.HEALTHCARE_GEN
  }

  // 8. Software Engineering & Systems
  if (
    /(software|developer|engineer|frontend|front-end|backend|back-end|full\s*stack|web\s+developer|mobile\s+developer|ios|android|systems\s+engineer|java|python\s+developer)/i.test(roleStr)
  ) {
    return ROLE_ARCHETYPES.SOFTWARE_ENG
  }

  // General fallback
  return ROLE_ARCHETYPES.GENERAL_PRO
}

/**
 * Returns role-specific tactical levers for a given archetype key or target role.
 */
export function getTacticalLevers(archetypeKeyOrRole = '') {
  const archetype = ROLE_ARCHETYPES[archetypeKeyOrRole] || classifyRoleArchetype(archetypeKeyOrRole)
  return archetype
}
