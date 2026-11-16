import assert from 'assert'
import { buildHybridPrompt, sanitizeModeCOutput } from '../agents/resume/orchestration/modeC_hybrid.js'
import { BATCH_WEAVER_SYSTEM_PROMPT } from '../agents/resume/market/smartKeywordWeaver.js'
import { ResumeAgentValidator } from '../agents/resume/resumeAgent.validator.js'

console.log('================================================================')
console.log('PHASE 2: SEMANTIC 5-PART BULLET AUDIT & LITERAL MIRRORING TESTS')
console.log('================================================================\n')

// ── Test 1: modeC_hybrid System Prompt & Mandates ────────────────────────────
console.log('--- Test 1: modeC_hybrid System Prompt & Mandates ---')
const sampleDossier = {
  quantification: { density: 0.7, totalBullets: 10, quantifiedBullets: 7, unquantifiedBulletIds: [] },
  toolDumps: [],
  timeline: { totalExperienceYears: 6, itemCount: 2 },
  targetJdOverlap: { evidencedSkills: ['Docker', 'Kubernetes'], unverifiedSkills: ['Kafka'] },
  marketEvidenceGaps: [{ skill: 'Kafka', frequency: '4 of 5' }],
}

const promptMessages = buildHybridPrompt({
  compactResume: 'Alex Rivera | Staff Software Engineer',
  dossier: sampleDossier,
  targetRole: 'Staff Software Engineer',
  targetJobDescription: 'Looking for a Staff Engineer experienced in distributed systems and Kafka.',
})

const sysPrompt = promptMessages[0].content

assert.ok(sysPrompt.includes('THE 5-PART WINNING BULLET FORMULA'), 'Prompt must mandate 5-Part Winning Bullet Formula')
assert.ok(sysPrompt.includes('[1. Strong Action Verb] + [2. Relevant Hard Skill/Tool] + [3. Collaboration/Leadership Signal] + [4. Realistic Calibrated Metric] + [5. Concrete Achievement/Outcome]'), 'Formula tokens must match specification')
assert.ok(sysPrompt.includes('Candidate Activity (Task):') && sysPrompt.includes('Outcome Deficit:'), 'Prompt must separate candidate task from outcome deficit')
assert.ok(sysPrompt.includes('LLM SEMANTIC AUDIT MANDATE'), 'Prompt must include LLM Semantic Audit Mandate')
assert.ok(sysPrompt.includes('"bulletEvaluations"'), 'Prompt must mandate bulletEvaluations array')
assert.ok(sysPrompt.includes('"cutList"'), 'Prompt must mandate cutList array')
assert.ok(sysPrompt.includes('"nearMissKeywords"'), 'Prompt must mandate nearMissKeywords array')
assert.ok(sysPrompt.includes('LITERAL ATS KEYWORD MIRRORING'), 'Prompt must enforce Literal ATS Keyword Mirroring')
console.log('  ✓ 1.1 modeC_hybrid system prompt enforces 5-part formula, separation, audit mandate, and literal mirroring')

// ── Test 2: modeC_hybrid Output Sanitization ────────────────────────────────
console.log('\n--- Test 2: modeC_hybrid Output Sanitization ---')
const rawModelOutput = {
  analysisVersion: '2.2',
  candidateSnapshot: { name: 'Alex Rivera', targetRole: 'Staff Software Engineer' },
  bulletEvaluations: [
    {
      bulletId: 'exp_001_b01',
      verdict: 'neutral', // Should normalize to 'helping' or 'hurting'
      fivePartFlags: { actionVerb: true, hardSkill: true, collaboration: false, metric: true, outcome: true },
      isResponsibilityOnly: false,
      missingElements: ['collaboration'],
    },
    {
      bulletId: 'exp_001_b02',
      verdict: 'hurting',
      fivePartFlags: { actionVerb: false, hardSkill: false, collaboration: false, metric: false, outcome: false },
      isResponsibilityOnly: true,
      missingElements: ['actionVerb', 'hardSkill', 'metric', 'outcome'],
    },
  ],
  cutList: [
    {
      section: 'experience',
      itemId: 'exp_001',
      bulletId: 'exp_001_b04',
      originalText: 'Attended daily standup meetings {{targetRole}}',
      reason: 'Low-value filler line {{targetRole}}',
    },
  ],
  nearMissKeywords: [
    {
      resumePhrase: 'large-scale systems',
      jdPhrase: 'distributed systems',
      bulletId: 'exp_001_b01',
      reason: 'ATS exact phrase matching',
    },
  ],
}

const sanitized = sanitizeModeCOutput(rawModelOutput)

assert.strictEqual(sanitized.bulletEvaluations.length, 2, 'bulletEvaluations count preserved')
assert.strictEqual(sanitized.bulletEvaluations[0].verdict, 'helping', 'Non-responsibility bullet normalized to helping')
assert.strictEqual(sanitized.bulletEvaluations[0].fivePartFlags.collaboration, false, 'Boolean flags preserved')
assert.strictEqual(sanitized.bulletEvaluations[1].verdict, 'hurting', 'Responsibility-only bullet marked hurting')
assert.strictEqual(sanitized.bulletEvaluations[1].isResponsibilityOnly, true, 'isResponsibilityOnly preserved')

assert.strictEqual(sanitized.cutList.length, 1, 'cutList preserved')
assert.strictEqual(sanitized.cutList[0].originalText, 'Attended daily standup meetings', 'Unrendered tokens stripped from cutList')

assert.strictEqual(sanitized.nearMissKeywords.length, 1, 'nearMissKeywords preserved')
assert.strictEqual(sanitized.nearMissKeywords[0].jdPhrase, 'distributed systems', 'jdPhrase preserved')

// Test fallback defaulting when fields are omitted
const emptyOutput = sanitizeModeCOutput({ analysisVersion: '2.2' })
assert.deepStrictEqual(emptyOutput.bulletEvaluations, [], 'bulletEvaluations defaults to []')
assert.deepStrictEqual(emptyOutput.cutList, [], 'cutList defaults to []')
assert.deepStrictEqual(emptyOutput.nearMissKeywords, [], 'nearMissKeywords defaults to []')
console.log('  ✓ 2.1 sanitizeModeCOutput correctly normalizes 5-part evaluations, cutList, and nearMissKeywords with safe defaults')

// ── Test 3: smartKeywordWeaver Prompt Alignment ─────────────────────────────
console.log('\n--- Test 3: smartKeywordWeaver Prompt Alignment ---')
assert.ok(BATCH_WEAVER_SYSTEM_PROMPT.includes('THE 5-PART WINNING BULLET FORMULA (MANDATORY FOR ALL REWRITES)'), 'Weaver prompt must contain 5-Part formula')
assert.ok(BATCH_WEAVER_SYSTEM_PROMPT.includes('LITERAL ATS KEYWORD MIRRORING RULE'), 'Weaver prompt must enforce Literal ATS Mirroring rule')
assert.ok(BATCH_WEAVER_SYSTEM_PROMPT.includes('REPLACE the loose synonym with the EXACT target JD phrase'), 'Weaver prompt must instruct replacing synonym with exact phrase')
assert.ok(BATCH_WEAVER_SYSTEM_PROMPT.includes('interviewDefense'), 'Weaver prompt must include interview defense')
assert.ok(BATCH_WEAVER_SYSTEM_PROMPT.includes('talkingScript'), 'Weaver prompt must include spoken talking script')
assert.ok(BATCH_WEAVER_SYSTEM_PROMPT.includes('tradeOffJustification'), 'Weaver prompt must include engineering tradeoff')
console.log('  ✓ 3.1 smartKeywordWeaver embeds 5-part formula, literal JD mirroring, and interview defense scripts')

// ── Test 4: resumeAgent.validator.js Preservation ───────────────────────────
console.log('\n--- Test 4: resumeAgent.validator.js Preservation ---')
const canonicalResume = {
  candidate: { name: 'Alex Rivera', targetRole: 'Staff Software Engineer' },
  experiences: [
    {
      id: 'exp_001',
      title: 'Senior Engineer',
      company: 'Tech Corp',
      bullets: [
        { id: 'exp_001_b01', text: 'Architected distributed backend pipelines.' },
        { id: 'exp_001_b02', text: 'Built user-facing features.' },
        { id: 'exp_001_b03', text: 'Optimized PostgreSQL queries.' },
      ],
    },
  ],
}

const analysisWithNewFields = {
  analysisVersion: '2.2',
  candidateSnapshot: { name: 'Alex Rivera', targetRole: 'Staff Software Engineer' },
  dashboard: null,
  overallReview: { summary: 'Strong background in distributed backend systems.', tone: 'conversational' },
  strengths: [
    {
      id: 'str_001',
      title: 'Strong distributed systems background',
      evidence: [{ section: 'experience', itemId: 'exp_001', bulletId: 'exp_001_b01', originalText: 'Architected distributed backend pipelines.' }],
    },
  ],
  issues: [
    {
      id: 'iss_001',
      severity: 'medium',
      category: 'impact',
      title: 'Missing quantified outcome in user feature delivery',
      diagnosis: 'Candidate Activity (Task): Built user-facing features. Outcome Deficit: Lacks scale and metric impact.',
      whyItMatters: 'Hiring managers look for measurable business impact.',
      recommendation: 'Add calibrated metrics showing active users or performance turnaround.',
      correctedText: 'Engineered responsive user-facing interfaces with React partnering with product squads, reducing bounce rates by 35%.',
      evidence: [{ section: 'experience', itemId: 'exp_001', bulletId: 'exp_001_b02', originalText: 'Built user-facing features.' }],
      correctionType: 'rewrite',
      confidence: 0.95,
    },
    {
      id: 'iss_002',
      severity: 'medium',
      category: 'impact',
      title: 'Missing latency improvement metric on query tuning',
      diagnosis: 'Candidate Activity (Task): Optimized queries. Outcome Deficit: Missing latency numbers.',
      whyItMatters: 'Performance claims require metrics.',
      recommendation: 'Quantify query latency reduction percentage.',
      correctedText: 'Optimized complex PostgreSQL query execution plans, cutting p99 query latency by 45%.',
      evidence: [{ section: 'experience', itemId: 'exp_001', bulletId: 'exp_001_b03', originalText: 'Optimized PostgreSQL queries.' }],
      correctionType: 'rewrite',
      confidence: 0.95,
    },
    {
      id: 'iss_003',
      severity: 'low',
      category: 'clarity',
      title: 'Positioning clarity on distributed pipeline architecture',
      diagnosis: 'Candidate Activity (Task): Architected pipelines. Outcome Deficit: Clarify throughput.',
      whyItMatters: 'Demonstrates senior system ownership.',
      recommendation: 'Detail the event streaming throughput.',
      correctedText: 'Architected high-throughput Kafka streaming pipelines processing 10M+ daily events with 99.99% uptime.',
      evidence: [{ section: 'experience', itemId: 'exp_001', bulletId: 'exp_001_b01', originalText: 'Architected distributed backend pipelines.' }],
      correctionType: 'rewrite',
      confidence: 0.95,
    },
  ],
  priorityActions: [
    { priority: 1, title: 'Quantify impact', action: 'Add measurable scale to bullets', reason: 'High leverage fix' },
  ],
  bulletEvaluations: [
    {
      bulletId: 'exp_001_b01',
      verdict: 'helping',
      fivePartFlags: { actionVerb: true, hardSkill: true, collaboration: true, metric: true, outcome: true },
      isResponsibilityOnly: false,
      missingElements: [],
    },
  ],
  cutList: [
    {
      section: 'experience',
      itemId: 'exp_001',
      bulletId: null,
      originalText: 'References available upon request',
      reason: 'Prune obsolete reference text',
    },
  ],
  nearMissKeywords: [
    {
      resumePhrase: 'backend pipelines',
      jdPhrase: 'distributed streaming systems',
      bulletId: 'exp_001_b01',
      reason: 'ATS exact phrase matching',
    },
  ],
}

const validation = ResumeAgentValidator.validate(analysisWithNewFields, canonicalResume)
assert.strictEqual(validation.isSchemaValid, true, `Schema must be valid: ${validation.errors.join('; ')}`)
assert.ok(Array.isArray(validation.sanitizedAnalysis.bulletEvaluations), 'bulletEvaluations preserved in sanitizedAnalysis')
assert.strictEqual(validation.sanitizedAnalysis.bulletEvaluations.length, 1, 'bulletEvaluations count preserved')
assert.ok(Array.isArray(validation.sanitizedAnalysis.cutList), 'cutList preserved in sanitizedAnalysis')
assert.strictEqual(validation.sanitizedAnalysis.cutList.length, 1, 'cutList count preserved')
assert.ok(Array.isArray(validation.sanitizedAnalysis.nearMissKeywords), 'nearMissKeywords preserved in sanitizedAnalysis')
assert.strictEqual(validation.sanitizedAnalysis.nearMissKeywords.length, 1, 'nearMissKeywords count preserved')

// Test validation when fallback model omits them
const analysisWithoutNewFields = { ...analysisWithNewFields }
delete analysisWithoutNewFields.bulletEvaluations
delete analysisWithoutNewFields.cutList
delete analysisWithoutNewFields.nearMissKeywords

const fallbackValidation = ResumeAgentValidator.validate(analysisWithoutNewFields, canonicalResume)
assert.strictEqual(fallbackValidation.isSchemaValid, true, 'Fallback without new fields must still be valid')
assert.deepStrictEqual(fallbackValidation.sanitizedAnalysis.bulletEvaluations, [], 'Defaults to [] on sanitizedAnalysis')
assert.deepStrictEqual(fallbackValidation.sanitizedAnalysis.cutList, [], 'Defaults to [] on sanitizedAnalysis')
assert.deepStrictEqual(fallbackValidation.sanitizedAnalysis.nearMissKeywords, [], 'Defaults to [] on sanitizedAnalysis')

console.log('  ✓ 4.1 resumeAgent.validator preserves semantic audit fields and supplies safe defaults for fallbacks')

console.log('\n================================================================')
console.log('ALL PHASE 2 SEMANTIC AUDIT & LITERAL MIRRORING TESTS PASSED!')
console.log('================================================================')
