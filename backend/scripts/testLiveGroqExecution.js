import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function main() {
  const fixturePath = path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt')
  const resumeText = fs.readFileSync(fixturePath, 'utf8')

  console.log('Testing Live Groq model openai/gpt-oss-120b through ResumeAgent.evaluate...')
  const start = Date.now()
  const res = await ResumeAgent.evaluate({
    resumeText,
    targetRole: 'Senior AI & Full Stack Engineer',
    model: 'openai/gpt-oss-120b',
    isBenchmark: false,
    useV3Pipeline: true,
    inputMode: 'compact_text',
  })

  console.log('Live Groq Result:', {
    success: res.success,
    provider: res.metadata?.provider,
    model: res.metadata?.actualModel || res.metadata?.model,
    durationMs: Date.now() - start,
    issuesCount: res.analysis?.issues?.length,
    strengthsCount: res.analysis?.strengths?.length,
    schemaValid: res.metadata?.schemaValid,
    error: res.error?.message,
  })
}

main().catch(console.error)
