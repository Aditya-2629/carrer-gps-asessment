import assert from 'assert'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { downloadAtsResumeDocx } from '../controllers/assessmentController.js'

console.log('Testing downloadAtsResumeDocx controller...')

const fakeUser = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Aditya Kulkarni',
  email: 'aditya.test@example.com',
  targetRole: 'Senior Full Stack Engineer',
  aiReport: {
    missing_ats_keywords: ['Kafka'],
    resume_agent: {
      summaryOptimization: {
        rewrittenSummary: 'Executive AI & Full Stack Leader with 5+ years scaling distributed platforms.',
      },
      keywordAlignment: {
        missingKeywords: ['TypeScript', 'Spring Boot', 'Java', 'JWT / OAuth 2.0'],
        missingFromResume: ['Kafka'],
      },
      bulletAudit: [
        {
          bulletId: 'exp_001_b01',
          originalText: 'Developed backend services with Node.js.',
          rewriteOption: 'Architected scalable microservices using Node.js and Express.',
        },
      ],
      canonicalResume: {
        candidate_name: 'Aditya Kulkarni',
        target_role: 'Senior Full Stack Engineer',
        skills: ['Python', 'Docker', 'AWS'],
        experiences: [
          {
            company: 'TechCorp',
            role: 'Senior Engineer',
            location: 'Hoboken, NJ',
            startDate: 'Jan 2022',
            endDate: 'Present',
            isCurrent: true,
            bullets: [
              'Developed backend services with Node.js.',
            ],
          },
        ],
        education: [
          {
            school: 'Stevens Institute of Technology',
            degree: 'M.S. in Computer Science',
            location: 'Hoboken, NJ',
            dates: 'Sep 2024 - May 2026',
          },
        ],
      },
    },
  },
}

// Mock User.findById
const origFindById = User.findById
User.findById = async (id) => {
  if (String(id) === String(fakeUser._id)) return fakeUser
  return null
}

let headers = {}
let responseBuffer = null
let statusSent = null

const req = {
  params: { userId: String(fakeUser._id) },
  query: {},
}

const res = {
  setHeader(k, v) {
    headers[k] = v
  },
  status(code) {
    statusSent = code
    return this
  },
  json(data) {
    return data
  },
  end(buf) {
    responseBuffer = buf
  },
}

await downloadAtsResumeDocx(req, res)

// Restore
User.findById = origFindById

assert(!statusSent, 'Should not return error status')
assert(responseBuffer && Buffer.isBuffer(responseBuffer), 'Response buffer must be a Buffer')
assert(responseBuffer.length > 5000, 'DOCX buffer length must be > 5000 bytes')
assert.strictEqual(
  headers['Content-Type'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'Content-Type must be docx'
)
assert(
  headers['Content-Disposition'].includes('Aditya_Kulkarni_Tailored_ATS_Resume.docx'),
  'Filename must match candidate name'
)
assert.strictEqual(headers['X-Resume-Pages'], '1', 'Pages header set')

console.log('✓ downloadAtsResumeDocx controller test passed successfully! Generated ' + responseBuffer.length + ' bytes')
