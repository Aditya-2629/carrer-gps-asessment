import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from '@google/generative-ai'
import packageJson from '../package.json' assert { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const keys = [
  { name: 'GEMINI_API_KEY (Primary)', key: process.env.GEMINI_API_KEY },
  { name: 'GEMINI_API_KEY_FALLBACK_1', key: process.env.GEMINI_API_KEY_FALLBACK_1 },
  { name: 'GEMINI_API_KEY_FALLBACK_2', key: process.env.GEMINI_API_KEY_FALLBACK_2 },
  { name: 'GEMINI_RESUME_API_KEY', key: process.env.GEMINI_RESUME_API_KEY },
]

const models = [
  process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
]

console.log('=== DIRECT GEMINI SDK DIAGNOSTIC TEST ===')
console.log(`SDK: @google/generative-ai v${packageJson.dependencies['@google/generative-ai']}`)
console.log(`Node: ${process.version}`)
console.log(`GEMINI_MODEL env: ${process.env.GEMINI_MODEL}`)

async function runDirectTests() {
  for (const k of keys) {
    console.log(`\n------------------------------------------------------------`)
    console.log(`Testing Key: ${k.name} (${k.key ? k.key.slice(0, 10) + '...' : 'NOT SET'})`)
    if (!k.key) continue

    const genAI = new GoogleGenerativeAI(k.key)

    for (const modelId of models) {
      const startTime = Date.now()
      try {
        const model = genAI.getGenerativeModel({ model: modelId })
        const res = await model.generateContent('Hello, reply with one word: OK')
        const latencyMs = Date.now() - startTime
        const text = res?.response?.text ? res.response.text().trim() : ''
        console.log(`  [${modelId}] SUCCESS in ${latencyMs}ms | Response: "${text}"`)
      } catch (err) {
        const latencyMs = Date.now() - startTime
        const status = err.status || err.statusCode || (err.message?.match(/\[(\d{3})[^\]]*\]/)?.[1] ?? 'unknown')
        console.log(`  [${modelId}] FAILED in ${latencyMs}ms`)
        console.log(`    Status: ${status}`)
        console.log(`    Message: ${err.message}`)
        if (err.errorDetails) {
          console.log(`    ErrorDetails:`, JSON.stringify(err.errorDetails))
        }
      }
    }
  }
}

runDirectTests().catch(console.error)
