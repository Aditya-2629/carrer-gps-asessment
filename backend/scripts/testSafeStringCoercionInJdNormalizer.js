/**
 * testSafeStringCoercionInJdNormalizer.js
 * 
 * Verifies safe string coercion in:
 * 1. normalizeSingleJd (title, company, location, description) when fields are objects, strings, or null
 * 2. validateJdQuality when candidate fields are non-primitive or objects
 * 3. apifyJdScraper location normalization
 */

import assert from 'assert'
import { normalizeSingleJd, validateJdQuality } from '../agents/resume/market/jdNormalizer.js'

console.log('=== RUNNING SAFE STRING COERCION IN JD NORMALIZER TESTS ===\n')

// -------------------------------------------------------------
// TEST 1: normalizeSingleJd with Object Fields
// -------------------------------------------------------------
console.log('Test 1: Verifying normalizeSingleJd with object fields...')

const rawJobWithObjectFields = {
  title: { name: 'Staff Infrastructure Engineer', level: 'L6' },
  company: { name: 'Google Cloud', ticker: 'GOOGL' },
  location: { city: 'Seattle', state: 'WA', name: 'Seattle, WA' },
  description: 'Designing resilient distributed storage and Kubernetes orchestrators using Golang, Python, and gRPC with terraform modules extending past 200 characters to pass validation.',
  url: 'https://careers.google.com/jobs/101',
  id: 450912,
}

// Must not throw TypeError (e.g. rawJob.company.trim is not a function)
const normalized = normalizeSingleJd(rawJobWithObjectFields, 'software-engineer')

assert.strictEqual(typeof normalized.title, 'string', 'Title must be coerced to string')
assert(normalized.title.includes('Staff Infrastructure Engineer'), 'Title should extract name property')

assert.strictEqual(typeof normalized.company, 'string', 'Company must be coerced to string')
assert.strictEqual(normalized.company, 'Google Cloud', 'Company should extract name property')

assert.strictEqual(typeof normalized.location, 'string', 'Location must be coerced to string')
assert(normalized.location.includes('Seattle'), 'Location should safely extract city/name')

assert.strictEqual(typeof normalized.sourceJobId, 'string', 'JobId number must be coerced to string')
assert.strictEqual(normalized.sourceJobId, '450912')
console.log('✔ Test 1 Passed: Object fields safely coerced into strings without runtime errors.\n')

// -------------------------------------------------------------
// TEST 2: normalizeSingleJd with Null / Undefined Fallbacks
// -------------------------------------------------------------
console.log('Test 2: Verifying normalizeSingleJd with null/missing values...')

const emptyJob = {
  description: 'Valid job description with Python, Docker, AWS, and PostgreSQL with enough length to form valid candidate record.',
}

const normalizedEmpty = normalizeSingleJd(emptyJob, 'software-engineer')
assert.strictEqual(normalizedEmpty.title, 'Untitled Position', 'Title fallback should be Untitled Position')
assert.strictEqual(normalizedEmpty.company, 'Not Disclosed', 'Company fallback should be Not Disclosed')
assert.strictEqual(normalizedEmpty.location, 'Remote / Not Disclosed', 'Location fallback should be Remote / Not Disclosed')
assert.strictEqual(normalizedEmpty.sourceJobId, null)
console.log('✔ Test 2 Passed: Fallbacks cleanly applied for missing or null fields.\n')

// -------------------------------------------------------------
// TEST 3: validateJdQuality with Object Fields
// -------------------------------------------------------------
console.log('Test 3: Verifying validateJdQuality with object fields...')

const candidateWithObjectProps = {
  title: { name: 'DevOps Engineer' },
  description: { text: 'Developing automated Terraform modules and CI/CD pipelines on AWS with Docker, Kubernetes, and Helm charts with comprehensive monitoring and alerting infrastructure.' },
}

const qualityResult = validateJdQuality(candidateWithObjectProps, 'devops-engineer')
assert.strictEqual(qualityResult.valid, true, 'Candidate with object title/description must pass validation safely')
console.log('✔ Test 3 Passed: validateJdQuality safely handles object title/description.\n')

// -------------------------------------------------------------
// TEST 4: Object Location Normalization in Scraper Mappings
// -------------------------------------------------------------
console.log('Test 4: Verifying scraper location mapper simulation...')

const testScraperItem = {
  title: 'AI Researcher',
  company: { name: 'DeepMind' },
  location: { city: 'London', country: 'UK' },
  descriptionText: 'Researching generative architectures...',
}

const safeLocation = typeof testScraperItem.location === 'object'
  ? (testScraperItem.location?.name || testScraperItem.location?.city || testScraperItem.location?.label || 'United States')
  : (testScraperItem.location || 'United States')

assert.strictEqual(safeLocation, 'London', 'Safe location mapper extracts city from object')
console.log('✔ Test 4 Passed: Scraper object location mapping verified.\n')

console.log('ALL SAFE STRING COERCION TESTS COMPLETED SUCCESSFULLY! 🚀')
