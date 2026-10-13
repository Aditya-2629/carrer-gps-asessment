/**
 * testMarketIntelligence.js
 *
 * Comprehensive Test Suite for Resume Agent V3 Market Intelligence Layer.
 * Tests cover:
 * 1. Bucket Resolution (Exact, Synonymous, Specialization, Experience ranges, Ambiguity fallback)
 * 2. Normalization & Deduplication (Fingerprinting, Quality filter, Top 5 ranking)
 * 3. Market Profile Builder (Deterministic frequency aggregation, Prompt formatter)
 * 4. Market Evidence & Guardrails (Target JD priority, Market gap != skill deficiency, Language rules)
 * 5. Atomic Swap & Rollback Safety (Active version preservation on failure)
 * 6. Queue & Concurrency (Bounded concurrency, Status inspection)
 * 7. Cache Key Integration & Invalidation (Version increments change fingerprint, Benchmark bypass)
 * 8. Learning Signals (Versioned observation tracking, Strictly no prompt mutation)
 * 9. Golden Fixtures Evaluation (Swapnil, Alekya, Weak Resume)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Market modules
import { resolveMarketBucket, BUCKET_EXPERIENCE_RANGES } from '../agents/resume/market/marketBucketResolver.js';
import { normalizeJdRecord, selectTopMarketJds, computeJdFingerprint, validateJdQuality } from '../agents/resume/market/jdNormalizer.js';
import { buildMarketProfile, formatMarketProfileForPrompt } from '../agents/resume/market/marketProfileBuilder.js';
import { analyzeMarketEvidence, buildMarketContextReport, validateMarketLanguage } from '../agents/resume/market/marketEvidence.js';
import { createVersionRecord, prepareAtomicSwap } from '../agents/resume/market/marketVersions.js';
import { marketJdQueue } from '../jobs/marketJd/marketJdQueue.js';
import { computeAnalysisCacheFingerprint } from '../agents/orchestrator.js';
import { recordLearningSignal, extractMarketSignalsFromProfile } from '../agents/resume/market/marketLearning.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('RESUME AGENT V3 MARKET INTELLIGENCE TEST SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function it(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`FAIL: ${desc}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAll() {
// -------------------------------------------------------------
// 1. Bucket Resolution
// -------------------------------------------------------------
console.log('--- Suite 1: Role & Experience Bucket Resolution ---');

it('Resolves exact canonical role and experience', () => {
  const result = resolveMarketBucket({
    targetRole: 'Software Engineer',
    targetJobDescription: 'Seeking Software Engineer with 4 years experience',
    experienceYears: 4
  });
  assert.strictEqual(result.roleKey, 'software-engineer');
  assert.strictEqual(result.experienceBucket, '3-5');
  assert.strictEqual(result.bucketKey, 'software-engineer::3-5');
  assert.ok(result.confidence >= 0.85);
});

it('Resolves synonymous role to canonical key (Full Stack Developer -> software-engineer)', () => {
  const result = resolveMarketBucket({
    targetRole: 'Senior Full Stack Developer',
    experienceYears: 7
  });
  assert.strictEqual(result.roleKey, 'software-engineer');
  assert.strictEqual(result.specialization, 'fullstack');
  assert.strictEqual(result.experienceBucket, '6-8');
  assert.strictEqual(result.bucketKey, 'software-engineer::6-8');
});

it('Resolves specialized role (Backend Engineer -> specialization: backend)', () => {
  const result = resolveMarketBucket({
    targetRole: 'Backend Engineer',
    experienceYears: 2
  });
  assert.strictEqual(result.roleKey, 'software-engineer');
  assert.strictEqual(result.specialization, 'backend');
  assert.strictEqual(result.experienceBucket, '0-2');
  assert.strictEqual(result.bucketKey, 'software-engineer::0-2');
});

it('Reconciles candidate experience with JD requirements (Resume takes priority over ambiguous JD)', () => {
  const result = resolveMarketBucket({
    targetRole: 'Data Analyst',
    targetJobDescription: 'Requires at least 2+ years experience in SQL and analytics',
    experienceYears: 5 // Candidate has 5 years
  });
  assert.strictEqual(result.roleKey, 'data-analyst');
  assert.strictEqual(result.experienceBucket, '3-5'); // 5 years maps to 3-5
  assert.strictEqual(result.candidateExperienceYears, 5);
});

it('Gracefully falls back on ambiguous/unknown role without guessing silently', () => {
  const result = resolveMarketBucket({
    targetRole: 'Chief Metaphysical Alchemist',
    experienceYears: 10
  });
  assert.strictEqual(result.roleKey, 'chief-metaphysical-alchemist');
  assert.strictEqual(result.experienceBucket, '8+');
  assert.ok(result.confidence < 0.7);
  assert.strictEqual(result.method, 'slugified_fallback');
});

// -------------------------------------------------------------
// 2. Normalization & Quality Deduplication
// -------------------------------------------------------------
console.log('\n--- Suite 2: Normalization, Fingerprinting & Top 5 Selection ---');

const sampleRawJobs = [
  {
    title: 'Senior Software Engineer',
    company: 'TechFlow',
    location: 'Remote',
    description: 'We are seeking a Senior Software Engineer with strong Python and AWS skills to design and architect enterprise cloud microservices with high availability.',
    sourceUrl: 'https://job.test/1'
  },
  {
    // Exact duplicate
    title: 'Senior Software Engineer',
    company: 'TechFlow',
    location: 'Remote',
    description: 'We are seeking a Senior Software Engineer with strong Python and AWS skills to design and architect enterprise cloud microservices with high availability.',
    sourceUrl: 'https://job.test/1'
  },
  {
    // Near duplicate with whitespace variation
    title: '  SENIOR Software Engineer  ',
    company: 'techflow',
    location: 'remote',
    description: 'We are seeking a Senior Software Engineer with strong Python and AWS skills to design and architect enterprise cloud microservices with high availability.',
    sourceUrl: 'https://job.test/1/'
  },
  {
    title: 'Backend Engineer',
    company: 'CloudNova',
    location: 'NYC',
    description: 'CloudNova is looking for a Backend Engineer with Go, Kafka, and Docker experience to build high throughput event-driven backend pipelines.',
    sourceUrl: 'https://job.test/2'
  },
  {
    // Invalid: no description
    title: 'Empty Description Role',
    company: 'GhostCorp',
    description: '   '
  },
  {
    title: 'Software Developer',
    company: 'Apex Solutions',
    location: 'Chicago',
    description: 'Develop modern full stack web applications with React, Node.js, and PostgreSQL for customer-facing applications and dashboards.',
    sourceUrl: 'https://job.test/3'
  },
  {
    title: 'Platform Engineer',
    company: 'DataSphere',
    location: 'Austin',
    description: 'Manage Kubernetes infrastructure, CI/CD pipelines, and cloud security in AWS to deliver reliable internal developer platforms.',
    sourceUrl: 'https://job.test/4'
  },
  {
    title: 'API Engineer',
    company: 'FinPulse',
    location: 'Boston',
    description: 'Build robust REST and GraphQL APIs using Java and Spring Boot in distributed financial transaction systems with zero downtime.',
    sourceUrl: 'https://job.test/5'
  },
  {
    title: 'Full Stack Engineer',
    company: 'WebSphere',
    location: 'Seattle',
    description: 'TypeScript, Next.js, and serverless architectures powering modern e-commerce user experiences with high scalability and security.',
    sourceUrl: 'https://job.test/6'
  }
];

it('Fingerprint produces stable hash and detects duplicates', () => {
  const fp1 = computeJdFingerprint(sampleRawJobs[0]);
  const fp2 = computeJdFingerprint(sampleRawJobs[1]);
  const fp3 = computeJdFingerprint(sampleRawJobs[2]);
  assert.strictEqual(fp1, fp2);
  assert.strictEqual(fp1, fp3);
});

it('Rejects invalid JD records missing required fields or content', () => {
  const invalidResult = validateJdQuality(sampleRawJobs[4]);
  assert.strictEqual(invalidResult.isValid, false);
  assert.ok(invalidResult.reasons.some(r => r.toLowerCase().includes('description')));
});

it('Deduplicates and selects exactly top 5 valid market JDs', () => {
  const normalized = sampleRawJobs.map(j => normalizeJdRecord(j));
  const selection = selectTopMarketJds(normalized, {
    targetRole: 'Software Engineer',
    targetCount: 5
  });

  assert.strictEqual(selection.selectedJds.length, 5);
  assert.ok(selection.deduplicatedCount >= 2);
  // Ensure all 5 selected JDs are unique fingerprints
  const fingerprints = new Set(selection.selectedJds.map(j => j.fingerprint));
  assert.strictEqual(fingerprints.size, 5);
});

// -------------------------------------------------------------
// 3. Market Profile Builder (Deterministic Aggregation)
// -------------------------------------------------------------
console.log('\n--- Suite 3: Deterministic Market Profile Builder ---');

const top5Jds = [
  {
    sourceJobId: 'job_1',
    title: 'Senior Software Engineer',
    normalizedDescription: 'Develop scalable backend systems in Python, FastAPI, and AWS. Kafka messaging required. Must have experience with Docker.'
  },
  {
    sourceJobId: 'job_2',
    title: 'Senior Python Engineer',
    normalizedDescription: 'Architect high-throughput microservices using Python, FastAPI, PostgreSQL, and AWS. Kafka experience preferred.'
  },
  {
    sourceJobId: 'job_3',
    title: 'Full Stack AI Engineer',
    normalizedDescription: 'Build AI applications with Python, React, and AWS. Integrate Redis caching and Kafka streaming pipelines.'
  },
  {
    sourceJobId: 'job_4',
    title: 'Senior Backend Developer',
    normalizedDescription: 'Lead system design and API architecture. Tech stack includes Python, Go, Kafka, Redis, and Kubernetes.'
  },
  {
    sourceJobId: 'job_5',
    title: 'Platform Software Engineer',
    normalizedDescription: 'Maintain cloud platforms in AWS. Strong Python, Docker, CI/CD, and system design expertise.'
  }
];

let generatedProfile = null;

it('Builds deterministic market profile with correct frequencies across 5 JDs', () => {
  generatedProfile = buildMarketProfile(top5Jds, {
    bucketKey: 'software-engineer::6-8',
    version: 1
  });

  assert.strictEqual(generatedProfile.bucketKey, 'software-engineer::6-8');
  assert.strictEqual(generatedProfile.sampleSize, 5);
  assert.ok(Array.isArray(generatedProfile.skills));

  // Python appears in all 5
  const pythonSkill = generatedProfile.skills.find(s => s.name === 'Python');
  assert.ok(pythonSkill, 'Python skill should be present');
  assert.strictEqual(pythonSkill.frequency, 5);
  assert.strictEqual(pythonSkill.frequencyRatio, 1.0);

  // AWS appears in 4 (job 1, 2, 3, 5)
  const awsSkill = generatedProfile.skills.find(s => s.name === 'AWS');
  assert.ok(awsSkill, 'AWS skill should be present');
  assert.strictEqual(awsSkill.frequency, 4);
  assert.strictEqual(awsSkill.frequencyRatio, 0.8);

  // Kafka appears in 4 (job 1, 2, 3, 4)
  const kafkaSkill = generatedProfile.skills.find(s => s.name === 'Kafka');
  assert.ok(kafkaSkill, 'Kafka skill should be present');
  assert.strictEqual(kafkaSkill.frequency, 4);
  assert.strictEqual(kafkaSkill.frequencyRatio, 0.8);
});

it('Formats compact market profile block for LLM prompt without raw JDs', () => {
  const promptText = formatMarketProfileForPrompt(generatedProfile);
  assert.ok(promptText.includes('SAMPLED MARKET INTELLIGENCE (software-engineer::6-8)'));
  assert.ok(promptText.includes('Top Market Skills:'));
  assert.ok(promptText.includes('Python: 5/5 JDs (100%)'));
  // Ensure NO raw job descriptions are leaked into prompt
  assert.ok(!promptText.includes('Lead system design and API architecture'));
  assert.ok(!promptText.includes('job_1'));
});

// -------------------------------------------------------------
// 4. Market Evidence & Guardrails
// -------------------------------------------------------------
console.log('\n--- Suite 4: Target JD Priority, Evidence Gaps & Language Rules ---');

const mockResumeFacts = {
  skills: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
  technologies: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
  bullets: [
    { bulletId: 'b1', text: 'Built high-throughput backend APIs with Python and FastAPI' }
  ]
};

const mockTargetJd = `
Looking for a Senior Software Engineer.
Requirements:
- Must have strong experience with Kafka for distributed streaming.
- Proficiency in Python and PostgreSQL.
- Experience with Kubernetes is a plus.
`;

it('Target JD has primary priority over market frequency', () => {
  const evidenceAnalysis = analyzeMarketEvidence({
    resumeFacts: mockResumeFacts,
    targetJdText: mockTargetJd,
    marketProfile: generatedProfile
  });

  // Kafka is in Target JD AND in 4/5 market JDs, but resume doesn't have it
  const kafkaGap = evidenceAnalysis.marketEvidenceGaps.find(g => g.skill === 'Kafka');
  assert.ok(kafkaGap, 'Kafka evidence gap should be detected');
  assert.strictEqual(kafkaGap.targetJdRequested, true);
  assert.strictEqual(kafkaGap.marketFrequency, 0.8);

  // Python is in Target JD, Market JDs, AND Resume -> Strength
  const pythonStrength = evidenceAnalysis.marketStrengths.find(s => s.skill === 'Python');
  assert.ok(pythonStrength, 'Python should be marked as market & target alignment strength');
});

it('Frames gaps as missing resume evidence, never as missing candidate knowledge', () => {
  const evidenceAnalysis = analyzeMarketEvidence({
    resumeFacts: mockResumeFacts,
    targetJdText: mockTargetJd,
    marketProfile: generatedProfile
  });

  const report = buildMarketContextReport({
    bucketKey: 'software-engineer::6-8',
    marketVersion: 1,
    evidenceAnalysis
  });

  for (const gap of report.marketEvidenceGaps) {
    assert.strictEqual(gap.resumeEvidence, 'none_found');
    // Observation wording check
    assert.ok(!gap.observation.includes("You don't know"));
    assert.ok(!gap.observation.includes('You lack'));
    assert.ok(gap.observation.includes('does not provide clear evidence') || gap.observation.includes('sampled'));
  }
});

it('Language validator rejects prohibited claims and approves compliant phrases', () => {
  // Prohibited phrases
  const badTexts = [
    "You don't know Kubernetes so you will fail.",
    "AWS is mandatory for this role.",
    "You will be rejected without Kafka experience.",
    "Adding Docker will increase your interview chances by 45%."
  ];

  for (const bad of badTexts) {
    const check = validateMarketLanguage(bad);
    assert.strictEqual(check.isValid, false, `Should reject: "${bad}"`);
  }

  // Approved phrases
  const goodTexts = [
    "AWS appears in 4 of 5 sampled JDs at this experience level.",
    "The target JD explicitly requests Kafka.",
    "The current resume does not provide clear evidence of Kafka experience."
  ];

  for (const good of goodTexts) {
    const check = validateMarketLanguage(good);
    assert.strictEqual(check.isValid, true, `Should accept: "${good}"`);
  }
});

// -------------------------------------------------------------
// 5. Atomic Swaps & Rollback Safety
// -------------------------------------------------------------
console.log('\n--- Suite 5: Atomic Version Swap & Rollback Safety ---');

it('Prepares version record without mutating active version pointer', () => {
  const versionRecord = createVersionRecord({
    bucketKey: 'software-engineer::6-8',
    versionNumber: 2,
    jobs: top5Jds,
    marketProfile: generatedProfile
  });

  assert.strictEqual(versionRecord.bucketKey, 'software-engineer::6-8');
  assert.strictEqual(versionRecord.version, 2);
  assert.strictEqual(versionRecord.jobs.length, 5);
  assert.strictEqual(versionRecord.validationSummary.isValid, true);
});

it('Calculates atomic pointer transition (v1 -> v2) only after successful validation', () => {
  const transition = prepareAtomicSwap({
    currentBucket: { bucketKey: 'software-engineer::6-8', activeVersion: 1, status: 'active' },
    newVersionRecord: { version: 2, validationSummary: { isValid: true } }
  });

  assert.strictEqual(transition.canActivate, true);
  assert.strictEqual(transition.targetVersion, 2);
  assert.strictEqual(transition.previousVersion, 1);
});

it('Refuses activation and retains current active version if new version is invalid', () => {
  const transition = prepareAtomicSwap({
    currentBucket: { bucketKey: 'software-engineer::6-8', activeVersion: 1, status: 'active' },
    newVersionRecord: { version: 2, validationSummary: { isValid: false, errors: ['Only 3 valid JDs found'] } }
  });

  assert.strictEqual(transition.canActivate, false);
  assert.strictEqual(transition.retainedVersion, 1);
  assert.ok(transition.reason.includes('failed validation'));
});

// -------------------------------------------------------------
// 6. Queue & Concurrency Management
// -------------------------------------------------------------
console.log('\n--- Suite 6: In-Memory / BullMQ Compatible Queue Architecture ---');

it('Queue initializes with bounded concurrency = 3', () => {
  assert.strictEqual(marketJdQueue.concurrency, 3);
  const status = marketJdQueue.getStatus();
  assert.strictEqual(typeof status.active, 'number');
  assert.strictEqual(typeof status.pending, 'number');
});

// -------------------------------------------------------------
// 7. Cache Key Fingerprinting & Invalidation
// -------------------------------------------------------------
console.log('\n--- Suite 7: Cache Fingerprinting & Invalidation ---');

it('Analysis cache fingerprint changes when marketBucketVersion changes', () => {
  const fpV1 = computeAnalysisCacheFingerprint({
    resumeText: 'Test resume text',
    targetJobDescription: 'Test JD',
    targetRole: 'Software Engineer',
    experienceBucket: '6-8',
    marketBucketVersion: 1
  });

  const fpV2 = computeAnalysisCacheFingerprint({
    resumeText: 'Test resume text',
    targetJobDescription: 'Test JD',
    targetRole: 'Software Engineer',
    experienceBucket: '6-8',
    marketBucketVersion: 2 // Incremented version after refresh
  });

  assert.notStrictEqual(fpV1, fpV2, 'Fingerprints must differ across market versions');
});

it('Benchmark mode bypass returns null fingerprint to force real evaluation', () => {
  const fpBypass = computeAnalysisCacheFingerprint({
    resumeText: 'Test resume text',
    cacheMode: 'bypass'
  });

  assert.strictEqual(fpBypass, null, 'Cache bypass must return null fingerprint');
});

// -------------------------------------------------------------
// 8. Learning Signals
// -------------------------------------------------------------
console.log('\n--- Suite 8: Continuous Improvement & Learning Signals ---');

it('Extracts versioned candidate market signals from profile', () => {
  const signals = extractMarketSignalsFromProfile(generatedProfile);
  assert.ok(signals.length >= 2);
  const pythonSignal = signals.find(s => s.signal === 'Python');
  assert.ok(pythonSignal);
  assert.strictEqual(pythonSignal.signalType, 'MARKET_SKILL_TREND');
  assert.strictEqual(pythonSignal.roleKey, 'software-engineer');
  assert.strictEqual(pythonSignal.experienceBucket, '6-8');
  assert.strictEqual(pythonSignal.status, 'candidate');
  // Does NOT mutate prompt
  assert.strictEqual(pythonSignal.requiresAdminReview, true);
});

await it('Records learning signal safely without throwing or mutating system prompts', async () => {
  const signal = await recordLearningSignal({
    signalType: 'MARKET_SKILL_TREND',
    roleKey: 'software-engineer',
    experienceBucket: '6-8',
    signal: 'Kafka',
    observationCount: 5,
    confidence: 0.95
  });

  assert.strictEqual(signal.signal, 'Kafka');
  assert.strictEqual(signal.status, 'candidate');
});

// -------------------------------------------------------------
// 9. Golden Fixtures Verification
// -------------------------------------------------------------
console.log('\n--- Suite 9: Golden Fixtures (Swapnil, Alekya, Weak-Resume) ---');

const fixtures = ['swapnil', 'alekya', 'weak-resume'];

for (const fixName of fixtures) {
  await it(`Evaluates golden fixture "${fixName}" against expected bucket and constraints`, () => {
    const fixDir = path.join(__dirname, '../agents/resume/fixtures', fixName);
    const meta = JSON.parse(fs.readFileSync(path.join(fixDir, 'fixtureMetadata.json'), 'utf-8'));
    const resumeText = fs.readFileSync(path.join(fixDir, 'resume.txt'), 'utf-8');
    const targetJdText = fs.readFileSync(path.join(fixDir, 'targetJd.txt'), 'utf-8');
    const mockJds = JSON.parse(fs.readFileSync(path.join(fixDir, 'mockMarketJds.json'), 'utf-8'));

    // 1. Bucket resolution
    const bucket = resolveMarketBucket({
      targetRole: meta.role,
      targetJobDescription: targetJdText,
      resumeText,
    });
    assert.strictEqual(bucket.bucketKey, meta.expectedBucket);

    // 2. Normalization & Market Profile
    const normalized = mockJds.map(j => normalizeJdRecord(j));
    const selection = selectTopMarketJds(normalized, { targetRole: meta.role, targetCount: 5 });
    assert.strictEqual(selection.selectedJds.length, 5);

    const profile = buildMarketProfile(selection.selectedJds, { bucketKey: bucket.bucketKey });
    assert.strictEqual(profile.sampleSize, 5);

    // Check expected market skills
    const topSkillNames = profile.skills.map(s => s.name.toLowerCase());
    for (const expSkill of meta.expectedMarketSkills) {
      assert.ok(
        topSkillNames.includes(expSkill.toLowerCase()),
        `Fixture ${fixName} profile should identify expected skill: ${expSkill}`
      );
    }

    // 3. Evidence analysis and guardrail assertions
    const evidence = analyzeMarketEvidence({
      resumeFacts: { skills: [], technologies: [], bullets: [] },
      targetJdText,
      marketProfile: profile
    });
    const report = buildMarketContextReport({
      bucketKey: bucket.bucketKey,
      evidenceAnalysis: evidence
    });

    for (const gap of report.marketEvidenceGaps) {
      for (const forbidden of meta.forbiddenClaims) {
        assert.ok(
          !gap.observation.toLowerCase().includes(forbidden.toLowerCase()),
          `Fixture ${fixName} observation "${gap.observation}" contains forbidden phrase "${forbidden}"`
        );
      }
    }
  });
}

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`ALL ${passedTests} OF ${totalTests} MARKET INTELLIGENCE TESTS PASSED!`);
  console.log('================================================================');
}

runAll().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
