/**
 * Alekya Maddu LinkedIn & Resume Recruiter Discrepancy Verification Test
 *
 * Validates:
 * 1. Apify harvestapi mapper & normalizer against Alekya's exact harvestapi LinkedIn payload
 * 2. 7-point deterministic recruiter discrepancy engine against Alekya's verified resume
 */

import assert from 'node:assert'
import { mapApifyProfileToCanonical } from '../utils/apifyLinkedInScraper.js'
import { normalizeLinkedInProfile } from '../agents/linkedin/linkedinNormalizer.js'
import { analyzeCrossAgentDiscrepancies } from '../agents/linkedin/linkedinCrossAnalyzer.js'
import { computeLinkedInScorecard } from '../agents/linkedin/linkedinScorecard.js'
import { extractLinkedInSignals } from '../agents/linkedin/linkedinSignalEngine.js'

console.log('================================================================')
console.log('ALEKYA MADDU RESUME vs LINKEDIN 7-POINT DISCREPANCY VERIFICATION')
console.log('================================================================\n')

// ── 1. Mock HarvestAPI LinkedIn Profile Scraper Payload for Alekya Maddu ───────
const rawHarvestApiAlekyaPayload = {
  fullName: 'Alekya Maddu',
  headline: 'Actively seeking full-time opportunities | UCM | Full Stack Developer | Java, Spring Boot, React',
  about: 'Full Stack Developer with experience building enterprise microservices and modern frontend applications.',
  profilePicture: {
    url: 'https://media.licdn.com/dms/image/v2/D5603AQFalekya_pic.jpg',
    sizes: [{ url: 'https://media.licdn.com/dms/image/v2/D5603AQFalekya_pic_small.jpg', width: 200, height: 200 }],
  },
  coverPicture: {
    url: 'https://media.licdn.com/dms/image/v2/D5603AQFalekya_cover.jpg',
    sizes: [{ url: 'https://media.licdn.com/dms/image/v2/D5603AQFalekya_cover.jpg', width: 1584, height: 396 }],
  },
  location: {
    linkedinText: 'Chicago, IL',
    parsed: {
      text: 'Chicago, IL, United States',
      city: 'Chicago',
      state: 'Illinois',
      country: 'United States',
    },
  },
  connectionsCount: 520,
  recommendationsCount: 0,
  experience: [
    {
      position: 'Full Stack Developer',
      companyName: 'Bank of America',
      companyLogo: { url: 'https://media.licdn.com/dms/image/bofa.png' },
      dateRange: 'Feb 2024 - Present',
      location: 'Chicago, IL',
      description: 'Developing high-throughput financial microservices with Spring Boot and React.',
    },
    {
      position: 'Software Engineer',
      companyName: 'Abbot Laboratories', // Typo: Abbot instead of Abbott Laboratories
      companyLogo: null, // Unlinked company page placeholder
      dateRange: 'Feb 2023 - Feb 2024',
      location: 'Chicago, IL',
      description: 'Maintained enterprise healthcare software systems and internal services.',
    },
    {
      position: 'Software Engineer',
      companyName: 'Capgemini',
      companyLogo: { url: 'https://media.licdn.com/dms/image/capgemini.png' },
      dateRange: 'Aug 2021 - Dec 2022',
      location: 'Hyderabad, India',
      description: 'Built Java microservices and REST APIs.',
    },
  ],
  education: [
    {
      schoolName: 'Judson University',
      degree: 'Doctor of Education - EdD',
      fieldOfStudy: 'Computer Science',
      period: 'May 2026 - Present',
    },
    {
      schoolName: 'University of Central Missouri',
      degree: 'Master of Science - MS',
      fieldOfStudy: 'Computer Science',
      period: 'Jan 2023 - May 2024',
    },
    {
      schoolName: 'Vasireddy Venkatadri Institute of Technology',
      degree: 'Bachelor of Technology - BTech',
      fieldOfStudy: null, // Missing field of study on LinkedIn
      period: 'Aug 2017 - Aug 2021',
    },
  ],
  projects: [
    { title: 'Library Management System', dateRange: 'Jan 2022 - May 2022' },
    { title: 'Dr. Assist Healthcare Portal', dateRange: 'Mar 2022 - Jun 2022' },
    { title: 'Appointments Management System', dateRange: 'Jul 2022 - Sep 2022' },
    { title: 'Student Enrollment System', dateRange: 'Oct 2022 - Dec 2022' },
  ],
  certifications: [
    { title: 'Meta Front-End Developer', issuedBy: 'Meta', issuedAt: '2023' },
    { title: 'Java (Basic)', issuedBy: 'HackerRank', issuedAt: '2022' },
    { title: 'SQL (Intermediate)', issuedBy: 'HackerRank', issuedAt: '2022' },
    { title: 'React Basics', issuedBy: 'Coursera', issuedAt: '2023' },
    { title: 'Spring Framework Specialization', issuedBy: 'Coursera', issuedAt: '2023' },
    { title: 'AWS Cloud Quest: Cloud Practitioner', issuedBy: 'Amazon Web Services', issuedAt: '2024' },
    { title: 'Building RESTful APIs with Spring Boot', issuedBy: 'LinkedIn Learning', issuedAt: '2023' },
    { title: 'Docker for Developers', issuedBy: 'LinkedIn Learning', issuedAt: '2024' },
    { title: 'Problem Solving (Basic)', issuedBy: 'HackerRank', issuedAt: '2021' },
    { title: 'Python for Everybody', issuedBy: 'University of Michigan', issuedAt: '2021' },
    { title: 'Git Essential Training', issuedBy: 'LinkedIn Learning', issuedAt: '2022' },
    { title: 'PostgreSQL Essential Training', issuedBy: 'LinkedIn Learning', issuedAt: '2023' },
  ],
  skills: [
    'Java', 'Spring Boot', 'React.js', 'JavaScript', 'SQL', 'MySQL', 'PostgreSQL', 'Docker', 'Git',
    'WinSCP', 'JSP', 'JScript', 'HTML', 'CSS', 'Microservices', 'REST APIs', 'Hibernate', 'Maven',
    'Jenkins', 'JIRA', 'Agile Methodologies', 'JUnit', 'Eclipse', 'IntelliJ IDEA', 'Visual Studio Code',
  ],
  topSkills: ['Java', 'Spring Boot', 'React.js'],
  sectionTotals: { skills: 94 },
}

// ── 2. Verified Canonical Resume Facts for Alekya Maddu ────────────────────────
const canonicalResumeAlekya = {
  candidate: {
    name: 'Alekya Maddu',
    email: 'alekyamaddu06@gmail.com',
    targetRole: 'Senior Full Stack Developer',
  },
  experience: [
    {
      company: 'Bank of America',
      role: 'Full Stack Developer',
      dates: 'Feb 2024 - Present',
      bullets: [
        { text: 'Engineered high-throughput financial microservices processing 4.2M daily transactions.' },
        { text: 'Reduced page latency by 34% by refactoring React front-end state management.' },
      ],
    },
    {
      company: 'It America / Abbott Laboratories',
      role: 'Software Developer', // Title mismatch: Software Developer (Resume) vs Software Engineer (LinkedIn)
      dates: 'Feb 2023 - Feb 2024',
      bullets: [
        { text: 'Developed Spring Boot microservices and automated CI/CD pipelines reducing deployment downtime by 40%.' },
      ],
    },
    {
      company: 'Capgemini',
      role: 'Software Engineer',
      dates: 'Aug 2021 - Dec 2022',
      bullets: [
        { text: 'Built Java microservices and optimized PostgreSQL database queries.' },
      ],
    },
  ],
  education: [
    {
      institution: 'University of Central Missouri',
      degree: 'Master of Science in Computer Science',
      dates: 'Jan 2023 - May 2024',
    },
    {
      institution: 'Vasireddy Venkatadri Institute of Technology',
      degree: "Bachelor's, Electrical Engineering",
      dates: 'Aug 2017 - Aug 2021',
    },
  ],
  projects: [
    {
      title: 'RAG-Powered Intelligent Document Assistant',
      description: 'Enterprise Generative AI assistant built with LangGraph, LangChain, FastAPI, ChromaDB, and Next.js.',
      bullets: [
        { text: 'Orchestrated multi-agent document analysis using LangGraph and ChromaDB vector search.' },
      ],
    },
    {
      title: 'Personal Finance Tracker & Microservices Platform',
      description: 'Distributed fintech platform using Spring Boot, Spring AI, React, PostgreSQL, and Kafka.',
      bullets: [
        { text: 'Designed event-driven transaction pipeline handling 100K synthetic events/min.' },
      ],
    },
  ],
  skills: [
    'Java', 'Python', 'Spring Boot', 'Spring AI', 'React', 'Next.js', 'FastAPI',
    'LangChain', 'LangGraph', 'ChromaDB', 'Kafka', 'Redis', 'Docker', 'Kubernetes',
    'AWS', 'PostgreSQL', 'GraphQL', 'REST APIs', 'Microservices',
  ],
}

// ── Test 1: Apify Mapper & Normalizer Field Extractions ────────────────────────
console.log('--- Test 1: HarvestAPI Mapper & Normalizer Field Extractions ---')
const mappedProfile = mapApifyProfileToCanonical(rawHarvestApiAlekyaPayload, 'https://linkedin.com/in/alekyamaddu', 'harvestapi/linkedin-profile-scraper')
const normalizedProfile = normalizeLinkedInProfile(mappedProfile)

assert.strictEqual(normalizedProfile.fullName, 'Alekya Maddu', 'Full name must resolve to "Alekya Maddu"')
assert.strictEqual(normalizedProfile.experiences.length, 3, 'Must have 3 experiences (Bank of America, Abbot Laboratories, Capgemini)')
assert(normalizedProfile.pictureUrl.startsWith('https://'), `pictureUrl must be valid https URL, got: ${normalizedProfile.pictureUrl}`)
assert(!normalizedProfile.pictureUrl.includes('[object Object]'), 'pictureUrl must not contain [object Object]')
assert(normalizedProfile.bannerUrl.startsWith('https://'), `bannerUrl must be valid https URL, got: ${normalizedProfile.bannerUrl}`)
assert(!normalizedProfile.bannerUrl.includes('[object Object]'), 'bannerUrl must not contain [object Object]')
assert.strictEqual(normalizedProfile.location, 'Chicago, IL, United States', 'Location must unpack nested parsed text')
assert.strictEqual(normalizedProfile.certifications.length, 12, 'Must extract all 12 certifications')
assert.strictEqual(normalizedProfile.certifications[0].issuer, 'Meta', 'Certification issuer must be preserved')
assert.strictEqual(normalizedProfile.certifications[1].issuer, 'HackerRank', 'Certification issuer must be preserved')
assert.strictEqual(normalizedProfile.experiences[1].companyLogo, null, 'Abbot Laboratories unlinked logo must be null')

console.log('PASS: HarvestAPI scraper mapper & normalizer cleanly unpacked all fields without [object Object]\n')

// ── Test 2: 7-Point Recruiter Discrepancy Engine ──────────────────────────────
console.log('--- Test 2: 7-Point Recruiter Discrepancy Engine Execution ---')
const crossAnalysis = analyzeCrossAgentDiscrepancies(normalizedProfile, {
  canonicalResume: canonicalResumeAlekya,
  targetRole: 'Senior Full Stack Developer',
})

const discrepancies = crossAnalysis.discrepancies || []
console.log(`Discrepancies flagged: ${discrepancies.length}`)
discrepancies.forEach((d, idx) => {
  console.log(`  [${idx + 1}] (${d.severity}) ${d.type}: ${d.title}`)
})

// Red Flag 1: Company typo & unlinked placeholder logo
const redFlag1 = discrepancies.find((d) => d.type === 'company_typo_unlinked_logo')
assert(redFlag1, 'Red Flag 1: company_typo_unlinked_logo must be flagged for Abbot Laboratories')
assert(redFlag1.diagnosis.includes('misspelling') || redFlag1.diagnosis.includes('unlinked') || redFlag1.diagnosis.includes('official'), 'Red Flag 1 diagnosis must explain unlinked company logo')
console.log('PASS: Red Flag 1 (Company typo & unlinked logo) detected')

// Red Flag 2: Job title mismatch at matched company
const redFlag2 = discrepancies.find((d) => d.type === 'title_drift')
assert(redFlag2, 'Red Flag 2: title_drift must be flagged (Software Developer vs Software Engineer)')
assert.strictEqual(redFlag2.resumeClaim, 'Software Developer')
assert.strictEqual(redFlag2.linkedinClaim, 'Software Engineer')
console.log('PASS: Red Flag 2 (Job title mismatch Software Developer vs Software Engineer) detected')

// Red Flag 3: Modern Resume Projects missing or outdated on LinkedIn
const redFlag3 = discrepancies.find((d) => d.type === 'missing_modern_projects')
assert(redFlag3, 'Red Flag 3: missing_modern_projects must be flagged')
assert(redFlag3.title.includes('RAG') || redFlag3.resumeClaim.includes('RAG'), 'Red Flag 3 must cite missing modern GenAI project')
console.log('PASS: Red Flag 3 (Modern GenAI projects missing from LinkedIn) detected')

// Red Flag 4: Reverse education discrepancy (Unlisted LinkedIn Judson University degree missing from resume)
const redFlag4 = discrepancies.find((d) => d.type === 'education_mismatch')
assert(redFlag4, 'Red Flag 4: education_mismatch must be flagged for Judson University')
assert(redFlag4.title.includes('Judson University'), 'Red Flag 4 must cite Judson University')
console.log('PASS: Red Flag 4 (Unlisted Judson University Ed.D. on LinkedIn) detected')

// Red Flag 5: Incomplete education metadata (Missing fieldOfStudy on LinkedIn VVIT entry)
const redFlag5 = discrepancies.find((d) => d.type === 'incomplete_education_major')
assert(redFlag5, 'Red Flag 5: incomplete_education_major must be flagged for VVIT BTech')
assert(redFlag5.title.includes('Vasireddy Venkatadri'), 'Red Flag 5 must cite VVIT')
console.log('PASS: Red Flag 5 (Missing Field of Study for VVIT BTech on LinkedIn) detected')

// Red Flag 6: High-demand tech skills gap prioritizing modern AI/Cloud tech
const redFlag6 = discrepancies.find((d) => d.type === 'skill_gap')
assert(redFlag6, 'Red Flag 6: skill_gap must be flagged')
assert(crossAnalysis.missingSkills.includes('LangGraph'), 'Missing skills must include LangGraph')
assert(crossAnalysis.missingSkills.includes('LangChain'), 'Missing skills must include LangChain')
assert(crossAnalysis.missingSkills.includes('FastAPI'), 'Missing skills must include FastAPI')
// Verify priority sorting puts modern AI tech first
assert(crossAnalysis.missingSkills.slice(0, 5).includes('LangGraph') || crossAnalysis.missingSkills.slice(0, 5).includes('LangChain'), 'Priority tech must be sorted to front of missingSkills')
console.log('PASS: Red Flag 6 (High-demand modern tech skills gap with LangGraph/LangChain priority) detected')

// Red Flag 7: Headline wasted prefix ("Actively seeking...") and 0 Recommendations
const redFlag7A = discrepancies.find((d) => d.type === 'headline_wasted_opener')
assert(redFlag7A, 'Red Flag 7A: headline_wasted_opener must be flagged for "Actively seeking..."')
console.log('PASS: Red Flag 7A (Headline wasted opener "Actively seeking...") detected')

const redFlag7B = discrepancies.find((d) => d.type === 'zero_recommendations')
assert(redFlag7B, 'Red Flag 7B: zero_recommendations must be flagged for 520 connections + 3 roles with 0 recommendations')
console.log('PASS: Red Flag 7B (Zero recommendations with established career) detected')

// ── Test 3: Scorecard Engine Integration ─────────────────────────────────────
console.log('\n--- Test 3: Scorecard Engine Integration ---')
const signals = extractLinkedInSignals(normalizedProfile, { canonicalResume: canonicalResumeAlekya, targetRole: 'Senior Full Stack Developer' })
const scorecard = computeLinkedInScorecard(signals, crossAnalysis, 'Senior Full Stack Developer')

assert(typeof scorecard.score === 'number' && scorecard.score > 0 && scorecard.score <= 100, 'Scorecard must compute valid overall score')
assert(scorecard.grades.consistency.score <= 70, `Consistency score must reflect discrepancies, got: ${scorecard.grades.consistency.score}`)
assert(scorecard.issues.length >= 7, `Scorecard must surface issues for discrepancies, got: ${scorecard.issues.length}`)
console.log(`PASS: Scorecard generated: ${scorecard.score}/100 (Grade ${scorecard.grade}) with ${scorecard.issues.length} surfaced issues`)

console.log('\n================================================================')
console.log('ALL ALEKYA MADDU VERIFICATION TESTS PASSED SUCCESSFULLY! (7/7)')
console.log('================================================================')
