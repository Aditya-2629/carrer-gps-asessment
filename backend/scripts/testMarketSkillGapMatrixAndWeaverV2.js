/**
 * Test Suite: Real Market JD Skill Gap Matrix, Smart Weaving V2 & De-Cluttering
 */

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import { getMarketDemandedSkills, MARKET_SKILL_DEMAND } from '../agents/resume/market/marketSkillDemandRegistry.js'
import { computeKeywordAlignment } from '../agents/resume/market/keywordAlignment.js'
import { weaveKeywordsAndBuildLedger } from '../agents/resume/market/smartKeywordWeaver.js'
import { groupByCategory, cleanGrammarArtifacts } from '../services/docxResumeService.js'
import { repairGrammar } from '../services/resumeValidator.js'

async function runTests() {
  console.log('================================================================')
  console.log('TEST SUITE: REAL MARKET JD SKILL GAP MATRIX & WEAVER V2')
  console.log('================================================================\n')

  // ── TEST 1: Market Skill Demand Registry ─────────────────────────────────
  console.log('[Test 1] Real Market Skill Demand Registry (99 JDs Matrix):')
  const sweSkills = getMarketDemandedSkills('Software Engineer')
  assert(Array.isArray(sweSkills) && sweSkills.length >= 10, 'Must have at least 10 skills')
  const ml = sweSkills.find((s) => s.skill === 'Machine Learning')
  assert.ok(ml, 'Machine Learning must be present')
  assert.strictEqual(ml.percentage, 48)
  assert.strictEqual(ml.priority, 'HIGH')

  const git = sweSkills.find((s) => s.skill === 'Git / GitHub')
  assert.ok(git, 'Git / GitHub must be present')
  assert.strictEqual(git.percentage, 41)

  const sysDesign = sweSkills.find((s) => s.skill === 'System Design')
  assert.ok(sysDesign, 'System Design must be present')
  assert.strictEqual(sysDesign.percentage, 37)

  const dataSkills = getMarketDemandedSkills('Senior Data Analyst')
  const sql = dataSkills.find((s) => s.skill === 'SQL')
  assert.strictEqual(sql.percentage, 85)
  console.log('  ✓ 1.1 Market demand registry populated with 99 JDs frequencies and percentages')

  // ── TEST 2: Keyword Alignment with Ranked Market Demands ──────────────────
  console.log('\n[Test 2] Keyword Alignment Engine (Market JD Percentage Badges):')
  const mockResume = {
    candidate: { name: 'Swapnil Jadhav', targetRole: 'Senior AI & Full Stack Engineer' },
    skills: ['Python', 'FastAPI', 'Docker', 'AWS'],
    experience: [
      {
        company: 'Innovatech',
        role: 'AI Engineer',
        bullets: [
          'Engineered conversational AI chatbots with LangChain and FastAPI.',
          'Built microservices hosted on AWS cloud infrastructure.',
        ],
      },
    ],
  }

  const alignment = computeKeywordAlignment({
    canonicalResume: mockResume,
    targetRole: 'Software Engineer',
  })

  assert(Array.isArray(alignment.missingMarketSkillsRanked), 'missingMarketSkillsRanked must be an array')
  assert(alignment.missingMarketSkillsRanked.length > 0, 'Must have missing market skills')

  const topMissing = alignment.missingMarketSkillsRanked[0]
  assert.ok(topMissing.badge.includes('% of JDs'), 'Badge must include "% of JDs"')
  assert.ok(topMissing.percentage >= 20, 'Top missing skill must have significant percentage')

  // Verify missingMarketSkillsRanked contains Machine Learning (48%), Git / GitHub (41%), etc.
  const hasGit = alignment.missingMarketSkillsRanked.some((s) => s.keyword.includes('Git') || s.keyword === 'Git / GitHub')
  const hasSysDesign = alignment.missingMarketSkillsRanked.some((s) => s.keyword === 'System Design')
  assert.ok(hasGit, 'Git / GitHub must be in missingMarketSkillsRanked')
  assert.ok(hasSysDesign, 'System Design must be in missingMarketSkillsRanked')
  console.log(`  ✓ 2.1 Ranked market skills surfaced (${alignment.missingMarketSkillsRanked.length} items, top: ${topMissing.keyword} with ${topMissing.badge})`)

  // ── TEST 3: Smart Keyword Weaving V2 (No Franken-Sentences) ──────────────
  console.log('\n[Test 3] Smart Keyword Weaving V2:')
  const resumeWithChatbot = {
    experiences: [
      {
        company: 'Enterprise AI Corp',
        role: 'Lead Engineer',
        bullets: [
          'Engineered an enterprise conversational AI chatbot and virtual assistant using LangChain and FastAPI.',
          'Optimized backend services and SQL database queries to handle large transaction volume.',
        ],
      },
    ],
  }

  const woven = weaveKeywordsAndBuildLedger({
    canonicalResume: resumeWithChatbot,
    missingKeywords: ['Redis', 'TypeScript', 'Unit / Integration Testing', 'Git / GitHub'],
  })

  const exp = woven.tailoredExperiences[0]
  const bullet1 = exp.bullets[0]
  const bullet2 = exp.bullets[1]

  // Redis must NOT be in chatbot bullet
  assert.strictEqual(
    /redis/i.test(bullet1),
    false,
    'Redis must strictly NEVER be tacked onto a conversational chatbot bullet'
  )

  // Redis MUST be in database / query bullet
  assert.ok(
    /redis/i.test(bullet2),
    'Redis must be woven into database/query optimization bullet'
  )

  // Every bullet must not exceed 38 words
  exp.bullets.forEach((b, idx) => {
    const wc = b.split(/\s+/).filter(Boolean).length
    assert.ok(wc <= 38, `Bullet ${idx + 1} must not exceed 38 words (got ${wc})`)
  })
  console.log('  ✓ 3.1 Redis placed only in DB bullet; Chatbot bullet preserved cleanly without franken-phrases')

  // Check synthesized 3rd bullet for testing and git
  const testingBullet = exp.bullets.find((b) => /jest|pytest/i.test(b))
  assert.ok(testingBullet, 'Testing & Git bullet must be present')
  assert.ok(testingBullet.includes('Git/GitHub CI/CD pull request review gates'))
  console.log('  ✓ 3.2 Standalone production quality bullet generated with Jest, PyTest, and Git')

  // ── TEST 4: Skills Section De-Cluttering (4-Line Standard) ───────────────
  console.log('\n[Test 4] Skills Section De-Cluttering & Banned Buzzwords:')
  const clutteredSkills = [
    'Python', 'FastAPI', 'Node.js', 'React', 'Docker', 'Kubernetes', 'AWS',
    'Agile/Scrum', 'OOP & Design Patterns', 'Code Review', 'Full-Stack Development',
    'Performance Optimization', 'Secure Coding', 'Unit & Integration Testing',
    'Software Engineering', 'Problem Solving', 'Communication', 'PostgreSQL', 'Redis',
  ]

  const grouped = groupByCategory(clutteredSkills, 'Software Engineer')
  const flattenedCategories = grouped.map(([cat, skills]) => ({ cat, skills }))

  // Verify banned soft buzzwords are completely stripped
  flattenedCategories.forEach(({ cat, skills }) => {
    assert.ok(skills.length <= 8, `Category ${cat} must be capped at max 8 items (got ${skills.length})`)
    const hasBanned = skills.some((s) => /agile|oop|problem solving|communication|code review|full-stack/i.test(s))
    assert.strictEqual(hasBanned, false, `Category ${cat} must NOT contain banned buzzwords`)
  })
  console.log('  ✓ 4.1 Banned buzzwords filtered out and categories capped to max 8 items')

  // ── TEST 5: Grammar Collision Fix & Print CSS ─────────────────────────────
  console.log('\n[Test 5] Grammar Collision & Print CSS:')
  const collisionText = 'Implemented input sanitization security audit compliance across all endpoints.'
  const repairedInDocx = cleanGrammarArtifacts(collisionText)
  assert.ok(
    repairedInDocx.includes('sanitization, achieving 100% security audit compliance'),
    'docxResumeService must fix sanitization collision'
  )

  const repairedInValidator = repairGrammar(collisionText)
  assert.ok(
    repairedInValidator.includes('sanitization, achieving 100% security audit compliance'),
    'resumeValidator must fix sanitization collision'
  )
  console.log('  ✓ 5.1 "sanitization security audit compliance" repaired to clean grammatical phrasing')

  // Check index.css contains print hide rule for metric-generator-widget
  const indexCss = fs.readFileSync(path.join(__dirname, '../../src/index.css'), 'utf8')
  assert.ok(indexCss.includes('.metric-generator-widget'), 'index.css must hide .metric-generator-widget in print')
  assert.ok(indexCss.includes('[data-interactive="true"]'), 'index.css must hide [data-interactive="true"] in print')
  console.log('  ✓ 5.2 Print CSS hides interactive metric generator widgets')

  console.log('\n================================================================')
  console.log('ALL MARKET SKILL GAP MATRIX & WEAVER V2 TESTS PASSED!')
  console.log('================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})

