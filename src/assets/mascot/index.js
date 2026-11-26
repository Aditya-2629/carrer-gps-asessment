import mascotWave from './mascot_wave.webp'
import mascotThinking from './mascot_thinking.webp'
import mascotReading from './mascot_reading.webp'
import mascotLaptop from './mascot_laptop.webp'
import mascotChart from './mascot_chart.webp'
import mascotClipboard from './mascot_clipboard.webp'
import mascotRoadmap from './mascot_roadmap.webp'
import mascotThumbsup from './mascot_thumbsup.webp'
import mascotAngry from './mascot_angry.webp'
import mascotHappy from './mascot_happy.webp'
import mascotSad from './mascot_sad.webp'
import mascotShocked from './mascot_shocked.webp'
import mascotIdle from './mascot_idle.webp'
import mascotWorking from './mascot_working.webp'

export {
  mascotWave,
  mascotThinking,
  mascotReading,
  mascotLaptop,
  mascotChart,
  mascotClipboard,
  mascotRoadmap,
  mascotThumbsup,
  mascotAngry,
  mascotHappy,
  mascotSad,
  mascotShocked,
  mascotIdle,
  mascotWorking,
}

export const MASCOT_POSES = {
  wave: mascotWave,
  thinking: mascotThinking,
  reading: mascotReading,
  laptop: mascotLaptop,
  chart: mascotChart,
  clipboard: mascotClipboard,
  roadmap: mascotRoadmap,
  thumbsup: mascotThumbsup,
  angry: mascotAngry,
  happy: mascotHappy,
  sad: mascotSad,
  shocked: mascotShocked,
  idle: mascotIdle,
  working: mascotWorking,
}

export const MASCOT_ASSETS = {
  ...MASCOT_POSES,

  // Semantic aliases for seamless backwards/forwards compatibility:
  welcome: mascotWave,
  guide: mascotWave,
  intro: mascotWave,
  linkedin: mascotWave,
  point: mascotWave,

  ask: mascotThinking,
  explore: mascotThinking,
  question: mascotThinking,
  quiz: mascotThinking,
  idea: mascotThinking,

  resume: mascotReading,
  ats: mascotReading,
  uploading: mascotReading,

  apply: mascotLaptop,
  tech: mascotLaptop,

  progress: mascotChart,
  healthscore: mascotChart,
  funnel: mascotChart,
  metrics: mascotChart,
  analytics: mascotChart,
  analyse: mascotChart,
  analysis: mascotChart,

  audit: mascotClipboard,
  checklist: mascotClipboard,
  notes: mascotClipboard,

  sprint: mascotRoadmap,
  journey: mascotRoadmap,
  milestones: mascotRoadmap,
  plan: mascotRoadmap,

  success: mascotThumbsup,
  celebrate: mascotThumbsup,
  victory: mascotHappy,
  offer: mascotThumbsup,
  siuuu: mascotThumbsup,

  error: mascotShocked,
  alert: mascotAngry,
  warning: mascotAngry,
  rejected: mascotShocked,
  low_score: mascotSad,
}

export function getMascotPose(poseName) {
  if (!poseName) return mascotWave
  const key = String(poseName).toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (MASCOT_ASSETS[key]) return MASCOT_ASSETS[key]
  if (MASCOT_ASSETS[poseName]) return MASCOT_ASSETS[poseName]
  return mascotWave
}

let hasPreloaded = false
export function preloadMascotAssets() {
  if (typeof window === 'undefined' || hasPreloaded) return
  hasPreloaded = true
  const urls = Object.values(MASCOT_ASSETS)
  const uniqueUrls = Array.from(new Set(urls))
  uniqueUrls.forEach((src) => {
    if (src && typeof src === 'string') {
      const img = new Image()
      img.src = src
    }
  })
}

export default MASCOT_ASSETS
