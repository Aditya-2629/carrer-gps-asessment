import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { serializeResumeForLLM } from '../agents/resume/resumeAgent.inputSerializer.js'
import { DocumentParser } from '../agents/resume/resumeAgent.documentParser.js'
import { ResumeNormalizer } from '../agents/resume/resumeAgent.normalizer.js'
import { generateResumeSignals } from '../agents/resume/resumeAgent.precomputedSignals.js'
import { buildResumeAgentPrompt } from '../agents/resume/resumeAgent.prompt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function testFullPromptDirect() {
  const resumeText = fs.readFileSync(
    path.join(__dirname, '../agents/resume/fixtures/swapnil-jadhav.txt'),
    'utf8'
  )
  const targetRole = 'Senior AI & Full Stack Engineer'
  const parsedDoc = await DocumentParser.parse({ text: resumeText })
  const canonicalResume = ResumeNormalizer.normalize(parsedDoc, targetRole)
  const compactText = serializeResumeForLLM(canonicalResume, { targetRole })
  const signals = generateResumeSignals(canonicalResume)
  const promptData = buildRecruiterPrompt(compactText, {
    targetRole,
    precomputedSignals: signals,
  })

  const fullPromptText = `${promptData.systemPrompt}\n\n${promptData.userPrompt}`
  console.log(`Prompt length: ${fullPromptText.length} chars`)

  const testKey = process.env.GEMINI_API_KEY_FALLBACK_1 || process.env.GEMINI_API_KEY_FALLBACK_2
  console.log(`Testing with fallback key (${testKey ? testKey.slice(0, 10) + '...' : 'none'})`)

  const genAI = new GoogleGenerativeAI(testKey)

  for (const modelName of ['gemini-3.6-flash', 'gemini-2.5-flash']) {
    console.log(`\nTesting model ${modelName}...`)
    const startTime = Date.now()
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 6144,
        },
      })
      const result = await model.generateContent(fullPromptText)
      const durationMs = Date.now() - startTime
      const text = result.response.text()
      console.log(`[${modelName}] SUCCESS in ${durationMs}ms! Output length: ${text.length} chars`)
      const parsed = JSON.parse(text)
      console.log(`  Issues count: ${parsed.issues?.length}, Strengths: ${parsed.strengths?.length}`)
    } catch (err) {
      const durationMs = Date.now() - startTime
      console.log(`[${modelName}] FAILED in ${durationMs}ms: ${err.message}`)
    }
  }
}

testFullPromptDirect().catch(console.error)
