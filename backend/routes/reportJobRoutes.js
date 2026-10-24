/**
 * Report Job routes — async report generation with live SSE progress (Phase C).
 *
 * POST /api/report-jobs            → create job, returns { jobId } immediately
 * GET  /api/report-jobs/:id        → poll fallback { status, events, aiReport }
 * GET  /api/report-jobs/:id/stream → SSE: progress events + report_ready
 *
 * The worker runs in-process (single-instance Render deployment). The bus is
 * an in-memory EventEmitter; events are also persisted on the job document so
 * poll fallback and reconnects still see history.
 */

import { Router } from 'express'
import crypto from 'crypto'
import { EventEmitter } from 'node:events'
import mongoose from 'mongoose'
import ReportJob from '../models/ReportJob.js'
import User from '../models/User.js'
import { generateReportBundle } from '../services/reportGeneration.js'

const router = Router()

// Per-job event bus (in-memory; single-instance safe)
const bus = (globalThis.__reportJobBus ||= new EventEmitter())
bus.setMaxListeners(50)

function pushEvent(job, stage, message) {
  const event = { at: new Date().toISOString(), stage, message }
  job.events.push(event)
  bus.emit(job.id, event)
  return event
}

// ─── Create job ──────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { userId, semanticProfile, precomputedResumeAgent, precomputedResumeJson } = req.body || {}
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Valid userId is required.' })
    }

    let parsedProfile = semanticProfile
    if (typeof parsedProfile === 'string') {
      try {
        parsedProfile = JSON.parse(parsedProfile)
      } catch (_e) {
        parsedProfile = null
      }
    }

    const user = await User.findById(userId).select('isVerified answers').lean()
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
    if (!user.isVerified) return res.status(403).json({ success: false, message: 'Email not verified.' })

    const job = await ReportJob.create({ userId, status: 'queued' })
    // Fire-and-forget worker — the client is streaming, not waiting on this
    processJob(job._id.toString(), userId, parsedProfile, { precomputedResumeAgent, precomputedResumeJson })

    return res.status(202).json({ success: true, jobId: job._id.toString() })
  } catch (err) {
    console.error('[ReportJob] create failed:', err)
    return res.status(500).json({ success: false, message: 'Failed to create report job.' })
  }
})

// ─── Worker ──────────────────────────────────────────────────────────────────
const running = (globalThis.__reportJobRunning ||= new Set())

async function processJob(jobId, userId, semanticProfile, options = {}) {
  if (running.has(jobId)) return
  running.add(jobId)
  try {
    const job = await ReportJob.findById(jobId)
    if (!job) return
    job.status = 'running'
    pushEvent(job, 'job_started', 'Job started — spinning up your agent team…')
    await job.save()

    const { aiReport } = await generateReportBundle({
      userId,
      semanticProfile,
      precomputedResumeAgent: options.precomputedResumeAgent || null,
      precomputedResumeJson: options.precomputedResumeJson || null,
      onProgress: ({ stage, message }) => pushEvent(job, stage, message),
    })

    // Single terminal event WITH the payload — clients close on report_ready,
    // so it must never arrive before the report is attached.
    job.aiReport = aiReport
    job.status = 'done'
    const finalEvent = { at: new Date().toISOString(), stage: 'report_ready', message: 'Report ready.', report: aiReport }
    job.events.push({ at: finalEvent.at, stage: finalEvent.stage, message: finalEvent.message })
    await job.save()
    bus.emit(jobId, finalEvent)
  } catch (err) {
    console.error('[ReportJob] processing failed:', err.message)
    try {
      const job = await ReportJob.findById(jobId)
      if (job) {
        job.status = 'failed'
        job.error = err.message
        pushEvent(job, 'job_failed', err.message)
        await job.save()
        bus.emit(jobId, { at: new Date().toISOString(), stage: 'job_failed', message: err.message })
      }
    } catch (_e) {
      /* job doc gone — nothing to do */
    }
  } finally {
    running.delete(jobId)
    // Free SSE listeners for this job shortly after completion
    setTimeout(() => {
      bus.removeAllListeners(jobId)
    }, 60_000)
  }
}

// ─── Poll fallback ───────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const job = await ReportJob.findById(req.params.id).select('status events aiReport error userId').lean()
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' })

    // Fallback: If user already has aiReport saved in MongoDB, treat job as done immediately
    if (job.status !== 'done' && job.userId) {
      try {
        const user = await User.findById(job.userId).select('aiReport').lean()
        if (user?.aiReport) {
          job.status = 'done'
          job.aiReport = user.aiReport
        }
      } catch (_e) {}
    }

    return res.status(200).json({ success: true, ...job })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load job.' })
  }
})

// ─── SSE stream ──────────────────────────────────────────────────────────────
router.get('/:id/stream', async (req, res) => {
  const { id } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid job id.' })
  }

  const job = await ReportJob.findById(id).select('status events aiReport userId').lean()
  if (!job) return res.status(404).json({ success: false, message: 'Job not found.' })

  // Fallback: If user already has aiReport saved, recover immediately
  if (job.status !== 'done' && job.userId) {
    try {
      const user = await User.findById(job.userId).select('aiReport').lean()
      if (user?.aiReport) {
        job.status = 'done'
        job.aiReport = user.aiReport
      }
    } catch (_e) {}
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(`retry: 3000\n\n`)

  const send = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    } catch (_e) {
      /* client gone */
    }
  }

  // Replay history
  for (const event of job.events || []) send(event)

  if (job.status === 'done' && job.aiReport) {
    send({ at: new Date().toISOString(), stage: 'report_ready', message: 'Report ready.', report: job.aiReport })
    return res.end()
  }
  if (job.status === 'failed') {
    send({ at: new Date().toISOString(), stage: 'job_failed', message: job.error || 'Generation failed.' })
    return res.end()
  }

  const onEvent = (event) => {
    send(event)
    if (event.stage === 'report_ready' || event.stage === 'job_failed') {
      cleanup()
      res.end()
    }
  }
  const heartbeat = setInterval(() => {
    try {
      res.write(`: hb ${Date.now()}\n\n`)
    } catch (_e) {
      cleanup()
    }
  }, 15_000)

  const cleanup = () => {
    clearInterval(heartbeat)
    bus.removeListener(id, onEvent)
  }
  bus.on(id, onEvent)
  req.on('close', cleanup)
})

export default router
