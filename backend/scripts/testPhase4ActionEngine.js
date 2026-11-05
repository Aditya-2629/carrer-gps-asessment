/**
 * testPhase4ActionEngine.js
 *
 * Verification suite for Phase 4: Dynamic 7-Day Rapid Triage Checklist,
 * 30-60-90 Day Milestone Pathway, and GoalRoadmapPath Modernization.
 */

import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../../')

console.log('================================================================')
console.log('CAREER GPS PHASE 4: ROADMAP & ACTION ENGINE VERIFICATION SUITE')
console.log('================================================================\n')

async function runVerification() {
  const goalRoadmapPathFile = path.join(rootDir, 'src/components/report/GoalRoadmapPath.jsx')
  const roadmapTimelineFile = path.join(rootDir, 'src/components/report/RoadmapTimeline.jsx')

  assert.strictEqual(fs.existsSync(goalRoadmapPathFile), true, 'GoalRoadmapPath.jsx must exist')
  assert.strictEqual(fs.existsSync(roadmapTimelineFile), true, 'RoadmapTimeline.jsx must exist')

  const goalRoadmapContent = fs.readFileSync(goalRoadmapPathFile, 'utf-8')
  const roadmapTimelineContent = fs.readFileSync(roadmapTimelineFile, 'utf-8')

  // -----------------------------------------------------------------
  // 1. Zero "Slide 08" Legacy Labels
  // -----------------------------------------------------------------
  console.log('--- Check 1: Zero Legacy "Slide 08" Labels ---')
  assert.strictEqual(
    goalRoadmapContent.includes('Slide 08'),
    false,
    'GoalRoadmapPath.jsx must not contain "Slide 08"'
  )
  assert.strictEqual(
    roadmapTimelineContent.includes('Slide 08'),
    false,
    'RoadmapTimeline.jsx must not contain "Slide 08"'
  )
  console.log('✔ Check 1 Passed: Zero occurrences of "Slide 08".\n')

  // -----------------------------------------------------------------
  // 2. GoalRoadmapPath Executive Badge & Calibrated 4 Steps
  // -----------------------------------------------------------------
  console.log('--- Check 2: GoalRoadmapPath Executive Badge & Step Calibration ---')
  assert.strictEqual(
    goalRoadmapContent.includes('Strategic Offer Pathway'),
    true,
    'GoalRoadmapPath.jsx must contain executive badge "Strategic Offer Pathway"'
  )

  const expectedSteps = [
    'Positioning & Asset Calibration',
    'Sourcing Velocity & Multi-Channel Outbound',
    'Technical Defense & System Architecture Mastery',
    'Executive Closing, Negotiation & Offer Clearance',
  ]

  for (const step of expectedSteps) {
    assert.strictEqual(
      goalRoadmapContent.includes(step),
      true,
      `GoalRoadmapPath.jsx must include modern step "${step}"`
    )
  }
  console.log('✔ Check 2 Passed: Executive badge and 4 career progression steps verified.\n')

  // -----------------------------------------------------------------
  // 3. Dynamic 7-Day Sprint Matrix Across Phases 1 through 4
  // -----------------------------------------------------------------
  console.log('--- Check 3: Dynamic 7-Day Rapid Triage Checklist (Phases 1-4) ---')

  const requiredPhaseChecks = [
    { phase: 'Phase 1', condition: 'effectivePhaseId === 1' },
    { phase: 'Phase 2', condition: 'effectivePhaseId === 2' },
    { phase: 'Phase 3', condition: 'effectivePhaseId === 3' },
    { phase: 'Phase 4', condition: 'effectivePhaseId === 4' },
  ]

  for (const p of requiredPhaseChecks) {
    assert.strictEqual(
      roadmapTimelineContent.includes(p.condition),
      true,
      `RoadmapTimeline.jsx must contain branch for ${p.phase} (${p.condition})`
    )
  }

  // Days 1 through 7 badges
  for (let day = 1; day <= 7; day++) {
    assert.strictEqual(
      roadmapTimelineContent.includes(`day: 'Day ${day}'`),
      true,
      `RoadmapTimeline.jsx must define day: 'Day ${day}'`
    )
  }

  // Candidate context extraction
  assert.strictEqual(roadmapTimelineContent.includes('extractTopSkills'), true, 'Must extract topSkills')
  assert.strictEqual(roadmapTimelineContent.includes('isSponsorshipRequired'), true, 'Must extract work authorization / visa constraint')
  assert.strictEqual(roadmapTimelineContent.includes('targetRole'), true, 'Must extract targetRole')

  console.log('✔ Check 3 Passed: 7-Day sprint contains daily day-by-day badges and phase branching.\n')

  // -----------------------------------------------------------------
  // 4. Concrete 30-60-90 Day Milestone Pathway with Deliverables & KPIs
  // -----------------------------------------------------------------
  console.log('--- Check 4: 30-60-90 Day Milestones & Deliverable / Success Signals ---')

  assert.strictEqual(roadmapTimelineContent.includes("period: '30 DAYS'"), true, 'Must define 30 DAYS')
  assert.strictEqual(roadmapTimelineContent.includes("period: '60 DAYS'"), true, 'Must define 60 DAYS')
  assert.strictEqual(roadmapTimelineContent.includes("period: '90 DAYS'"), true, 'Must define 90 DAYS')

  assert.strictEqual(
    roadmapTimelineContent.includes('deliverable:'),
    true,
    'Milestones must define deliverable property'
  )
  assert.strictEqual(
    roadmapTimelineContent.includes('successSignal:'),
    true,
    'Milestones must define successSignal property'
  )
  assert.strictEqual(
    roadmapTimelineContent.includes('{p.deliverable}'),
    true,
    'UI must render key deliverable'
  )
  assert.strictEqual(
    roadmapTimelineContent.includes('{p.successSignal}'),
    true,
    'UI must render success signal'
  )

  // Specific high-leverage tool references in actions
  const requiredTools = ['LeetCode', 'Levels.fyi', 'Apollo', 'Sales Navigator']
  for (const tool of requiredTools) {
    assert.strictEqual(
      roadmapTimelineContent.includes(tool),
      true,
      `Milestone actions must reference specific tool "${tool}"`
    )
  }

  console.log('✔ Check 4 Passed: 30-60-90 milestones contain deliverables, KPIs, and specific tool references.\n')

  console.log('================================================================')
  console.log('🎉 ALL PHASE 4 ROADMAP & ACTION ENGINE VERIFICATIONS PASSED!')
  console.log('================================================================')
}

runVerification().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
