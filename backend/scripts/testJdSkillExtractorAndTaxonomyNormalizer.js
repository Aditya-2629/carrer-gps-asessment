import assert from 'assert'
import {
  SKILL_EXTRACTION_SYSTEM_PROMPT,
  buildSkillExtractionUserMessage,
  TAXONOMY_NORMALIZER_SYSTEM_PROMPT,
  buildTaxonomyNormalizerUserMessage,
  extractSkillsFromSingleJd,
  normalizeTaxonomyWithLLM,
  normalizeCanonicalSkill,
  analyzeAndAggregateJdCorpus,
  TAXONOMY_CANONICAL_CACHE,
} from '../agents/resume/market/llmJdSkillAnalyzer.js'

async function runTests() {
  console.log('=== TEST SUITE: 2-Step JD Skill Extractor & Taxonomy Normalizer ===\n')

  // TEST 1: System Prompts & Template Verification
  console.log('[Test 1] Verifying System Prompts & User Message Templates...')
  assert(SKILL_EXTRACTION_SYSTEM_PROMPT.includes('talent taxonomy engine'), 'Extraction prompt must match specification')
  assert(SKILL_EXTRACTION_SYSTEM_PROMPT.includes('CATEGORIES TO EXTRACT'), 'Must include categories list')
  assert(SKILL_EXTRACTION_SYSTEM_PROMPT.includes('STRICT EXCLUSIONS'), 'Must include strict exclusions list')
  assert(SKILL_EXTRACTION_SYSTEM_PROMPT.includes('"required"'), 'Must specify "required" rule')
  assert(SKILL_EXTRACTION_SYSTEM_PROMPT.includes('"preferred"'), 'Must specify "preferred" rule')

  const userMsg = buildSkillExtractionUserMessage('Senior Data Analyst', 'Must know SQL and Python. Nice to have: Docker.')
  assert.strictEqual(userMsg, 'Job Title: Senior Data Analyst\n\nJob Description:\nMust know SQL and Python. Nice to have: Docker.')

  assert(TAXONOMY_NORMALIZER_SYSTEM_PROMPT.includes('technical taxonomy normalizer'), 'Normalizer prompt must match specification')
  assert(TAXONOMY_NORMALIZER_SYSTEM_PROMPT.includes('Map each raw input term to its official, canonical industry name'))
  assert(TAXONOMY_NORMALIZER_SYSTEM_PROMPT.includes('map its canonical value to an empty string ""'))

  const normUserMsg = buildTaxonomyNormalizerUserMessage(['postgres', 'communication'])
  assert(normUserMsg.includes('postgres') && normUserMsg.includes('communication'), 'Normalizer user message must serialize input terms')
  console.log('✔ Test 1 Passed: System instructions and user templates verified.\n')

  // TEST 2: Step 1 Skill Extraction (Per-JD Analysis)
  console.log('[Test 2] Testing Step 1: Per-JD Skill Extraction...')
  const sampleJd = {
    title: 'Senior Analytics Engineer',
    description: `
      About the Role:
      We are looking for a Senior Analytics Engineer to join our growing team.
      
      Required Qualifications:
      - 4+ years experience with SQL and data modeling
      - Strong proficiency in Python for data pipelines
      - Proven experience building transformation models with Snowflake
      
      Preferred / Nice to Have:
      - Hands-on experience with dbt Core or Cloud
      - Familiarity with Airflow DAG orchestration
      - AWS or GCP cloud knowledge
      
      Benefits:
      - Health insurance, 401(k), unlimited PTO
      - Excellent communication and leadership skills needed
    `,
  }

  const extraction = await extractSkillsFromSingleJd({
    jobTitle: sampleJd.title,
    jobDescription: sampleJd.description,
    timeoutMs: 15000,
  })

  console.log('Extracted Skills:', extraction)
  assert(Array.isArray(extraction.required), 'Required must be an array')
  assert(Array.isArray(extraction.preferred), 'Preferred must be an array')

  const requiredLower = extraction.required.map((s) => s.toLowerCase())
  const preferredLower = extraction.preferred.map((s) => s.toLowerCase())
  const allExtracted = [...requiredLower, ...preferredLower]

  assert(allExtracted.some((s) => s.includes('sql')), 'SQL must be extracted')
  assert(allExtracted.some((s) => s.includes('python')), 'Python must be extracted')
  assert(allExtracted.some((s) => s.includes('snowflake')), 'Snowflake must be extracted')

  // Verify exclusions: soft skills, benefits, nouns must NOT be in extraction
  assert(!allExtracted.includes('communication'), '"communication" must be excluded as soft skill')
  assert(!allExtracted.includes('leadership'), '"leadership" must be excluded as soft skill')
  assert(!allExtracted.includes('unlimited pto'), '"unlimited pto" must be excluded as benefit')
  console.log('✔ Test 2 Passed: Per-JD skill extraction accurately captures technical tools while excluding noise.\n')

  // TEST 3: Step 2 Canonical Taxonomy Normalization
  console.log('[Test 3] Testing Step 2: Taxonomy Normalization...')
  const rawTermsToNormalize = [
    'postgres',
    'k8s',
    'power bi',
    'communication',
    'insights',
    'node js',
    'analytics',
    'dbt core',
    'server',
  ]

  const normalizations = await normalizeTaxonomyWithLLM(rawTermsToNormalize, 20000)
  console.log('Taxonomy Mappings:')
  for (const [term, canon] of normalizations.entries()) {
    console.log(`  "${term}" -> "${canon}"`)
  }

  // Canonical mapping assertions
  assert.strictEqual(normalizations.get('postgres'), 'PostgreSQL', '"postgres" must map to "PostgreSQL"')
  assert.strictEqual(normalizations.get('k8s'), 'Kubernetes', '"k8s" must map to "Kubernetes"')
  assert.strictEqual(normalizations.get('power bi'), 'Power BI', '"power bi" must map to "Power BI"')
  assert.strictEqual(normalizations.get('node js'), 'Node.js', '"node js" must map to "Node.js"')

  // Noise rejection assertions (mapped to empty string "")
  assert.strictEqual(normalizations.get('communication'), '', '"communication" must map to ""')
  assert.strictEqual(normalizations.get('insights'), '', '"insights" must map to ""')
  assert.strictEqual(normalizations.get('analytics'), '', '"analytics" must map to ""')
  assert.strictEqual(normalizations.get('server'), '', '"server" must map to ""')
  console.log('✔ Test 3 Passed: Taxonomy normalization correctly standardizes tools and maps noise to "".\n')

  // TEST 4: Full 2-Step Corpus Aggregation
  console.log('[Test 4] Testing Full 2-Step Corpus Aggregation across Sample Postings...')
  const testJdCorpus = [
    {
      title: 'Data Analyst',
      company: 'Alpha Corp',
      description: 'Requirements: Proficient in SQL, Python, and Snowflake. Bonus: dbt experience.',
    },
    {
      title: 'BI Analyst',
      company: 'Beta Inc',
      description: 'Required: SQL, Power BI, and Tableau. Experience with communication is expected.',
    },
    {
      title: 'Data Engineer',
      company: 'Gamma Tech',
      description: 'Core requirements: SQL, Python, PostgreSQL, and Snowflake. Preferred: dbt.',
    },
  ]

  const corpusResult = await analyzeAndAggregateJdCorpus(testJdCorpus, 'data-analyst::3-5')
  assert.strictEqual(corpusResult.totalAnalyzed, 3, 'All 3 JDs must be analyzed')
  assert(Array.isArray(corpusResult.marketSkills), 'marketSkills must be array')
  assert(corpusResult.marketSkills.length > 0, 'marketSkills must not be empty')

  console.log('Aggregated Market Skills:')
  corpusResult.marketSkills.forEach((s) => {
    console.log(`  ${s.name}: ${s.percentage}% (${s.count}/${corpusResult.totalAnalyzed} JDs) [Priority: ${s.priority}, Required: ${s.requiredCount}, Preferred: ${s.preferredCount}]`)
  })

  // SQL should be in 100% of postings (3 of 3)
  const sql = corpusResult.marketSkills.find((s) => s.name === 'SQL')
  assert(sql, 'SQL must be in marketSkills')
  assert.strictEqual(sql.count, 3, 'SQL should appear in all 3 JDs')
  assert.strictEqual(sql.percentage, 100, 'SQL percentage should be 100%')

  // Zero noise in final marketSkills
  corpusResult.marketSkills.forEach((s) => {
    assert(s.name.length >= 2, 'Skill name must be at least 2 chars')
    assert(!/^(communication|insights|server|data|into|your)$/i.test(s.name), `Noise "${s.name}" present in marketSkills!`)
  })
  console.log('✔ Test 4 Passed: Full 2-step corpus aggregation verified.\n')

  console.log('=================================================================')
  console.log('ALL 2-STEP JD SKILL EXTRACTOR & TAXONOMY NORMALIZER TESTS PASSED!')
  console.log('=================================================================')
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err)
  process.exit(1)
})

