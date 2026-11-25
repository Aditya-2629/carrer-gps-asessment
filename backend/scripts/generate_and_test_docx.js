import fs from 'fs'
import path from 'path'
import JSZip from '../node_modules/jszip/lib/index.js'
import { extractDocxFastInfo } from '../../src/lib/fastResumeScanner.js'
import assert from 'assert'

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://www.linkedin.com/in/aditya-kumar" TargetMode="External"/>
</Relationships>`

// Document 1: WITH LinkedIn & Phone, with split <w:r> runs
const DOC1_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Aditya Kumar</w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>Contact: </w:t></w:r>
      <w:r><w:t>+91 98</w:t></w:r>
      <w:r><w:t>76543210</w:t></w:r>
      <w:r><w:t> | </w:t></w:r>
      <w:r><w:t>https://www.linkedin.com/in/</w:t></w:r>
      <w:r><w:t>aditya-kumar</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>Professional Summary</w:t></w:r></w:p>
    <w:p><w:r><w:t>Senior Full Stack Engineer with 8+ years experience building scalable web applications.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Work Experience</w:t></w:r></w:p>
    <w:p><w:r><w:t>Staff Software Engineer | Acme Systems (June 2021 – Present)</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Led migration of core API gateway reducing p99 latency by 35%.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Education</w:t></w:r></w:p>
    <w:p><w:r><w:t>Bachelor of Technology in Computer Science | Tech University (2014 – 2018)</w:t></w:r></w:p>
    <w:p><w:r><w:t>Skills</w:t></w:r></w:p>
    <w:p><w:r><w:t>React, Node.js, TypeScript, Python, AWS, Docker, Kubernetes, SQL, Git</w:t></w:r></w:p>
  </w:body>
</w:document>`

// Document 2: NO LinkedIn, NO Phone
const DOC2_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Alex Morgan</w:t></w:r></w:p>
    <w:p><w:r><w:t>Seattle, WA</w:t></w:r></w:p>
    <w:p><w:r><w:t>Professional Summary</w:t></w:r></w:p>
    <w:p><w:r><w:t>Principal Infrastructure Architect specializing in containerized cloud systems.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Work Experience</w:t></w:r></w:p>
    <w:p><w:r><w:t>Lead Systems Architect | Cloud Core (January 2019 – Present)</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Architected multi-region Kubernetes clusters supporting 100k daily queries.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Education</w:t></w:r></w:p>
    <w:p><w:r><w:t>Master of Science in Software Engineering | State University (2013 – 2017)</w:t></w:r></w:p>
    <w:p><w:r><w:t>Skills</w:t></w:r></w:p>
    <w:p><w:r><w:t>Golang, Rust, Kubernetes, Terraform, Linux, Prometheus, AWS, Docker</w:t></w:r></w:p>
  </w:body>
</w:document>`

async function createDocxBuffer(docXml, relsXml = null) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', ROOT_RELS)
  zip.file('word/document.xml', docXml)
  if (relsXml) {
    zip.file('word/_rels/document.xml.rels', relsXml)
  }
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

async function run() {
  console.log('Generating test docx files...')
  const bufWithContacts = await createDocxBuffer(DOC1_XML, DOC_RELS)
  const bufNoContacts = await createDocxBuffer(DOC2_XML)

  const outDir = path.resolve('public/test-resumes')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const pathWithContacts = path.join(outDir, 'test_resume_with_contacts.docx')
  const pathNoContacts = path.join(outDir, 'test_resume_no_contacts.docx')

  fs.writeFileSync(pathWithContacts, bufWithContacts)
  fs.writeFileSync(pathNoContacts, bufNoContacts)
  console.log('Saved test resumes to:', outDir)

  // Test extractDocxFastInfo on bufWithContacts
  const arrayBufWithContacts = bufWithContacts.buffer.slice(bufWithContacts.byteOffset, bufWithContacts.byteOffset + bufWithContacts.byteLength)
  const resWithContacts = await extractDocxFastInfo(arrayBufWithContacts)
  console.log('Res with contacts:', resWithContacts)
  assert.strictEqual(resWithContacts.linkedin, 'https://www.linkedin.com/in/aditya-kumar')
  assert.strictEqual(resWithContacts.phone, '+91 98 76543210')
  console.log('✓ Test resume WITH contacts correctly extracted split runs!')

  // Test extractDocxFastInfo on bufNoContacts
  const arrayBufNoContacts = bufNoContacts.buffer.slice(bufNoContacts.byteOffset, bufNoContacts.byteOffset + bufNoContacts.byteLength)
  const resNoContacts = await extractDocxFastInfo(arrayBufNoContacts)
  console.log('Res without contacts:', resNoContacts)
  assert.strictEqual(resNoContacts.linkedin, '')
  assert.strictEqual(resNoContacts.phone, '')
  console.log('✓ Test resume WITHOUT contacts returned clean empty strings!')

  console.log('\nAll docx fast scanner and file generation checks passed!')
}

run().catch((err) => {
  console.error('Error running test:', err)
  process.exit(1)
})
