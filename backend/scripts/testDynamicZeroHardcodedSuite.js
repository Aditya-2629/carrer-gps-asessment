/**
 * testDynamicZeroHardcodedSuite.js
 * Multi-Domain Verification Test Suite for Zero-Hardcoded Competency Clustering & Unified Report Engine
 * Domains Tested:
 * 1. Clinical Nurse Lead (Healthcare / EMR)
 * 2. Product Manager (SaaS / Analytics)
 * 3. Golang Backend Engineer (Distributed Systems / Databases)
 * 4. Supply Chain & Logistics Lead (WMS / ERP)
 * 5. Data Analyst (BI / Data Warehousing)
 */

import assert from 'assert'
import dynamicCompetencyClusterizer from '../agents/resume/market/dynamicCompetencyClusterizer.js'
import reportGen from '../services/reportGeneration.js'

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  TEST: Dynamic Zero-Hardcoding Cross-Domain Verification Suite')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const testDomains = [
  {
    domain: 'Healthcare / Nursing',
    targetRole: 'Clinical Nurse Lead',
    candidateSkills: ['Epic', 'BLS', 'Patient Triage', 'HIPAA'],
    marketJds: [
      'Seeking a Registered Nurse with 5+ years experience. Must have hands-on experience with Epic or Cerner EMR systems.',
      'Active certification in BLS or ACLS required. Proven ability to handle acute care and patient flow triage.'
    ],
    rawSkills: ['Epic', 'Cerner', 'BLS', 'ACLS', 'Patient Triage', 'HIPAA'],
    expectedInterchangeable: [
      ['epic', 'cerner'],
      ['bls', 'acls']
    ]
  },
  {
    domain: 'Product Management',
    targetRole: 'Senior Product Manager',
    candidateSkills: ['Linear', 'Amplitude', 'Roadmapping', 'Agile'],
    marketJds: [
      'Must have proficiency in Jira or Linear for backlog management and sprint tracking.',
      'Strong product analytics track record using either Mixpanel or Amplitude to measure feature adoption.'
    ],
    rawSkills: ['Jira', 'Linear', 'Mixpanel', 'Amplitude', 'Roadmapping', 'Agile'],
    expectedInterchangeable: [
      ['jira', 'linear'],
      ['mixpanel', 'amplitude']
    ]
  },
  {
    domain: 'Software Engineering',
    targetRole: 'Golang Backend Engineer',
    candidateSkills: ['Go', 'Postgres', 'RabbitMQ', 'Docker'],
    marketJds: [
      'Build low-latency microservices in Go. Deep operational knowledge of Postgres or CockroachDB required.',
      'Experience with high-throughput event streaming via Kafka or RabbitMQ, alongside Docker / K8s.'
    ],
    rawSkills: ['Go', 'Postgres', 'CockroachDB', 'Kafka', 'RabbitMQ', 'Docker', 'K8s'],
    expectedInterchangeable: [
      ['postgres', 'cockroachdb'],
      ['kafka', 'rabbitmq']
    ]
  },
  {
    domain: 'Supply Chain & Logistics',
    targetRole: 'Supply Chain Operations Lead',
    candidateSkills: ['SAP', 'Manhattan Associates', 'Inventory Optimization', 'Six Sigma'],
    marketJds: [
      'Oversee regional distribution network. Hands-on experience with SAP or Oracle SCM enterprise suites.',
      'Proficiency in modern WMS solutions such as Manhattan Associates or Blue Yonder to streamline freight flow.'
    ],
    rawSkills: ['SAP', 'Oracle SCM', 'Manhattan Associates', 'Blue Yonder', 'Inventory Optimization', 'Six Sigma'],
    expectedInterchangeable: [
      ['sap', 'oracle scm'],
      ['manhattan associates', 'blue yonder']
    ]
  },
  {
    domain: 'Data Analytics',
    targetRole: 'Lead Data Analyst',
    candidateSkills: ['Power BI', 'BigQuery', 'SQL', 'Statistical Modeling'],
    marketJds: [
      'Design executive business dashboards using Tableau or Power BI.',
      'Query petabyte-scale data lakes with Snowflake or BigQuery; advanced SQL required.'
    ],
    rawSkills: ['Tableau', 'Power BI', 'Snowflake', 'BigQuery', 'SQL'],
    expectedInterchangeable: [
      ['tableau', 'power bi'],
      ['snowflake', 'bigquery']
    ]
  }
]

// ----------------------------------------------------
// Section 1: Dynamic Clustering & Equivalence Test Across All 5 Domains
// ----------------------------------------------------
console.log('--- Section 1: In-Memory Statistical Clustering & Equivalence Across 5 Domains ---')

// V8 JIT Warm-up
dynamicCompetencyClusterizer.processDynamicClustering({
  jdTexts: ['SQL or Python for data processing.'],
  rawSkills: ['SQL', 'Python'],
  candidateSkills: ['SQL'],
})

for (const scenario of testDomains) {
  console.log(`Testing Domain: ${scenario.domain} (${scenario.targetRole})...`)

  const t0 = Date.now()
  const result = dynamicCompetencyClusterizer.processDynamicClustering({
    jdTexts: scenario.marketJds,
    rawSkills: scenario.rawSkills,
    candidateSkills: scenario.candidateSkills
  })
  const duration = Date.now() - t0

  assert.ok(duration < 20, `Clustering must run in sub-20ms (Actual: ${duration}ms)`)
  assert.ok(result.clusters.length > 0, `Clusters must be dynamically formed for ${scenario.targetRole}`)

  const clusterBreakdown = result.evaluation.clusterBreakdown

  // Check expected interchangeable clusters exist
  for (const expectedPair of scenario.expectedInterchangeable) {
    const foundCluster = clusterBreakdown.find((c) => {
      const groupLower = c.interchangeableGroup.map((t) => t.toLowerCase())
      return expectedPair.every((item) => groupLower.includes(item.toLowerCase()))
    })

    assert.ok(
      foundCluster,
      `Expected interchangeable group [${expectedPair.join(', ')}] to be formed in ${scenario.domain}`
    )
    assert.strictEqual(
      foundCluster.satisfied,
      true,
      `Equivalence principle must grant 100% credit for ${foundCluster.clusterName}`
    )
    assert.strictEqual(
      foundCluster.creditScore,
      1.0,
      `Credit score must be 1.0 when candidate has equivalent skill`
    )
  }

  assert.ok(
    result.evaluation.coveragePercentage >= 50,
    `Candidate should achieve healthy coverage via equivalence (Got: ${result.evaluation.coveragePercentage}%)`
  )

  console.log(`  ✓ Formed ${result.clusters.length} dynamic clusters in ${duration}ms. Coverage: ${result.evaluation.coveragePercentage}%`)
}
console.log('✔ Section 1 Passed: All 5 domains dynamically clustered with zero hardcoding.\n')

// ----------------------------------------------------
// Section 2: Deterministic Triage Context Ingestion
// ----------------------------------------------------
console.log('--- Section 2: Deterministic Triage Runtime Ingestion ---')

const triageNurseData = {
  targetRole: 'Clinical Nurse Lead',
  candidateSkills: ['Epic', 'BLS', 'Patient Triage'],
  resumeFacts: {
    experienceYears: 7,
    experience: [
      {
        bullets: [
          'Managed 30-bed triage unit ensuring 100% compliance with HIPAA and emergency triage protocols.',
          'Reduced ER patient wait times by 22% by standardizing Epic EHR charting workflows.'
        ]
      }
    ]
  },
  marketJds: [
    'Requires proficiency in Epic or Cerner EMR.',
    'Certification in BLS or ACLS mandatory.'
  ],
  scrapedSkills: ['Epic', 'Cerner', 'BLS', 'ACLS']
}

const triageStart = Date.now()
const triageResult = reportGen.performDeterministicTriage(triageNurseData)
const triageDuration = Date.now() - triageStart

assert.strictEqual(triageResult.targetRole, 'Clinical Nurse Lead')
assert.strictEqual(triageResult.experienceYears, 7)
assert.strictEqual(triageResult.quantificationRatio, 100, 'Both bullets contain numbers (30-bed, 100%, 22%)')
assert.strictEqual(triageResult.totalBulletPoints, 2)
assert.strictEqual(triageResult.clustering.coveragePercentage, 100, 'Epic and BLS satisfy both clusters')
assert.ok(triageDuration < 25, `Triage must execute sub-25ms (Actual: ${triageDuration}ms)`)

console.log(`  ✓ Triage executed in ${triageDuration}ms for Clinical Nurse Lead.`)
console.log(`  ✓ Metric Quantification Ratio: ${triageResult.quantificationRatio}%`)
console.log(`  ✓ Market Competency Coverage: ${triageResult.clustering.coveragePercentage}%`)
console.log('✔ Section 2 Passed: Deterministic triage accurately parsed candidate context.\n')

// ----------------------------------------------------
// Section 3: End-to-End Unified Report Generation
// ----------------------------------------------------
console.log('--- Section 3: End-to-End Unified Report Generation Execution ---')

const e2eData = {
  targetRole: 'Supply Chain Operations Lead',
  candidateSkills: ['SAP', 'Manhattan Associates', 'Inventory Optimization'],
  resumeFacts: {
    experienceYears: 8,
    experience: [
      {
        bullets: [
          'Directed multi-site inventory across 4 regional warehouses representing $45M in stock.',
          'Streamlined freight distribution workflows saving $1.2M annually in demurrage fees.'
        ]
      }
    ]
  },
  marketJds: [
    'Enterprise ERP proficiency in SAP or Oracle SCM.',
    'WMS expertise in Manhattan Associates or Blue Yonder.'
  ],
  scrapedSkills: ['SAP', 'Oracle SCM', 'Manhattan Associates', 'Blue Yonder', 'Inventory Optimization']
}

console.log('Invoking generateReportBundle for Supply Chain Operations Lead...')
console.time('ReportGenerationTotal')

reportGen.generateReportBundle(e2eData).then((res) => {
  console.timeEnd('ReportGenerationTotal')
  assert.strictEqual(res.success, true, 'Report bundle generation must return success: true')
  assert.ok(res.data, 'res.data must be present')
  assert.ok(res.data.career_health_score, 'career_health_score must be present')
  assert.ok(res.data.primary_bottleneck, 'primary_bottleneck must be present')
  assert.ok(Array.isArray(res.data.competency_clusters_audit), 'competency_clusters_audit must be an array')
  assert.ok(Array.isArray(res.data.bullet_rewrites), 'bullet_rewrites must be an array')
  assert.ok(Array.isArray(res.data.roadmap), 'roadmap must be an array')

  // Check latency constraint
  assert.ok(res.telemetry.latencyMs < 10000, `Latency must be < 10000ms (Got ${res.telemetry.latencyMs}ms)`)

  console.log(`  ✓ Report completed in ${res.telemetry.latencyMs}ms`)
  console.log(`  ✓ Clusters Evaluated: ${res.data.competency_clusters_audit.length}`)
  console.log(`  ✓ First Cluster: ${res.data.competency_clusters_audit[0].clusterName || res.data.competency_clusters_audit[0].cluster_title}`)
  console.log(`  ✓ Primary Bottleneck Severity: ${res.data.primary_bottleneck.severity}`)
  console.log('\n================================================================')
  console.log('🎉 ALL DYNAMIC ZERO-HARDCODED CROSS-DOMAIN TESTS PASSED!')
  console.log('================================================================')
  setTimeout(() => process.exit(0), 200)
}).catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
