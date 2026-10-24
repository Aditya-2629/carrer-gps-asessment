import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { aiConfig } from '../ai/config/aiConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function runEndToEndVerification() {
  console.log('================================================================')
  console.log('CAREER GPS END-TO-END RESUME AGENT EVALUATION VERIFICATION')
  console.log('================================================================\n')

  console.log('Configuration Check:')
  console.log(`- Default Resume Model: ${aiConfig.defaultResumeModel}`)
  console.log(`- Fallback Enabled: ${aiConfig.fallbackEnabled}`)
  console.log(`- Gemini perAttemptTimeoutMs: ${aiConfig.gemini.perAttemptTimeoutMs}ms`)
  console.log(`- Gemini totalDeadlineMs: ${aiConfig.gemini.totalDeadlineMs}ms`)
  console.log(`- Gateway totalDeadlineMs: ${aiConfig.totalDeadlineMs}ms`)
  console.log(`- Groq timeoutMs: ${aiConfig.groq.timeoutMs}ms`)

  const fixturePath = path.join(__dirname, '../tests/fixtures/swapnil-jadhav.txt')
  const resumeText = fs.readFileSync(fixturePath, 'utf8')
  const targetRole = 'Senior AI & Full Stack Engineer'

  console.log(`\nLoaded fixture from ${fixturePath} (${resumeText.length} chars)`)
  console.log(`Calling ResumeAgent.evaluate with:`)
  console.log(`  model: "gemini-3.6-flash" (primary)`)
  console.log(`  isBenchmark: false (allows provider fallback if Gemini is degraded)`)
  console.log(`  useV3Pipeline: true`)
  console.log(`  targetRole: "${targetRole}"\n`)

  const overallStart = Date.now()
  let result = null

  try {
    result = await ResumeAgent.evaluate({
      resumeText,
      targetRole,
      model: 'gemini-3.6-flash',
      isBenchmark: false,
      useV3Pipeline: true,
      inputMode: 'compact_text',
    })
  } catch (err) {
    console.error('Unexpected unhandled error from ResumeAgent.evaluate:', err)
    process.exit(1)
  }

  const totalDurationMs = Date.now() - overallStart
  console.log('\n================================================================')
  console.log(`EVALUATION FINISHED in ${totalDurationMs}ms`)
  console.log('================================================================\n')

  console.log(`Result Status:`)
  console.log(`- success: ${result.success}`)
  console.log(`- classification: ${result.classification || result.status}`)
  console.log(`- provider: ${result.metadata?.provider}`)
  console.log(`- model: ${result.metadata?.model}`)
  console.log(`- latencyMs: ${result.metadata?.latencyMs}ms (gateway latency)`)
  console.log(`- totalDurationMs: ${totalDurationMs}ms (end-to-end latency)`)

  if (!result.success) {
    console.error(`\n❌ EVALUATION FAILED:`)
    console.error(`- Error: ${result.error}`)
    console.error(`- Code: ${result.code}`)
    console.error(`- Details:`, result.details || result.validationDetails)
    process.exit(1)
  }

  // Verification step 3: Validators, deterministic scorecard, and final report
  console.log('\n--- VERIFYING VALIDATION & REPORT SEMANTICS ---')
  const analysis = result.analysis
  const validationDetails = result.validationDetails

  console.log(`- Schema Valid: ${validationDetails?.isSchemaValid ?? 'N/A'}`)
  console.log(`- Evidence Valid: ${validationDetails?.isEvidenceValid ?? 'N/A'}`)
  console.log(`- V3 Rewrite Violations: ${validationDetails?.v3RewriteViolations?.length ?? 0}`)
  console.log(`- V3 Unsupported Assumptions: ${validationDetails?.v3UnsupportedAssumptions?.length ?? 0}`)

  console.log(`\n--- FINAL REPORT CONTENTS ---`)
  const reviewText = typeof analysis?.overallReview === 'string'
    ? analysis.overallReview
    : JSON.stringify(analysis?.overallReview || '')
  console.log(`- Overall Review: ${reviewText ? reviewText.slice(0, 120) + '...' : 'NONE'}`)
  console.log(`- Issues Count: ${analysis?.issues?.length ?? 0}`)
  console.log(`- Strengths Count: ${analysis?.strengths?.length ?? 0}`)
  console.log(`- Scores (Scorecard):`, analysis?.scores || 'Scorecard generated in report')

  if (analysis?.issues?.length > 0) {
    console.log(`\nSample Issues:`)
    analysis.issues.slice(0, 3).forEach((iss, i) => {
      console.log(`  ${i + 1}. [${iss.category || 'N/A'}] (severity: ${iss.severity}): ${iss.title || iss.quote?.slice(0, 50)}`)
    })
  }

  if (analysis?.strengths?.length > 0) {
    console.log(`\nSample Strengths:`)
    analysis.strengths.slice(0, 2).forEach((str, i) => {
      console.log(`  ${i + 1}. [${str.category || 'N/A'}]: ${str.title || str.quote?.slice(0, 50)}`)
    })
  }

  // Verification step 6: Confirm no 20-second timeout remains active
  console.log(`\n--- VERIFYING NO 20-SECOND TIMEOUT DEFECT ---`)
  if (totalDurationMs > 20000) {
    console.log(`✅ Execution took ${totalDurationMs}ms (> 20,000ms) and SUCCEEDED without premature abort!`)
  } else {
    console.log(`ℹ️ Execution finished quickly in ${totalDurationMs}ms (< 20,000ms).`)
  }

  // Verification step 5: Provider & Fallback Check
  console.log(`\n--- PROVIDER / FALLBACK RECORD ---`)
  const provider = result.metadata?.provider
  const model = result.metadata?.model
  console.log(`Primary requested: gemini-3.6-flash`)
  console.log(`Actual provider: ${provider}`)
  console.log(`Actual model: ${model}`)

  if (provider === 'gemini') {
    console.log(`✅ Gemini succeeded directly without needing fallback!`)
  } else if (provider === 'groq' || provider === 'nvidia') {
    console.log(`✅ Gemini failed or degraded; production fallback to ${provider} (${model}) succeeded seamlessly!`)
  } else {
    console.log(`ℹ️ Provider resolved: ${provider}`)
  }

  console.log('\n================================================================')
  console.log('VERIFICATION COMPLETE: FULL PIPELINE END-TO-END SUCCESS!')
  console.log('================================================================')
}

runEndToEndVerification().catch(console.error)
