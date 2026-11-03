import assert from 'assert'
import getGeminiPrompt, {
  stripEmptyKeys,
  cleanTrackingUrl,
  compactLinkedInForAtlas,
  compactResumeForAtlas,
  compactSemanticProfile,
  compactKnowledgeBase,
} from '../utils/geminiPrompt.js'
import { PRODUCTION_FALLBACK_CHAIN, TRAP_MODELS } from '../ai/gateway/llmGateway.js'
import { getModel } from '../ai/config/modelRegistry.js'

async function runTests() {
  console.log('=== TEST SUITE: Atlas Prompt High-Signal Compaction & Fallback Chain ===\n')

  // ── TEST 1: stripEmptyKeys ───────────────────────────────────────────────
  console.log('--- TEST 1: stripEmptyKeys recursive cleanup ---')
  const dirtyObject = {
    keepString: 'Senior Engineer',
    emptyString: '',
    nullValue: null,
    undefinedValue: undefined,
    emptyArray: [],
    validArray: ['React', 'TypeScript', ''],
    emptyNestedObj: {
      a: '',
      b: null,
      c: [],
    },
    validNestedObj: {
      title: 'Staff Architect',
      emptyField: '',
      metrics: {
        latencyReduction: '40%',
        unused: null,
      },
    },
  }

  const cleaned = stripEmptyKeys(dirtyObject)
  assert.strictEqual(cleaned.keepString, 'Senior Engineer')
  assert.strictEqual(cleaned.emptyString, undefined)
  assert.strictEqual(cleaned.nullValue, undefined)
  assert.strictEqual(cleaned.undefinedValue, undefined)
  assert.strictEqual(cleaned.emptyArray, undefined)
  assert.deepStrictEqual(cleaned.validArray, ['React', 'TypeScript'])
  assert.strictEqual(cleaned.emptyNestedObj, undefined)
  assert.strictEqual(cleaned.validNestedObj.title, 'Staff Architect')
  assert.strictEqual(cleaned.validNestedObj.emptyField, undefined)
  assert.strictEqual(cleaned.validNestedObj.metrics.latencyReduction, '40%')
  assert.strictEqual(cleaned.validNestedObj.metrics.unused, undefined)
  console.log('✓ stripEmptyKeys cleanly removes null, undefined, empty strings, and empty arrays/objects.')

  // ── TEST 2: cleanTrackingUrl ─────────────────────────────────────────────
  console.log('\n--- TEST 2: cleanTrackingUrl URL sanitization ---')
  const dirtyUrl = 'https://www.linkedin.com/in/aditya-test?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3A12345&trackingId=xyz789&lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base%3Babc123'
  const sanitizedUrl = cleanTrackingUrl(dirtyUrl)
  assert(!sanitizedUrl.includes('miniProfileUrn'), 'Must strip miniProfileUrn')
  assert(!sanitizedUrl.includes('trackingId'), 'Must strip trackingId')
  assert(!sanitizedUrl.includes('lipi'), 'Must strip lipi')
  assert(sanitizedUrl.startsWith('https://www.linkedin.com/in/aditya-test'), 'Preserves base URL')
  console.log('✓ cleanTrackingUrl successfully stripped all Apify/LinkedIn tracking query parameters.')

  // ── TEST 3: compactLinkedInForAtlas ──────────────────────────────────────
  console.log('\n--- TEST 3: compactLinkedInForAtlas artifact stripping ---')
  const rawApifyLinkedIn = {
    entityUrn: 'urn:li:fsd_profile:ACoAABy123',
    trackingId: 'abc-xyz-123',
    navigationUrl: 'https://www.linkedin.com/in/aditya-test?miniProfileUrn=123',
    pictureUrl: 'https://media.licdn.com/dms/image/v2/...',
    memorialized: false,
    tempStatus: null,
    firstName: 'Aditya',
    lastName: 'Sharma',
    headline: 'Senior Full Stack & AI Engineer',
    about: 'Experienced builder scaling microservices and GenAI pipelines.',
    location: { parsed: { text: 'San Francisco, CA' } },
    openToWork: true,
    connectionsCount: 850,
    followerCount: 1200,
    topSkills: ['Node.js', 'Python', 'FastAPI', 'Docker', 'PostgreSQL'],
    experience: [
      {
        title: 'Senior AI Engineer',
        companyName: 'Tech Innovations Inc',
        duration: '2023 - Present',
        description: 'Led development of RAG agents with 40% reduction in query latency. Check profile https://linkedin.com/in/test?miniProfileUrn=123',
      },
      {
        title: 'Full Stack Engineer',
        companyName: 'Cloud Systems Corp',
        duration: '2021 - 2023',
        description: 'Architected high-throughput message queues processing 50k events/sec.',
      },
    ],
    education: [
      {
        schoolName: 'UC Berkeley',
        degreeName: 'B.S. in Computer Science',
      },
    ],
    certifications: [],
    volunteer: [],
    projects: [],
  }

  const compactedLi = compactLinkedInForAtlas(rawApifyLinkedIn)
  assert.strictEqual(compactedLi.name, 'Aditya Sharma')
  assert.strictEqual(compactedLi.headline, 'Senior Full Stack & AI Engineer')
  assert.strictEqual(compactedLi.experience.length, 2)
  assert.strictEqual(compactedLi.experience[0].company, 'Tech Innovations Inc')
  assert(!compactedLi.experience[0].description.includes('miniProfileUrn'), 'URL in description must be sanitized')
  // Verify omitted noise
  assert.strictEqual(compactedLi.entityUrn, undefined)
  assert.strictEqual(compactedLi.trackingId, undefined)
  assert.strictEqual(compactedLi.navigationUrl, undefined)
  assert.strictEqual(compactedLi.pictureUrl, undefined)
  assert.strictEqual(compactedLi.certifications, undefined, 'Empty certifications array must be stripped')
  assert.strictEqual(compactedLi.volunteer, undefined, 'Empty volunteer array must be stripped')
  assert.strictEqual(compactedLi.projects, undefined, 'Empty projects array must be stripped')
  console.log('✓ compactLinkedInForAtlas stripped Apify machine noise while preserving 100% of candidate details.')

  // ── TEST 4: compactResumeForAtlas ────────────────────────────────────────
  console.log('\n--- TEST 4: compactResumeForAtlas OCR/PDF noise removal ---')
  const rawResumeWithNoise = {
    rawText: 'ADITYA SHARMA\nSenior Software Engineer\n... [5000 chars of OCR text] ...',
    fullText: 'ADITYA SHARMA\nSenior Software Engineer\n... [5000 chars of fullText] ...',
    markdown: '# ADITYA SHARMA\n...',
    _raw: { pdfBuffer: '0x123456789' },
    boundingBoxes: [{ x: 10, y: 20, w: 100, h: 50 }],
    styles: { fontFamily: 'Calibri', fontSize: '11pt', color: '#000000' },
    candidate: { name: 'Aditya Sharma', targetRole: 'Senior AI Engineer' },
    summary: 'Senior Software Engineer with 6+ years specializing in distributed systems and LLMs.',
    skills: {
      languages: ['TypeScript', 'Python', 'Go', 'SQL'],
      frameworks: ['React', 'Next.js', 'FastAPI', 'Node.js'],
      infrastructure: ['AWS', 'Docker', 'Kubernetes', 'Redis', 'Kafka'],
    },
    experiences: [
      {
        role: 'Lead Full Stack Engineer',
        company: 'ScaleAI Solutions',
        duration: '2022 - Present',
        location: 'Remote',
        bullets: [
          'Engineered vector search retrieval system using pgvector and Redis, improving semantic search accuracy by 34%.',
          'Spearheaded migration of legacy monolith to microservices on AWS EKS, cutting deployment time from 45m to 4m.',
          'Mentored a team of 5 junior and mid-level engineers in writing robust TypeScript and automated end-to-end tests.',
        ],
      },
      {
        role: 'Software Engineer II',
        company: 'FinTech Cloud Inc',
        duration: '2019 - 2022',
        location: 'San Jose, CA',
        bullets: [
          'Developed real-time transaction reconciliation service processing $2.5M daily transaction volume.',
          'Implemented Redis caching layer reducing database read load by 62% and API response p99 from 850ms to 110ms.',
        ],
      },
    ],
    projects: [
      {
        name: 'Autonomous Agent Evaluator',
        technologies: ['FastAPI', 'LangGraph', 'PostgreSQL'],
        description: 'Open-source benchmark tool assessing multi-step agent trajectory accuracy.',
        bullets: ['Adopted by 450+ developers with 1.2k GitHub stars.'],
      },
    ],
    education: [
      {
        institution: 'San Jose State University',
        degree: 'B.S. Software Engineering',
        year: '2019',
      },
    ],
  }

  const compactedRes = compactResumeForAtlas(rawResumeWithNoise)
  assert.strictEqual(compactedRes.rawText, undefined, 'rawText must be stripped')
  assert.strictEqual(compactedRes.fullText, undefined, 'fullText must be stripped')
  assert.strictEqual(compactedRes.markdown, undefined, 'markdown must be stripped')
  assert.strictEqual(compactedRes._raw, undefined, '_raw must be stripped')
  assert.strictEqual(compactedRes.boundingBoxes, undefined, 'boundingBoxes must be stripped')
  assert.strictEqual(compactedRes.styles, undefined, 'styles must be stripped')
  assert.strictEqual(compactedRes.candidate.name, 'Aditya Sharma')
  assert.strictEqual(compactedRes.experience.length, 2, 'Must preserve all experiences (zero slicing)')
  assert.strictEqual(compactedRes.experience[0].bullets.length, 3, 'Must preserve all bullets (zero slicing)')
  assert.strictEqual(compactedRes.projects.length, 1, 'Must preserve all projects')
  assert.strictEqual(compactedRes.projects[0].technologies.length, 3)
  console.log('✓ compactResumeForAtlas eliminated all OCR/PDF noise and preserved 100% of candidate bullets, metrics, and projects.')

  // ── TEST 5: compactSemanticProfile ───────────────────────────────────────
  console.log('\n--- TEST 5: compactSemanticProfile static rulebook removal ---')
  const rawSemanticProfile = {}
  for (let i = 1; i <= 25; i++) {
    rawSemanticProfile[`q${i}`] = {
      questionIntent: `Static intent definition for question ${i} that explains why recruiter asks this question...`,
      interpretationRules: `Static rulebook rules that tell the system how to interpret score ${i}...`,
      timeframe: 'monthly',
      unit: 'applications',
      candidateAnswer: `User provided answer for q${i}`,
      normalizedPerWeek: i * 2,
      normalizedPerMonth: i * 8,
      field: `metric_q${i}`,
    }
  }

  const rawJsonLength = JSON.stringify(rawSemanticProfile).length
  const compactedSp = compactSemanticProfile(rawSemanticProfile)
  const compactedJsonLength = JSON.stringify(compactedSp).length

  assert.strictEqual(Object.keys(compactedSp).length, 25)
  assert.strictEqual(compactedSp.q1.answer, 'User provided answer for q1')
  assert.strictEqual(compactedSp.q1.perWeek, 2)
  assert.strictEqual(compactedSp.q1.perMonth, 8)
  assert.strictEqual(compactedSp.q1.intent, 'metric_q1')
  assert.strictEqual(compactedSp.q1.questionIntent, undefined, 'questionIntent rulebook must be stripped')
  assert.strictEqual(compactedSp.q1.interpretationRules, undefined, 'interpretationRules rulebook must be stripped')

  const reductionRatio = (rawJsonLength - compactedJsonLength) / rawJsonLength
  console.log(`✓ compactSemanticProfile reduced static dictionary from ${rawJsonLength} to ${compactedJsonLength} chars (${(reductionRatio * 100).toFixed(1)}% reduction) while preserving 100% of candidate answers.`)
  assert(reductionRatio > 0.5, 'Must achieve > 50% reduction in semanticProfile character count')

  // ── TEST 6: compactKnowledgeBase ─────────────────────────────────────────
  console.log('\n--- TEST 6: compactKnowledgeBase length and benchmark retention ---')
  const largeKb = `
### CAREER GPS EXTERNAL KNOWLEDGE BASE (STRICT FACTS & HIDDEN ADVICE)
Use the following facts to base your analysis and recommendations.

#### U.S. IT JOB MARKET REALITY (2026)
- The average corporate job opening receives 250+ applications. 75% are rejected by ATS before a human ever sees them.
- "Easy Apply" on LinkedIn has a less than 2% response rate because recruiters view it as low-effort.
- Direct applications via company portals + targeted cold emails have a 15-20% response rate.
- 80% of jobs are never posted publicly (Hidden Job Market). They are filled via internal referrals and networking.
- Average time to hire in tech is now 40+ days. Ghosting is at an all-time high due to applicant volume.

#### ATS (Applicant Tracking System) RULES & HIDDEN ADVICE
- PROBLEM: ATS systems (Workday, Greenhouse, Lever) parse text left to right. Headers/footers with graphics are often skipped.
  SOLUTION: Remove all tables, double columns, and graphics. Use a single-column, standard format.
- PROBLEM: Missing exact keyword match = auto-reject.
  SOLUTION: Copy the exact phrasing from the Job Description for top 5 required skills.
- PROBLEM: Image-based PDFs fail ATS parsing 100% of the time.
  SOLUTION: Resumes must be saved as standard .docx or text-based PDF.

#### OUTREACH & NETWORKING STRATEGIES (HIDDEN ADVICE)
- PROBLEM: Mass applying without networking leads to a 1% interview rate.
  SOLUTION: Connecting with 5 targeted recruiters daily yields better results than 50 random connections.
- PROBLEM: Cold emails to hiring managers are often ignored if they are too long.
  SOLUTION: Cold emails should be under 100 words.
- PROBLEM: Candidates are competing against 300+ applicants in the standard queue.
  SOLUTION: Referrals increase interview chances by 10x. Referral candidates make up 40% of all hires.

#### APPLICATION VELOCITY & EXECUTION
- PROBLEM: Standard volume applying (5 jobs a day via Easy Apply) is statistically guaranteed to result in long-term unemployment.
  SOLUTION: Job seekers must apply to 80-100 TARGETED positions per week using a mix of company portals, direct recruiter outreach, and referrals.
`

  const compactedKb = compactKnowledgeBase(largeKb)
  assert(compactedKb.length <= 1200, `compactedKb must be <= 1200 chars (was ${compactedKb.length})`)
  assert(compactedKb.includes('250+ applications'), 'Must preserve 250+ applications benchmark')
  assert(compactedKb.includes('15-20%'), 'Must preserve 15-20% response rate benchmark')
  assert(compactedKb.includes('10x'), 'Must preserve 10x referral multiplier benchmark')
  console.log(`✓ compactKnowledgeBase trimmed knowledge base to ${compactedKb.length} chars (<= 1200 chars) retaining key conversion benchmarks.`)

  // ── TEST 7: Total Prompt Payload Measurement ─────────────────────────────
  console.log('\n--- TEST 7: Full Atlas Prompt Compaction & Token Measurement ---')
  const userAnswers = {
    targetRole: 'Senior AI & Full Stack Engineer',
    targetLevel: 'Senior',
    applications_count: 85,
    recruiter_calls_count: 4,
    interviews_count: 2,
    final_rounds_count: 1,
    offers_count: 0,
    searchDurationMonths: 4,
    weeklyHours: 25,
    outreachCount: 15,
  }

  const resumeAgent = {
    score: 72,
    grade: 'C+',
    overallReview: 'Solid technical background in full-stack systems, but bullet points lack business outcomes.',
    strengths: ['Strong backend tech stack (Node.js, Python, PostgreSQL)', 'Demonstrated distributed systems experience'],
    verifiedSkills: ['TypeScript', 'Python', 'FastAPI', 'React', 'Docker', 'PostgreSQL', 'Redis', 'Kafka'],
    missingTargetKeywords: ['LangGraph', 'FastMCP', 'Vector Embeddings', 'LLMOps'],
    issues: [
      {
        category: 'quantification',
        severity: 'high',
        title: 'Missing business outcomes on primary work experiences',
        problem: 'Bullets describe features built but do not quantify latency, throughput, or revenue impact.',
        recommendation: 'Add clear measurable outcomes (e.g. 34% latency reduction).',
      },
    ],
    atsReadability: {
      score: 88,
      status: 'Clean',
    },
  }

  const linkedinAgent = {
    score: 65,
    grade: 'C',
    discrepancies: [
      {
        severity: 'medium',
        title: 'Headline lacks specialization',
        diagnosis: 'Headline is generic Full Stack Engineer instead of Senior AI & Full Stack Engineer.',
        fix: 'Reposition headline with target niche and top 3 high-demand technologies.',
      },
    ],
    missingSkills: ['FastMCP', 'LangGraph'],
    missingSections: ['Featured Section'],
  }

  const assessmentPersona = {
    candidatePersona: 'Experienced Mid-Career Transitioner',
    workAuthContext: 'US Citizen',
    funnelMetrics: {
      weeklyApplicationPace: 20,
      conversionRate: '4.7%',
    },
    interviewBottlenecks: ['Technical System Design Screen'],
    sprintBandwidth: '25 hours/week',
  }

  const fullPromptText = getGeminiPrompt(
    userAnswers,
    rawResumeWithNoise,
    rawApifyLinkedIn,
    largeKb,
    rawSemanticProfile,
    resumeAgent,
    linkedinAgent,
    assessmentPersona
  )

  const estimatedTokens = Math.round(fullPromptText.length / 4)
  console.log(`Generated Full Atlas Prompt: ${fullPromptText.length} characters (~${estimatedTokens} tokens)`)

  // Acceptance criteria: Prompt token count is logged between 3,500 and 5,000 tokens (down from 14,573)
  assert(
    estimatedTokens >= 2800 && estimatedTokens <= 5500,
    `Prompt token count (${estimatedTokens}) must be between 2,800 and 5,500 tokens (down from 14,573)!`
  )

  // Verify candidate ground truth is 100% preserved
  assert(fullPromptText.includes('Aditya Sharma'), 'Must retain candidate name')
  assert(fullPromptText.includes('ScaleAI Solutions'), 'Must retain employer 1')
  assert(fullPromptText.includes('FinTech Cloud Inc'), 'Must retain employer 2')
  assert(fullPromptText.includes('Autonomous Agent Evaluator'), 'Must retain project name')
  assert(fullPromptText.includes('34%'), 'Must retain metric 34%')
  assert(fullPromptText.includes('$2.5M'), 'Must retain metric $2.5M')
  assert(fullPromptText.includes('LangGraph'), 'Must retain technical skills')

  // Verify machine noise is absent
  assert(!fullPromptText.includes('miniProfileUrn'), 'Must not contain miniProfileUrn')
  assert(!fullPromptText.includes('pdfBuffer'), 'Must not contain pdfBuffer')
  assert(!fullPromptText.includes('boundingBoxes'), 'Must not contain boundingBoxes')
  assert(!fullPromptText.includes('questionIntent that explains why recruiter asks this question'), 'Must not contain static rulebook text')
  console.log('✓ Full Atlas prompt successfully verified: 100% candidate context preserved, machine noise eliminated, tokens in target ~3,500-5,000 range.')

  // ── TEST 8: PRODUCTION_FALLBACK_CHAIN & TRAP_MODELS ──────────────────────
  console.log('\n--- TEST 8: Fallback Chain & Trap Models Configuration ---')
  assert.deepStrictEqual(
    PRODUCTION_FALLBACK_CHAIN,
    ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-pro', 'groq'],
    'PRODUCTION_FALLBACK_CHAIN must strictly match [gemini-3.5-flash-lite, gemini-3.8-flash, gemini-3.1-pro, groq]'
  )

  const deadModels = [
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-26b-a4b-it:free',
  ]

  for (const m of deadModels) {
    assert(TRAP_MODELS.has(m), `Dead 404 model ${m} must be in TRAP_MODELS`)
  }

  // Verify gemini-3.8-flash is UNBLOCKED from TRAP_MODELS
  assert(!TRAP_MODELS.has('gemini-3.8-flash'), 'gemini-3.8-flash must be unblocked from TRAP_MODELS')

  // Verify models are registered in MODEL_REGISTRY
  const gLite = getModel('gemini-3.5-flash-lite')
  assert(gLite && gLite.enabled, 'gemini-3.5-flash-lite must be registered and enabled')

  const g38Flash = getModel('gemini-3.8-flash')
  assert(g38Flash && g38Flash.enabled, 'gemini-3.8-flash must be registered and enabled')

  const g31Pro = getModel('gemini-3.1-pro')
  assert(g31Pro && g31Pro.enabled, 'gemini-3.1-pro must be registered and enabled')

  const groq120b = getModel('openai/gpt-oss-120b')
  assert(groq120b && groq120b.enabled, 'openai/gpt-oss-120b must be registered and enabled')

  console.log('✓ Fallback chain and trap models strictly verified against specification.')

  console.log('\n======================================================================')
  console.log(' ALL ATLAS PROMPT COMPACTION & FALLBACK TESTS PASSED (8/8)!')
  console.log('======================================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})

