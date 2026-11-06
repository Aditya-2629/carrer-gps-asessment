import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  TEST: Phase A Tabbed Cockpit Overhaul Verification')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// 1. Purged files must not exist
const purgedFiles = [
  'src/components/report/CareerGpsReadyModal.jsx',
  'src/components/report/FunnelAndRisks.jsx',
]

for (const file of purgedFiles) {
  const fullPath = path.join(rootDir, file)
  assert(!fs.existsSync(fullPath), `Purged file must NOT exist on disk: ${file}`)
  console.log(`✓ Confirmed purged file does not exist: ${file}`)
}

// 2. No references to CareerGpsReadyModal or showReadyModal in src/
const reportDashboardPath = path.join(rootDir, 'src/components/report/ReportDashboard.jsx')
const reportDashboardContent = fs.readFileSync(reportDashboardPath, 'utf8')

assert(!reportDashboardContent.includes('CareerGpsReadyModal'), 'ReportDashboard must NOT reference CareerGpsReadyModal')
assert(!reportDashboardContent.includes('showReadyModal'), 'ReportDashboard must NOT reference showReadyModal')
assert(!reportDashboardContent.includes('CareerHealthSnapshot'), 'ReportDashboard must NOT reference CareerHealthSnapshot')
console.log('✓ Confirmed no dead references (CareerGpsReadyModal, showReadyModal, CareerHealthSnapshot) in ReportDashboard')

// 3. COCKPIT_TABS defined and exported
assert(reportDashboardContent.includes('export const COCKPIT_TABS = ['), 'COCKPIT_TABS must be exported')
const expectedTabs = ['overview', 'resume', 'linkedin', 'funnel', 'roadmap']
for (const tabId of expectedTabs) {
  assert(reportDashboardContent.includes(`id: '${tabId}'`), `COCKPIT_TABS must include tab '${tabId}'`)
}
console.log('✓ Confirmed COCKPIT_TABS defined and exported with all 5 required tabs')

// 4. URL hash sync logic exists
assert(reportDashboardContent.includes('getInitialTab'), 'ReportDashboard must have getInitialTab')
assert(reportDashboardContent.includes('activeTab'), 'ReportDashboard must manage activeTab state')
assert(reportDashboardContent.includes('handleTabChange'), 'ReportDashboard must handle tab change')
assert(reportDashboardContent.includes('window.history.replaceState'), 'ReportDashboard must update hash via replaceState')
console.log('✓ Confirmed URL hash synchronization logic')

// 5. Interactive 5-tab Screen view with print:hidden
assert(reportDashboardContent.includes('className="print:hidden"'), 'Screen view container must have print:hidden')
assert(reportDashboardContent.includes("activeTab === 'overview'"), 'Must render overview tab conditionally')
assert(reportDashboardContent.includes("activeTab === 'resume'"), 'Must render resume tab conditionally')
assert(reportDashboardContent.includes("activeTab === 'linkedin'"), 'Must render linkedin tab conditionally')
assert(reportDashboardContent.includes("activeTab === 'funnel'"), 'Must render funnel tab conditionally')
assert(reportDashboardContent.includes("activeTab === 'roadmap'"), 'Must render roadmap tab conditionally')
console.log('✓ Confirmed screen view conditionally renders all 5 tabs')

// 6. Print / PDF Sequential view with hidden print:block
assert(reportDashboardContent.includes('className="hidden print:block print:space-y-6"'), 'Print view must have hidden print:block')
console.log('✓ Confirmed print view preserves sequential rendering')

// 7. StickyReportNav verification
const stickyNavPath = path.join(rootDir, 'src/components/report/StickyReportNav.jsx')
const stickyNavContent = fs.readFileSync(stickyNavPath, 'utf8')
assert(stickyNavContent.includes('COCKPIT_TABS'), 'StickyReportNav must import or reference COCKPIT_TABS')
assert(stickyNavContent.includes('layoutId="cockpit-active-tab"'), 'StickyReportNav must have framer motion active layoutId')
assert(stickyNavContent.includes('{healthScore}/100'), 'StickyReportNav must render healthScore pill')
console.log('✓ Confirmed StickyReportNav implements modern executive pill bar')

// 8. CSS Animations & Print rules
const cssPath = path.join(rootDir, 'src/index.css')
const cssContent = fs.readFileSync(cssPath, 'utf8')
assert(cssContent.includes('@keyframes tabFadeIn'), 'src/index.css must declare @keyframes tabFadeIn')
assert(cssContent.includes('.animate-fadeIn'), 'src/index.css must declare .animate-fadeIn')
assert(cssContent.includes('.cockpit-pill'), 'src/index.css must declare .cockpit-pill')
console.log('✓ Confirmed CSS tab transition animations and pill styling')

console.log('\n✅ ALL PHASE A TABBED COCKPIT TESTS PASSED SUCCESSFULLY!')

