/**
 * Unit Test Suite for Resume Agent V2.3 Deterministic Signal Engine
 *
 * Implements Section 25 requirements (15 test scenarios):
 * 1. skill extraction
 * 2. skill normalization
 * 3. skill evidence matching
 * 4. missing skill evidence (skillEvidenceGap)
 * 5. metric extraction
 * 6. percentage extraction
 * 7. multiplier extraction
 * 8. duplicate detection
 * 9. timeline overlap
 * 10. section counts
 * 11. parser warning
 * 12. claim extraction
 * 13. deterministic repeatability
 * 14. empty resume
 * 15. malformed canonical JSON
 */

import { generateResumeSignals, formatCompactSignalSummary } from '../agents/resume/signals/signalEngine.js'
import { extractListedSkills, normalizeSkill, isSkillMentionedInText, analyzeSkillEvidence } from '../agents/resume/signals/skillEvidence.js'
import { extractResumeMetrics, extractMetricsFromText } from '../agents/resume/signals/metricExtractor.js'
import { detectDuplicateContent, computeTextSimilarity } from '../agents/resume/signals/duplicateDetector.js'
import { analyzeTimeline, parseDateRange } from '../agents/resume/signals/timelineAnalyzer.js'
import { analyzeSections } from '../agents/resume/signals/sectionAnalyzer.js'
import { detectParserQuality } from '../agents/resume/signals/parserQuality.js'
import { analyzeClaimEvidence } from '../agents/resume/signals/claimEvidence.js'

function assert(condition, message) {
  if (!condition) {
    console.error(`FAILED: ${message}`)
    throw new Error(`Test assertion failed: ${message}`)
  }
  console.log(`PASS: ${message}`)
}

export async function runSignalEngineTests() {
  console.log('================================================================')
  console.log('RESUME SIGNAL ENGINE V2.3 UNIT TEST SUITE (15 SCENARIOS)')
  console.log('================================================================\n')

  // Sample Canonical Resume Fixture
  const sampleResume = {
    candidate: {
      name: 'Swapnil Jadhav',
      targetRole: 'Senior Full Stack & AI Systems Engineer',
      contact: {
        email: 'swapnil.jadhav@example.com',
        phone: '(555) 345-6789',
        location: 'San Jose, CA',
      },
      summary: 'Senior Full Stack & AI Systems Engineer with 5+ years of experience architecting scalable distributed backends.',
    },
    summary: {
      text: 'Senior Full Stack & AI Systems Engineer with 5+ years of experience architecting scalable distributed backends, LLM-powered applications, and high-concurrency cloud systems.',
    },
    skills: [
      { id: 'skill_001', name: 'Python' },
      { id: 'skill_002', name: 'TypeScript' },
      { id: 'skill_003', name: 'Go' },
      { id: 'skill_004', name: 'Kubernetes' },
      { id: 'skill_005', name: 'Docker' },
      { id: 'skill_006', name: 'PostgreSQL' },
      { id: 'skill_007', name: 'Redis' },
      { id: 'skill_008', name: 'Next.js' },
      { id: 'skill_009', name: 'FastMCP' },
      { id: 'skill_010', name: 'ChromaDB' },
    ],
    experience: [
      {
        id: 'exp_001',
        company: 'Apex Intelligence Labs',
        role: 'Senior AI & Full Stack Engineer',
        dates: 'March 2023 – Present',
        bullets: [
          {
            id: 'exp_001_b01',
            text: 'Architected RAG agent pipeline integrating 9 tools using FastMCP protocol, resulting in 35% faster retrieval and 38% reduction in manual support queries.',
          },
          {
            id: 'exp_001_b02',
            text: 'Conducted 170-query evaluation benchmark across multi-modal retrieval models, elevating answer accuracy from 72% to 94%.',
          },
          {
            id: 'exp_001_b03',
            text: 'Scaled real-time chat infrastructure to handle 3x concurrent capacity with page load <1 second for 5,000+ users and 200+ faculty members.',
          },
          {
            id: 'exp_001_b04',
            text: 'Automated continuous deployment pipeline delivering 20+ production releases with zero-downtime over 12 months.',
          },
        ],
      },
      {
        id: 'exp_002',
        company: 'CoreLogic Systems',
        role: 'Full Stack Software Engineer',
        dates: 'June 2021 – February 2023',
        bullets: [
          {
            id: 'exp_002_b01',
            text: 'Developed automated data reconciliation service in Python and PostgreSQL, eliminating 50+ hours reconciliation/month and cutting 25+ hours manual work/week reduced across finance operations.',
          },
          {
            id: 'exp_002_b02',
            text: 'Re-indexed relational database tables and introduced Redis read-aside caching, cutting p95 API query latency from 850ms to 120ms.',
          },
        ],
      },
    ],
    projects: [
      {
        id: 'proj_001',
        title: 'FastMCP Multi-Tool Agent Platform | Python, FastMCP, Docker',
        bullets: [
          {
            id: 'proj_001_b01',
            text: 'Implemented modular MCP server exposing 9 tools with streaming JSON-RPC responses for local LLM orchestration.',
          },
          {
            id: 'proj_001_b02',
            text: 'Benchmarked tool execution latency achieving sub-50ms roundtrip dispatch across 100 simulated concurrent sessions.',
          },
        ],
      },
    ],
    education: [
      {
        id: 'edu_001',
        degree: 'B.S. in Computer Science',
        institution: 'San Jose State University',
        dates: '2017 – 2021',
      },
    ],
    certifications: [],
  }

  // --- Scenario 1: Skill extraction ---
  console.log('--- Test 1: Skill extraction ---')
  const extractedSkills = extractListedSkills(sampleResume)
  assert(extractedSkills.length === 10, `Extracted ${extractedSkills.length} skills (expected 10)`)
  assert(extractedSkills.some((s) => s.originalName === 'Python'), 'Extracted Python')
  assert(extractedSkills.some((s) => s.originalName === 'Kubernetes'), 'Extracted Kubernetes')

  // --- Scenario 2: Skill normalization ---
  console.log('\n--- Test 2: Skill normalization ---')
  assert(normalizeSkill('Amazon Web Services') === 'aws', 'Amazon Web Services -> aws')
  assert(normalizeSkill('Amazon ECS') === 'ecs', 'Amazon ECS -> ecs')
  assert(normalizeSkill('Node.js') === 'nodejs', 'Node.js -> nodejs')
  assert(normalizeSkill('ReactJS') === 'react', 'ReactJS -> react')
  assert(normalizeSkill('PostgreSQL') === 'postgres', 'PostgreSQL -> postgres')
  assert(normalizeSkill('Python 3.11') === 'python', 'Python 3.11 -> python')

  // --- Scenario 3: Skill evidence matching ---
  console.log('\n--- Test 3: Skill evidence matching ---')
  const skillsAnalysis = analyzeSkillEvidence(sampleResume)
  const pythonSkill = skillsAnalysis.skills.find((s) => s.skill === 'Python')
  assert(pythonSkill && pythonSkill.evidenceFound === true, 'Python has evidenceFound: true')
  assert(pythonSkill.evidenceCount >= 1, `Python evidenceCount is ${pythonSkill.evidenceCount}`)
  assert(pythonSkill.status === 'evidenceFound', 'Python status is evidenceFound')

  const redisSkill = skillsAnalysis.skills.find((s) => s.skill === 'Redis')
  assert(redisSkill && redisSkill.evidenceFound === true, 'Redis has evidenceFound: true (in exp_002_b02)')

  // --- Scenario 4: Missing skill evidence (skillEvidenceGap) ---
  console.log('\n--- Test 4: Missing skill evidence (skillEvidenceGap) ---')
  const goSkill = skillsAnalysis.skills.find((s) => s.skill === 'Go')
  assert(goSkill && goSkill.evidenceFound === false, 'Go has evidenceFound: false')
  assert(goSkill.status === 'skillEvidenceGap', 'Go status is skillEvidenceGap')
  assert(!JSON.stringify(skillsAnalysis).includes('fakeSkill'), 'Does not use fakeSkill terminology')
  assert(!JSON.stringify(skillsAnalysis).includes('invalidSkill'), 'Does not use invalidSkill terminology')

  const k8sSkill = skillsAnalysis.skills.find((s) => s.skill === 'Kubernetes')
  assert(k8sSkill && k8sSkill.evidenceFound === false, 'Kubernetes has evidenceFound: false')
  assert(k8sSkill.status === 'skillEvidenceGap', 'Kubernetes status is skillEvidenceGap')

  // --- Scenario 5: Metric extraction ---
  console.log('\n--- Test 5: Metric extraction ---')
  const metricResults = extractResumeMetrics(sampleResume)
  assert(metricResults.metrics.length > 5, `Extracted ${metricResults.metrics.length} metrics`)
  assert(metricResults.summary.totalMetrics === metricResults.metrics.length, 'Summary matches total metrics')

  // --- Scenario 6: Percentage extraction ---
  console.log('\n--- Test 6: Percentage extraction ---')
  const percentages = metricResults.metrics.filter((m) => m.type === 'percentage')
  assert(percentages.some((p) => p.value === '38%'), 'Extracted 38%')
  assert(percentages.some((p) => p.value === '35%'), 'Extracted 35%')
  assert(percentages.some((p) => p.value === '94%'), 'Extracted 94%')
  assert(percentages.some((p) => p.value === '72%'), 'Extracted 72%')

  // --- Scenario 7: Multiplier extraction ---
  console.log('\n--- Test 7: Multiplier extraction ---')
  const multipliers = metricResults.metrics.filter((m) => m.type === 'multiplier')
  assert(multipliers.some((m) => m.value.toLowerCase() === '3x'), 'Extracted 3x multiplier')

  // --- Scenario 8: Duplicate detection ---
  console.log('\n--- Test 8: Duplicate detection ---')
  const duplicateResume = {
    ...sampleResume,
    experience: [
      {
        id: 'exp_001',
        bullets: [
          { id: 'exp_001_b01', text: 'Architected high-throughput telemetry ingestion engine in Go and Kafka scaling throughput from 5,000 to 45,000 events/second.' },
          { id: 'exp_001_b02', text: 'Architected high-throughput telemetry ingestion engine in Go and Kafka scaling throughput from 5,000 to 45,000 events/sec.' },
        ],
      },
    ],
  }
  const duplicateSignals = detectDuplicateContent(duplicateResume, { threshold: 0.70 })
  assert(duplicateSignals.duplicates.length === 1, 'Detected high-similarity duplicate pair')
  assert(duplicateSignals.duplicates[0].similarity > 0.8, 'Similarity score is > 0.8')

  // --- Scenario 9: Timeline overlap ---
  console.log('\n--- Test 9: Timeline overlap ---')
  const overlappingResume = {
    experience: [
      {
        id: 'exp_001',
        company: 'Alpha Corp',
        role: 'Tech Lead',
        dates: 'January 2021 – December 2022',
      },
      {
        id: 'exp_002',
        company: 'Beta LLC',
        role: 'Consultant',
        dates: 'June 2021 – March 2022',
      },
    ],
    education: [],
  }
  const timelineResult = analyzeTimeline(overlappingResume)
  assert(timelineResult.overlaps.length === 1, 'Detected overlapping experience dates')
  assert(timelineResult.overlaps[0].itemA === 'exp_001' && timelineResult.overlaps[0].itemB === 'exp_002', 'Identified overlapping items')

  // --- Scenario 10: Section counts ---
  console.log('\n--- Test 10: Section counts ---')
  const sectionResult = analyzeSections(sampleResume)
  assert(sectionResult.summary.exists === true, 'Summary exists')
  assert(sectionResult.experience.items === 2, 'Experience items: 2')
  assert(sectionResult.experience.bullets === 6, 'Experience bullets: 6')
  assert(sectionResult.projects.items === 1, 'Project items: 1')
  assert(sectionResult.projects.bullets === 2, 'Project bullets: 2')
  assert(sectionResult.contact.hasEmail === true, 'Contact email present')
  assert(sectionResult.contact.hasPhone === true, 'Contact phone present')

  // --- Scenario 11: Parser warning ---
  console.log('\n--- Test 11: Parser warning ---')
  const mergedHeaderResume = {
    ...sampleResume,
    summary: {
      text: 'Swapnil Jadhav swapnil.jadhav@example.com (555) 345-6789 Senior Full Stack & AI Systems Engineer with 5+ years of experience.',
    },
  }
  const parserWarnings = detectParserQuality(mergedHeaderResume)
  assert(parserWarnings.warnings.length > 0, 'Flagged parser warning')
  assert(
    parserWarnings.warnings.some((w) => w.type === 'possible_header_summary_merge'),
    'Flagged possible_header_summary_merge'
  )
  assert(
    parserWarnings.warnings[0].severity === 'warning',
    'Warning severity is warning'
  )

  // --- Scenario 12: Claim extraction ---
  console.log('\n--- Test 12: Claim extraction ---')
  const claimResult = analyzeClaimEvidence(sampleResume)
  assert(claimResult.claims.length > 0, `Extracted ${claimResult.claims.length} claims`)
  assert(claimResult.claims.some((c) => c.claimType === 'performance'), 'Found performance claim')
  assert(claimResult.claims.some((c) => c.claimType === 'scale'), 'Found scale claim')
  assert(claimResult.claims.some((c) => c.claimType === 'outcome'), 'Found outcome claim')

  // --- Scenario 13: Deterministic repeatability ---
  console.log('\n--- Test 13: Deterministic repeatability ---')
  const runA = generateResumeSignals(sampleResume)
  const runB = generateResumeSignals(sampleResume)
  const jsonA = JSON.stringify(runA)
  const jsonB = JSON.stringify(runB)
  assert(jsonA === jsonB, 'Two consecutive signal generations are 100% byte-identical')

  // Test compact summary formatting
  const summaryText = formatCompactSignalSummary(runA)
  assert(summaryText.includes('## DETERMINISTIC RESUME SIGNALS'), 'Formatted summary contains header')
  assert(summaryText.includes('Skill evidence gaps:'), 'Formatted summary contains Skill evidence gaps')
  assert(summaryText.includes('Strong quantified evidence:'), 'Formatted summary contains Strong quantified evidence')

  // --- Scenario 14: Empty resume ---
  console.log('\n--- Test 14: Empty resume ---')
  const emptySignals = generateResumeSignals({})
  assert(emptySignals.version === '1.0', 'Empty resume returns version 1.0')
  assert(emptySignals.skills.skills.length === 0, 'Empty resume returns 0 skills')
  assert(emptySignals.metrics.metrics.length === 0, 'Empty resume returns 0 metrics')
  assert(emptySignals.duplicates.duplicates.length === 0, 'Empty resume returns 0 duplicates')
  assert(emptySignals.timeline.overlaps.length === 0, 'Empty resume returns 0 overlaps')

  // --- Scenario 15: Malformed canonical JSON ---
  console.log('\n--- Test 15: Malformed canonical JSON ---')
  const malformedA = generateResumeSignals(null)
  assert(malformedA.version === '1.0', 'Null input handled gracefully')

  const malformedB = generateResumeSignals({ skills: 'invalid-non-array', experience: 'corrupted' })
  assert(malformedB.version === '1.0', 'Invalid type input handled gracefully without throwing')
  assert(Array.isArray(malformedB.skills.skills), 'Skills is an array even with malformed input')

  console.log('\n================================================================')
  console.log('ALL 15 SIGNAL ENGINE V2.3 UNIT TESTS PASSED!')
  console.log('================================================================\n')
}

// Auto-run
runSignalEngineTests().catch((err) => {
  console.error(err)
  process.exit(1)
})

