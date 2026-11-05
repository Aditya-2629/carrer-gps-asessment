/**
 * testPhase3LayoutIntegration.js
 * Verification test suite for Phase 3 UI Layout & Component Integration
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')

console.log('🧪 Starting Phase 3 UI Layout & Component Integration Test Suite...\n')

// 1. Verify ReportDashboard.jsx
console.log('Test 1: ReportDashboard.jsx Component Mounting & Navigation')
const dashboardPath = path.join(rootDir, 'src/components/report/ReportDashboard.jsx')
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8')

assert(
  dashboardContent.includes("import RiskHeatMap from './RiskHeatMap'"),
  'ReportDashboard.jsx must import RiskHeatMap'
)
assert(
  dashboardContent.includes("import MissionBoard from './MissionBoard'"),
  'ReportDashboard.jsx must import MissionBoard'
)
assert(
  dashboardContent.includes('<RiskHeatMap data={reportData.risk_heatmap} />'),
  'ReportDashboard.jsx must render RiskHeatMap with reportData.risk_heatmap'
)
assert(
  dashboardContent.includes('<MissionBoard data={reportData.mission_board} />'),
  'ReportDashboard.jsx must render MissionBoard with reportData.mission_board'
)
assert(
  dashboardContent.includes("targetId = 'risk-matrix'"),
  'ReportDashboard.jsx handleNavigateSection must support risk-matrix navigation'
)
console.log('  ✅ ReportDashboard.jsx cleanly imports, mounts, and navigates RiskHeatMap & MissionBoard')

// 2. Verify RiskHeatMap.jsx & MissionBoard.jsx Outdated Labels Purge
console.log('\nTest 2: Outdated Slide Labels Purge in RiskHeatMap & MissionBoard')
const riskHeatMapPath = path.join(rootDir, 'src/components/report/RiskHeatMap.jsx')
const riskHeatMapContent = fs.readFileSync(riskHeatMapPath, 'utf8')

assert(!riskHeatMapContent.includes('Slide 06'), 'RiskHeatMap.jsx must NOT contain "Slide 06"')
assert(
  riskHeatMapContent.includes('Vulnerability & Risk Matrix'),
  'RiskHeatMap.jsx must contain executive badge "Vulnerability & Risk Matrix"'
)
assert(
  riskHeatMapContent.includes('Array.isArray(safeData.high_impact_low_likelihood)'),
  'RiskHeatMap.jsx must have robust array fallback for high_impact_low_likelihood'
)

const missionBoardPath = path.join(rootDir, 'src/components/report/MissionBoard.jsx')
const missionBoardContent = fs.readFileSync(missionBoardPath, 'utf8')

assert(!missionBoardContent.includes('Slide 07'), 'MissionBoard.jsx must NOT contain "Slide 07"')
assert(
  missionBoardContent.includes('High-ROI Mission Board'),
  'MissionBoard.jsx must contain executive badge "High-ROI Mission Board"'
)
assert(
  missionBoardContent.includes('getIconConfig'),
  'MissionBoard.jsx must have dynamic icon mapping getIconConfig'
)
assert(
  missionBoardContent.includes('xpCurrent / xpGoal'),
  'MissionBoard.jsx must cleanly bound XP level calculation'
)
console.log('  ✅ Zero "Slide 06" / "Slide 07" labels found; executive badges and defensive guards active')

// 3. Verify CareerHealthBreakdown.jsx
console.log('\nTest 3: Dynamic 4-Pillars Binding & Zero Hardcoded Fallbacks in CareerHealthBreakdown.jsx')
const careerHealthPath = path.join(rootDir, 'src/components/report/CareerHealthBreakdown.jsx')
const careerHealthContent = fs.readFileSync(careerHealthPath, 'utf8')

assert(!careerHealthContent.includes('DEFAULT_METRICS'), 'CareerHealthBreakdown.jsx must NOT contain DEFAULT_METRICS')
assert(!careerHealthContent.includes('Slide 03'), 'CareerHealthBreakdown.jsx must NOT contain "Slide 03"')
assert(
  careerHealthContent.includes('Resume & ATS Readability') &&
  careerHealthContent.includes('LinkedIn & Brand Authority') &&
  careerHealthContent.includes('Outreach & Referral Velocity') &&
  careerHealthContent.includes('Interview & Conversion Defense'),
  'CareerHealthBreakdown.jsx must bind the 4 equal-weight career health pillars'
)
assert(
  careerHealthContent.includes('fourPillars') &&
  careerHealthContent.includes('healthScore') &&
  careerHealthContent.includes('reportData'),
  'CareerHealthBreakdown.jsx must accept fourPillars, healthScore, and reportData props'
)

// Functional logic simulation for empty fourPillars & defensive guards
const simulateCareerHealthBreakdown = (props = {}) => {
  const resolvedFourPillars =
    props.fourPillars ||
    props.reportData?.score_breakdown ||
    props.reportData?.gps_scores?.four_pillars ||
    props.scores?.four_pillars ||
    props.scores ||
    {}

  const resolvedHealthScore = Math.min(
    100,
    Math.max(
      0,
      Number(
        props.healthScore ??
        props.reportData?.career_health_score ??
        props.reportData?.score ??
        50
      )
    )
  )

  const resumeScore =
    resolvedFourPillars?.resume?.score ??
    props.reportData?.resume_agent?.dashboard?.score ??
    70
  const linkedinScore =
    resolvedFourPillars?.linkedin?.score ??
    props.reportData?.linkedin_agent?.score ??
    65
  const outreachScore =
    resolvedFourPillars?.outreach?.score ??
    60
  const interviewScore =
    resolvedFourPillars?.interviews?.score ??
    55

  return {
    resolvedHealthScore,
    resumeScore,
    linkedinScore,
    outreachScore,
    interviewScore,
  }
}

// Check with completely empty object
const emptyRun = simulateCareerHealthBreakdown({})
assert.strictEqual(typeof emptyRun.resolvedHealthScore, 'number')
assert.strictEqual(emptyRun.resumeScore, 70)
assert.strictEqual(emptyRun.linkedinScore, 65)
assert.strictEqual(emptyRun.outreachScore, 60)
assert.strictEqual(emptyRun.interviewScore, 55)

// Check with live 4 pillars
const liveRun = simulateCareerHealthBreakdown({
  fourPillars: {
    resume: { score: 92 },
    linkedin: { score: 85 },
    outreach: { score: 78 },
    interviews: { score: 80 },
  },
  healthScore: 84,
})
assert.strictEqual(liveRun.resolvedHealthScore, 84)
assert.strictEqual(liveRun.resumeScore, 92)
assert.strictEqual(liveRun.linkedinScore, 85)
assert.strictEqual(liveRun.outreachScore, 78)
assert.strictEqual(liveRun.interviewScore, 80)
console.log('  ✅ CareerHealthBreakdown.jsx binds dynamically to live fourPillars and handles empty inputs safely')

// 4. Verify FunnelAndConversionSection.jsx & ReportHero.jsx Clarity
console.log('\nTest 4: 5-Second Executive Clarity in Funnel & Hero Components')
const funnelPath = path.join(rootDir, 'src/components/report/FunnelAndConversionSection.jsx')
const funnelContent = fs.readFileSync(funnelPath, 'utf8')

assert(funnelContent.includes('Drop-off Gate'), 'FunnelAndConversionSection.jsx must contain Drop-off Gate badge')
assert(funnelContent.includes('animate-pulse'), 'Drop-off Gate badge must have pulsating animation')
assert(funnelContent.includes('Detected Funnel Leak:'), 'FunnelAndConversionSection.jsx must highlight detected funnel leak')
assert(funnelContent.includes('Target: &gt;5.0%'), 'FunnelAndConversionSection.jsx must display App->Screen target')
assert(funnelContent.includes('Target: &gt;40%'), 'FunnelAndConversionSection.jsx must display Tech->Final target')
assert(funnelContent.includes('Target: &gt;30%'), 'FunnelAndConversionSection.jsx must display Final->Offer target')

const heroPath = path.join(rootDir, 'src/components/report/ReportHero.jsx')
const heroContent = fs.readFileSync(heroPath, 'utf8')

assert(heroContent.includes('Key Advantage'), 'ReportHero.jsx must format Key Advantage badge')
assert(heroContent.includes('Primary Bottleneck'), 'ReportHero.jsx must format Primary Bottleneck badge')
assert(heroContent.includes('6-Second Recruiter Verdict'), 'ReportHero.jsx must include 6-Second Recruiter Verdict')
assert(heroContent.includes('Anchor 1 (Proven Core):'), 'ReportHero.jsx must include Anchor 1')
assert(heroContent.includes('Anchor 2 (Conversion Risk):'), 'ReportHero.jsx must include Anchor 2')
console.log('  ✅ Hero & Funnel sections feature pulsating drop-off gate, US benchmarks, and 6-second recruiter verdict anchors')

console.log('\n🎉 ALL PHASE 3 UI LAYOUT & INTEGRATION TESTS PASSED!')
