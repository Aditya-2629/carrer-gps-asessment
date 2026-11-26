import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { build as esbuild } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const PDF_JSX_PATH = path.resolve(REPO_ROOT, 'src/components/pdf/CareerReportPdf.jsx')
const CACHE_DIR = path.resolve(__dirname, '../.cache')
const CACHE_BUNDLE_PATH = path.resolve(CACHE_DIR, 'career-report-pdf.mjs')

let _cachedComponentPromise = null

async function loadCareerReportPdfComponent() {
  if (!_cachedComponentPromise) {
    _cachedComponentPromise = (async () => {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
      await esbuild({
        entryPoints: [PDF_JSX_PATH],
        outfile: CACHE_BUNDLE_PATH,
        bundle: true,
        platform: 'node',
        format: 'esm',
        jsx: 'automatic',
        loader: {
          '.jpg': 'dataurl',
          '.jpeg': 'dataurl',
          '.png': 'dataurl',
          '.webp': 'dataurl',
        },
        external: ['react', 'react/jsx-runtime', '@react-pdf/renderer'],
        logLevel: 'silent',
      })
      const mod = await import(`${pathToFileURL(CACHE_BUNDLE_PATH).href}?v=${Date.now()}`)
      if (typeof mod?.default !== 'function') {
        throw new Error('CareerReportPdf default export not found after esbuild bundle')
      }
      return mod.default
    })().catch((err) => {
      _cachedComponentPromise = null
      throw err
    })
  }
  return _cachedComponentPromise
}

export async function renderCareerReportPdfBuffer(reportData = {}) {
  const CareerReportPdf = await loadCareerReportPdfComponent()
  const doc = React.createElement(CareerReportPdf, { reportData: reportData || {} })
  return await renderToBuffer(doc)
}

export default renderCareerReportPdfBuffer
