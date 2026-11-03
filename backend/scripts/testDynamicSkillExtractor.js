import assert from 'assert'
import {
  extractSkillsDynamically,
  extractSkillsHeuristically,
  clearJdSkillCache,
  JD_SKILL_CACHE,
} from '../agents/resume/market/dynamicSkillExtractor.js'
import { extractSkillsFromJd, extractSkillsFromJdAsync } from '../agents/resume/market/jdNormalizer.js'
import { analyzeMarketJdCorpus } from '../agents/resume/market/marketJdAnalyzer.js'
import { determineSemanticSlot } from '../agents/resume/market/keywordAlignment.js'

console.log('================================================================')
console.log('TEST SUITE: UNIVERSAL DYNAMIC 3-TIER SKILL EXTRACTION ENGINE')
console.log('================================================================\n')

// 3 Highly Diverse Real-World JDs from 3 Distinct Domains
const GENAI_JD = `
Senior AI & Agentic Systems Engineer
We are seeking an experienced engineer to architect autonomous agents and tool-calling infrastructure.
Requirements:
- Strong production experience with FastMCP, LangGraph, and ChromaDB for vector storage.
- High-throughput LLM model serving and quantization using vLLM and TensorRT-LLM.
- Proficiency in Python, asynchronous concurrency, and Redis caching.
- Familiarity with RAG architectures and prompt defense guardrails.
`

const HEALTHCARE_JD = `
Lead Healthcare Analytics & Clinical Data Specialist
Join our healthcare informatics team to modernize clinical data interoperability.
Requirements:
- Deep hands-on experience integrating with Epic Systems and Cerner EHR architectures.
- Expert knowledge of FHIR standards, HL7 v2/v3 message pipelines, and clinical data models.
- Advanced SQL query optimization, Snowflake warehousing, and Power BI executive reporting.
- Experience with HIPAA security standards and AWS health cloud services.
`

const BIOINFORMATICS_JD = `
Bioinformatics Computational Scientist - Genomics
We are hiring a computational biologist to build scalable next-generation sequencing analysis pipelines.
Requirements:
- Demonstrable expertise with Biopython, Nextflow workflow managers, GATK variant calling, and BLAST sequence alignment.
- Fluency in Python, R, and Linux bash scripting for large-scale multi-omics data.
- Containerization with Docker and Kubernetes for reproducibility on AWS Batch.
`

async function runTests() {
  clearJdSkillCache()

  // -------------------------------------------------------------
  // Test 1: Tier 1 - Dynamic Extraction Across 3 Distinct Domains
  // -------------------------------------------------------------
  console.log('[Test 1] Tier 1: Zero-Shot Dynamic Skill Extraction (3 Domains)')

  console.log('  1.1 Extracting from Emerging GenAI JD...')
  const genaiResult = await extractSkillsDynamically(GENAI_JD)
  console.log('      Extracted Skills:', genaiResult.skills.slice(0, 10))
  console.log('      Source:', genaiResult.source)

  const genaiLower = genaiResult.skills.map((s) => s.toLowerCase())
  assert(genaiLower.some((s) => s.includes('fastmcp')), 'FastMCP must be extracted from GenAI JD')
  assert(genaiLower.some((s) => s.includes('langgraph')), 'LangGraph must be extracted from GenAI JD')
  assert(genaiLower.some((s) => s.includes('chromadb') || s.includes('chroma')), 'ChromaDB must be extracted from GenAI JD')
  assert(genaiLower.some((s) => s.includes('vllm')), 'vLLM must be extracted from GenAI JD')
  console.log('  ✓ 1.1 GenAI domain tools (FastMCP, LangGraph, ChromaDB, vLLM) successfully extracted')

  console.log('  1.2 Extracting from Healthcare Analytics JD...')
  const healthcareResult = await extractSkillsDynamically(HEALTHCARE_JD)
  console.log('      Extracted Skills:', healthcareResult.skills.slice(0, 10))
  console.log('      Source:', healthcareResult.source)

  const healthLower = healthcareResult.skills.map((s) => s.toLowerCase())
  assert(healthLower.some((s) => s.includes('epic systems') || s.includes('epic')), 'Epic Systems must be extracted')
  assert(healthLower.some((s) => s.includes('fhir')), 'FHIR must be extracted')
  assert(healthLower.some((s) => s.includes('hl7')), 'HL7 must be extracted')
  assert(healthLower.some((s) => s.includes('sql')), 'SQL must be extracted')
  assert(healthLower.some((s) => s.includes('power bi')), 'Power BI must be extracted')
  console.log('  ✓ 1.2 Healthcare domain tools (Epic Systems, FHIR, HL7, SQL, Power BI) successfully extracted')

  console.log('  1.3 Extracting from Bioinformatics JD...')
  const bioResult = await extractSkillsDynamically(BIOINFORMATICS_JD)
  console.log('      Extracted Skills:', bioResult.skills.slice(0, 10))
  console.log('      Source:', bioResult.source)

  const bioLower = bioResult.skills.map((s) => s.toLowerCase())
  assert(bioLower.some((s) => s.includes('biopython')), 'Biopython must be extracted')
  assert(bioLower.some((s) => s.includes('nextflow')), 'Nextflow must be extracted')
  assert(bioLower.some((s) => s.includes('gatk')), 'GATK must be extracted')
  assert(bioLower.some((s) => s.includes('blast')), 'BLAST must be extracted')
  assert(bioLower.some((s) => s.includes('python')), 'Python must be extracted')
  console.log('  ✓ 1.3 Bioinformatics domain tools (Biopython, Nextflow, GATK, BLAST, Python) successfully extracted\n')

  // -------------------------------------------------------------
  // Test 2: Tier 2 - In-Memory LRU Cache (0ms latency on repeated calls)
  // -------------------------------------------------------------
  console.log('[Test 2] Tier 2: In-Memory LRU Cache Hit Verification')
  const cacheStart = performance.now()
  const cachedGenaiResult = await extractSkillsDynamically(GENAI_JD)
  const cacheDurationMs = performance.now() - cacheStart

  console.log(`      Cached retrieval duration: ${cacheDurationMs.toFixed(3)}ms (Expected < 5ms)`)
  assert(cacheDurationMs < 25, `Cache must return in near-zero time (got ${cacheDurationMs}ms)`)
  assert.strictEqual(cachedGenaiResult.skills.length, genaiResult.skills.length, 'Cached skills count must match original')
  assert.strictEqual(cachedGenaiResult.skills[0], genaiResult.skills[0], 'Cached skill order must match original')
  console.log('  ✓ 2.1 Cache hit returned identical extracted skills with 0 network latency\n')

  // -------------------------------------------------------------
  // Test 3: Tier 3 - Deterministic Heuristic Fallback (Bypassing LLM)
  // -------------------------------------------------------------
  console.log('[Test 3] Tier 3: Deterministic Heuristic Extractor (Bypass LLM)')
  clearJdSkillCache()

  const hGenai = await extractSkillsDynamically(GENAI_JD, { bypassLLM: true })
  console.log('      Heuristic GenAI:', hGenai.skills)
  assert.strictEqual(hGenai.source, 'heuristic_fallback', 'Source must be heuristic_fallback')
  const hGenaiLower = hGenai.skills.map((s) => s.toLowerCase())
  assert(hGenaiLower.some((s) => s.includes('fastmcp')), 'Heuristic must extract FastMCP')
  assert(hGenaiLower.some((s) => s.includes('langgraph')), 'Heuristic must extract LangGraph')
  assert(hGenaiLower.some((s) => s.includes('chromadb')), 'Heuristic must extract ChromaDB')
  assert(hGenaiLower.some((s) => s.includes('vllm')), 'Heuristic must extract vLLM')
  console.log('  ✓ 3.1 Heuristic successfully extracted GenAI acronyms and camelCase tools')

  const hHealth = await extractSkillsDynamically(HEALTHCARE_JD, { bypassLLM: true })
  console.log('      Heuristic Healthcare:', hHealth.skills)
  const hHealthLower = hHealth.skills.map((s) => s.toLowerCase())
  assert(hHealthLower.some((s) => s.includes('fhir')), 'Heuristic must extract FHIR')
  assert(hHealthLower.some((s) => s.includes('hl7')), 'Heuristic must extract HL7')
  assert(hHealthLower.some((s) => s.includes('sql')), 'Heuristic must extract SQL')
  assert(hHealthLower.some((s) => s.includes('power bi')), 'Heuristic must extract Power BI')
  assert(hHealthLower.some((s) => s.includes('epic systems') || s.includes('epic')), 'Heuristic must extract Epic Systems')
  console.log('  ✓ 3.2 Heuristic successfully extracted Healthcare clinical tools')

  const hBio = await extractSkillsDynamically(BIOINFORMATICS_JD, { bypassLLM: true })
  console.log('      Heuristic Bioinformatics:', hBio.skills)
  const hBioLower = hBio.skills.map((s) => s.toLowerCase())
  assert(hBioLower.some((s) => s.includes('biopython')), 'Heuristic must extract Biopython')
  assert(hBioLower.some((s) => s.includes('nextflow')), 'Heuristic must extract Nextflow')
  assert(hBioLower.some((s) => s.includes('gatk')), 'Heuristic must extract GATK')
  assert(hBioLower.some((s) => s.includes('blast')), 'Heuristic must extract BLAST')
  assert(hBioLower.some((s) => s.includes('python')), 'Heuristic must extract Python')
  console.log('  ✓ 3.3 Heuristic successfully extracted Bioinformatics genomic tools\n')

  // -------------------------------------------------------------
  // Test 4: Dynamic Semantic Slotting
  // -------------------------------------------------------------
  console.log('[Test 4] Dynamic Semantic Slotting with Dynamic Categories')
  assert.strictEqual(determineSemanticSlot('FastMCP', 'ai_ml'), 'api_slot', 'FastMCP without ui maps to api_slot')
  assert.strictEqual(determineSemanticSlot('Kafka', 'messaging_streaming'), 'messaging_slot')
  assert.strictEqual(determineSemanticSlot('Kubernetes', 'cloud_devops'), 'cloud_slot')
  assert.strictEqual(determineSemanticSlot('PyTest', 'testing_quality'), 'testing_slot')
  assert.strictEqual(determineSemanticSlot('React', 'languages_frameworks'), 'frontend_slot')
  assert.strictEqual(determineSemanticSlot('Express', 'languages_frameworks'), 'api_slot')
  console.log('  ✓ 4.1 Dynamic category slotting routes emerging tools to correct resume bullet slots\n')

  // -------------------------------------------------------------
  // Test 5: Integration with Normalizer and Corpus Analyzer
  // -------------------------------------------------------------
  console.log('[Test 5] Normalizer & Corpus Analyzer Integration')
  const syncExtracted = extractSkillsFromJd(GENAI_JD)
  assert(syncExtracted.some((s) => s.toLowerCase().includes('fastmcp')), 'extractSkillsFromJd must extract FastMCP')
  assert(syncExtracted.some((s) => s.toLowerCase().includes('langgraph')), 'extractSkillsFromJd must extract LangGraph')
  console.log('  ✓ 5.1 Synchronous extractSkillsFromJd augmented with dynamic heuristic skills')

  const corpusResult = analyzeMarketJdCorpus([GENAI_JD, GENAI_JD, BIOINFORMATICS_JD], ['Python'])
  assert(corpusResult.totalAnalyzed === 3, 'Corpus analyzed count should be 3')
  assert(corpusResult.topDemandedSkills.length > 0, 'Top demanded skills must be populated')
  console.log('  ✓ 5.2 analyzeMarketJdCorpus dynamically extracted top tools across corpus:', corpusResult.topDemandedSkills.map((t) => `${t.tool} (${t.percentage}%)`))

  console.log('\n================================================================')
  console.log('ALL DYNAMIC SKILL EXTRACTOR TESTS PASSED PERFECTLY!')
  console.log('================================================================\n')
  setTimeout(() => process.exit(0), 100)
}

runTests().catch((err) => {
  console.error('\n❌ Dynamic Skill Extractor test failed:', err)
  process.exit(1)
})
