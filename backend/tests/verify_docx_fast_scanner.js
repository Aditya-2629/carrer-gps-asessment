import assert from 'assert'
import { extractCleanPhoneNumber } from '../../src/lib/fastResumeScanner.js'
import { normalizeLinkedInUrl } from '../../src/lib/linkedinUrlUtils.js'

console.log('Testing docx normalization and fast scanner logic...')

// Test 1: Split XML runs for phone number (as Word writes XML without whitespace between runs)
const rawXmlWithSplitPhone = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Contact Details</w:t></w:r></w:p><w:p><w:r><w:t>Phone: </w:t></w:r><w:r><w:t>+91 98</w:t></w:r><w:r><w:t>76543210</w:t></w:r></w:p><w:p><w:r><w:t>Address: New Delhi, India</w:t></w:r></w:p></w:body></w:document>`

function normalizeXml(rawXml) {
  let normalizedText = rawXml.replace(/<\/w:p>|<\/w:tr>|<\/w:tc>|<w:br[^>]*>|<w:cr[^>]*>|<w:tab[^>]*>/gi, ' \n ')
  normalizedText = normalizedText.replace(/<[^>]+>/g, '')
  normalizedText = normalizedText
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
  return normalizedText
}

const normPhoneText = normalizeXml(rawXmlWithSplitPhone)
const extractedPhone = extractCleanPhoneNumber(normPhoneText)
assert.strictEqual(extractedPhone, '+91 9876543210')
console.log('✓ Split phone run correctly extracted:', extractedPhone)

// Test 2: Split XML runs for LinkedIn URL
const rawXmlWithSplitLinkedin = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>LinkedIn: </w:t></w:r><w:r><w:t>https://www.linkedin.com/in/</w:t></w:r><w:r><w:t>aditya-</w:t></w:r><w:r><w:t>kumar-12345</w:t></w:r></w:p></w:body></w:document>`

const normLiText = normalizeXml(rawXmlWithSplitLinkedin)
const liMatch = normLiText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%-]+/i)
assert.ok(liMatch)
const normalizedLi = normalizeLinkedInUrl(liMatch[0])
assert.strictEqual(normalizedLi, 'https://www.linkedin.com/in/aditya-kumar-12345')
console.log('✓ Split LinkedIn run correctly extracted:', normalizedLi)

// Test 3: XML entities decoding (&amp;)
const rawXmlWithEntities = `<w:p><w:r><w:t>Profile: linkedin.com/in/john-doe?foo=1&amp;bar=2</w:t></w:r></w:p>`
const normEntityText = normalizeXml(rawXmlWithEntities)
assert.ok(normEntityText.includes('foo=1&bar=2'))
const entityLiMatch = normEntityText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%-]+/i)
assert.strictEqual(normalizeLinkedInUrl(entityLiMatch[0]), 'https://www.linkedin.com/in/john-doe')
console.log('✓ XML entities handled properly')

// Test 4: Block separation ensures phone does not bleed into other numbers
const rawXmlSeparateBlocks = `<w:p><w:r><w:t>Experience: 2020 - 2024</w:t></w:r></w:p><w:p><w:r><w:t>Tel: +1 (555) 234-5678</w:t></w:r></w:p><w:p><w:r><w:t>GPA: 3.85</w:t></w:r></w:p>`
const normBlockText = normalizeXml(rawXmlSeparateBlocks)
const extractedBlockPhone = extractCleanPhoneNumber(normBlockText)
assert.strictEqual(extractedBlockPhone, '+1 (555) 234-5678')
console.log('✓ Block boundaries prevented number bleeding:', extractedBlockPhone)

console.log('All docx fast scanner tests passed successfully!')
