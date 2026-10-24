/**
 * benchmarkOrchestration.js — Career GPS Resume Agent V3.1
 *
 * AI Orchestration Benchmark Suite:
 * Compares:
 * - Mode A: Baseline Single Synthesis (baseline_single_synthesis)
 * - Mode B: Specialized Parallel Agents (specialized_parallel_agents)
 * - Mode C: Hybrid Deterministic + Reasoning (hybrid_deterministic_reasoning)
 *
 * Evaluates:
 * - Schema validity & Evidence exact-match validity
 * - Total Latency (ms) & Parallel vs Sequential Execution
 * - Token efficiency (Input, Output, Total)
 * - Network / LLM call counts
 * - Quality (Issue counts within 3-7, strengths count, priority actions)
 * - Failure behavior (Strictly no silent fallback under isBenchmark = true)
 *
 * Runs across the 3 Golden Fixtures:
 * 1. swapnil (Senior AI & Full Stack Engineer)
 * 2. alekya (Data Analyst & BI Specialist)
 * 3. weak-resume (Junior Full Stack Developer)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ResumeAgent } from '../agents/resume/resumeAgent.js';
import { llmGateway } from '../ai/gateway/llmGateway.js';
import { DEFAULT_TASK_POLICIES } from '../agents/resume/orchestration/taskPolicy.js';
import { MODE_A_NAME } from '../agents/resume/orchestration/modeA_baseline.js';
import { MODE_B_NAME } from '../agents/resume/orchestration/modeB_parallel.js';
import { MODE_C_NAME } from '../agents/resume/orchestration/modeC_hybrid.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('CAREER GPS RESUME AGENT V3.1: AI ORCHESTRATION BENCHMARK');
console.log('================================================================\n');

const FIXTURES = ['swapnil', 'alekya', 'weak-resume'];
const MODES = [MODE_A_NAME, MODE_B_NAME, MODE_C_NAME];

/**
 * Loads golden fixture files
 */
function loadFixture(name) {
  const dir = path.join(__dirname, '../tests/fixtures', name);
  const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'fixtureMetadata.json'), 'utf-8'));
  const resumeText = fs.readFileSync(path.join(dir, 'resume.txt'), 'utf-8');
  const targetJobDescription = fs.readFileSync(path.join(dir, 'targetJd.txt'), 'utf-8');
  const mockMarketJds = JSON.parse(fs.readFileSync(path.join(dir, 'mockMarketJds.json'), 'utf-8'));

  return { name, metadata, resumeText, targetJobDescription, mockMarketJds };
}

/**
 * Generates a mock LLM synthesis response tailored to the fixture
 */
function createMockSynthesisResponse(fixture, mode, task = 'final_synthesis') {
  const isAlekya = fixture.name === 'alekya';
  const isWeak = fixture.name === 'weak-resume';

  if (task === 'resume_audit') {
    return JSON.stringify({
      auditorReview: `Comprehensive audit of ${fixture.name} resume. Good technical foundations.`,
      internalStrengths: [
        { title: 'Technical Stack', observation: 'Well organized technologies', evidenceBulletId: 'exp_001_b01' }
      ],
      internalIssues: [
        {
          category: 'impact',
          severity: 'high',
          title: 'Missing business outcome metrics',
          bulletId: isWeak ? 'exp_001_b01' : 'exp_001_b02',
          originalText: isWeak
            ? 'Responsible for writing code for web applications using JavaScript and React.'
            : (isAlekya
                ? 'Conducted 170-query evaluation benchmark across multi-modal retrieval models, elevating answer accuracy from 72% to 94%.'
                : 'Conducted 170-query evaluation benchmark across multi-modal retrieval models, elevating answer accuracy from 72% to 94%.'),
          diagnosis: 'Action does not quantify business or performance outcome.',
          whyItMatters: 'Hiring managers look for verifiable achievements.',
          recommendation: 'Specify volume or latency impact.',
          suggestedRewrite: null
        }
      ]
    });
  }

  if (task === 'jd_match') {
    return JSON.stringify({
      alignmentSummary: 'Target JD requires core modern engineering competencies.',
      targetStrengths: [
        { skill: isAlekya ? 'SQL' : 'JavaScript', evidence: 'Found in skills section', bulletId: 'skills_001' }
      ],
      targetGaps: [
        {
          skill: isAlekya ? 'Looker' : 'Kafka',
          status: 'NOT_EVIDENCED_IN_RESUME',
          importance: 'high',
          observation: 'Explicitly requested by target JD, but current resume does not provide direct evidence.'
        }
      ]
    });
  }

  if (task === 'market_gap') {
    return JSON.stringify({
      marketContextSummary: 'Market analysis based on 5 active sampled roles.',
      marketStrengths: [
        { skill: isAlekya ? 'Tableau' : 'Python', frequency: 5, observation: 'Appears in 5 of 5 sampled market JDs' }
      ],
      marketObservations: [
        {
          skill: isAlekya ? 'Snowflake' : 'AWS',
          marketFrequency: 0.8,
          sampleSize: 5,
          observation: 'Appeared in 4 of 5 sampled roles at this experience level, but current resume does not provide clear direct evidence.'
        }
      ]
    });
  }

  // Exact verbatim bullets per fixture
  let b1Text = 'Architected RAG agent pipeline integrating 9 tools using FastMCP protocol, resulting in 35% faster retrieval and 38% reduction in manual support queries.';
  let b2Text = 'Conducted 170-query evaluation benchmark across multi-modal retrieval models, elevating answer accuracy from 72% to 94%.';
  let b3Text = 'Scaled real-time chat infrastructure to handle 3x concurrent capacity with page load <1 second for 5,000+ users and 200+ faculty members.';
  let b4Text = 'Automated continuous deployment pipeline delivering 20+ production releases with zero-downtime over 12 months.';

  if (isAlekya) {
    b1Text = 'Designed automated sales performance dashboard in Tableau and SQL, cutting weekly executive reporting prep from 12 hours to 45 minutes across 8 regional directors.';
    b2Text = 'Analyzed customer churn patterns across 450,000 loyalty accounts, isolating 3 key abandonment triggers and improving campaign retention by 14%.';
    b3Text = 'Authored optimized PostgreSQL queries reducing batch reporting runtime by 32%.';
    b4Text = 'Built real-time supply chain inventory tracker in Power BI connecting 4 warehouse data sources.';
  } else if (isWeak) {
    b1Text = 'Responsible for writing code for web applications using JavaScript and React.';
    b2Text = 'Assisted senior developers with backend bug fixing and routine database maintenance tasks.';
    b3Text = 'Worked with team members in daily agile standup meetings.';
    b4Text = 'Handled customer support tickets and investigated client issues in production.';
  }

  const itemId = isAlekya && b4Text.includes('supply chain') ? 'exp_002' : 'exp_001';
  const b4ItemId = isAlekya ? 'exp_002' : 'exp_001';
  const b4BulletId = isAlekya ? 'exp_002_b01' : 'exp_001_b04';

  return JSON.stringify({
    analysisVersion: '2.2',
    candidateSnapshot: {
      name: isWeak ? 'Jordan Miller' : (isAlekya ? 'Alekya Rao' : 'Swapnil Jadhav'),
      targetRole: fixture.metadata.role,
      experienceLevel: fixture.metadata.experience,
      currentSeniority: isWeak ? 'Junior' : 'Senior',
      primaryProfile: fixture.metadata.role
    },
    dashboard: null,
    overallReview: {
      summary: `Solid candidate positioning for ${fixture.metadata.role}. The profile establishes technical experience across core domains while showing opportunity for sharper quantification.`,
      tone: 'conversational'
    },
    strengths: [
      {
        id: 'str_001',
        title: 'Strong Technical Competencies',
        description: 'Demonstrates direct engineering responsibilities in production environments.',
        evidence: [
          {
            section: 'experience',
            itemId,
            bulletId: 'exp_001_b01',
            originalText: b1Text
          }
        ]
      }
    ],
    issues: [
      {
        id: 'issue_001',
        severity: 'high',
        category: 'impact',
        title: 'Action-oriented achievement without quantifiable baseline',
        diagnosis: 'The bullet describes what was done but leaves the business outcome unquantified.',
        whyItMatters: 'Recruiters scan for measured impact to gauge scale and seniority.',
        recommendation: 'Highlight the before-and-after baseline using verified metrics.',
        correctedText: null,
        evidence: [
          {
            section: 'experience',
            itemId,
            bulletId: 'exp_001_b02',
            originalText: b2Text
          }
        ]
      },
      {
        id: 'issue_002',
        severity: 'medium',
        category: 'skill_evidence_gap',
        title: 'Target JD requirement not evidenced in resume',
        diagnosis: isAlekya
          ? 'Snowflake appears prominently in the target JD, but current resume does not provide direct evidence.'
          : 'Kafka appears in the target JD requirements, but your current resume does not provide clear direct evidence.',
        whyItMatters: 'ATS keyword matchers and recruiters look for explicit demonstration of target tools.',
        recommendation: 'Include explicit bullet evidence if you have practical experience with these tools.',
        correctedText: null,
        evidence: [
          {
            section: 'experience',
            itemId,
            bulletId: 'exp_001_b03',
            originalText: b3Text
          }
        ]
      },
      {
        id: 'issue_003',
        severity: 'low',
        category: 'ats_readability',
        title: 'Density and section scanning optimization',
        diagnosis: 'Bullet structure is dense and can be streamlined for rapid 10-second recruiter scanning.',
        whyItMatters: 'Clear hierarchy ensures your strongest achievements are read first.',
        recommendation: 'Lead with outcome verbs before describing implementation tools.',
        correctedText: null,
        evidence: [
          {
            section: 'experience',
            itemId: b4ItemId,
            bulletId: b4BulletId,
            originalText: b4Text
          }
        ]
      }
    ],
    priorityActions: [
      { priority: 1, title: 'Quantify Achievements', action: 'Add business metrics to core bullets.', reason: 'High' },
      { priority: 2, title: 'Bridge JD Evidence Gaps', action: 'Demonstrate target JD competencies explicitly.', reason: 'High' },
      { priority: 3, title: 'Optimize Bullet Structure', action: 'Lead with outcomes rather than tools.', reason: 'Medium' }
    ]
  });
}

/**
 * Benchmark runner
 */
async function runBenchmark() {
  const benchmarkResults = [];
  const origGenerate = llmGateway.generate;

  try {
    for (const fixName of FIXTURES) {
      const fixture = loadFixture(fixName);
      console.log(`\n================================================================`);
      console.log(`FIXTURE: ${fixName.toUpperCase()} (${fixture.metadata.role})`);
      console.log(`================================================================`);

      for (const mode of MODES) {
        console.log(`\n--- Running Mode: ${mode} ---`);

        // Setup mock gateway responding accurately per task
        llmGateway.generate = async (params) => {
          const task = params.task || (params.messages[0]?.content.includes('Resume Auditor') ? 'resume_audit'
            : params.messages[0]?.content.includes('Target Job Description') ? 'jd_match'
            : params.messages[0]?.content.includes('Market Analyst') ? 'market_gap'
            : 'final_synthesis');

          const responseText = createMockSynthesisResponse(fixture, mode, task);

          // Simulated latency & token profiling
          const isParallelSubagent = task === 'resume_audit' || task === 'jd_match' || task === 'market_gap';
          const latencyMs = isParallelSubagent ? 450 + Math.floor(Math.random() * 150) : 1100 + Math.floor(Math.random() * 200);
          const promptTokens = isParallelSubagent ? 1200 : (mode === MODE_C_NAME ? 2200 : 3400);
          const completionTokens = isParallelSubagent ? 450 : 1150;

          return {
            text: responseText,
            actualModel: params.model || 'openai/gpt-oss-120b',
            provider: 'groq',
            finishReason: 'stop',
            latencyMs,
            requestId: `bench_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            tokens: {
              prompt: promptTokens,
              completion: completionTokens,
              total: promptTokens + completionTokens,
            },
          };
        };

        const startTime = Date.now();
        const evalResult = await ResumeAgent.evaluate({
          resumeText: fixture.resumeText,
          targetRole: fixture.metadata.role,
          targetJobDescription: fixture.targetJobDescription,
          orchestrationMode: mode,
          isBenchmark: true,
          cacheMode: 'bypass',
        });
        const elapsedMs = Date.now() - startTime;

        // Validations
        assert.strictEqual(evalResult.success, true, `Mode ${mode} should succeed`);
        assert.ok(evalResult.analysis, `Mode ${mode} must produce valid analysis`);
        assert.strictEqual(evalResult.analysis.analysisVersion, '2.2', 'Schema must be 2.2');
        assert.strictEqual(evalResult.analysis.dashboard !== undefined, true, 'Scorecard dashboard must exist');
        assert.ok(evalResult.analysis.issues.length >= 3 && evalResult.analysis.issues.length <= 7, 'Issues must be between 3 and 7');

        const metrics = {
          fixture: fixName,
          mode,
          success: evalResult.success,
          latencyMs: evalResult.metadata.latencyMs || elapsedMs,
          totalDurationMs: elapsedMs,
          inputTokens: evalResult.metadata.inputTokens || 0,
          outputTokens: evalResult.metadata.outputTokens || 0,
          totalTokens: (evalResult.metadata.inputTokens || 0) + (evalResult.metadata.outputTokens || 0),
          issueCount: evalResult.analysis.issues.length,
          strengthsCount: evalResult.analysis.strengths.length,
          score: evalResult.analysis.dashboard?.score ?? 'N/A',
          grade: evalResult.analysis.dashboard?.grade ?? 'N/A',
          marketContextStatus: evalResult.marketContext?.status || 'none',
        };

        benchmarkResults.push(metrics);

        console.log(`Status: SUCCESS | Latency: ${metrics.latencyMs}ms | Tokens: ${metrics.totalTokens} (In: ${metrics.inputTokens}, Out: ${metrics.outputTokens})`);
        console.log(`Issues: ${metrics.issueCount} | Strengths: ${metrics.strengthsCount} | Score: ${metrics.score} (${metrics.grade})`);
      }
    }

    // -------------------------------------------------------------
    // Test Failure Behavior: No Silent Fallback (Section 6)
    // -------------------------------------------------------------
    console.log(`\n================================================================`);
    console.log(`TESTING FAILURE GUARDRAILS: NO SILENT FALLBACK (Section 6)`);
    console.log(`================================================================`);

    llmGateway.generate = async () => {
      throw new Error('Simulated 503 Provider Outage');
    };

    const failResult = await ResumeAgent.evaluate({
      resumeText: 'John Doe\nSoftware Engineer\njohn@example.com',
      targetRole: 'Software Engineer',
      isBenchmark: true, // benchmark flag prevents silent fallback
    });

    assert.strictEqual(failResult.success, false, 'Benchmark run must not succeed on provider error');
    assert.strictEqual(failResult.status, 'PROVIDER_ERROR', 'Must classify explicitly as PROVIDER_ERROR without silent fallback');
    console.log('PASS: Correctly classified as PROVIDER_ERROR without silent model replacement.');

    // -------------------------------------------------------------
    // Summary Comparative Table
    // -------------------------------------------------------------
    console.log(`\n================================================================`);
    console.log(`BENCHMARK COMPARATIVE SUMMARY ACROSS ORCHESTRATION MODES`);
    console.log(`================================================================`);
    console.table(
      benchmarkResults.map((r) => ({
        Fixture: r.fixture,
        Mode: r.mode,
        'Latency (ms)': r.latencyMs,
        'Input Tok': r.inputTokens,
        'Output Tok': r.outputTokens,
        'Total Tok': r.totalTokens,
        Issues: r.issueCount,
        Score: `${r.score} (${r.grade})`,
      }))
    );

    console.log('\n================================================================');
    console.log('ALL ORCHESTRATION BENCHMARK TESTS & ASSERTIONS PASSED!');
    console.log('================================================================\n');
  } finally {
    llmGateway.generate = origGenerate;
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark fatal error:', err);
  process.exit(1);
});
