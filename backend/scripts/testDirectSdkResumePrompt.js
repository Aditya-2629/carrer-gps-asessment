import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { SYNTHESIS_SYSTEM_PROMPT } from '../agents/resume/synthesis/resumeSynthesis.prompt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function runDirectSdkPromptTest() {
  console.log('=== DIRECT GEMINI SDK TEST WITH ACTUAL RESUME AGENT PROMPT (NO GATEWAY TIMEOUT) ===')
  const resumeText = fs.readFileSync(
    path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt'),
    'utf8'
  )

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
    systemInstruction: SYNTHESIS_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  })

  const prompt = `CANDIDATE RESUME:\n${resumeText}\n\nTARGET ROLE: Senior AI & Full Stack Engineer\n\nAnalyze this resume according to your expert recruiter persona and JSON schema.`

  for (let attempt = 1; attempt <= 3; attempt++) {
    const attemptStart = Date.now()
    try {
      console.log(`Sending direct prompt to gemini-3.6-flash (attempt ${attempt}/3)...`)
      const res = await model.generateContent(prompt)
      const latencyMs = Date.now() - attemptStart
      const totalLatencyMs = Date.now() - startTime
      const text = res.response.text()
      console.log(`\nDirect SDK SUCCESS on attempt ${attempt}!`)
      console.log(`Attempt latency: ${latencyMs}ms | Total elapsed: ${totalLatencyMs}ms`)
      console.log(`Output characters: ${text.length}`)
      const parsed = JSON.parse(text)
      console.log(`Parsed JSON analysisVersion: ${parsed.analysisVersion}`)
      console.log(`Strengths found: ${parsed.strengths?.length || 0}`)
      console.log(`Issues found: ${parsed.issues?.length || 0}`)
      return
    } catch (err) {
      const latencyMs = Date.now() - attemptStart
      console.log(`Attempt ${attempt} FAILED in ${latencyMs}ms: [${err.status || 503}] ${err.message}`)
      if (attempt < 3) {
        console.log(`Waiting 1000ms before retry...`)
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }
}

runDirectSdkPromptTest().catch(console.error)
