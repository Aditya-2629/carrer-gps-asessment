import fs from 'fs'
import { DocumentParser } from '../services/documentParser/index.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'

async function inspect() {
  const buf = fs.readFileSync('backend/tests/fixtures/alekya/Alekya_Maddu_Resume.pdf')
  const parsedDoc = await DocumentParser.parse({
    buffer: buf,
    filename: 'Alekya_Maddu_Resume.pdf',
    mimeType: 'application/pdf',
  })

  const canonical = ResumeNormalizer.normalize(parsedDoc)
  console.log('\n--- EXTRACTED EXPERIENCE ITEMS --- (count: ' + canonical.experience.length + ')')
  canonical.experience.forEach((e) => {
    console.log(`[${e.id}] Company: "${e.company}" | Role: "${e.role}" | Dates: "${e.dates}" | Bullets: ${e.bullets.length}`)
    e.bullets.forEach((b, bIdx) => {
      console.log(`   b${bIdx+1}: [${b.id}] ${b.text.slice(0, 80)}...`)
    })
  })
}

inspect().catch(console.error)
