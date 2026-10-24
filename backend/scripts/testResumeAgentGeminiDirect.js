import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function runTest() {
  console.log('=== TESTING ACTUAL RESUME AGENT PROMPT WITH GEMINI-3.6-FLASH ===')
  const resumeText = fs.readFileSync(
    path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt'),
    'utf8'
  )

  const startTime = Date.now()
  try {
    const result = await ResumeAgent.evaluate({
      resumeText,
      targetRole: 'Senior AI & Full Stack Engineer',
      model: 'gemini-3.6-flash',
      inputMode: 'compact_text',
      isBenchmark: true,
      useV3Pipeline: true,
    })
    const latencyMs = Date.now() - startTime
    console.log(`\nEvaluation SUCCESS in ${latencyMs}ms!`)
    console.log(`Success flag: ${result.success}`)
    console.log(`Issues count: ${result.analysis?.issues?.length || 0}`)
    console.log(`Strengths count: ${result.analysis?.strengths?.length || 0}`)
    console.log(`Raw output length: ${result.rawModelOutput?.length || 0} chars`)
  } catch (err) {
    const latencyMs = Date.now() - startTime
    console.log(`\nEvaluation FAILED in ${latencyMs}ms!`)
    console.log(`Error Code: ${err.code}`)
    console.log(`Status: ${err.statusCode}`)
    console.log(`Message: ${err.message}`)
    console.log(`Stack / Details:`, err.details || err.stack)
  }
}

runTest().catch(console.error)
