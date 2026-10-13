/**
 * Resume Agent V3.3 — Verification Suite
 * Tests:
 * 1. Contact / ATS Header Separation (Root Fix)
 * 2. Intelligent Experience & Education Header Parsing
 * 3. Intelligent Career Timeline (Duration, Current Role, Gaps > 6 mo, Promotions)
 * 4. Deterministic Certification Detection (Skills, Summary, Bullets, Section)
 * 5. Pre-Audit Dossier & Mode C Hybrid Prompt Integration
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { analyzeTimeline } from '../agents/resume/signals/timelineAnalyzer.js'
import { detectCertifications } from '../agents/resume/signals/certificationDetector.js'
import { buildDeterministicDossier, buildHybridPrompt } from '../agents/resume/orchestration/modeC_hybrid.js'
import { computePrecomputedSignals } from '../agents/resume/signals/precomputedSignals.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('================================================================')
console.log('CAREER GPS RESUME AGENT V3.3 — VERIFICATION TEST SUITE')
console.log('================================================================\n')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`PASS: ${name}`)
    passed++
  } catch (err) {
    console.error(`FAIL: ${name} ->`, err.message)
    failed++
  }
}

// =============================================================================
// TEST SUITE 1: CONTACT / ATS HEADER SEPARATION (Root Fix)
// =============================================================================
console.log('--- SUITE 1: Contact Header & ATS Root Fix ---')

const standardContactResume = `John Smith
New York, NY | 555-555-5555 | john@email.com | linkedin.com/in/johnsmith

Professional Summary
Senior Data Analyst with 4+ years of experience in data visualization and SQL.`

const normJohn = ResumeNormalizer.normalize({ rawText: standardContactResume })
const sigJohn = computePrecomputedSignals(normJohn)

test('Header lines separated cleanly from summary', () => {
  assert(normJohn.header.length >= 2, 'Header contains contact lines')
  assert(normJohn.summary.text.startsWith('Senior Data Analyst'), 'Summary starts with narrative')
})

test('Standard contact line does NOT trigger isContactMerged anomaly', () => {
  assert.strictEqual(sigJohn.contactMerge.isContactMerged, false)
})

// =============================================================================
// TEST SUITE 2: INTELLIGENT EXPERIENCE & EDUCATION PARSING
// =============================================================================
console.log('\n--- SUITE 2: Intelligent Experience & Education Parsing ---')

const swapnilRaw = fs.readFileSync(path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt'), 'utf8')
const normSwapnil = ResumeNormalizer.normalize({ rawText: swapnilRaw })

test('Swapnil exp_001 company extracted accurately', () => {
  assert.strictEqual(normSwapnil.experience[0].company, 'Apex Intelligence Labs')
})

test('Swapnil exp_001 role extracted accurately', () => {
  assert.strictEqual(normSwapnil.experience[0].role, 'Senior AI & Full Stack Engineer')
})

test('Swapnil exp_001 location extracted accurately', () => {
  assert.strictEqual(normSwapnil.experience[0].location, 'San Jose, CA')
})

test('Swapnil exp_001 dates and start/end parsed', () => {
  assert.strictEqual(normSwapnil.experience[0].startDate, 'March 2023')
  assert.strictEqual(normSwapnil.experience[0].endDate, 'Present')
})

test('Swapnil exp_002 company and role extracted accurately', () => {
  assert.strictEqual(normSwapnil.experience[1].company, 'CoreLogic Systems')
  assert.strictEqual(normSwapnil.experience[1].role, 'Full Stack Software Engineer')
  assert.strictEqual(normSwapnil.experience[1].startDate, 'June 2021')
  assert.strictEqual(normSwapnil.experience[1].endDate, 'February 2023')
})

test('Swapnil education parsed into degree, institution, and year', () => {
  assert(normSwapnil.education.length > 0)
  assert.strictEqual(normSwapnil.education[0].degree, 'B.S. in Computer Science')
  assert.strictEqual(normSwapnil.education[0].institution, 'San Jose State University')
  assert.strictEqual(normSwapnil.education[0].year, '2017 – 2021')
})

// =============================================================================
// TEST SUITE 3: INTELLIGENT CAREER TIMELINE ENGINE
// =============================================================================
console.log('\n--- SUITE 3: Intelligent Career Timeline Engine ---')

const timelineSwapnil = analyzeTimeline(normSwapnil)

test('Calculates Swapnil career duration dynamically', () => {
  assert(timelineSwapnil.careerDuration.totalYears >= 3.0, 'Years >= 3.0')
  assert(timelineSwapnil.careerDuration.totalMonths >= 36, 'Months >= 36')
  assert(timelineSwapnil.careerDuration.formatted.includes('yrs') || timelineSwapnil.careerDuration.formatted.includes('mos'), 'Formatted duration string present')
})

test('Supports deterministic referenceDate option in analyzeTimeline', () => {
  const fixedTimeline = analyzeTimeline(normSwapnil, { referenceDate: new Date('2026-10-15') })
  assert.strictEqual(fixedTimeline.careerDuration.totalYears, 5.4)
  assert.strictEqual(fixedTimeline.careerDuration.totalMonths, 65)
})

test('Detects Swapnil is actively employed at Apex Intelligence Labs', () => {
  assert.strictEqual(timelineSwapnil.currentRole.isCurrentlyEmployed, true)
  assert.strictEqual(timelineSwapnil.currentRole.company, 'Apex Intelligence Labs')
  assert.strictEqual(timelineSwapnil.currentRole.role, 'Senior AI & Full Stack Engineer')
})

test('Swapnil has 0 career gaps between CoreLogic and Apex', () => {
  assert.strictEqual(timelineSwapnil.careerGaps.length, 0)
})

// Career Gaps & Internal Promotion Test
const resumeWithGapAndPromo = `Alex Morgan
alex@example.com | 555-9876 | Chicago, IL

WORK EXPERIENCE
Lead Infrastructure Architect | CloudForge Corp | Chicago, IL
January 2024 – Present
• Directed multi-cloud architecture.

Senior DevOps Engineer | CloudForge Corp | Chicago, IL
March 2022 – December 2023
• Built Terraform automated deployment workflows.

Cloud Engineer | Horizon Labs | Chicago, IL
January 2020 – January 2021
• Managed AWS resources.
`

const normGapPromo = ResumeNormalizer.normalize({ rawText: resumeWithGapAndPromo })
const timelineGapPromo = analyzeTimeline(normGapPromo)

test('Detects internal promotion at CloudForge Corp (Senior DevOps -> Lead Architect)', () => {
  assert(timelineGapPromo.promotions.length >= 1, 'Detected at least 1 promotion')
  const promo = timelineGapPromo.promotions[0]
  assert(promo.company.toLowerCase().includes('cloudforge'), 'Company is CloudForge')
  assert(promo.roleCount >= 2, 'Role count >= 2')
})

test('Detects significant career gap (>6 months) between Jan 2021 and Mar 2022', () => {
  assert(timelineGapPromo.careerGaps.length >= 1, 'Detected career gap')
  const gap = timelineGapPromo.careerGaps[0]
  assert(gap.gapMonths > 6, `Gap months (${gap.gapMonths}) > 6`)
  assert.strictEqual(gap.isSignificant, true)
})

test('Timeline summary contains duration, gap count, and promotion count', () => {
  assert.strictEqual(timelineGapPromo.summary.isCurrentlyEmployed, true)
  assert(timelineGapPromo.summary.gapCount >= 1)
  assert(timelineGapPromo.summary.promotionCount >= 1)
})

// =============================================================================
// TEST SUITE 4: DETERMINISTIC CERTIFICATION DETECTION
// =============================================================================
console.log('\n--- SUITE 4: Deterministic Certification Detection ---')

const resumeWithCerts = `Sarah Jenkins
sarah@example.com | 555-1111 | Austin, TX

SUMMARY
AWS Certified Solutions Architect and Certified Kubernetes Administrator with 6 years leading cloud platforms.

SKILLS
Cloud: AWS, Azure (AZ-104), Docker, Terraform Associate
Security: CISSP, CompTIA Security+

EXPERIENCE
Senior Cloud Engineer | TechCorp | Austin, TX
2022 - Present
• Designed Kubernetes clusters in alignment with CKA standards.
• Led teams using PMP best practices.
`

const normCerts = ResumeNormalizer.normalize({ rawText: resumeWithCerts })

test('Detects AWS Certified Solutions Architect from summary', () => {
  const found = normCerts.certifications.find((c) => c.name.includes('AWS Certified Solutions Architect'))
  assert(found, 'Found AWS Solutions Architect')
})

test('Detects CKA (Certified Kubernetes Administrator) from summary', () => {
  const found = normCerts.certifications.find((c) => c.name.includes('Certified Kubernetes Administrator'))
  assert(found, 'Found CKA')
})

test('Detects AZ-104 from skills', () => {
  const found = normCerts.certifications.find((c) => c.name.includes('AZ-104'))
  assert(found, 'Found AZ-104')
})

test('Detects Terraform Associate from skills', () => {
  const found = normCerts.certifications.find((c) => c.name.includes('Terraform Associate'))
  assert(found, 'Found Terraform Associate')
})

test('Detects CISSP and Security+ from skills', () => {
  const cissp = normCerts.certifications.find((c) => c.name.includes('CISSP'))
  const secPlus = normCerts.certifications.find((c) => c.name.includes('Security+'))
  assert(cissp, 'Found CISSP')
  assert(secPlus, 'Found CompTIA Security+')
})

test('Detects PMP from experience bullet', () => {
  const pmp = normCerts.certifications.find((c) => c.name.includes('PMP'))
  assert(pmp, 'Found PMP')
})

test('Certifications are deduplicated across sections', () => {
  const names = normCerts.certifications.map((c) => c.name.toLowerCase())
  const uniqueNames = new Set(names)
  assert.strictEqual(names.length, uniqueNames.size, 'No duplicate certification names')
})

// =============================================================================
// TEST SUITE 5: PRE-AUDIT DOSSIER & PROMPT INJECTION
// =============================================================================
console.log('\n--- SUITE 5: Pre-Audit Dossier & Prompt Injection ---')

const dossier = buildDeterministicDossier({
  canonicalResume: normSwapnil,
  signals: { timeline: timelineSwapnil },
  precomputedSignals: computePrecomputedSignals(normSwapnil),
  targetJobDescription: 'Seeking Senior Full Stack Engineer with Python, React, and Redis.',
  marketContext: { bucketKey: 'software-engineer::3-5', marketSampleSize: 5, marketEvidenceGaps: [] },
})

test('Dossier includes deterministic timeline facts', () => {
  assert(dossier.timeline, 'dossier.timeline exists')
  assert.strictEqual(dossier.timeline.isCurrentlyEmployed, true)
  assert(dossier.timeline.totalExperienceYears >= 3.0, 'totalExperienceYears >= 3.0')
  assert.strictEqual(dossier.timeline.itemCount, 2)
})

test('Dossier includes certifications list', () => {
  assert(Array.isArray(dossier.certifications), 'dossier.certifications is array')
})

const messages = buildHybridPrompt({
  compactResume: 'MOCK COMPACT RESUME',
  dossier,
  targetRole: 'Senior AI & Full Stack Engineer',
  targetJobDescription: 'Seeking Senior Full Stack Engineer with Python, React, and Redis.',
  marketContext: { bucketKey: 'software-engineer::3-5', marketSampleSize: 5 },
})

test('Prompt contains Career Timeline ground truth', () => {
  const userContent = messages[1].content
  assert(userContent.includes('Career Timeline:'))
  assert(userContent.includes('across 2 roles'))
})

test('Prompt contains Current Role ground truth', () => {
  const userContent = messages[1].content
  assert(userContent.includes('Current Role: Senior AI & Full Stack Engineer at Apex Intelligence Labs (March 2023 – Present)'))
})

test('Prompt system message contains Career Story & Recruiter Perspective section', () => {
  const systemContent = messages[0].content
  assert(systemContent.includes('7. CAREER STORY & RECRUITER PERSPECTIVE'))
  assert(systemContent.includes('Respect the precomputed timeline facts'))
})

console.log('\n================================================================')
console.log(`RESULTS: ${passed} passed, ${failed} failed`)
console.log('================================================================\n')

if (failed > 0) {
  process.exit(1)
}
