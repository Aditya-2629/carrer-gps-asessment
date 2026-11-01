/**
 * LinkedIn Agent Non-String Crash Defense Verification Suite
 * Verifies that nested objects/arrays from Apify scraper never trigger ".trim is not a function"
 */

import assert from 'assert'
import { buildCompactCandidateContext } from '../agents/linkedin/linkedinSynthesis.prompt.js'
import { analyzeCrossAgentDiscrepancies } from '../agents/linkedin/linkedinCrossAnalyzer.js'
import { buildDeterministicOptimizations, runLinkedInSynthesis } from '../agents/linkedin/linkedinSynthesis.js'
import { normalizeLinkedInProfile } from '../agents/linkedin/linkedinNormalizer.js'
import { evaluateLinkedIn, analyzeLinkedInProfile } from '../agents/linkedin/linkedinAgent.js'
import { extractLinkedInSignals } from '../agents/linkedin/linkedinSignalEngine.js'

async function runTests() {
  console.log('================================================================')
  console.log('RUNNING LINKEDIN NON-STRING CRASH DEFENSE VERIFICATION')
  console.log('================================================================\n')

  // Malformed Apify payload with object/array descriptions, about, headlines, fieldOfStudy
  const malformedApifyProfile = {
    fullName: 'Haswanth Valluru',
    headline: { text: 'Data Analyst | Python · SQL' }, // Object headline
    about: { text: 'Experienced Data Analyst building pipelines and dashboards.' }, // Object about
    skills: [
      { name: 'Python' },
      { title: 'SQL' },
      'PostgreSQL',
    ],
    experiences: [
      {
        title: 'Data Analyst',
        company: { name: 'PwC USA / Shure Incorporated' },
        duration: 'Jul 2024 – Present',
        description: { text: 'Engineered ETL telemetry pipelines with Python and PostgreSQL.' }, // Object description
      },
      {
        title: 'Data Engineer',
        company: 'Recibo Technologies',
        duration: 'Jun 2021 – Jul 2023',
        description: ['Built Spark data pipelines.', 'Optimized 50+ enterprise schemas.'], // Array description
      },
      {
        title: 'Analyst Intern',
        company: null,
        duration: null,
        description: null, // Null description
      },
    ],
    education: [
      {
        school: 'University of Illinois Chicago',
        degree: 'Master of Science',
        fieldOfStudy: { name: 'Business Analytics' }, // Object fieldOfStudy
        dates: '2023 – 2025',
      },
    ],
  }

  const sampleResumeContext = {
    canonicalResume: {
      candidate: { name: 'Haswanth Valluru', targetRole: 'Senior Data Analyst' },
      experience: [
        {
          role: 'Data Analyst',
          company: 'PwC USA / Shure Incorporated USA',
          dates: 'Jul 2024 – Present',
          bullets: [
            { text: 'Architected automated ETL pipelines processing 10M+ daily records, reducing latency by 42%.' },
          ],
        },
      ],
      projects: [
        {
          title: 'Telemetry Platform',
          techStack: 'Python, Kafka, PostgreSQL',
          description: { text: 'Real-time telemetry event streaming.' }, // Object description in project
          bullets: [{ text: 'Handled 50k events/sec.' }],
        },
      ],
      skills: ['Python', 'SQL', 'PostgreSQL', 'Kafka'],
      certifications: ['Google Data Analytics'],
    },
    targetRole: 'Senior Data Analyst',
  }

  // ── TEST 1: normalizeLinkedInProfile with nested objects/arrays ─
  console.log('[Test 1] normalizeLinkedInProfile:')
  const normalized = normalizeLinkedInProfile(malformedApifyProfile)
  assert.strictEqual(typeof normalized.experiences[0].description, 'string')
  assert(normalized.experiences[0].description.includes('Engineered ETL'))
  assert.strictEqual(typeof normalized.experiences[1].description, 'string')
  assert(normalized.experiences[1].description.includes('Built Spark'))
  console.log('  ✓ 1.1 Object and Array descriptions normalized to clean strings')

  // ── TEST 2: buildCompactCandidateContext with nested objects ───
  console.log('\n[Test 2] buildCompactCandidateContext:')
  const context = buildCompactCandidateContext({
    profile: malformedApifyProfile,
    resumeContext: sampleResumeContext,
    discrepancies: [{ title: 'Sample Discrepancy', diagnosis: 'Detail' }],
    missingSkills: ['Kafka', 'Docker'],
  })
  assert(typeof context === 'string', 'Context must be a string')
  assert(context.includes('Haswanth Valluru'))
  assert(context.includes('Description present'))
  console.log('  ✓ 2.1 Context generated successfully without throwing .trim errors')

  // ── TEST 3: analyzeCrossAgentDiscrepancies with non-strings ────
  console.log('\n[Test 3] analyzeCrossAgentDiscrepancies:')
  const crossResult = analyzeCrossAgentDiscrepancies(malformedApifyProfile, sampleResumeContext, null)
  assert(crossResult && typeof crossResult === 'object')
  assert(Array.isArray(crossResult.discrepancies))
  console.log('  ✓ 3.1 Cross-analyzer evaluated successfully with zero TypeError exceptions')

  // ── TEST 4: buildDeterministicOptimizations with non-strings ───
  console.log('\n[Test 4] buildDeterministicOptimizations:')
  const deterministicOpts = buildDeterministicOptimizations(
    malformedApifyProfile,
    sampleResumeContext,
    ['Kafka']
  )
  assert(deterministicOpts && Array.isArray(deterministicOpts.headlines))
  assert(typeof deterministicOpts.aboutRewrite.fullText === 'string')
  console.log('  ✓ 4.1 Deterministic optimizations generated smoothly with zero crashes')

  // ── TEST 5: runLinkedInSynthesis (Prompt Building Try/Catch) ───
  console.log('\n[Test 5] runLinkedInSynthesis:')
  const synthResult = await runLinkedInSynthesis(
    malformedApifyProfile,
    sampleResumeContext,
    ['Kafka'],
    [],
    null,
    { bypassAI: true }
  )
  assert(synthResult && synthResult.headlines.length >= 2)
  console.log('  ✓ 5.1 runLinkedInSynthesis safely handled and completed with valid output')

  // ── TEST 6: Object TargetRole Defense (Swapnil Case) ──────────
  console.log('\n[Test 6] Object TargetRole Defense:')
  const objectRoleResumeContext = {
    canonicalResume: {
      candidate: { name: 'Swapnil Jadhav', targetRole: { title: 'Senior AI Engineer', value: 'ai_engineer' } },
      experience: sampleResumeContext.canonicalResume.experience,
      projects: sampleResumeContext.canonicalResume.projects,
      skills: ['Python', 'FastAPI'],
    },
    targetRole: { title: 'Senior AI & Full Stack Engineer', raw: 'AI Engineer' },
  }

  const signals = extractLinkedInSignals(malformedApifyProfile, objectRoleResumeContext)
  assert.strictEqual(typeof signals.headline.targetRoleMatches, 'boolean')
  console.log('  ✓ 6.1 extractLinkedInSignals coerced object targetRole without .trim errors')

  const crossObjResult = analyzeCrossAgentDiscrepancies(malformedApifyProfile, objectRoleResumeContext, signals)
  assert(crossObjResult && Array.isArray(crossObjResult.discrepancies))
  console.log('  ✓ 6.2 analyzeCrossAgentDiscrepancies coerced object targetRole safely')

  const baseObjResult = analyzeLinkedInProfile(malformedApifyProfile, objectRoleResumeContext)
  assert.strictEqual(baseObjResult.dataAvailable, true)
  console.log('  ✓ 6.3 analyzeLinkedInProfile executed cleanly with object targetRole')

  const evalObjResult = await evaluateLinkedIn({
    profile: malformedApifyProfile,
    resumeContext: objectRoleResumeContext,
    runLlm: false,
  })
  assert.strictEqual(evalObjResult.dataAvailable, true)
  console.log('  ✓ 6.4 evaluateLinkedIn completed safely with zero .trim errors under object targetRole')

  console.log('\n================================================================')
  console.log('ALL LINKEDIN NON-STRING CRASH DEFENSE TESTS PASSED!')
  console.log('================================================================')
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
