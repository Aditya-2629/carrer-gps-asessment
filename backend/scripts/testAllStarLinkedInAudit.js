import assert from 'assert'
import {
  normalizeLinkedInProfile,
  analyzeCrossAgentDiscrepancies,
  buildDeterministicOptimizations,
  synthesizeLinkedInOptimizations,
  buildLinkedInUserPrompt,
  LINKEDIN_SYSTEM_PROMPT,
} from '../agents/linkedin/index.js'

async function runAllStarTests() {
  console.log('================================================================')
  console.log('ALL-STAR LINKEDIN AUDIT & REAL-TIME LOADER UNIT TEST')
  console.log('================================================================\n')

  // 1. Scraper & Normalizer Visual/Section Extraction
  console.log('--- Test 1: Scraper & Normalizer Visual/Section Extraction ---')
  const rawScraped = {
    fullName: 'Jane Doe',
    headline: 'Senior Full Stack Engineer',
    about: 'Experienced software architect building distributed web systems.',
    pictureUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
    bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
    hasPicture: true,
    hasBanner: true,
    certifications: [
      { name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', date: '2023' },
    ],
    projects: [
      { title: 'Distributed Graph Engine', description: 'High-scale graph query processing in Rust and Go' },
    ],
    education: [
      { school: 'MIT', degree: 'B.S. in Computer Science' },
    ],
    experiences: [
      { title: 'Lead Architect', company: 'TechCorp', dates: '2021 – Present', description: 'Leading architecture' },
    ],
    skills: ['Rust', 'Go', 'AWS', 'Docker'],
  }

  const norm = normalizeLinkedInProfile(rawScraped)
  assert.strictEqual(norm.hasPicture, true, 'hasPicture is true for valid photo')
  assert.strictEqual(norm.hasBanner, true, 'hasBanner is true for custom banner')
  assert.strictEqual(norm.pictureUrl, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330')
  assert.strictEqual(norm.bannerUrl, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe')
  assert.strictEqual(norm.certifications.length, 1, 'certifications normalized')
  assert.strictEqual(norm.projects.length, 1, 'projects normalized')
  console.log('PASS: Normalizer cleanly extracts pictureUrl, bannerUrl, hasPicture, hasBanner, certifications, projects')

  // 2. Ghost Avatar and Default Banner Detection
  console.log('\n--- Test 2: Default Avatar & Gray Banner Detection ---')
  const ghostProfile = normalizeLinkedInProfile({
    fullName: 'Ghost User',
    headline: 'Developer',
    pictureUrl: 'https://static.licdn.com/sc/h/ghost_person_200.png',
    bannerUrl: '',
    experiences: [{ title: 'Dev', company: 'Inc' }],
  })
  assert.strictEqual(ghostProfile.hasPicture, false, 'Ghost picture detected as false')
  assert.strictEqual(ghostProfile.hasBanner, false, 'Empty banner detected as false')
  console.log('PASS: Ghost avatar and empty banner correctly resolved to false')

  // 3. Cross-Analyzer: Visual Presence and Section Omission Audit
  console.log('\n--- Test 3: Visual Audit & Missing Sections Against Resume ---')
  const canonicalResume = {
    candidate: { name: 'Jane Doe', targetRole: 'Senior Full Stack Engineer' },
    experience: [
      {
        company: 'TechCorp',
        role: 'Lead Architect',
        dates: '2021 – Present',
        bullets: [{ text: 'Scaled graph query throughput by 4x using Rust and Go.' }],
      },
    ],
    certifications: [
      { name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services' },
      { name: 'Certified Kubernetes Administrator (CKA)', issuer: 'Linux Foundation' },
    ],
    projects: [
      { title: 'Distributed Graph Engine', bullets: [{ text: 'Processed 50M edges/sec.' }] },
      { title: 'Telemetry Gateway', bullets: [{ text: 'Kafka-based message broker.' }] },
    ],
    education: [
      { institution: 'MIT', degree: 'B.S. Computer Science' },
    ],
    skills: ['Rust', 'Go', 'AWS', 'Docker', 'Kubernetes', 'Kafka', 'PostgreSQL'],
  }

  // Cross-analyze ghost profile (no picture, no banner, no certs, no projects, no edu) against canonical resume
  const auditResult = analyzeCrossAgentDiscrepancies(ghostProfile, { canonicalResume, targetRole: 'Senior Full Stack Engineer' })

  // Verify visualAudit
  assert(auditResult.visualAudit, 'visualAudit object must be returned')
  assert.strictEqual(auditResult.visualAudit.hasPicture, false, 'visualAudit.hasPicture is false')
  assert.strictEqual(auditResult.visualAudit.hasBanner, false, 'visualAudit.hasBanner is false')
  assert(auditResult.visualAudit.issues.some((i) => i.id === 'visual_photo_missing' && i.severity === 'high'), 'Photo penalty flagged as high')
  assert(auditResult.visualAudit.issues.some((i) => i.id === 'visual_banner_default' && i.severity === 'medium'), 'Banner issue flagged as medium')
  console.log('PASS: Flagged missing profile photo (high severity, 21x view penalty) and default gray cover banner')

  // Verify missingSections
  assert(Array.isArray(auditResult.missingSections), 'missingSections must be an array')
  assert(auditResult.missingSections.some((s) => s.type === 'missing_certifications'), 'Missing certifications flagged')
  assert(auditResult.missingSections.some((s) => s.type === 'missing_projects'), 'Missing projects flagged')
  assert(auditResult.missingSections.some((s) => s.type === 'missing_education'), 'Missing education credentials flagged')
  console.log(`PASS: Flagged ${auditResult.missingSections.length} missing sections (certifications, featured projects, education)`)

  // Verify timelineWarnings alias
  assert(Array.isArray(auditResult.timelineWarnings), 'timelineWarnings array returned')
  console.log('PASS: timelineWarnings array cleanly returned alongside timelineMismatches')

  // 4. All-Star Generative Optimizer Schema & Fallback
  console.log('\n--- Test 4: All-Star Generative Optimizer & Canva Blueprint ---')
  const opt = buildDeterministicOptimizations(ghostProfile, { canonicalResume, targetRole: 'Senior Full Stack Engineer' }, auditResult.missingSkills)
  assert(opt.bannerStrategy, 'bannerStrategy generated')
  assert(opt.bannerStrategy.bannerTagline, 'bannerTagline present')
  assert(opt.bannerStrategy.bannerSecondaryText, 'bannerSecondaryText present')
  assert(opt.bannerStrategy.designAdvice, 'designAdvice present')
  assert(Array.isArray(opt.featuredSectionRecommendations) && opt.featuredSectionRecommendations.length > 0, 'featuredSectionRecommendations present')
  assert(Array.isArray(opt.top3PinnedSkills) && opt.top3PinnedSkills.length === 3, 'top3PinnedSkills has 3 skills')
  assert(Array.isArray(opt.visualPresenceTips) && opt.visualPresenceTips.length > 0, 'visualPresenceTips present')
  assert(Array.isArray(opt.headlines) && opt.headlines.length === 3, '3 headlines present')
  assert(opt.aboutRewrite.hook && opt.aboutRewrite.proof && opt.aboutRewrite.callToAction, '3-paragraph about rewrite present')
  console.log(`PASS: Canva Blueprint generated: "${opt.bannerStrategy.bannerTagline}"`)
  console.log(`PASS: Top 3 Pinned Skills: ${opt.top3PinnedSkills.join(', ')}`)
  console.log(`PASS: Featured Section Recommendations: ${opt.featuredSectionRecommendations.map(f => f.title).join(', ')}`)

  // 5. System Prompt Schema
  console.log('\n--- Test 5: System Prompt Schema Verification ---')
  assert(LINKEDIN_SYSTEM_PROMPT.includes('bannerStrategy'), 'System prompt contains bannerStrategy schema')
  assert(LINKEDIN_SYSTEM_PROMPT.includes('featuredSectionRecommendations'), 'System prompt contains featuredSectionRecommendations')
  assert(LINKEDIN_SYSTEM_PROMPT.includes('top3PinnedSkills'), 'System prompt contains top3PinnedSkills')
  assert(LINKEDIN_SYSTEM_PROMPT.includes('visualPresenceTips'), 'System prompt contains visualPresenceTips')
  console.log('PASS: System prompt enforces complete All-Star LinkedIn package schema')

  console.log('\n================================================================')
  console.log('ALL TESTS PASSED SUCCESSFULLY!')
  console.log('================================================================\n')
}

runAllStarTests().catch((err) => {
  console.error('All-Star test suite failed:', err)
  process.exit(1)
})
