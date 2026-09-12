import { STEPS } from './assessmentSteps'

const SAMPLE_LOCATIONS = [
  'San Francisco, CA, Remote',
  'New York, NY',
  'Austin, TX, Remote',
  'Seattle, WA',
  'Chicago, IL, Remote',
  'Boston, MA',
]

const SAMPLE_ROLES = [
  'Full Stack Software Engineer',
  'Senior Frontend Developer',
  'Backend Engineer (Go / Node)',
  'Data Scientist / AI Engineer',
  'Product Manager / Tech Lead',
]

const SAMPLE_DEGREES = [
  'B.S. in Computer Science',
  'M.S. in Software Engineering',
  'B.S. in Electrical & Computer Engineering',
  'Master of Science in Information Systems',
]

const SAMPLE_UNIVERSITIES = [
  'UC Berkeley',
  'Northeastern University',
  'UT Austin',
  'Georgia Tech',
  'University of Washington',
]

export function getRandomAnswerForStep(step) {
  if (!step) return null

  switch (step.type) {
    case 'phone': {
      const area = Math.floor(200 + Math.random() * 700)
      const mid = Math.floor(100 + Math.random() * 899)
      const last = Math.floor(1000 + Math.random() * 8999)
      return `${step.prefix || '+1'} (${area}) ${mid}-${last}`
    }

    case 'radio': {
      const opts = (step.options || []).filter((o) => o !== 'Other')
      if (opts.length === 0) return 'Yes'
      return opts[Math.floor(Math.random() * opts.length)]
    }

    case 'checkbox': {
      const opts = (step.options || []).filter((o) => o !== 'Other')
      if (opts.length === 0) return ['None']
      // pick 1 or 2 random options
      const shuffled = [...opts].sort(() => 0.5 - Math.random())
      const count = Math.min(shuffled.length, Math.floor(1 + Math.random() * 2))
      return shuffled.slice(0, count)
    }

    case 'input-na': {
      if (Math.random() < 0.2 && step.naLabel) {
        return 'N/A'
      }
      return String(Math.floor(1 + Math.random() * 5))
    }

    case 'quantitative': {
      if (Math.random() < 0.15 && (step.hasNA || step.naLabel)) {
        return {
          raw: 'N/A',
          period: 'na',
          per_week: null,
          per_month: null,
          formatted: 'N/A',
          is_na: true,
        }
      }
      const period = Math.random() < 0.5 ? 'week' : 'month'
      let num = Math.floor(2 + Math.random() * 25)
      if (period === 'month') num = num * 4
      const perWeek = period === 'week' ? num : Math.round((num / 4.33) * 10) / 10
      const perMonth = period === 'week' ? Math.round(num * 4.33) : num

      return {
        raw: String(num),
        period,
        per_week: perWeek,
        per_month: perMonth,
        formatted: `${num} per ${period}`,
        is_na: false,
      }
    }

    case 'file': {
      return new File(
        ['Mock resume PDF content for ATS testing'],
        'Alex_Chen_Candidate_Resume.pdf',
        { type: 'application/pdf' }
      )
    }

    case 'textarea': {
      return 'Looking for competitive engineering roles with H-1B sponsorship flexibility and fast growth.'
    }

    case 'input':
    default: {
      if (step.name === 'location') {
        return SAMPLE_LOCATIONS[Math.floor(Math.random() * SAMPLE_LOCATIONS.length)]
      }
      if (step.name === 'linkedin') {
        return 'https://www.linkedin.com/in/alex-chen-dev'
      }
      if (step.name === 'targetRole' || step.name === 'primaryRole') {
        return SAMPLE_ROLES[Math.floor(Math.random() * SAMPLE_ROLES.length)]
      }
      if (step.name === 'degree') {
        return SAMPLE_DEGREES[Math.floor(Math.random() * SAMPLE_DEGREES.length)]
      }
      if (step.name === 'university') {
        return SAMPLE_UNIVERSITIES[Math.floor(Math.random() * SAMPLE_UNIVERSITIES.length)]
      }
      if (step.inputType === 'number') {
        return String(Math.floor(1 + Math.random() * 6))
      }
      return step.placeholder || 'Software Engineering'
    }
  }
}

export function generateAllRandomAssessmentData() {
  const result = {}
  STEPS.forEach((step) => {
    result[step.name] = getRandomAnswerForStep(step)
  })
  return result
}
