import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

const runExec = promisify(execFile)

// Semaphore limiting concurrent LibreOffice conversions to max 2
class Semaphore {
  constructor(max) {
    this.max = max
    this.current = 0
    this.queue = []
  }
  acquire() {
    if (this.current < this.max) {
      this.current++
      return Promise.resolve()
    }
    return new Promise((resolve) => this.queue.push(resolve))
  }
  release() {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.current--
    }
  }
}

const libreOfficeSemaphore = new Semaphore(2)

/**
 * Async, Isolated LibreOffice Page Counter with Guaranteed Temp Cleanup
 * Uses pathToFileURL for cross-platform Windows & Linux compatibility.
 */
export async function measurePageCountAsync(docxBuffer) {
  await libreOfficeSemaphore.acquire()
  let dir = null

  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ats-fit-'))
    const docxPath = path.join(dir, 'resume.docx')
    const pdfPath = path.join(dir, 'resume.pdf')
    await fs.writeFile(docxPath, docxBuffer)

    const profileUrl = pathToFileURL(path.join(dir, 'profile')).href

    await runExec(
      'soffice',
      [
        `-env:UserInstallation=${profileUrl}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        dir,
        docxPath,
      ],
      { timeout: 20000 }
    )

    const { stdout } = await runExec('pdfinfo', [pdfPath], { timeout: 5000 })
    const match = stdout.match(/Pages:\s+(\d+)/)
    return match ? parseInt(match[1], 10) : null
  } catch (_err) {
    return null // Trigger calibrated line-budget fallback
  } finally {
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
    libreOfficeSemaphore.release()
  }
}

/**
 * Calibrated Line & Height Budget Estimator (105–118 chars/line for 10pt/9.5pt Calibri)
 */
export function estimateHeightBudget(sanitizedResume = {}, config = {}) {
  const exps = sanitizedResume.experiences || []
  const projs = sanitizedResume.projects || []
  const CHARS_PER_LINE = config.tightFont ? 118 : 110

  let totalLines = 0

  // Header & Subtitle: ~4 lines
  totalLines += 4

  // Summary lines
  if (sanitizedResume.summary) {
    const sumText = config.shortenSummary
      ? sanitizedResume.summary.split(/(?<=[.?!])\s+/).slice(0, 3).join(' ')
      : sanitizedResume.summary
    totalLines += Math.max(2, Math.ceil(sumText.length / CHARS_PER_LINE)) + 2
  }

  // Skills lines
  const rawSkills = sanitizedResume.skills || []
  const skillsCount = Array.isArray(rawSkills) ? rawSkills.length : Object.values(rawSkills).flat().length
  totalLines += Math.min(5, Math.ceil(skillsCount / 6)) + 2

  // Experience lines: role/company headers + bullets
  exps.forEach((e) => {
    totalLines += 2
    ;(e.bullets || []).forEach((b) => {
      const bText = typeof b === 'string' ? b : b?.text || ''
      totalLines += Math.max(1, Math.ceil(bText.length / CHARS_PER_LINE))
    })
  })

  // Projects lines
  projs.forEach((p) => {
    totalLines += 1.5
    ;(p.bullets || []).forEach((b) => {
      const bText = typeof b === 'string' ? b : b?.text || ''
      totalLines += Math.max(1, Math.ceil(bText.length / CHARS_PER_LINE))
    })
  })

  // Education lines
  totalLines += 3

  // 1 standard US Letter page capacity:
  // Standard pass: 44 lines.
  // Tightening pass (0.45" margins, 9.5pt font, reduced spacing): 52 lines.
  const capacity = config.tightMargin ? 52 : (config.tightSpacing ? 48 : 44)
  return totalLines <= capacity ? 1 : 2
}

