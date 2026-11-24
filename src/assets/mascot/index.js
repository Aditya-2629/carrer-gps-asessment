import poseWave from './pose-wave.png'
import posePoint from './pose-point.png'
import poseClipboard from './pose-clipboard.png'
import poseThinking from './pose-thinking.png'
import poseChart from './pose-chart.png'
import poseAnalytics from './pose-analytics.png'
import poseAnalyticsGif from './mascot-analytics.gif'
import poseReading from './pose-reading.png'
import poseLaptop from './pose-laptop.png'
import poseThumbsUp from './pose-thumbsup.png'
import poseRoadmap from './pose-roadmap.png'
import poseSpeech from './pose-speech.png'
import poseIdea from './pose-idea.png'

export {
  poseWave,
  posePoint,
  poseClipboard,
  poseThinking,
  poseChart,
  poseAnalytics,
  poseAnalyticsGif,
  poseReading,
  poseLaptop,
  poseThumbsUp,
  poseRoadmap,
  poseSpeech,
  poseIdea,
}

export const MASCOT_POSES = {
  // Direct Pose Names
  wave: poseWave,
  point: posePoint,
  clipboard: poseClipboard,
  thinking: poseThinking,
  chart: poseAnalyticsGif || poseChart,
  analytics: poseAnalyticsGif || poseAnalytics,
  reading: poseReading,
  laptop: poseLaptop,
  thumbsup: poseThumbsUp,
  roadmap: poseRoadmap,
  speech: poseSpeech,
  idea: poseIdea,

  // Semantic Aliases mapped to Crafture Career GPS Guide:
  // 01 Welcome & Guide
  welcome: poseWave,
  guide: poseWave,
  intro: poseWave,

  // 02 Ask & Explore
  ask: poseThinking,
  explore: poseThinking,
  question: poseThinking,

  // 03 Plan & Analyse
  plan: poseIdea,
  analyse: poseAnalyticsGif || poseAnalytics,
  analysis: poseAnalyticsGif || poseAnalytics,
  executive: poseWave,

  // 04 Show Progress
  progress: poseAnalyticsGif || poseChart,
  healthScore: poseAnalyticsGif || poseChart,
  funnel: poseAnalyticsGif || poseChart,
  metrics: poseAnalyticsGif || poseChart,

  // 05 Find Opportunities
  opportunities: posePoint,
  radar: posePoint,
  market: posePoint,
  directing: posePoint,
  highlight: posePoint,

  // 08 Apply for Jobs & Working
  apply: poseLaptop,
  working: poseLaptop,
  analyzing: poseLaptop,

  // 09 Network & Connect (LinkedIn)
  network: posePoint,
  linkedin: poseLaptop,

  // 11 Build a Better Resume (ATS)
  resume: poseReading,
  ats: poseReading,
  audit: poseClipboard,
  checklist: poseClipboard,

  // 14 Follow the Roadmap
  roadmap_plan: poseRoadmap,
  sprint: poseRoadmap,
  journey: poseRoadmap,
  milestones: poseRoadmap,

  // 15 Success & Celebrate
  success: poseThumbsUp,
  celebrate: poseThumbsUp,
  victory: poseThumbsUp,
  offer: poseThumbsUp,
  siuuu: poseThumbsUp,

  // Dialogue & Eureka
  dialogue: poseSpeech,
  tip: poseSpeech,
  feedback: poseSpeech,
  eureka: poseIdea,
  insights: poseIdea,
}

export function getMascotPose(poseName) {
  if (!poseName) return poseWave
  const key = String(poseName).toLowerCase().replace(/[^a-z0-9]/g, '')
  if (MASCOT_POSES[key]) return MASCOT_POSES[key]
  if (MASCOT_POSES[poseName]) return MASCOT_POSES[poseName]
  return poseWave
}

let hasPreloaded = false
export function preloadMascotAssets() {
  if (typeof window === 'undefined' || hasPreloaded) return
  hasPreloaded = true
  const urls = [
    poseWave,
    posePoint,
    poseClipboard,
    poseThinking,
    poseAnalyticsGif,
    poseChart,
    poseAnalytics,
    poseReading,
    poseLaptop,
    poseThumbsUp,
    poseRoadmap,
    poseSpeech,
    poseIdea,
  ]
  urls.forEach((src) => {
    if (src && typeof src === 'string') {
      const img = new Image()
      img.src = src
    }
  })
}

export default MASCOT_POSES
