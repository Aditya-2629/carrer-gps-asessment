/**
 * Client-Side Instant Resume Scanner
 * Extracts candidate LinkedIn URL and Phone Number directly in the browser in < 80ms,
 * before server-side parsing even finishes.
 * 
 * Supports:
 * - PDF files: checks /URI (linkedin) and /URI (tel:), uncompressed text
 * - Word (.docx) files: zero-dependency ZIP reader using native DecompressionStream('deflate-raw')
 */

import { normalizeLinkedInUrl } from './linkedinUrlUtils.js'

/**
 * Strict international, US, and Indian phone number extractor.
 * Supports:
 * - Indian: +91 98765 43210, +91-9876543210, 09876543210, 9876543210
 * - US / North American: +1 (555) 123-4567, (555) 123-4567, 555-123-4567, 555.123.4567
 * - General International: +<1-3 digits> followed by grouped digits totaling 10 to 15 digits.
 * - Explicit labels: tel:, phone:, mobile:, cell:, contact:
 * Rejects:
 * - Date ranges (e.g. 2020-2024, 01/2021-03/2024)
 * - Zip codes (5 digits or 9 digits)
 * - Identifiers with >15 digits or <10 digits
 * - Numbers directly connected to month/date terms unless explicitly prefixed with '+' or 'tel:'
 */
export function extractCleanPhoneNumber(text) {
  if (!text || typeof text !== 'string') return null

  // 1. Explicit labels or tel: URI links
  const explicitMatch = text.match(/(?:tel:|phone(?: number)?\s*:?|mobile\s*:?|cell\s*:?|contact\s*:?)\s*([+\d()\s.-]{10,25})/i)
  if (explicitMatch) {
    let raw = explicitMatch[1].replace(/[.,;:)\]\s]+$/, '').replace(/^[.,;:\s]+/, '').trim()
    if (raw.endsWith(')') && !raw.includes('(')) raw = raw.slice(0, -1).trim()
    const digits = raw.replace(/\D/g, '')
    if (digits.length >= 10 && digits.length <= 15) {
      return raw.replace(/[^\d+()\s.-]/g, '').trim()
    }
  }

  // 2. General international & domestic phone patterns with strict non-digit boundaries
  const phonePattern = /(?:^|[^\d+])((?:(?:\+|00)\d{1,3}[\s.-]*)?(?:\(?\d{2,5}\)?[\s.-]*)?\d{3,5}[\s.-]?\d{4,5})(?=[^\d]|$)/g
  let m
  while ((m = phonePattern.exec(text)) !== null) {
    let clean = m[1].replace(/[.,;:)\]\s]+$/, '').replace(/^[.,;:\s]+/, '').trim()
    if (clean.endsWith(')') && !clean.includes('(')) clean = clean.slice(0, -1).trim()
    const digits = clean.replace(/\D/g, '')

    // Strict length check: 10 to 15 digits
    if (digits.length < 10 || digits.length > 15) continue

    // Reject pure year/date ranges e.g. 2020-2024 or 2018-2022
    if (/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/.test(clean)) continue
    if (/\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/.test(clean)) continue
    if (/\d{1,2}\/\d{2,4}\s*[-–—]\s*\d{1,2}\/\d{2,4}/.test(clean)) continue

    // Check surrounding context for date keywords
    const idx = m.index + m[0].indexOf(m[1])
    if (idx > -1 && !clean.startsWith('+')) {
      const preceding = text.slice(Math.max(0, idx - 20), idx)
      const succeeding = text.slice(idx + clean.length, idx + clean.length + 20)
      if (/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|since|until|from|to)\s*$/i.test(preceding)) continue
      if (/^\s*[-–—]\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|present|current|now)/i.test(succeeding)) continue
    }

    return clean
  }

  return null
}

/**
 * Decompresses raw deflate stream using native browser DecompressionStream.
 */
async function decompressDeflateRaw(compressedData) {
  if (typeof DecompressionStream === 'undefined') {
    return ''
  }
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  writer.write(compressedData)
  writer.close()
  const res = new Response(ds.readable)
  return await res.text()
}

/**
 * Zero-dependency browser ZIP reader for .docx files.
 * Extracts word/document.xml, word/_rels/document.xml.rels, and header/footer files.
 */
export async function extractDocxFastInfo(arrayBuffer) {
  try {
    const bytes = new Uint8Array(arrayBuffer)
    const view = new DataView(arrayBuffer)
    let eocdOffset = -1

    for (let i = arrayBuffer.byteLength - 22; i >= 0 && i >= arrayBuffer.byteLength - 65557; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i
        break
      }
    }
    if (eocdOffset === -1) return { linkedin: '', phone: '' }

    const cdCount = view.getUint16(eocdOffset + 10, true)
    const cdOffset = view.getUint32(eocdOffset + 16, true)
    let cur = cdOffset
    const targetFiles = []

    for (let i = 0; i < cdCount && cur < eocdOffset; i++) {
      if (view.getUint32(cur, true) !== 0x02014b50) break
      const method = view.getUint16(cur + 10, true)
      const compSize = view.getUint32(cur + 20, true)
      const nameLen = view.getUint16(cur + 28, true)
      const extraLen = view.getUint16(cur + 30, true)
      const commentLen = view.getUint16(cur + 32, true)
      const localHeaderOffset = view.getUint32(cur + 42, true)

      const nameBytes = bytes.subarray(cur + 46, cur + 46 + nameLen)
      const name = new TextDecoder('utf-8').decode(nameBytes)

      if (
        name.startsWith('word/document.xml') ||
        name.startsWith('word/_rels/') ||
        name.includes('header') ||
        name.includes('footer')
      ) {
        const localNameLen = view.getUint16(localHeaderOffset + 26, true)
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
        const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen
        targetFiles.push({
          name,
          method,
          compSize,
          data: bytes.subarray(dataOffset, dataOffset + compSize),
        })
      }

      cur += 46 + nameLen + extraLen + commentLen
    }

    let aggregatedText = ''
    for (const file of targetFiles) {
      try {
        if (file.method === 0) {
          aggregatedText += ' ' + new TextDecoder('utf-8').decode(file.data)
        } else if (file.method === 8) {
          const text = await decompressDeflateRaw(file.data)
          aggregatedText += ' ' + text
        }
      } catch (_e) {}
    }

    // Extract LinkedIn
    let linkedin = ''
    const relsMatch = aggregatedText.match(/Target="([^"]*linkedin\.com\/in\/[^"]*)"/i)
    const plainMatch = aggregatedText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%-]+/i)
    const rawLi = relsMatch?.[1] || plainMatch?.[0] || ''
    if (rawLi) {
      linkedin = normalizeLinkedInUrl(rawLi)
    }

    // Extract Phone
    let phone = ''
    const telMatch = aggregatedText.match(/(?:tel:|Target="tel:)\s*([+\d()\s.-]{10,25})/i)
    if (telMatch) {
      const p = extractCleanPhoneNumber(telMatch[0])
      if (p) phone = p
    }
    if (!phone) {
      const cleanXml = aggregatedText.replace(/<[^>]+>/g, ' ')
      phone = extractCleanPhoneNumber(cleanXml) || ''
    }

    return { linkedin, phone }
  } catch (err) {
    console.warn('[fastResumeScanner] DOCX fast scan error:', err.message)
    return { linkedin: '', phone: '' }
  }
}

/**
 * Fast scanner for PDF text & annotations.
 */
export function extractPdfFastInfo(text) {
  let linkedin = ''
  let phone = ''

  try {
    // 1. Check clickable links in PDF stream
    const pdfUriMatch = text.match(/\/URI\s*\(([^)]*linkedin\.com\/in\/[^)]*)\)/i)
    const plainMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_%-]+/i)
    const rawLi = pdfUriMatch?.[1] || plainMatch?.[0] || ''
    if (rawLi) {
      linkedin = normalizeLinkedInUrl(rawLi)
    }

    // 2. Check tel: links in PDF annotations
    const pdfTelMatch = text.match(/\/URI\s*\(\s*tel:([^)]+)\)/i)
    if (pdfTelMatch && pdfTelMatch[1]) {
      phone = extractCleanPhoneNumber(pdfTelMatch[1]) || ''
    }

    // 3. Fallback scan on decoded text
    if (!phone) {
      phone = extractCleanPhoneNumber(text) || ''
    }
  } catch (_e) {}

  return { linkedin, phone }
}

/**
 * Universal instant client scanner. Dispatches based on file extension / MIME type.
 * Returns { linkedin: string, phone: string } in < 80ms.
 */
export async function fastScanResumeFile(file) {
  if (!file) return { linkedin: '', phone: '' }

  try {
    const isDocx = file.name.toLowerCase().endsWith('.docx') || file.type.includes('word') || file.type.includes('officedocument')
    const buf = await file.arrayBuffer()

    if (isDocx) {
      return await extractDocxFastInfo(buf)
    }

    // PDF or plain text
    const text = new TextDecoder('latin1').decode(buf)
    return extractPdfFastInfo(text)
  } catch (err) {
    console.warn('[fastResumeScanner] Fast scan failed:', err.message)
    return { linkedin: '', phone: '' }
  }
}
