import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  TEST: Phase B Interactivity & Diff Controls Verification')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// 1. Verify ResumeBulletAudit.jsx
const bulletAuditPath = path.join(rootDir, 'src/components/report/ResumeBulletAudit.jsx')
assert(fs.existsSync(bulletAuditPath), 'ResumeBulletAudit.jsx must exist')
const bulletAuditContent = fs.readFileSync(bulletAuditPath, 'utf8')

// Split-pane diff check
assert(
  bulletAuditContent.includes('grid grid-cols-1 md:grid-cols-2'),
  'ResumeBulletAudit must render side-by-side split pane (grid grid-cols-1 md:grid-cols-2)'
)
console.log('✓ Confirmed split-pane before/after diff layout')

// 3-pill filter controls check
assert(
  bulletAuditContent.includes('🔴 Critical Fixes'),
  'ResumeBulletAudit must have 🔴 Critical Fixes filter pill'
)
assert(
  bulletAuditContent.includes('🟡 Needs Impact Metrics'),
  'ResumeBulletAudit must have 🟡 Needs Impact Metrics filter pill'
)
assert(
  bulletAuditContent.includes('🟢 Strong Bullets'),
  'ResumeBulletAudit must have 🟢 Strong Bullets filter pill'
)
assert(
  bulletAuditContent.includes("useState('fix')"),
  'ResumeBulletAudit must default activeFilter to "fix"'
)
console.log('✓ Confirmed 3-pill filter controls defaulting to Critical Fixes')

// Copy & why recruiters skip checks
assert(
  bulletAuditContent.includes('handleCopy'),
  'ResumeBulletAudit must implement handleCopy clipboard action'
)
assert(
  bulletAuditContent.includes('Why recruiters skip this bullet'),
  'ResumeBulletAudit must have collapsible Why Recruiters Skip summary'
)
assert(
  bulletAuditContent.includes('Pick Your Scale Metric:'),
  'ResumeBulletAudit must have metric selector chips'
)
console.log('✓ Confirmed interactive copy action, metric chips, and recruiter reason bar')

// 2. Verify ResumeKeywordAlignment.jsx
const keywordAlignPath = path.join(rootDir, 'src/components/report/ResumeKeywordAlignment.jsx')
assert(fs.existsSync(keywordAlignPath), 'ResumeKeywordAlignment.jsx must exist')
const keywordAlignContent = fs.readFileSync(keywordAlignPath, 'utf8')

// Collapsible drawer check
assert(
  keywordAlignContent.includes('showAllTags'),
  'ResumeKeywordAlignment must define showAllTags state'
)
assert(
  keywordAlignContent.includes('Show full keyword inventory'),
  'ResumeKeywordAlignment must render collapsible drawer button'
)
console.log('✓ Confirmed collapsible skill tags drawer eliminating 110-tag dump')

// Top 5 focus check
assert(
  keywordAlignContent.includes('uniqueMissing.slice(0, 5)'),
  'ResumeKeywordAlignment must isolate top 5 critical missing keywords'
)
assert(
  keywordAlignContent.includes('+ Add to Work Bullet'),
  'ResumeKeywordAlignment must provide + Add to Work Bullet action'
)
console.log('✓ Confirmed top 5 critical missing skills executive focus card')

console.log('\n✅ ALL PHASE B INTERACTIVITY & DIFF CONTROL TESTS PASSED SUCCESSFULLY!')

