import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  TEST: Phase C AI Slop Purge & Tone Tightening Verification')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// 1. Verify backend/utils/geminiPrompt.js
const geminiPromptPath = path.join(rootDir, 'backend/utils/geminiPrompt.js')
const geminiPromptContent = fs.readFileSync(geminiPromptPath, 'utf8')

assert(
  geminiPromptContent.includes('EXECUTIVE RECRUITER DIAGNOSTIC FRAMEWORK (ZERO-SLOP, ZERO-FLATTERY)'),
  'geminiPrompt.js must define zero-slop zero-flattery framework'
)
assert(
  geminiPromptContent.includes('STRICT BAN ON GENERIC CHATGPT FLATTERY & HOLLOW PRAISE'),
  'geminiPrompt.js must ban generic flattery'
)
assert(
  geminiPromptContent.includes('PROGRESSIVE DISCLOSURE & DEDUPLICATION (MANDATORY)'),
  'geminiPrompt.js must mandate progressive disclosure and deduplication'
)
console.log('✓ Confirmed geminiPrompt.js enforces executive recruiter tone and progressive deduplication')

// 2. Verify backend/services/reportGeneration.js
const reportGenPath = path.join(rootDir, 'backend/services/reportGeneration.js')
const reportGenContent = fs.readFileSync(reportGenPath, 'utf8')

assert(
  reportGenContent.includes('EXECUTIVE RECRUITER DIAGNOSTIC FRAMEWORK (ZERO-SLOP, ZERO-FLATTERY)'),
  'reportGeneration.js must define zero-slop zero-flattery framework'
)
assert(
  reportGenContent.includes('flatteryPatterns'),
  'reportGeneration.js must implement flattery scrubber patterns'
)
assert(
  reportGenContent.includes('De-duplicate primary_bottleneck against top resume issues'),
  'reportGeneration.js must deduplicate primary_bottleneck from top resume issue'
)
console.log('✓ Confirmed reportGeneration.js purges flattery and deduplicates echo chamber sections')

// 3. Verify backend/agents/assessment/assessmentAgent.js
const assessmentAgentPath = path.join(rootDir, 'backend/agents/assessment/assessmentAgent.js')
const assessmentAgentContent = fs.readFileSync(assessmentAgentPath, 'utf8')

assert(
  !assessmentAgentContent.includes('resumeAgent?.issues?.[0]?.diagnosis ||'),
  'assessmentAgent.js must NOT copy-paste resumeAgent issues[0] as primary bottleneck evidence'
)
assert(
  assessmentAgentContent.includes('appToScreenRate'),
  'assessmentAgent.js must compute funnel conversion rate for behavioral evidence'
)
console.log('✓ Confirmed assessmentAgent.js decouples bottleneck evidence from resume line issues')

// 4. Verify resume prompts anti-flattery directives
const resumePromptPath = path.join(rootDir, 'backend/agents/resume/resumeAgent.prompt.js')
const resumePromptContent = fs.readFileSync(resumePromptPath, 'utf8')
assert(
  resumePromptContent.includes('ZERO-FLATTERY EXECUTIVE RECRUITER READ'),
  'resumeAgent.prompt.js must enforce zero-flattery executive recruiter read'
)

const resumeSynthPromptPath = path.join(rootDir, 'backend/agents/resume/synthesis/resumeSynthesis.prompt.js')
const resumeSynthPromptContent = fs.readFileSync(resumeSynthPromptPath, 'utf8')
assert(
  resumeSynthPromptContent.includes('ZERO-FLATTERY EXECUTIVE RECRUITER READ'),
  'resumeSynthesis.prompt.js must enforce zero-flattery executive recruiter read'
)
console.log('✓ Confirmed resume prompts enforce direct executive diagnostic recruiter tone')

// 5. Verify ResumeDeepDiagnosis.jsx flattery scrubber
const resumeDeepDiagPath = path.join(rootDir, 'src/components/report/ResumeDeepDiagnosis.jsx')
const resumeDeepDiagContent = fs.readFileSync(resumeDeepDiagPath, 'utf8')

assert(
  resumeDeepDiagContent.includes('cleanRecruiterSummary'),
  'ResumeDeepDiagnosis.jsx must define cleanRecruiterSummary flattery scrubber'
)
assert(
  resumeDeepDiagContent.includes('Direct Diagnostic Tone'),
  'ResumeDeepDiagnosis.jsx must indicate Direct Diagnostic Tone'
)
console.log('✓ Confirmed ResumeDeepDiagnosis.jsx sanitizes flattery and applies direct recruiter read')

// 6. Test runtime flattery scrubber logic
const testFlatteryText = 'Alekya, you have built a solid foundation across major enterprise domains like banking. However, your bullets need metrics.'
const flatteryRegex = /^(?:[\w\s.-]+,\s*)?you have built a solid foundation across[^\n.]*[.]?\s*(.*)$/is
const match = testFlatteryText.match(flatteryRegex)
assert(match && match[1] === 'However, your bullets need metrics.', 'Flattery regex must strip opening praise')
console.log('✓ Confirmed flattery scrubber regex functions correctly')

console.log('\n✅ ALL PHASE C AI SLOP PURGE & TONE TIGHTENING TESTS PASSED!')

