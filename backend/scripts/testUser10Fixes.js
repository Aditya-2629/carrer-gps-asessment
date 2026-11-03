import { computeKeywordAlignment } from '../agents/resume/market/keywordAlignment.js'
import { weaveKeywordsAndBuildLedger } from '../agents/resume/market/smartKeywordWeaver.js'
import { buildAtsTailoredDocx } from '../services/docxResumeService.js'
import fs from 'fs'

async function runComprehensiveTest() {
  console.log('=== Step 1: Testing Keyword Alignment on Swapnil Profile ===')
  const swapnilResume = {
    candidate: { targetRole: 'Software Engineer' },
    summary: { text: 'Software Engineer with 3 years of experience building high-concurrency backend services, event-driven serverless architectures on AWS, and LLM orchestration workflows. Strong foundation in Python, Go, and distributed systems.' },
    experience: [
      {
        company: 'Kitcoek',
        role: 'Software Engineer',
        duration: 'July 2022 – June 2024',
        isCurrent: false,
        bullets: [
          'Built a support chatbot using LangChain, MCP tool-calling agents, and Gemini API with prompt-injection guardrails and logging.',
          'Migrated a synchronous monolith to an event-driven serverless backend on Azure, reducing page load time to less than 1 s.',
          'Architected the database schema and backend for an Alumni Management System supporting 5,000+ users and a role-based admin panel.',
          'Automated Jenkins CI/CD deployment integrated with Git / GitHub, enabling 20+ production releases with zero-downtime rollouts.'
        ]
      },
      {
        company: 'Recibo Technologies',
        role: 'Software Engineer',
        duration: 'January 2021 – April 2022',
        isCurrent: false,
        bullets: [
          'Built a cross-engine database synchronization service between MySQL and MS SQL for enterprise clients including BIC and Henkel.',
          'Optimized backend services using GraphQL and Sequelize ORM, achieving a 35% improvement in data retrieval times.',
          'Streamlined enterprise operations by delivering a multi-level L1-L3 customer approval workflow and TensorFlow NLP intent classifier.',
          'Hardened enterprise APIs and eliminated high-risk vulnerabilities by remediating XSS attack vectors and sensitive-key exposure.'
        ]
      }
    ],
    projects: [
      {
        title: 'NJNavigator - NJ/NYC Transit AI Agent',
        techStack: 'smolagents, GPT-4o-mini, FastMCP, RAG',
        bullets: ['Designed an LLM transit assistant using smolagents ToolCallingAgent and GPT-4o-mini, orchestrating 9 tools through FastMCP.']
      }
    ],
    skills: [
      'Python', 'JavaScript', 'Go', 'Node.js', 'FastAPI', 'Flask', 'REST APIs', 'GraphQL',
      'Docker', 'Kubernetes', 'AWS', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis'
    ]
  }

  const alignment = computeKeywordAlignment({
    canonicalResume: swapnilResume,
    targetRole: 'Software Engineer'
  })

  console.log('Total Target Keywords:', alignment.totalTargetKeywords)
  console.log('Matched in Experience:', alignment.matchedCount, alignment.matchedInExperience)
  console.log('Skills Only Unverified:', alignment.skillsOnlyUnverified)
  console.log('Ranked Missing Market Skills:', alignment.missingMarketSkillsRanked.length)
  for (const m of alignment.missingMarketSkillsRanked.slice(0, 6)) {
    console.log(`  - ${m.keyword}: ${m.percentage}% of JDs (${m.priority})`)
  }

  console.log('\n=== Step 2: Verifying Mathematically Grounded Match Lift ===')
  const verifiedCount = alignment.matchedCount || alignment.matchedInExperience.length
  const total = alignment.totalTargetKeywords
  const currentMatchRate = Math.min(100, Math.round((verifiedCount / total) * 100))
  const selectedCount = 6
  const projectedCount = Math.min(total, verifiedCount + selectedCount)
  const projectedRate = Math.min(100, Math.round((projectedCount / total) * 100))
  const lift = Math.max(0, projectedRate - currentMatchRate)

  console.log(`Current Match Rate: ${verifiedCount}/${total} = ${currentMatchRate}%`)
  console.log(`With 6 Skills Selected: ${projectedCount}/${total} = ${projectedRate}%`)
  console.log(`Calculated Lift: +${lift}% (from ${currentMatchRate}% ➔ ${projectedRate}%)`)
  if (lift > 50) {
    throw new Error(`Math formula failed! Lift was +${lift}%, which is unrealistic!`)
  }

  console.log('\n=== Step 3: Testing Smart Keyword Weaver (Multi-Company Distribution) ===')
  const missingKws = alignment.missingMarketSkillsRanked.slice(0, 6).map((m) => m.keyword)
  console.log('Missing Keywords to weave:', missingKws)
  console.log('Stranded Skills-Only to weave:', alignment.skillsOnlyUnverified)

  const { tailoredExperiences, interviewLedger } = await weaveKeywordsAndBuildLedger({
    canonicalResume: swapnilResume,
    missingKeywords: missingKws,
    targetRole: 'Software Engineer',
    skillsOnlyKeywords: alignment.skillsOnlyUnverified,
  })

  console.log('\nTailored Experiences Bullet Counts:')
  tailoredExperiences.forEach((exp) => {
    console.log(`Company: ${exp.company} (Duration: ${exp.duration}) -> ${exp.bullets.length} bullets`)
    exp.bullets.forEach((b, i) => {
      console.log(`   ${i + 1}. ${b}`)
    })
  })

  // Check balance: No company should have > 6 bullets, and Kitcoek should not hoard all additions
  const kitcoekBullets = tailoredExperiences.find((e) => e.company.includes('Kitcoek'))?.bullets || []
  const reciboBullets = tailoredExperiences.find((e) => e.company.includes('Recibo'))?.bullets || []

  console.log(`\nKitcoek bullets: ${kitcoekBullets.length}, Recibo bullets: ${reciboBullets.length}`)
  if (kitcoekBullets.length > 6) {
    throw new Error(`Kitcoek has too many bullets (${kitcoekBullets.length})! Failed balance constraint.`)
  }
  if (reciboBullets.length < 5) {
    throw new Error(`Recibo did not receive any additions (${reciboBullets.length})! Failed distribution.`)
  }

  console.log('\n=== Step 4: Verifying Interview Defense Ledger ===')
  console.log(`Total keywords in interview defense ledger: ${interviewLedger.length}`)
  interviewLedger.forEach((entry, i) => {
    console.log(`  [${i + 1}] Keyword: ${entry.keyword} (${entry.company})`)
    console.log(`      Placement: ${entry.placement}`)
    console.log(`      Script: ${entry.interviewTalkingScript}`)
  })

  console.log('\n=== Step 5: Generating and Verifying Tailored ATS DOCX ===')
  const testCanonical = {
    ...swapnilResume,
    experiences: tailoredExperiences,
    experience: tailoredExperiences,
    target_role: 'Software Engineer',
    name: 'Swapnil Jadhav',
    phone: '+1 (201) 234-2112',
    email: 'Swapnilkjadhav07@gmail.com',
    linkedin: 'https://www.google.com/search?q=linkedin.com/in/swapniljadhav',
    github: 'https://www.google.com/search?q=github.com/swapniljadhav',
    summary: swapnilResume.summary.text,
  }

  const { buffer: docxBuffer, pages, mode } = await buildAtsTailoredDocx(
    testCanonical,
    [],
    missingKws.map((k) => ({ keyword: k, count: 1 }))
  )

  const magic = docxBuffer.slice(0, 4).toString('utf-8')
  console.log('DOCX Magic Bytes:', magic, '(Expected: PK\\x03\\x04)')
  if (docxBuffer[0] !== 0x50 || docxBuffer[1] !== 0x4b) {
    throw new Error('Generated DOCX is not a valid zip/docx archive!')
  }

  const outputPath = '/tmp/Swapnil_Tailored_ATS_Resume_Fixed.docx'
  fs.writeFileSync(outputPath, docxBuffer)
  console.log(`Successfully wrote ${docxBuffer.length} bytes to ${outputPath}`)
  console.log('Pages:', pages, 'Mode:', mode)
  console.log('\nAll 5 validation steps PASSED perfectly!')
}

runComprehensiveTest().catch((err) => {
  console.error('Test FAILED:', err)
  process.exit(1)
})
