import express, { Router } from 'express'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import VisitorSession from '../models/VisitorSession.js'
import DailyAnalyticsSummary from '../models/DailyAnalyticsSummary.js'

const router = Router()

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many analytics pings' },
})

function detectDevice(userAgent = '', explicitDevice = '') {
  if (explicitDevice && ['mobile', 'tablet', 'desktop'].includes(explicitDevice)) {
    return explicitDevice
  }
  const ua = String(userAgent).toLowerCase()
  if (/ipad|tablet/.test(ua)) return 'tablet'
  if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile'
  return 'desktop'
}

/**
 * POST /api/analytics/track
 * Public non-blocking endpoint for live visitor heartbeats, step progression, and abandoned lead draft capture.
 * Accepts both application/json and text/plain (navigator.sendBeacon).
 */
router.post('/track', analyticsLimiter, express.text({ type: 'text/plain', limit: '32kb' }), async (req, res) => {
  try {
    let payload = req.body
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch {
        return res.status(400).json({ ok: false })
      }
    }
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ ok: false })
    }

    const sessionId = String(payload.sessionId || '').trim().slice(0, 128)
    if (!sessionId) {
      return res.status(400).json({ ok: false, message: 'sessionId required' })
    }

    const updateFields = {
      lastHeartbeatAt: new Date(),
      device: detectDevice(req.headers['user-agent'], payload.device),
    }

    if (payload.currentPhase) updateFields.currentPhase = String(payload.currentPhase).slice(0, 32)
    if (payload.currentStep !== undefined && payload.currentStep !== null) {
      updateFields.currentStep = String(payload.currentStep).slice(0, 32)
    }
    if (payload.referrer) updateFields.referrer = String(payload.referrer).slice(0, 256)

    const attr = payload.attribution && typeof payload.attribution === 'object' ? payload.attribution : {}
    const attrSource = String(attr.source || payload.utm_source || '').trim().slice(0, 100)
    const attrMedium = String(attr.medium || payload.utm_medium || '').trim().slice(0, 100)
    const attrCampaign = String(attr.campaign || payload.utm_campaign || '').trim().slice(0, 128)
    const attrReferrer = String(attr.referrer || payload.referrer || '').trim().slice(0, 256)
    if (attrSource) updateFields['attribution.source'] = attrSource
    if (attrMedium) updateFields['attribution.medium'] = attrMedium
    if (attrCampaign) updateFields['attribution.campaign'] = attrCampaign
    if (attrReferrer) updateFields['attribution.referrer'] = attrReferrer

    const city =
      payload.city ||
      req.headers['x-vercel-ip-city'] ||
      req.headers['cf-ipcity'] ||
      ''
    if (city) updateFields.city = decodeURIComponent(String(city)).slice(0, 100)

    if (payload.userId && mongoose.Types.ObjectId.isValid(payload.userId)) {
      updateFields.userId = payload.userId
    }

    // Merge non-empty abandonedDraft fields without overwriting existing captured values with blanks
    const draft = payload.abandonedDraft || {}
    if (draft && typeof draft === 'object') {
      const draftKeys = ['name', 'email', 'phone', 'linkedin', 'targetRole', 'resumeFilename']
      for (const key of draftKeys) {
        if (typeof draft[key] === 'string' && draft[key].trim()) {
          updateFields[`abandonedDraft.${key}`] = draft[key].trim().slice(0, 256)
        }
      }
    }

    const existing = await VisitorSession.findOne({ sessionId }).select('currentPhase currentStep maxStepReached').lean()

    // Map phase/step to monotonic step rank: 0=landing, 1=step1(1-3), 2=step2(4-7), 3=step3(8+/otp/loading), 4=report
    let stepRank = 0
    const phaseLower = String(updateFields.currentPhase || '').toLowerCase()
    const stepStr = String(updateFields.currentStep || '').toLowerCase()
    const stepNum = parseInt(stepStr, 10)
    if (phaseLower === 'report' || stepStr === 'report') {
      stepRank = 4
    } else if (phaseLower === 'loading' || phaseLower === 'otp' || stepStr === 'email' || stepStr === 'otp' || (!isNaN(stepNum) && stepNum >= 8)) {
      stepRank = 3
    } else if (!isNaN(stepNum) && stepNum >= 4) {
      stepRank = 2
    } else if (phaseLower === 'assessment' || (!isNaN(stepNum) && stepNum >= 1)) {
      stepRank = 1
    }

    await VisitorSession.findOneAndUpdate(
      { sessionId },
      {
        $set: updateFields,
        $max: { maxStepReached: stepRank },
        $setOnInsert: { sessionId },
      },
      { upsert: true, new: false }
    )

    // Roll up lightweight daily counts (~500 bytes/day) for lifetime Admin charts
    const todayKey = new Date().toISOString().slice(0, 10)
    const inc = {}
    if (!existing) inc.totalVisitors = 1
    if (updateFields.currentPhase === 'report' && existing?.currentPhase !== 'report') {
      inc.completedReports = 1
    }
    if (updateFields.currentStep && updateFields.currentStep !== existing?.currentStep) {
      inc[`stepDropoffs.${updateFields.currentStep}`] = 1
    }
    if (Object.keys(inc).length > 0) {
      DailyAnalyticsSummary.findOneAndUpdate(
        { date: todayKey },
        { $inc: inc, $setOnInsert: { date: todayKey } },
        { upsert: true }
      ).catch(() => {})
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.warn('[AnalyticsTrack] Non-fatal error:', err.message)
    return res.status(200).json({ ok: false })
  }
})

export default router
