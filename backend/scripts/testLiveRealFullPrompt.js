import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { serializeResumeForLLM } from '../agents/resume/resumeAgent.inputSerializer.js'
import { DocumentParser } from '../services/documentParser/index.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { computePrecomputedSignals } from '../agents/resume/signals/precomputedSignals.js'
import { ResumeAgentPrompt } from '../agents/resume/resumeAgent.prompt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function main() {
  console.log('=== TESTING REAL FULL RESUME PROMPT AGAINST LIVE GEMINI ===')
  const resumeText = fs.readFileSync(
    path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt'),
    'utf8'
  )
  const targetRole = 'Senior AI & Full Stack Engineer'
  const parsedDoc = await DocumentParser.parse({ text: resumeText })
  const canonicalResume = ResumeNormalizer.normalize(parsedDoc, targetRole)
  const compactText = serializeResumeForLLM(canonicalResume, { targetRole })
  const precomputedSignals = computePrecomputedSignals(canonicalResume)
  
  const messages = ResumeAgentPrompt.buildMessages(canonicalResume, targetRole, {
    compactText,
    precomputedSignals,
  })

  const systemInstruction = messages.find((m) => m.role === 'system')?.content
  const userPrompt = messages.find((m) => m.role === 'user')?.content
  console.log(`Prompt constructed. System: ${systemInstruction.length} chars, User: ${userPrompt.length} chars`)

  const apiKey = process.env.GEMINI_API_KEY_FALLBACK_1
  console.log(`Using GEMINI_API_KEY_FALLBACK_1 (${apiKey ? apiKey.slice(0, 10) + '...' : 'none'})`)
  const genAI = new GoogleGenerativeAI(apiKey)

  // Try gemini-2.5-flash first since 3.6 is overloaded with 503
  for (const modelId of ['gemini-2.5-flash', 'gemini-3.6-flash']) {
    console.log(`\nAttempting generation with ${modelId}...`)
    const startTime = Date.now()
    try {
      const model = genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      })
      const res = await model.generateContent(
        systemInstruction ? `${systemInstruction}\n\n${userPrompt}` : userPrompt
      )
      const durationMs = Date.now() - startTime
      const text = res.response.text()
      console.log(`>>> SUCCESS on ${modelId} in ${durationMs}ms! Length: ${text.length} chars`)
      console.log(`End snippet: ${text.slice(-150)}`)
      const json = JSON.parse(text)
      console.log(`Analysis Version: ${json.analysisVersion}`)
      console.log(`Issues count: ${json.issues?.length}`)
      console.log(`Strengths count: ${json.strengths?.length}`)
      console.log(`First issue: ${json.issues?.[0]?.title || json.issues?.[0]?.category}`)
      break
    } catch (err) {
      const durationMs = Date.now() - startTime
      console.log(`>>> FAILED on ${modelId} in ${durationMs}ms: ${err.message}`)
    }
  }
}

main().catch(console.error)
