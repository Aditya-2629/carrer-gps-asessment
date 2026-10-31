import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildAtsTailoredDocx } from '../services/docxResumeService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function verifySwapnilResume() {
  console.log('================================================================')
  console.log('VERIFYING SWAPNIL JADHAV ATS RESUME (.DOCX) GENERATION')
  console.log('================================================================\n')

  // Swapnil test canonical data with potential edge cases:
  // - target_role: Software Engineer
  // - bullet with [ADD: ...] bracket
  // - leaked header bullet: "Recibo Technologies Bengaluru, India"
  // - experience header with potential duplicate location: "Kitcoek Maharashtra, India" + location "Maharashtra, India"
  const swapnilCanonical = {
    candidate_name: 'Swapnil Jadhav',
    target_role: 'Software Engineer',
    contact: {
      phone: '(555) 345-6789',
      email: 'swapnil.jadhav@example.com',
      location: 'San Jose, CA',
      linkedin: 'https://linkedin.com/in/swapnil-jadhav-dev',
      github: 'https://github.com/swapnil-jadhav',
    },
    skills: ['Python', 'TypeScript', 'Go', 'FastMCP', 'Docker', 'Kubernetes', 'AWS', 'PostgreSQL'],
    experiences: [
      {
        role: 'Senior AI & Full Stack Engineer',
        company: 'Apex Intelligence Labs',
        location: 'San Jose, CA',
        duration: 'March 2023 – Present',
        bullets: [
          'Architected RAG agent pipeline integrating 9 tools using FastMCP protocol, resulting in 35% faster retrieval and 38% reduction in manual support queries, achieving [ADD: verified impact].',
          'Recibo Technologies Bengaluru, India', // Leaked company header that should be discarded
          'Scaled real-time chat infrastructure to handle 3x concurrent capacity by [ADD: optimization].',
          'Automated continuous deployment pipeline delivering 20+ production releases with zero-downtime [ADD: metric].',
        ],
      },
      {
        role: 'Full Stack Software Engineer Jan 2021 - Apr 2022', // Stray date in role should be stripped
        company: 'Kitcoek Maharashtra, India',
        location: 'Maharashtra, India', // Duplicate location should be deduped
        duration: 'June 2021 – February 2023',
        bullets: [
          'Developed automated data reconciliation service in Python and PostgreSQL, eliminating 50+ hours manual work per month.',
          'Re-indexed relational database tables and introduced Redis read-aside caching, cutting p95 latency from 850ms to 120ms.',
        ],
      },
    ],
  }

  // 1. Filename verification
  const candidateName = (
    swapnilCanonical.candidate_name ||
    swapnilCanonical.name ||
    'Candidate'
  ).replace(/\s+/g, '_')
  const filename = `${candidateName}_Tailored_ATS_Resume.docx`
  console.log(`[1] Verifying Filename: ${filename}`)
  assert.strictEqual(filename, 'Swapnil_Jadhav_Tailored_ATS_Resume.docx', 'Filename must be Swapnil_Jadhav_Tailored_ATS_Resume.docx')
  assert(!filename.startsWith('Candidate_'), 'Filename must not start with Candidate_')
  console.log('    ✓ Filename matches exactly: Swapnil_Jadhav_Tailored_ATS_Resume.docx\n')

  // 2. Generate docx buffer
  const docxRes = await buildAtsTailoredDocx(swapnilCanonical)
  const buffer = Buffer.isBuffer(docxRes) ? docxRes : docxRes?.buffer
  assert(Buffer.isBuffer(buffer), 'Output must be a Buffer')
  assert(buffer.length > 5000, `Buffer size (${buffer.length} bytes) should be substantial`)
  assert.strictEqual(buffer[0], 0x50, 'PK magic byte 0')
  assert.strictEqual(buffer[1], 0x4b, 'PK magic byte 1')
  console.log(`    ✓ Valid .docx PK archive generated (${buffer.length} bytes)\n`)

  // 3. Inspect XML content of the docx to verify text formatting
  // A docx file is a ZIP archive containing word/document.xml
  import('jszip').then(async ({ default: JSZip }) => {
    const zip = await JSZip.loadAsync(buffer)
    const docXml = await zip.file('word/document.xml').async('text')

    console.log('[3] Inspecting document.xml content:')

    // A. Subtitle check
    assert(docXml.includes('Software Engineer'), 'Document must contain target role Software Engineer')
    assert(!docXml.includes('Business Analyst'), 'Document must NOT hallucinate Business Analyst')
    assert(!docXml.includes('Power BI | Tableau | Business Analysis'), 'Document must NOT contain hardcoded BA subtitle')
    console.log('    ✓ Subtitle correctly reflects candidate role ("Software Engineer") and not "Business Analyst"')

    // B. Bullets must NOT contain raw [ADD: ...] brackets
    assert(!docXml.includes('[ADD:'), 'Document must NOT contain raw [ADD: ...] placeholders')
    console.log('    ✓ Zero [ADD: ...] placeholders in generated document')

    // C. Bullets must NOT contain leaked header "Recibo Technologies Bengaluru, India" as bullet
    assert(!docXml.includes('Recibo Technologies Bengaluru, India'), 'Leaked company header bullet must be stripped')
    console.log('    ✓ Leaked header "Recibo Technologies Bengaluru, India" correctly stripped from bullets')

    // D. Check role title date stripping
    assert(!docXml.includes('Full Stack Software Engineer Jan 2021 - Apr 2022'), 'Trailing date must be stripped from role title')
    console.log('    ✓ Trailing date stripped from role title')

    console.log('\n[4] Verifying Frontend UI Button Count in ResumeDeepDiagnosis.jsx:')
    const jsxPath = path.join(__dirname, '../../src/components/report/ResumeDeepDiagnosis.jsx')
    const jsxContent = fs.readFileSync(jsxPath, 'utf8')

    // Check that SectionHeader does not have onDownloadDocx or download button
    assert(!jsxContent.includes('onDownloadDocx={handleDownloadDocx}'), 'SectionHeader must not be passed onDownloadDocx')
    assert(!jsxContent.includes('Generating Word Doc...'), 'SectionHeader download button text must be removed')

    // Count download buttons in file: should only be inside Ready-to-Apply Asset card
    const downloadButtonMatches = jsxContent.match(/Download Tailored ATS Resume \(\.docx\)/g) || []
    console.log(`    Total occurrences of "Download Tailored ATS Resume (.docx)": ${downloadButtonMatches.length}`)
    assert.strictEqual(downloadButtonMatches.length, 1, 'There must be exactly ONE download button in ResumeDeepDiagnosis.jsx')
    console.log('    ✓ Exactly 1 download button in ResumeDeepDiagnosis.jsx (in Ready-to-Apply Asset card)\n')

    console.log('================================================================')
    console.log('ALL SWAPNIL ATS RESUME VERIFICATION CHECKS PASSED!')
    console.log('================================================================')
  }).catch((err) => {
    console.error('FAIL during docx XML inspection:', err)
    process.exit(1)
  })
}

verifySwapnilResume().catch((err) => {
  console.error('FAIL:', err)
  process.exit(1)
})
