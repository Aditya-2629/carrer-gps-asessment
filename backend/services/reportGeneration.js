/**
 * Report Generation Service — the shared engine behind both the blocking
 * controller and the async ReportJob worker (Phase C).
 *
 * Flow: prep (scrape/RAG) → [Atlas narrative ‖ orchestrator agents] →
 * attach agent bundle → persist to User → admin email.
 *
 * onProgress(stage, message) lets callers (job worker) stream live status.
 */

import mongoose from 'mongoose'
import User from '../models/User.js'
import getGeminiPrompt from '../utils/geminiPrompt.js'
import { sendAdminReportEmail } from '../utils/adminEmails.js'
import { scrapeLinkedInProfile } from '../utils/apifyLinkedInScraper.js'
import { buildRAGContext, buildSmartQuery } from '../utils/ragEngine.js'
import { generateContentWithFallback } from '../utils/geminiClient.js'
import { runCareerAgents } from '../agents/orchestrator.js'

export async function generateReportBundle({ userId, semanticProfile, onProgress = () => {} }) {
  const report = (stage, message) => {
    try {
      onProgress({ stage, message, at: new Date().toISOString() })
    } catch (_e) {
      /* listeners must never break generation */
    }
  }

  const user = await User.findById(userId)
  if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 })
  if (!user.isVerified) throw Object.assign(new Error('Unauthorized. Email not verified.'), { statusCode: 403 })

  const hasAnswers = user.answers && Object.keys(user.answers).length > 0
  if (!hasAnswers) throw Object.assign(new Error('No answers found. Please submit the assessment first.'), { statusCode: 400 })

  report('preparing', 'Scraping LinkedIn profile and building knowledge context…')

  // LinkedIn scrape (if URL provided but not yet scraped)
  if (user.linkedinUrl && !user.linkedinData) {
    try {
      const scrapedProfile = await scrapeLinkedInProfile(user.linkedinUrl)
      if (scrapedProfile) {
        user.linkedinData = scrapedProfile
      }
    } catch (e) {
      console.error('Apify LinkedIn scraping failed during report generation:', e)
    }
  }

  // RAG-enhanced Knowledge Base context (baseline + uploaded documents)
  let dynamicKbContent = null
  try {
    const smartQuery = buildSmartQuery(user.answers, user.resumeJson)
    dynamicKbContent = await buildRAGContext(smartQuery)
  } catch (kbErr) {
    console.error('Error building RAG context, using default fallback:', kbErr)
  }

  const effectiveSemanticProfile = semanticProfile || user.semanticProfile || null

  const promptText = getGeminiPrompt(user.answers, user.resumeJson, user.linkedinData, dynamicKbContent, effectiveSemanticProfile)

  const resumeTargetRole =
    effectiveSemanticProfile?.targetRole ||
    effectiveSemanticProfile?.target_role ||
    user.answers?.targetRole ||
    user.resumeJson?.target_role ||
    ''

  // Atlas narrative and the agent orchestrator run in parallel (Phase B).
  report('agents_running', 'Resume + LinkedIn agents analyzing in parallel with Atlas…')

  const atlasReportPromise = generateContentWithFallback({
    contents: promptText,
    modelName: 'gemini-3.6-flash',
  })

  const agentsPromise = runCareerAgents({
    resumeBuffer: user.resumeData && user.resumeData.length > 0 ? user.resumeData : null,
    resumeName: user.resumeName || '',
    resumeTargetRole,
    linkedinData: user.linkedinData || null,
    userId: user._id,
    onProgress: (e) => report(`agent_${e.agent}_${e.stage}`, e.message),
  })

  const { text: responseText } = await atlasReportPromise

  report('composing', 'Atlas is composing your executive report…')

  const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
  const aiReport = JSON.parse(cleanJsonString)

  // Include structured resume & linkedin json in final report output
  if (user.resumeJson) {
    aiReport.resume_json = user.resumeJson
  }
  if (user.linkedinData) {
    aiReport.linkedin_json = user.linkedinData
  }

  // Attach both agent diagnoses once the orchestrator settles. Either agent
  // can be null (no data / failed) without breaking the report.
  const { resumeAgent: resumeAgentAnalysis, linkedinAgent: linkedinAgentAnalysis } = await agentsPromise
  if (resumeAgentAnalysis) {
    aiReport.resume_agent = resumeAgentAnalysis
  }
  if (linkedinAgentAnalysis) {
    aiReport.linkedin_agent = linkedinAgentAnalysis
  }

  // Save report to User DB
  user.aiReport = aiReport
  await user.save()

  // Trigger Admin Email asynchronously (so candidate doesn't wait)
  sendAdminReportEmail(user.email, user.answers, aiReport, user.resumeData, user.resumeName)

  report('done', 'Report ready.')

  return { user, aiReport }
}

export default { generateReportBundle }
