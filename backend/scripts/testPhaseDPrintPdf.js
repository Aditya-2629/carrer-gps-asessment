import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('--- TESTING PHASE D: PUBLICATION-GRADE 4-PAGE PDF BRIEF ---');

// 1. Verify FullCareerReportPage.jsx has exactly 4 pdf-page containers
const fullReportPath = path.join(rootDir, 'src/pages/FullCareerReportPage.jsx');
const fullReportContent = fs.readFileSync(fullReportPath, 'utf8');

const pdfPageMatches = fullReportContent.match(/className=["'][^"']*pdf-page/g) || [];
console.log(`[Test 1] Found ${pdfPageMatches.length} .pdf-page containers in FullCareerReportPage.jsx`);
assert.strictEqual(
  pdfPageMatches.length,
  4,
  `FullCareerReportPage.jsx must have exactly 4 .pdf-page containers, found ${pdfPageMatches.length}`
);

// Verify page numbers 1-4 are present in footers
assert(fullReportContent.includes('Page 1 of 4'), 'Must include "Page 1 of 4" footer');
assert(fullReportContent.includes('Page 2 of 4'), 'Must include "Page 2 of 4" footer');
assert(fullReportContent.includes('Page 3 of 4'), 'Must include "Page 3 of 4" footer');
assert(fullReportContent.includes('Page 4 of 4'), 'Must include "Page 4 of 4" footer');
console.log('✓ Test 1 Passed: Exactly 4 pages structured with headers and footers');

// 2. Verify RiskHeatMap.jsx has zero occurrences of -rotate-90
const heatMapPath = path.join(rootDir, 'src/components/report/RiskHeatMap.jsx');
const heatMapContent = fs.readFileSync(heatMapPath, 'utf8');
assert(
  !heatMapContent.includes('-rotate-90'),
  'RiskHeatMap.jsx must not contain "-rotate-90" to prevent label overlap'
);
assert(
  heatMapContent.includes('Impact: High ↑'),
  'RiskHeatMap.jsx must include inline clean column header "Impact: High ↑"'
);
console.log('✓ Test 2 Passed: Rotated Y-axis label removed from RiskHeatMap.jsx');

// 3. Verify src/index.css contains A4 portrait and 274mm height budget
const cssPath = path.join(rootDir, 'src/index.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(
  cssContent.includes('size: A4 portrait;'),
  'src/index.css must specify "size: A4 portrait;"'
);
assert(
  cssContent.includes('height: 274mm !important;'),
  'src/index.css must specify "height: 274mm !important;" for strict container height budgeting'
);
assert(
  cssContent.includes('.pdf-page:last-of-type {'),
  'src/index.css must include .pdf-page:last-of-type rule to prevent trailing blank page'
);
console.log('✓ Test 3 Passed: Print CSS hardened to A4 portrait and 274mm container budget');

// 4. Verify ReportDashboard.jsx PDF download button triggers /full-report with print=true
const dashboardPath = path.join(rootDir, 'src/components/report/ReportDashboard.jsx');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
assert(
  dashboardContent.includes('/full-report?') && dashboardContent.includes('print=true'),
  'ReportDashboard.jsx Download PDF button must route to /full-report?...&print=true'
);
console.log('✓ Test 4 Passed: ReportDashboard.jsx connects directly to 4-page print dossier');

console.log('\n>>> ALL PHASE D PRINT PDF TESTS PASSED SUCCESSFULLY! <<<');

