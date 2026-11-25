import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { extractDocxFastInfo } from '../../src/lib/fastResumeScanner.js'
import { ResumeAgent } from '../agents/resume/resumeAgent.js'
import { normalizeLinkedInUrl } from '../../src/lib/linkedinUrlUtils.js'

console.log('Testing full autofill & clean reset flow...')

// Simulated store state representing useAppStore
const mockStore = {
  formData: {
    name: '',
    fullName: '',
    email: '',
    location: '',
    linkedin: '',
    linkedinData: null,
    targetRole: '',
    phone: '',
  },
  resumeAnalysis: {
    status: 'idle',
    data: null,
    error: null,
    filename: '',
  },
  setFormData(key, val) {
    this.formData[key] = val
  },
  setBulkFormData(updates) {
    this.formData = { ...this.formData, ...updates }
  },
  setResumeAnalysis(analysis) {
    this.resumeAnalysis = { ...this.resumeAnalysis, ...analysis }
  },
}

// Simulated validateAndSet + startBackgroundAnalysis logic from FileUpload.jsx
async function simulateFileUpload(filename, fileBuffer) {
  // Step 1: Immediate reset on file selection
  mockStore.setResumeAnalysis({
    status: 'idle',
    data: null,
    error: null,
    filename,
  })
  mockStore.setBulkFormData({
    name: '',
    fullName: '',
    email: '',
    location: '',
    linkedin: '',
    linkedinData: null,
    targetRole: '',
    phone: '',
  })

  // Step 2: Client fast scan (< 50ms)
  const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
  const fastInfo = await extractDocxFastInfo(arrayBuffer)
  let fastLinkedIn = ''
  let fastPhone = ''

  if (fastInfo.linkedin) {
    fastLinkedIn = fastInfo.linkedin
    mockStore.setFormData('linkedin', fastLinkedIn)
  }
  if (fastInfo.phone) {
    fastPhone = fastInfo.phone
    mockStore.setFormData('phone', fastPhone)
  }

  // Step 3: Background analysis simulation (calls backend ResumeAgent)
  mockStore.setResumeAnalysis({ status: 'analyzing', filename, error: null, data: null })
  const result = await ResumeAgent.prepareCanonicalContext({ buffer: fileBuffer, filename })

  mockStore.setResumeAnalysis({ status: 'completed', filename, error: null, data: result })

  const detectedLinkedin = normalizeLinkedInUrl(
    result.canonicalResume?.candidate?.linkedin ||
    result.canonicalResume?.linkedin ||
    fastLinkedIn ||
    ''
  )

  const detectedName = result.canonicalResume?.candidate?.name || ''
  const detectedEmail = result.canonicalResume?.candidate?.email || result.canonicalResume?.candidate?.contact?.email || ''
  const mostRecentRole = result.canonicalResume?.experiences?.[0]?.role || 'Software Engineer'

  const bulkUpdates = {}
  if (detectedLinkedin) {
    bulkUpdates.linkedin = detectedLinkedin
  } else {
    bulkUpdates.linkedin = ''
    bulkUpdates.linkedinData = null
  }

  if (detectedName) {
    bulkUpdates.name = detectedName
    bulkUpdates.fullName = detectedName
  }
  if (detectedEmail) {
    bulkUpdates.email = detectedEmail
  }
  bulkUpdates.targetRole = mostRecentRole

  const rawPhone =
    result.canonicalResume?.candidate?.phone ||
    result.canonicalResume?.candidate?.contact?.phone ||
    result.canonicalResume?.phone ||
    ''
  const cleanDigits = String(rawPhone).replace(/\D/g, '')

  if (
    rawPhone &&
    rawPhone !== 'N/A' &&
    cleanDigits.length >= 10 &&
    cleanDigits.length <= 15 &&
    !/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/.test(rawPhone.trim())
  ) {
    bulkUpdates.phone = rawPhone
  } else if (fastPhone) {
    bulkUpdates.phone = fastPhone
  } else {
    bulkUpdates.phone = ''
  }

  mockStore.setBulkFormData(bulkUpdates)
}

async function run() {
  const bufWithContacts = fs.readFileSync('public/test-resumes/test_resume_with_contacts.docx')
  const bufNoContacts = fs.readFileSync('public/test-resumes/test_resume_no_contacts.docx')

  // Phase 1: Upload resume WITH contacts
  console.log('--- Phase 1: Upload resume WITH contacts ---')
  await simulateFileUpload('test_resume_with_contacts.docx', bufWithContacts)
  console.log('Store after Resume 1 upload:', {
    name: mockStore.formData.name,
    linkedin: mockStore.formData.linkedin,
    phone: mockStore.formData.phone,
    targetRole: mockStore.formData.targetRole,
  })

  assert.strictEqual(mockStore.formData.linkedin, 'https://www.linkedin.com/in/aditya-kumar')
  assert.ok(mockStore.formData.phone.includes('9876543210'))
  console.log('✓ Phase 1 PASSED: LinkedIn and Phone correctly auto-filled on upload!')

  // Phase 2: Immediately upload resume WITHOUT contacts
  console.log('\n--- Phase 2: Upload resume WITHOUT contacts ---')
  await simulateFileUpload('test_resume_no_contacts.docx', bufNoContacts)
  console.log('Store after Resume 2 upload:', {
    name: mockStore.formData.name,
    linkedin: mockStore.formData.linkedin,
    phone: mockStore.formData.phone,
    targetRole: mockStore.formData.targetRole,
  })

  assert.strictEqual(mockStore.formData.linkedin, '', 'LinkedIn must be reset to empty string')
  assert.strictEqual(mockStore.formData.linkedinData, null, 'LinkedInData must be reset to null')
  assert.strictEqual(mockStore.formData.phone, '', 'Phone must be reset to empty string')
  assert.strictEqual(mockStore.formData.name, 'Alex Morgan')
  console.log('✓ Phase 2 PASSED: Missing fields cleanly reset to empty strings without lingering state!')

  console.log('\nAll autofill and reset flow tests passed successfully!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
