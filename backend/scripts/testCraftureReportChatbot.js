/**
 * testCraftureReportChatbot.js
 *
 * Comprehensive Automated Verification Suite for:
 * Phase 1 — Crafture Career GPS Knowledge Base, Persona & Guardrails
 *
 * Verifies:
 * 1. CRAFTURE_BRAND constants, multi-domain scope, and 6-Phase diagnostic engine mappings.
 * 2. extractCandidateDossier fact extraction and careerGpsPhase attachment.
 * 3. buildChatbotSystemPrompt injection of Crafture persona ("we", "our", "us"), multi-domain scope,
 *    programs & pricing ($0, $150, $300), visa educational disclaimers, and negative constraint filters.
 * 4. classifyChatIntent handling of both legacy 5 report sections and extended Crafture intents.
 * 5. getCraftureFaqContext intent-targeted snippet retrieval.
 */

import assert from 'node:assert/strict'
import {
  CRAFTURE_BRAND,
  CAREER_GPS_PHASES,
  CRAFTURE_PROGRAMS,
  CRAFTURE_SAFETY_RULES,
  mapToCareerGpsPhase,
  getCraftureFaqContext,
} from '../utils/craftureKnowledgeBase.js'
import {
  extractCandidateDossier,
  buildChatbotSystemPrompt,
  classifyChatIntent,
  CHAT_INTENTS,
  EXTENDED_CHAT_INTENTS,
} from '../controllers/chatController.js'

console.log('======================================================================')
console.log(' RUNNING CRAFTURE CAREER GPS PHASE 1 VERIFICATION SUITE')
console.log('======================================================================\n')

// -------------------------------------------------------------
// TEST 1: Crafture Brand Constants & 6-Phase Mappings
// -------------------------------------------------------------
console.log('Test 1: Verifying Crafture Brand Constants & 6-Phase Framework Mappings...')

assert.strictEqual(CRAFTURE_BRAND.name, 'Crafture', 'Brand name must be Crafture')
assert.strictEqual(CRAFTURE_BRAND.supportEmail, 'support@crafture.me', 'Support email must be support@crafture.me')
assert.ok(
  CRAFTURE_BRAND.domainScope.toLowerCase().includes('multi-domain') &&
  CRAFTURE_BRAND.domainScope.toLowerCase().includes('never it-only'),
  'Brand domain scope must be multi-domain and never IT-only'
)

// Verify 6 distinct phases
const phaseKeys = Object.keys(CAREER_GPS_PHASES)
assert.strictEqual(phaseKeys.length, 6, 'Must define exactly 6 Career GPS phases')

// Verify mapToCareerGpsPhase mappings
const p1 = mapToCareerGpsPhase('ATS keyword alignment and resume formatting')
assert.strictEqual(p1.number, 1, 'ATS/resume keywords must map to Phase 1')

const p2 = mapToCareerGpsPhase('Converting applications to recruiter screening calls')
assert.strictEqual(p2.number, 2, 'Application/screening conversion must map to Phase 2')

const p3 = mapToCareerGpsPhase('Substantiating experience during initial recruiter phone screen')
assert.strictEqual(p3.number, 3, 'Screening experience substantiation must map to Phase 3')

const p4 = mapToCareerGpsPhase('Technical system design trade-offs and live coding interview')
assert.strictEqual(p4.number, 4, 'Technical system design must map to Phase 4')

const p5 = mapToCareerGpsPhase('Negotiating written salary offer and executive equity')
assert.strictEqual(p5.number, 5, 'Offer negotiation must map to Phase 5')

const p6 = mapToCareerGpsPhase('Background check verification and W-2 payroll documentation')
assert.strictEqual(p6.number, 6, 'Background verification must map to Phase 6')

// Verify program pricing
assert.ok(CRAFTURE_PROGRAMS.starter.price.includes('$0'), 'Starter must be $0')
assert.ok(CRAFTURE_PROGRAMS.ai.price.includes('$150'), 'AI tier must be $150')
assert.ok(CRAFTURE_PROGRAMS.elite.price.includes('$300'), 'Elite tier must be $300')

console.log('✔ Test 1 Passed: Brand constants, 6 phases, and programs verified.\n')

// -------------------------------------------------------------
// TEST 2: Candidate Fact Extraction with Attached Career GPS Phase
// -------------------------------------------------------------
console.log('Test 2: Verifying extractCandidateDossier & careerGpsPhase...')

const mockCandidate = {
  name: 'Devin Thorne',
  answers: {
    targetRole: 'Lead Product Manager',
    applications90d: 55,
  },
  resumeJson: {
    candidate: {
      name: 'Devin Thorne',
      targetRole: 'Lead Product Manager',
    },
    experiences: [
      {
        company: 'Stripe',
        role: 'Senior PM',
        dates: '2021 - Present',
        bullets: [
          'Led checkout conversion redesign increasing enterprise transaction completion by 18%.',
          'Defined product roadmap and coordinated with 14 engineers across 3 time zones.',
        ],
      },
    ],
    skills: ['Product Strategy', 'SQL', 'A/B Testing', 'System Roadmaps'],
  },
  aiReport: {
    target_role: 'Lead Product Manager',
    career_health_score: 79,
    primary_bottleneck: {
      title: 'Top of Funnel Recruiter Screen Drop-off',
    },
    assessment_agent: {
      seniorityTier: 'Lead',
    },
    resume_agent: {
      verifiedSkills: ['Product Strategy', 'SQL', 'A/B Testing'],
      missingTargetKeywords: ['Growth Loops', 'Go-To-Market'],
    },
    funnel_stages: {
      applications_count: 55,
      recruiter_calls_count: 6,
      interviews_count: 2,
      offers_count: 0,
      biggest_leak_stage: 'Recruiter Screen Drop-off',
    },
  },
}

const dossier = extractCandidateDossier(mockCandidate)

assert.strictEqual(dossier.candidateName, 'Devin Thorne', 'Candidate name must match')
assert.strictEqual(dossier.targetRole, 'Lead Product Manager', 'Target role must match')
assert.strictEqual(dossier.careerHealthScore, 79, 'Health score must match')
assert.strictEqual(dossier.currentCompany, 'Stripe', 'Must extract current company')
assert.ok(dossier.careerGpsPhase, 'Dossier must contain careerGpsPhase')
assert.strictEqual(dossier.careerGpsPhase.number, 2, 'Recruiter screen drop-off must map to Phase 2')

console.log('✔ Test 2 Passed: extractCandidateDossier attaches valid careerGpsPhase.\n')

// -------------------------------------------------------------
// TEST 3: buildChatbotSystemPrompt Crafture Persona & Guardrails
// -------------------------------------------------------------
console.log('Test 3: Verifying buildChatbotSystemPrompt persona, pricing & safety guardrails...')

const prompt = buildChatbotSystemPrompt(dossier)

// 1. Crafture Team Member Persona
assert.ok(prompt.includes('Crafture'), 'Prompt must identify as Crafture')
assert.ok(prompt.includes('Atlas'), 'Prompt must identify as Atlas')
assert.ok(prompt.includes('we') || prompt.includes('our'), 'Prompt must use "we" or "our" team voice')

// 2. Candidate Facts Grounding
assert.ok(prompt.includes('Devin Thorne'), 'Prompt must contain candidate name')
assert.ok(prompt.includes('Lead Product Manager'), 'Prompt must contain target role')
assert.ok(prompt.includes('Stripe'), 'Prompt must contain verified employer')
assert.ok(prompt.includes('Phase 2'), 'Prompt must contain diagnosed Career GPS phase')

// 3. Multi-Domain & Programs Pricing
assert.ok(prompt.toLowerCase().includes('multi-domain'), 'Must enforce multi-domain scope')
assert.ok(prompt.includes('Never describe Crafture as serving only IT') || prompt.includes('Crafture is not IT-only'), 'Must ban IT-only claim')
assert.ok(prompt.includes('$0') && prompt.includes('$150') && prompt.includes('$300'), 'Must include $0, $150, $300 pricing tiers')

// 4. Safety & Compliance Guardrails
assert.ok(prompt.includes('ZERO GUARANTEES') || prompt.includes('Zero employment or interview guarantees'), 'Must enforce zero guarantees')
assert.ok(prompt.includes('educational career guidance') || prompt.includes('not legal counsel'), 'Must enforce visa disclaimer')
assert.ok(prompt.includes('DSO') || prompt.includes('immigration attorney'), 'Must direct complex visa cases to DSO/attorney')

// 5. Anti-Slop & Negative Constraints
assert.ok(!prompt.includes('Max 3-4 sentences per response'), 'Must NOT have "Max 3-4 sentences" limitation')
assert.ok(prompt.includes('navigating the job market'), 'Must ban "navigating the job market"')
assert.ok(prompt.includes('delve'), 'Must ban "delve"')
assert.ok(prompt.includes('it is crucial'), 'Must ban "it is crucial"')
assert.ok(prompt.includes('in conclusion'), 'Must ban "in conclusion"')
assert.ok(prompt.includes('testament to'), 'Must ban "testament to"')
assert.ok(prompt.includes('Google XYZ format'), 'Must mandate Google XYZ format')
assert.ok(prompt.includes('THE ADDICTIVE CURIOSITY LOOP'), 'Must enforce curiosity loop')

console.log('✔ Test 3 Passed: System prompt enforces Crafture persona, multi-domain scope, programs & strict guardrails.\n')

// -------------------------------------------------------------
// TEST 4: classifyChatIntent Core & Extended Routing
// -------------------------------------------------------------
console.log('Test 4: Verifying classifyChatIntent for core & extended intents...')

// Core 5 Intents
assert.strictEqual(CHAT_INTENTS.length, 5, 'Must keep core CHAT_INTENTS length at 5')

const tInterview = classifyChatIntent('How do I answer tell me about a time I disagreed with leadership?')
assert.strictEqual(tInterview.id, 'interview')

const tOutreach = classifyChatIntent('Can you draft a cold outreach message to hiring managers at Google?')
assert.strictEqual(tOutreach.id, 'outreach')

const tLinkedin = classifyChatIntent('How should I optimize my LinkedIn headline for recruiter search?')
assert.strictEqual(tLinkedin.id, 'linkedin')

const tResume = classifyChatIntent('Please rewrite my Stripe resume bullet using metrics.')
assert.strictEqual(tResume.id, 'resume')

const tRoadmap = classifyChatIntent('What is my 7-day action plan for this week?')
assert.strictEqual(tRoadmap.id, 'roadmap')

// Extended Intents
assert.ok(EXTENDED_CHAT_INTENTS.length >= 4, 'Must define extended intents')

const tPricing = classifyChatIntent('What is the cost of the Elite AI + Human tier and what is your refund policy?')
assert.strictEqual(tPricing.id, 'pricing', 'Must route pricing queries to pricing intent')

const tVisa = classifyChatIntent('How does Crafture help candidates on F-1 STEM OPT looking for H-1B sponsorship?')
assert.strictEqual(tVisa.id, 'visa', 'Must route visa queries to visa intent')

const tConsultant = classifyChatIntent('Can I speak with a human coach or book a 1-on-1 strategy session?')
assert.strictEqual(tConsultant.id, 'escalation', 'Must route human consultant queries to escalation intent')

const tPhase = classifyChatIntent('Explain Phase 3 of the Career GPS Framework.')
assert.strictEqual(tPhase.id, 'phase', 'Must route framework phase queries to phase intent')

console.log('✔ Test 4 Passed: Intent classification accurately routes all core & extended queries.\n')

// -------------------------------------------------------------
// TEST 5: getCraftureFaqContext Knowledge Retrieval
// -------------------------------------------------------------
console.log('Test 5: Verifying getCraftureFaqContext intent-targeted snippet retrieval...')

const pricingFaq = getCraftureFaqContext('How much does Crafture cost and what is included in the $150 plan?')
assert.ok(pricingFaq.includes('CRAFTURE OFFICIAL PROGRAMS & PRICING'), 'Must retrieve pricing FAQ')
assert.ok(pricingFaq.includes('$150/month'), 'Must include $150 details')
assert.ok(pricingFaq.includes('$300/month'), 'Must include $300 details')

const visaFaq = getCraftureFaqContext('Do you provide legal advice for H-1B lottery filing and OPT?')
assert.ok(visaFaq.includes('VISA & WORK AUTHORIZATION'), 'Must retrieve visa FAQ')
assert.ok(visaFaq.includes('MANDATORY LEGAL DISCLAIMER'), 'Must include mandatory legal disclaimer')
assert.ok(visaFaq.includes('DSO'), 'Must mention DSO')

const guaranteeFaq = getCraftureFaqContext('Do you guarantee I will get a job offer?')
assert.ok(guaranteeFaq.includes('Zero Job Guarantees'), 'Must state zero job guarantees')

const multiDomainFaq = getCraftureFaqContext('Are your services only for IT and software developers?')
assert.ok(multiDomainFaq.includes('MULTI-DOMAIN SCOPE'), 'Must retrieve multi-domain FAQ')
assert.ok(multiDomainFaq.includes('UNIVERSAL'), 'Must emphasize universal platform')

console.log('✔ Test 5 Passed: getCraftureFaqContext accurately retrieves grounded FAQ intelligence.\n')

console.log('======================================================================')
console.log(' ALL CRAFTURE CAREER GPS PHASE 1 TESTS PASSED (5/5)! 🚀')
console.log('======================================================================\n')
