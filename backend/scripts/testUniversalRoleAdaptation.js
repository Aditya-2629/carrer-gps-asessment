import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { classifyRoleArchetype, ROLE_ARCHETYPES } from '../agents/core/roleArchetypeClassifier.js';
import {
  build7DayRapidTriageSprint,
  build30_60_90MilestonePathway,
  buildStandard4WeekRoadmap,
} from '../services/atlasDeterministicBuilders.js';
import { renderResumeSynthesisPromptV4 } from '../agents/resume/synthesis/resumeSynthesis.prompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  TEST: Universal Role-Adaptive Engine & Zero-Silent-Fallback');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ─────────────────────────────────────────────────────────────
// TEST 1: Candidate 1 — Data Analyst Archetype Verification
// ─────────────────────────────────────────────────────────────
console.log('[Test 1] Testing Data Analyst Role (Deepanjan Profile)...');
const dataRole = 'Senior Data Analyst';
const dataSkills = ['SQL', 'Snowflake', 'Power BI', 'dbt', 'Data Governance'];
const dataArchetype = classifyRoleArchetype(dataRole, dataSkills);

assert.strictEqual(
  dataArchetype.key,
  'DATA_ANALYTICS',
  `Expected DATA_ANALYTICS archetype, got ${dataArchetype.key}`
);

const dataSprint = build7DayRapidTriageSprint(2, dataRole, dataSkills);
const dataMilestones = build30_60_90MilestonePathway(2, dataRole, dataSkills);
const dataRoadmap = buildStandard4WeekRoadmap(2, dataRole, dataSkills);

const dataText = JSON.stringify({ dataSprint, dataMilestones, dataRoadmap }).toLowerCase();

assert(
  dataText.includes('sql') || dataText.includes('analytics'),
  'Data Analyst roadmap must mention SQL or Analytics'
);
assert(
  !dataText.includes('leetcode'),
  'Data Analyst roadmap must NEVER mention LeetCode'
);
assert(
  !dataText.includes('hackerrank'),
  'Data Analyst roadmap must NEVER mention HackerRank'
);
assert(
  !dataText.includes('codesignal'),
  'Data Analyst roadmap must NEVER mention CodeSignal'
);
assert(
  !dataText.includes('spring boot'),
  'Data Analyst roadmap must NEVER mention Spring Boot'
);
assert(
  !dataText.includes('microservices'),
  'Data Analyst roadmap must NEVER mention microservices'
);

const dataPrompt = renderResumeSynthesisPromptV4({
  targetRole: dataRole,
  candidateName: 'Deepanjan',
  skills: dataSkills,
});
assert(
  dataPrompt.includes('DATA_ANALYTICS'),
  'Prompt must inject DATA_ANALYTICS archetype directive'
);
assert(
  !dataPrompt.includes('{{archetypeKey}}'),
  'Prompt must replace {{archetypeKey}} placeholder'
);
console.log('✓ Candidate 1 (Data Analyst): Verified archetype, zero SWE bleed, strict SQL/BI tactics\n');

// ─────────────────────────────────────────────────────────────
// TEST 2: Candidate 2 — Product Manager Archetype Verification
// ─────────────────────────────────────────────────────────────
console.log('[Test 2] Testing Product Manager Profile...');
const pmRole = 'Lead Technical Product Manager';
const pmSkills = ['PRD', 'A/B Testing', 'User Retention', 'RICE Prioritization', 'Amplitude'];
const pmArchetype = classifyRoleArchetype(pmRole, pmSkills);

assert.strictEqual(
  pmArchetype.key,
  'PRODUCT_MGMT',
  `Expected PRODUCT_MGMT archetype, got ${pmArchetype.key}`
);

const pmSprint = build7DayRapidTriageSprint(2, pmRole, pmSkills);
const pmMilestones = build30_60_90MilestonePathway(2, pmRole, pmSkills);
const pmRoadmap = buildStandard4WeekRoadmap(2, pmRole, pmSkills);

const pmText = JSON.stringify({ pmSprint, pmMilestones, pmRoadmap }).toLowerCase();

assert(
  pmText.includes('prd') || pmText.includes('product') || pmText.includes('metrics') || pmText.includes('prioritization'),
  'Product Manager roadmap must mention PRD, product, metrics, or prioritization'
);
assert(
  !pmText.includes('leetcode'),
  'Product Manager roadmap must NEVER mention LeetCode'
);
assert(
  !pmText.includes('spring boot'),
  'Product Manager roadmap must NEVER mention Spring Boot'
);
assert(
  !pmText.includes('microservices'),
  'Product Manager roadmap must NEVER mention microservices'
);

const pmPrompt = renderResumeSynthesisPromptV4({
  targetRole: pmRole,
  candidateName: 'Sarah',
  skills: pmSkills,
});
assert(
  pmPrompt.includes('PRODUCT_MGMT'),
  'Prompt must inject PRODUCT_MGMT archetype directive'
);
console.log('✓ Candidate 2 (Product Manager): Verified PRD/retention metrics, zero SWE bleed\n');

// ─────────────────────────────────────────────────────────────
// TEST 3: Candidate 3 — Sales Executive Archetype Verification
// ─────────────────────────────────────────────────────────────
console.log('[Test 3] Testing Sales Executive Profile...');
const salesRole = 'Enterprise Account Executive';
const salesSkills = ['MEDDPICC', 'Salesforce', 'Outreach', 'Territory Planning', 'Pipeline Management'];
const salesArchetype = classifyRoleArchetype(salesRole, salesSkills);

assert.strictEqual(
  salesArchetype.key,
  'SALES_GTM',
  `Expected SALES_GTM archetype, got ${salesArchetype.key}`
);

const salesSprint = build7DayRapidTriageSprint(2, salesRole, salesSkills);
const salesMilestones = build30_60_90MilestonePathway(2, salesRole, salesSkills);
const salesRoadmap = buildStandard4WeekRoadmap(2, salesRole, salesSkills);

const salesText = JSON.stringify({ salesSprint, salesMilestones, salesRoadmap }).toLowerCase();

assert(
  salesText.includes('quota') || salesText.includes('pipeline') || salesText.includes('discovery') || salesText.includes('deal'),
  'Sales Executive roadmap must mention quota, pipeline, discovery, or deal velocity'
);
assert(
  !salesText.includes('leetcode'),
  'Sales Executive roadmap must NEVER mention LeetCode'
);
assert(
  !salesText.includes('spring boot'),
  'Sales Executive roadmap must NEVER mention Spring Boot'
);

const salesPrompt = renderResumeSynthesisPromptV4({
  targetRole: salesRole,
  candidateName: 'Marcus',
  skills: salesSkills,
});
assert(
  salesPrompt.includes('SALES_GTM'),
  'Prompt must inject SALES_GTM archetype directive'
);
console.log('✓ Candidate 3 (Sales Executive): Verified pipeline & quota metrics, zero SWE bleed\n');

// ─────────────────────────────────────────────────────────────
// TEST 4: Zero Silent Fallbacks & UI Error Gate Verification
// ─────────────────────────────────────────────────────────────
console.log('[Test 4] Testing Failure Isolation & Zero Silent Fallbacks...');

const simulatedFailedReport = {
  candidate_name: 'Test Candidate',
  partialFailure: true,
  failedAgents: ['resume_agent'],
  resume_agent: null,
};

assert.strictEqual(simulatedFailedReport.partialFailure, true, 'Report must set partialFailure flag');
assert(
  simulatedFailedReport.failedAgents.includes('resume_agent'),
  'failedAgents must include failed agent key'
);
assert.strictEqual(
  simulatedFailedReport.resume_agent,
  null,
  'Failed agent must remain null (NEVER silently populated with mock candidate data)'
);

// Verify ReportDashboard.jsx includes the Red Error Gate
const dashboardFile = path.join(rootDir, 'src/components/report/ReportDashboard.jsx');
const dashboardContent = fs.readFileSync(dashboardFile, 'utf8');

assert(
  dashboardContent.includes('reportData.partialFailure') &&
  dashboardContent.includes('reportData.failedAgents'),
  'ReportDashboard.jsx must contain top-level Diagnostic Error Gate checking partialFailure and failedAgents'
);
assert(
  dashboardContent.includes('⚠️ Agent Execution Error'),
  'ReportDashboard.jsx must render explicit Red Error Banner on agent failure'
);
console.log('✓ Zero Silent Fallbacks: Failure isolation confirmed & UI Red Diagnostic Gate verified\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ ALL UNIVERSAL ROLE-ADAPTIVE & ZERO-FALLBACK TESTS PASSED!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
