/**
 * Regression & Quality Tests for Compact Resume Input Serializer (V1.4)
 * Validates all 13 criteria specified in Section 26 of Career GPS Resume Agent V1.4.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DocumentParser } from '../services/documentParser/index.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import {
  INPUT_SERIALIZER_VERSION,
  serializeResumeForLLM,
  computeHash,
} from '../agents/resume/resumeAgent.inputSerializer.js'
import { ResumeAgentPrompt } from '../agents/resume/resumeAgent.prompt.js'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runRegressionSuite() {
  console.log('====================================================')
  console.log('CAREER GPS RESUME AGENT V1.4 — REGRESSION TEST SUITE')
  console.log('Testing Serializer Version:', INPUT_SERIALIZER_VERSION)
  console.log('====================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`)
      passed++
    } else {
      console.error(`[FAIL] ${message}`)
      failed++
    }
  }

  // Load strong fullstack fixture
  const fixturePath = path.join(__dirname, '../agents/resume/fixtures/strong-fullstack.txt')
  const rawText = fs.readFileSync(fixturePath, 'utf8')

  // Parse & Normalize
  const parsedDoc = await DocumentParser.parse({ text: rawText, filename: 'strong-fullstack.txt' })
  const targetRole = 'Senior Full Stack & Cloud Systems Engineer'
  const canonicalResume = ResumeNormalizer.normalize(parsedDoc, targetRole)

  // Serialize to Compact Text
  const compactText = serializeResumeForLLM(canonicalResume, { targetRole })
  const canonicalJson = JSON.stringify(canonicalResume, null, 2)

  console.log('--- TEST 1: All experience bullet IDs survive serialization ---')
  const allExpBullets = canonicalResume.experience.flatMap((e) => e.bullets)
  const allExpBulletIdsSurvive = allExpBullets.every((b) => compactText.includes(`[${b.id}]`))
  assert(allExpBulletIdsSurvive && allExpBullets.length > 0, `All ${allExpBullets.length} experience bullet IDs present in compact text`)

  console.log('\n--- TEST 2: All experience bullet text remains unchanged ---')
  const allExpTextUnchanged = allExpBullets.every((b) => compactText.includes(b.text.trim()))
  assert(allExpTextUnchanged, 'All experience bullet texts match verbatim in compact text')

  console.log('\n--- TEST 3: Existing metrics remain unchanged ---')
  // Known metrics in fixture: 45,000, 58%, $14M, 89%, 12,000
  const expectedMetrics = ['45,000', '58%', '$14M', '89%', '12,000']
  const allMetricsPresent = expectedMetrics.every((m) => compactText.includes(m))
  assert(allMetricsPresent, `All quantitative metrics preserved verbatim: ${expectedMetrics.join(', ')}`)

  console.log('\n--- TEST 4: Existing technologies remain unchanged ---')
  const expectedTech = ['Go', 'Kafka', 'PostgreSQL', 'Redis', 'AWS', 'Terraform', 'React', 'TypeScript', 'Docker', 'Raft']
  const allTechPresent = expectedTech.every((t) => compactText.includes(t))
  assert(allTechPresent, `All key technologies preserved: ${expectedTech.join(', ')}`)

  console.log('\n--- TEST 5: No source/bbox metadata enters LLM input ---')
  const hasSourceMetadata = compactText.includes('"source"') ||
                            compactText.includes('"bbox"') ||
                            compactText.includes('bbox: null') ||
                            compactText.includes('pageCount') ||
                            compactText.includes('confidence')
  assert(!hasSourceMetadata, 'Zero parser metadata (source, bbox, pageCount, confidence) present in compact LLM input')

  console.log('\n--- TEST 6: No canonical JSON enters compact mode ---')
  const hasJsonMarkers = compactText.trim().startsWith('{') || compactText.includes('"candidate":') || compactText.includes('"bullets": [')
  assert(!hasJsonMarkers, 'Compact text is clean human-readable text, not JSON')

  console.log('\n--- TEST 7: Skills are grouped without data loss ---')
  const allSkills = canonicalResume.skills
  const someSkillsInCompact = allSkills.length > 0 && compactText.includes('SKILLS')
  // Check that every individual skill name is represented in the SKILLS section
  const skillsSection = compactText.slice(compactText.indexOf('SKILLS'))
  const skillsPreserved = allSkills.every((s) => {
    // If name contains colon like "Languages: Go", check that remainder "Go" is present
    const cleanName = s.name.includes(':') ? s.name.split(':')[1].trim() : s.name.trim()
    return skillsSection.includes(cleanName)
  })
  assert(someSkillsInCompact && skillsPreserved, `All ${allSkills.length} skills preserved and categorized under SKILLS header`)

  console.log('\n--- TEST 8: Project bullet IDs remain available ---')
  const allProjBullets = canonicalResume.projects.flatMap((p) => p.bullets)
  const allProjBulletsSurvive = allProjBullets.every((b) => compactText.includes(`[${b.id}]`))
  assert(allProjBulletsSurvive && allProjBullets.length > 0, `All ${allProjBullets.length} project bullet IDs present in compact text`)

  console.log('\n--- TEST 9: Education data is preserved without fabrication ---')
  const allEduItems = canonicalResume.education
  const allEduSurvive = allEduItems.every((e) => compactText.includes(`[${e.id}]`))
  assert(allEduSurvive && allEduItems.length > 0, `All ${allEduItems.length} education items preserved with IDs`)

  console.log('\n--- TEST 10: Same canonical input produces deterministic compact text ---')
  const compactText2 = serializeResumeForLLM(canonicalResume, { targetRole })
  assert(compactText === compactText2, 'Two serializations of identical canonical resume produce identical text')

  console.log('\n--- TEST 11: Input hash is deterministic ---')
  const hash1 = computeHash(canonicalResume)
  const hash2 = computeHash(canonicalResume)
  const llmHash1 = computeHash(compactText)
  const llmHash2 = computeHash(compactText2)
  assert(hash1 === hash2 && llmHash1 === llmHash2, `Deterministic hashes: canonical=${hash1}, llm=${llmHash1}`)

  console.log('\n--- TEST 12: Existing evidence validator still works with canonicalResume ---')
  // Create a mock valid analysis referencing canonical IDs
  const mockValidAnalysisJson = JSON.stringify({
    analysisVersion: '1.0',
    candidateSnapshot: {
      targetRole: 'Senior Full Stack & Cloud Systems Engineer',
      experienceLevel: 'Senior (6 years)',
      primaryProfile: 'Full-Stack / Systems Specialist',
    },
    dashboard: {
      score: null,
      dimensions: { impact: null, clarity: null, positioning: null, structure: null },
    },
    overallReview: 'Marcus brings strong systems architecture and cloud engineering signal.',
    strengths: [
      {
        id: 'str_001',
        title: 'High-throughput Go Engine',
        signal: 'Demonstrated event-driven scalability at high volume.',
        evidence: {
          section: 'experience',
          itemId: 'exp_001',
          bulletId: 'exp_001_b01',
          originalText: canonicalResume.experience[0].bullets[0].text,
        },
      },
    ],
    issues: [
      {
        id: 'iss_001',
        severity: 'medium',
        category: 'impact',
        title: 'Quantify mentor outcomes',
        evidence: {
          section: 'experience',
          itemId: 'exp_001',
          bulletId: 'exp_001_b04',
          originalText: canonicalResume.experience[0].bullets[3].text,
        },
        diagnosis: 'Mentoring 4 engineers lacks downstream team impact.',
        whyItMatters: 'Hiring managers want to see if mentees were promoted or shipped key projects.',
        recommendation: 'Highlight specific projects mentees delivered.',
        correctedText: null,
        correctionType: 'none',
        confidence: 0.9,
      },
    ],
    priorityActions: [
      {
        order: 1,
        title: 'Add promotion/project outcome to mentoring bullet',
        action: 'Specify what the 4 mentored engineers achieved under your guidance.',
        impact: 'Medium',
      },
    ],
    metadata: { provider: 'test', model: 'test', latencyMs: 10 },
  })

  const valResult = ResumeAgentValidator.validate(mockValidAnalysisJson, canonicalResume)
  assert(valResult.isValid && valResult.warnings.length === 0, 'Validator accepts analysis matching canonical resume evidence')

  console.log('\n--- TEST 13: Existing Resume Agent output schema remains valid ---')
  assert(
    valResult.sanitizedAnalysis.candidateSnapshot &&
    valResult.sanitizedAnalysis.dashboard &&
    valResult.sanitizedAnalysis.overallReview &&
    Array.isArray(valResult.sanitizedAnalysis.strengths) &&
    Array.isArray(valResult.sanitizedAnalysis.issues) &&
    Array.isArray(valResult.sanitizedAnalysis.priorityActions),
    'Output schema preserves candidateSnapshot, dashboard, overallReview, strengths, issues, priorityActions'
  )

  // Token & Character Reduction Measurement
  const canonicalChars = canonicalJson.length
  const compactChars = compactText.length
  const reductionPct = (((canonicalChars - compactChars) / canonicalChars) * 100).toFixed(1)
  const canonicalEstTokens = Math.round(canonicalChars / 4)
  const compactEstTokens = Math.round(compactChars / 4)

  console.log('\n====================================================')
  console.log('INPUT COMPRESSION MEASUREMENT')
  console.log('====================================================')
  console.log(`Canonical JSON:   ${canonicalChars} characters (~${canonicalEstTokens} tokens)`)
  console.log(`Compact Text:     ${compactChars} characters (~${compactEstTokens} tokens)`)
  console.log(`Actual Reduction: ${reductionPct}% character reduction`)
  console.log('====================================================')
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log('====================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error running regression suite:', err)
  process.exit(1)
})
