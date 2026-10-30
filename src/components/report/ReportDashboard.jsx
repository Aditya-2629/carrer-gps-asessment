import { useState, useEffect, useRef } from 'react'
import {
  Sun,
  Moon,
  ArrowsClockwise,
  ShareNetwork,
  Printer,
  ShieldCheck,
  Compass,
  ArrowRight,
  SpinnerGap,
  DownloadSimple,
} from '@phosphor-icons/react'
import useAppStore, { PHASES } from '../../store/useAppStore'
import { api } from '../../lib/api'
import { navigateTo } from '../../lib/navigation'
import AnalysisLoader from '../loading/AnalysisLoader'

// Redesigned Modern Report Components
import ReportHero from './ReportHero'
import StickyReportNav from './StickyReportNav'
import CareerHealthSnapshot from './CareerHealthSnapshot'
import PrimaryBottleneck from './PrimaryBottleneck'
import FunnelAndConversionSection from './FunnelAndConversionSection'
import ResumeDeepDiagnosis from './ResumeDeepDiagnosis'
import LinkedInDeepDiagnosis from './LinkedInDeepDiagnosis'
import RoadmapTimeline from './RoadmapTimeline'
import FinalNextAction from './FinalNextAction'
import ReportChatbot from './ReportChatbot'
import CareerGpsReadyModal from './CareerGpsReadyModal'
import { Sparkle } from '@phosphor-icons/react'
import { evaluateAssessmentPersona } from '../../../backend/agents/assessment/assessmentAgent'

import brandLogo from '../../assets/images/crafture-logo.jpg'

// Complete mock report fallback
const MOCK_REPORT = {
  // V3.1 Resume Specialist Agent deep diagnosis (sample from real agent run)
  resume_agent: {
    "analysisVersion": "2.2",
    "candidateSnapshot": {
      "name": "Jordan Miller",
      "targetRole": "Junior Full Stack Developer",
      "experienceLevel": "Mid-Level (2-5 years)",
      "primaryProfile": "Full Stack Software Development"
    },
    "dashboard": {
      "version": "resume-scorecard-v1",
      "computedAt": "2026-10-05T11:13:00.180Z",
      "score": 93,
      "grade": "A",
      "gradeLabel": "Excellent",
      "grades": {
        "impact": {
          "label": "Impact",
          "score": 96,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "0 of 9 bullets include a hard number",
            "Impact issues: yes"
          ]
        },
        "positioning": {
          "label": "Positioning",
          "score": 84,
          "grade": "B",
          "gradeLabel": "Good",
          "facts": [
            "Positioning/ownership issues: yes"
          ]
        },
        "ats_readability": {
          "label": "ATS Safety",
          "score": 88,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "Contact details merged with summary text",
            "ATS issues: yes"
          ]
        },
        "credibility": {
          "label": "Credibility",
          "score": 92,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "Fabrication/assumption warnings: 0",
            "Skill evidence issues: yes"
          ]
        },
        "brevity": {
          "label": "Brevity",
          "score": 100,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "Average bullet length: 9.7 words",
            "All bullets within length"
          ]
        },
        "us_market_alignment": {
          "label": "US Alignment",
          "score": 100,
          "grade": "A",
          "gradeLabel": "Excellent",
          "facts": [
            "No non-US conventions detected",
            "No personal details"
          ]
        }
      },
      "checks": [
        {
          "id": "quantified_evidence",
          "label": "Quantified achievements",
          "status": "fail",
          "detail": "0 of 9 bullets include a hard number",
          "category": "impact"
        },
        {
          "id": "outcome_verbs",
          "label": "Bullets lead with outcome or action verbs",
          "status": "fail",
          "detail": "0 of 9 bullets show a clear action/outcome verb",
          "category": "impact"
        },
        {
          "id": "no_tool_dump",
          "label": "No tool-dump bullets",
          "status": "pass",
          "detail": "Every bullet explains the work, not just the stack",
          "category": "impact"
        },
        {
          "id": "contact_header",
          "label": "Contact details parse cleanly",
          "status": "warn",
          "detail": "Contact info sits alongside other text — check ATS parsing",
          "category": "ats_readability"
        },
        {
          "id": "no_personal_details",
          "label": "No personal details (US norm)",
          "status": "pass",
          "detail": "Nothing a US recruiter would expect removed",
          "category": "us_market_alignment"
        },
        {
          "id": "no_declaration",
          "label": "No declaration/signature block",
          "status": "pass",
          "detail": "None found",
          "category": "us_market_alignment"
        },
        {
          "id": "no_objective_section",
          "label": "Uses a summary, not an Objective",
          "status": "pass",
          "detail": "No Objective section found",
          "category": "us_market_alignment"
        },
        {
          "id": "skill_evidence",
          "label": "Skills backed by evidence",
          "status": "warn",
          "detail": "1 skill evidence gap(s) flagged",
          "category": "credibility"
        },
        {
          "id": "bullet_length",
          "label": "Bullet length (1-2 lines)",
          "status": "pass",
          "detail": "Average 9.7 words",
          "category": "brevity"
        },
        {
          "id": "page_count",
          "label": "1-2 page length",
          "status": "pass",
          "detail": "Parsed document is approximately 1 page(s)",
          "category": "brevity"
        },
        {
          "id": "certifications",
          "label": "Certifications / licenses included",
          "status": "warn",
          "detail": "No certifications listed — add any you hold",
          "category": "credibility"
        },
        {
          "id": "no_repetition",
          "label": "No repeated achievements",
          "status": "pass",
          "detail": "Each bullet carries distinct content",
          "category": "impact"
        }
      ],
      "bulletAudit": [
        {
          "bulletId": "exp_001_b01",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Responsible for writing code for web applications using JavaScript and React.",
          "status": "fix",
          "reason": "Core development framed as a passive duty rather than active delivery",
          "rewrite": "Built web application features using JavaScript and React across [ADD: number of web applications deployed].",
          "issueId": "iss_002",
          "category": "clarity"
        },
        {
          "bulletId": "exp_001_b02",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Assisted senior developers with backend bug fixing and routine database maintenance tasks.",
          "status": "warn",
          "reason": "Opens with weak/supporting phrasing ('Assisted') — start with a strong ownership action verb (e.g., Architected, Engineered, Automated, Spearheaded)",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_001_b03",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Worked with team members in daily agile standup meetings.",
          "status": "fix",
          "reason": "Routine meeting attendance listed as an achievement",
          "rewrite": null,
          "issueId": "iss_003",
          "category": "clarity"
        },
        {
          "bulletId": "exp_001_b04",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Handled customer support tickets and investigated client issues in production.",
          "status": "fix",
          "reason": "Production troubleshooting lacks operational scope and volume",
          "rewrite": "Investigated and resolved production client issues and support tickets, resolving [ADD: average number of tickets resolved per week].",
          "issueId": "iss_004",
          "category": "outcome_visibility"
        },
        {
          "bulletId": "exp_001_b05",
          "section": "experience",
          "itemName": "Software Developer | TechSolutions Inc. | Chicago, IL",
          "text": "Built REST APIs and wrote documentation for team members.",
          "status": "warn",
          "reason": "Describes the task/tools but omits the result — add the CAR outcome (what problem this solved, what improved, or measurable scope)",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_002_b01",
          "section": "experience",
          "itemName": "Experience",
          "text": "Created landing pages for clients using HTML, CSS, and basic JavaScript.",
          "status": "warn",
          "reason": "Describes the task/tools but omits the result — add the CAR outcome (what problem this solved, what improved, or measurable scope)",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_002_b02",
          "section": "experience",
          "itemName": "Experience",
          "text": "Attended weekly project status meetings with project managers.",
          "status": "warn",
          "reason": "Describes the task/tools but omits the result — add the CAR outcome (what problem this solved, what improved, or measurable scope)",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_002_b03",
          "section": "experience",
          "itemName": "Experience",
          "text": "Updated content and images on WordPress websites.",
          "status": "warn",
          "reason": "Describes the task/tools but omits the result — add the CAR outcome (what problem this solved, what improved, or measurable scope)",
          "rewrite": null,
          "issueId": null,
          "category": null
        },
        {
          "bulletId": "exp_002_b04",
          "section": "experience",
          "itemName": "Experience",
          "text": "Tested website links and browser compatibility across Chrome and Safari.",
          "status": "warn",
          "reason": "Describes the task/tools but omits the result — add the CAR outcome (what problem this solved, what improved, or measurable scope)",
          "rewrite": null,
          "issueId": null,
          "category": null
        }
      ],
      "summary": {
        "fix": 3,
        "warn": 6,
        "pass": 0,
        "checksPassed": 7,
        "checksTotal": 12,
        "strengths": 2,
        "issues": 5
      }
    },
    "overallReview": {
      "summary": "Jordan, your background shows a practical progression across both frontend interfaces and backend REST APIs. Having hands-on experience building React components, documenting APIs, and investigating live production issues gives you a solid foundation for junior full stack developer roles.\n\nThe main area to sharpen is how you communicate your daily impact. Right now, all 9 of your bullets describe tasks or routine meetings rather than measurable results. Upgrading passive phrases like \"responsible for\" to active verbs, cutting out meeting attendance bullets, and adding concrete ticket or project volumes will immediately make your technical contributions stand out to US engineering recruiters.",
      "tone": "conversational"
    },
    "issues": [
      {
        "id": "iss_001",
        "severity": "low",
        "category": "ats_readability",
        "title": "Extracted contact details merged into summary section",
        "diagnosis": "Your extracted resume text places contact details directly alongside your summary, which is worth checking for ATS-parsing safety.",
        "whyItMatters": "When applicant tracking systems parse a header merged into body text, contact fields like email and phone number can get misread or discarded, making it harder for recruiters to reach you directly.",
        "recommendation": "Ensure your name, email, phone number, and location sit cleanly in their own dedicated header block separate from the summary paragraph in your document source.",
        "correctedText": null,
        "metricDiscoveryQuestions": [],
        "evidence": [
          {
            "section": "summary",
            "itemId": "summary_001",
            "bulletId": "summary_001",
            "originalText": "Jordan Miller jordan.miller@example.com | (555) 789-0123 | Chicago, IL Hardworking software engineer looking to leverage my programming skills in a dynamic full stack development position. Responsible, detail-oriented team player with experience in multiple languages."
          }
        ],
        "correctionType": "none"
      },
      {
        "id": "iss_002",
        "severity": "medium",
        "category": "clarity",
        "title": "Core development framed as a passive duty rather than active delivery",
        "diagnosis": "The bullet begins with \"Responsible for writing code\", which reads like a job description duty rather than an active engineering contribution.",
        "whyItMatters": "Engineering recruiters scan quickly for what you personally built. Duty-oriented phrasing softens ownership and makes it harder to see what features or components you delivered.",
        "recommendation": "Lead with a power action verb such as \"Engineered\" or \"Built\" and define the scope of the web applications you contributed to.",
        "correctedText": "Built web application features using JavaScript and React across [ADD: number of web applications deployed].",
        "metricDiscoveryQuestions": [
          "How many web applications or distinct features did you build using JavaScript and React?",
          "What was the typical user base size or traffic volume for these web applications?"
        ],
        "evidence": [
          {
            "section": "experience",
            "itemId": "exp_001",
            "bulletId": "exp_001_b01",
            "originalText": "Responsible for writing code for web applications using JavaScript and React."
          }
        ],
        "correctionType": "rewrite"
      },
      {
        "id": "iss_003",
        "severity": "medium",
        "category": "clarity",
        "title": "Routine meeting attendance listed as an achievement",
        "diagnosis": "\"Worked with team members in daily agile standup meetings\" describes routine attendance rather than a technical deliverable or outcome.",
        "whyItMatters": "Attending standups is an expected baseline activity in software teams. Listing it as a standalone bullet uses up valuable resume space without highlighting technical skills.",
        "recommendation": "Replace this line with an engineering accomplishment, such as sprint deliverables completed, code reviews conducted, or cross-functional feature planning.",
        "correctedText": null,
        "metricDiscoveryQuestions": [
          "What specific features or sprint deliverables did you ship through your agile team cycles?",
          "Did you collaborate on peer code reviews or sprint planning that improved delivery turnaround?"
        ],
        "evidence": [
          {
            "section": "experience",
            "itemId": "exp_001",
            "bulletId": "exp_001_b03",
            "originalText": "Worked with team members in daily agile standup meetings."
          }
        ],
        "correctionType": "none"
      }
    ],
    "priorityActions": [
      {
        "priority": 1,
        "title": "Replace duty statements with active engineering verbs",
        "action": "Revise bullets starting with \"Responsible for\" and \"Assisted\" to power verbs like \"Built\", \"Engineered\", and \"Resolved\".",
        "reason": "Shifting from job descriptions to active contributions demonstrates ownership and makes your code contributions immediately visible."
      },
      {
        "priority": 2,
        "title": "Swap meeting attendance lines for technical contributions",
        "action": "Remove bullets that only mention attending agile standups or status meetings and replace them with sprint deliverables or feature releases.",
        "reason": "Recruiters already assume you attend meetings; dedicating bullets to attendance wastes space that could showcase technical output."
      },
      {
        "priority": 3,
        "title": "Quantify production troubleshooting volume",
        "action": "Add an estimate of weekly support tickets or client issues resolved to your production support bullet.",
        "reason": "Quantifying your debugging workload demonstrates operational reliability and capability in maintaining live web applications."
      }
    ]
  },
  // LinkedIn Agent deterministic sample
  linkedin_agent: {
    "agent": "linkedin",
    "version": "linkedin-agent-v1",
    "computedAt": "2026-10-05T18:37:22.595Z",
    "dataAvailable": true,
    "score": 71,
    "grade": "B",
    "gradeLabel": "Good",
    "grades": {
      "branding": {
        "label": "Branding & Story",
        "score": 65,
        "grade": "C",
        "gradeLabel": "Needs Work",
        "facts": [
          "Headline too short",
          "About section needs work"
        ]
      },
      "visibility": {
        "label": "Search Visibility",
        "score": 75,
        "grade": "B",
        "gradeLabel": "Good",
        "facts": [
          "340 connections",
          "0 recommendations"
        ]
      },
      "completeness": {
        "label": "Profile Completeness",
        "score": 70,
        "grade": "B",
        "gradeLabel": "Good",
        "facts": [
          "2 experiences (0 with descriptions)",
          "4 skills listed"
        ]
      },
      "consistency": {
        "label": "Resume Consistency",
        "score": 80,
        "grade": "B",
        "gradeLabel": "Good",
        "facts": [
          "Target role: Senior Full Stack Engineer"
        ]
      }
    },
    "checks": [
      {
        "id": "li_headline",
        "label": "Searchable headline",
        "status": "warn",
        "detail": "Too short for recruiter searches",
        "category": "branding"
      },
      {
        "id": "li_about",
        "label": "About section with proof",
        "status": "fail",
        "detail": "~110 characters, no numbers yet",
        "category": "branding"
      },
      {
        "id": "li_connections",
        "label": "500+ connections bracket",
        "status": "warn",
        "detail": "340 connections",
        "category": "visibility"
      },
      {
        "id": "li_recommendations",
        "label": "At least one recommendation",
        "status": "fail",
        "detail": "0 recommendation(s)",
        "category": "visibility"
      },
      {
        "id": "li_experience",
        "label": "Experiences with descriptions",
        "status": "fail",
        "detail": "0 of 2 roles have descriptions",
        "category": "completeness"
      },
      {
        "id": "li_skills",
        "label": "Skills coverage (10-15)",
        "status": "fail",
        "detail": "4 skills listed",
        "category": "completeness"
      },
      {
        "id": "li_role_match",
        "label": "Headline matches target role",
        "status": "warn",
        "detail": "Resume targets: Senior Full Stack Engineer",
        "category": "consistency"
      }
    ],
    "issues": [
      {
        "id": "li_001",
        "severity": "medium",
        "category": "branding",
        "title": "Headline is too short to be searchable",
        "diagnosis": "\"Software Developer at TechSolutions\" gives recruiters very little to match on. Most recruiter searches combine role + skills keywords.",
        "recommendation": "Expand to \"Target Role | Domain & Core Skills | Distinctive Win\" — around 8-15 words."
      },
      {
        "id": "li_002",
        "severity": "medium",
        "category": "branding",
        "title": "About section is thin",
        "diagnosis": "Only ~110 characters — recruiters and LinkedIn search both reward a fuller story with concrete outcomes.",
        "recommendation": "Aim for 1200-2000 characters: your positioning, 2-3 quantified wins, and a closing line about the role you want."
      },
      {
        "id": "li_003",
        "severity": "low",
        "category": "visibility",
        "title": "Below the 500-connections bracket",
        "diagnosis": "At 340 connections you sit just under the 500+ bracket that recruiters read as \"well-networked\".",
        "recommendation": "A few weeks of consistent 10/day personalized invitations gets you over the 500 mark."
      },
      {
        "id": "li_004",
        "severity": "medium",
        "category": "visibility",
        "title": "No recommendations on the profile",
        "diagnosis": "Zero recommendations removes the only third-party proof on the profile — recruiters notice an empty recommendations rail.",
        "recommendation": "Ask 2-3 former managers or senior colleagues for a short recommendation referencing a specific project."
      },
      {
        "id": "li_005",
        "severity": "medium",
        "category": "completeness",
        "title": "Experience entries lack descriptions",
        "diagnosis": "Most experience entries have no description — LinkedIn search only matches skills that appear in text, and recruiters skim for proof.",
        "recommendation": "Add 2-3 short, metric-led bullets to each role, consistent with the resume."
      },
      {
        "id": "li_006",
        "severity": "medium",
        "category": "completeness",
        "title": "Skills list is sparse",
        "diagnosis": "4 skills listed. LinkedIn ranks profiles in recruiter search partly by skills coverage — fewer than 10 sharply reduces discoverability.",
        "recommendation": "List up to 15 skills that match your target role, ordered by strength."
      },
      {
        "id": "li_007",
        "severity": "medium",
        "category": "consistency",
        "title": "Headline does not reflect the target role",
        "diagnosis": "The resume targets \"Senior Full Stack Engineer\" but the LinkedIn headline never mentions it — a recruiter cross-checking the two sees a mismatch.",
        "recommendation": "Align the headline (and About closing line) with the same target role as the resume."
      }
    ],
    "summary": {
      "fix": 6,
      "warn": 1,
      "pass": 0,
      "checksTotal": 7
    }
  },
  career_health_score: 41,
  score_label: 'Emerging',
  scores: {
    resume: { score: 34, diagnosis: 'Lacks quantitative metrics and ATS context keywords.' },
    linkedin: { score: 38, diagnosis: 'Decent profile completeness but low weekly networking activity.' },
    outreach: { score: 22, diagnosis: 'Outreach volume is critically low, relying mostly on Easy Apply.' },
    interview: { score: 42, diagnosis: 'Good mock interview performance, needs structure for behavioral stories.' },
  },
  resume_json: {
    candidate_name: 'Arjun Mehta',
    target_role: 'Senior Full Stack Engineer',
    years_of_experience: '4.5 Years',
    visa_status: 'F-1 OPT (STEM Extension)',
    contact: { email: 'arjun.mehta@example.com', phone: '+1 (555) 234-5678', location: 'San Francisco, CA' },
    top_skills: ['React.js', 'Node.js', 'TypeScript', 'GraphQL', 'AWS (EC2/S3)', 'MongoDB', 'Docker', 'PostgreSQL'],
    missing_ats_keywords: [],
    ats_score: 68,
    strengths: [
      'Strong modern JavaScript/TypeScript framework ecosystem and full-stack API design',
      'Demonstrated high-throughput microservices and latency optimization in production',
      'Enterprise cloud deployments and automated multi-region infrastructure pipelines',
    ],
    red_flags: [
      'Achievement bullets lack quantifiable business metrics (%, $, latency, team size)',
      'Over-reliance on job board Easy Apply without proactive recruiter networking',
    ],
    experience_summary: [
      'Engineered web dashboards used by over 50,000 active monthly users.',
      'Restructured backend API endpoints, improving load performance by 40%.',
    ],
    executive_ai_critique:
      "Your resume displays solid technical depth, but in today's high-competition market, ATS algorithms auto-filter up to 75% of profiles. Your bullets emphasize routine duties rather than tangible business impact. Adding hard percentage figures, latency improvements, and missing ATS keywords will immediately double your recruiter screening callbacks.",
  },
  career_journey: {
    current_phase_id: 2,
    guide_message: "We're currently in the Positioning phase. Before we accelerate outbound visibility and interviews, we need to eliminate the resume conversion bottlenecks holding you back.",
  },
  funnel_stages: {
    applications_count: 100,
    recruiter_calls_count: 5,
    interviews_count: 1,
    final_rounds_count: 0,
    offers_count: 0,
    biggest_leak_stage: 'Recruiter Calls',
    diagnosis_message:
      'Most candidates drop off right between Applications and Recruiter Calls. Fix top-of-funnel keyword density and quantified metrics to double screening invitations.',
  },
  rejection_factors: [
    { name: 'Resume Impact & ATS Keywords', pct: 38, desc: 'ATS parser drop-offs & achievement bullets lacking quantifiable metrics.' },
    { name: 'Application Strategy & Timing', pct: 22, desc: 'Late submissions on public boards facing 300+ competing applicants.' },
    { name: 'LinkedIn Profile Optimization', pct: 17, desc: 'Incomplete headline keywords and low weekly outbound networking activity.' },
    { name: 'Interview Behavioral Stories', pct: 11, desc: 'Unstructured responses to leadership and scenario questions (STAR gap).' },
  ],
  rejection_insight: 'Resume formatting and missing ATS keywords cause 38% of your initial rejections. This is the single highest-impact friction point to fix.',
  risk_heatmap: {
    critical_risk: 'Visa Sponsorship Timeline',
    high_impact_low_likelihood: ['Recruiter Ghosting', 'Offer Rescinded'],
    low_impact_high_likelihood: ['ATS Parsing Errors', 'Initial Screen Fail'],
    mitigation_plan: 'Target employers with verified e-Verify certification and explicit H-1B sponsorship history to prevent late-stage interview dropouts.',
  },
  mission_board: {
    xp_level: 'Level 4: Career Explorer',
    xp_current: 410,
    missions: [
      { title: 'Rebuild Resume Bullets', xp: '+18 XP', impact: 'High Impact' },
      { title: 'Optimize LinkedIn Headline', xp: '+12 XP', impact: 'High Impact' },
      { title: 'Fix ATS Keyword Density', xp: '+15 XP', impact: 'High Impact' },
      { title: 'Add 2 Production Projects', xp: '+10 XP', impact: 'Medium Impact' },
      { title: '3 Mock Behavioral Interviews', xp: '+15 XP', impact: 'High Impact' },
    ],
  },
  critical_issues: [
    {
      id: 'ci1',
      title: 'Low Application-to-Interview Conversion',
      description: 'Your application volume is high but your response rate is critically low (95% drop-off). Your resume lacks ATS keywords and metrics for specific roles.',
      severity: 'High',
      category: 'Resume Positioning',
      affectedSection: 'Experience Section',
      whyItMatters: 'Recruiters scan resumes in 6-8 seconds. Without immediate quantified outcomes in your top bullets, you get screened out automatically.',
      evidence: {
        section: 'experience',
        itemId: 'exp_001',
        bulletId: 'exp_001_b01',
        originalText: 'Responsible for maintaining backend services, database migrations, and collaborating with cross-functional teams on feature delivery.',
      },
      action_steps: ['Remove graphs and double columns from your resume.', 'Optimize layout for standard ATS parsing formats.'],
      recommendation: 'Rephrase your bullets using Google STAR/XYZ formula with quantified revenue, latency, or scale figures.',
      correctedText: 'Architected and optimized Go backend microservices handling 45,000 req/sec, reducing p99 database query latency by 58% across $14M billing infrastructure.',
    },
    {
      id: 'ci2',
      title: 'Direct Outreach Strategy Gap',
      description: 'You are relying primarily on public job board Easy Apply. Over 80% of senior and mid-level roles are filled through warm or direct outreach.',
      severity: 'Medium',
      category: 'Outreach Strategy',
      affectedSection: 'Outreach Cadence',
      whyItMatters: 'Public postings receive 350+ applications in hours. Direct recruiter messages cut directly to the front of the hiring queue.',
      evidence: {
        section: 'networking',
        itemId: 'net_001',
        bulletId: 'net_001_b01',
        originalText: 'Applied to 100+ roles via LinkedIn Easy Apply with minimal outreach to hiring managers.',
      },
      action_steps: ['Identify 5 direct recruiters at target companies weekly.', 'Send brief personalized connection notes.'],
      recommendation: 'Send 5 personalized recruiter notes weekly with customized 3-sentence value propositions.',
      correctedText: 'Direct Recruiter Outreach Cadence: Identify hiring manager, pitch specific architecture alignment, and request a 10-minute briefing call.',
    },
    {
      id: 'ci3',
      title: 'Project Portfolio Lacks Enterprise Context',
      description: 'Bullet points without measurable metrics are overlooked by ATS and technical managers. Add concrete numbers: throughput, percentages, team sizes.',
      severity: 'Medium',
      category: 'Project Positioning',
      affectedSection: 'Projects Section',
      whyItMatters: 'Senior engineering hiring managers evaluate side projects to gauge technical depth and architectural decision-making.',
      evidence: {
        section: 'projects',
        itemId: 'proj_001',
        bulletId: 'proj_001_b01',
        originalText: 'Built a full-stack dashboard with React and Node.js for tracking user analytics.',
      },
      action_steps: ['Rephrase achievement bullets using the STAR/Google XYZ formula.', 'Add explicit dollar values or percentage metrics.'],
      recommendation: 'State the engineering motivation, throughput benchmark, and fault-tolerance architecture implemented.',
      correctedText: 'Engineered real-time distributed analytics pipeline in React, TypeScript, and Go with Kafka event streaming, serving 250,000 MAU with zero downtime.',
    },
  ],
  roadmap: [
    {
      week: 'Week 1',
      title: 'Foundation Sprint',
      tasks: [
        'ATS-optimize your resume for top 3 target roles',
        'Complete LinkedIn profile to 100% (All-Star status)',
        'Build a list of 50 target companies with verified hiring',
      ],
    },
    {
      week: 'Week 2',
      title: 'Outreach Blitz',
      tasks: [
        'Send 5 personalized cold notes to recruiters weekly',
        'Connect with 10 alumni or peers at target companies',
        'Request 2 informational interviews',
      ],
    },
    {
      week: 'Week 3',
      title: 'Interview Mastery',
      tasks: [
        'Complete 3 mock interviews (behavioral + technical)',
        'Prepare STAR stories for top 10 leadership questions',
        'Research salary benchmarks with Levels.fyi',
      ],
    },
    {
      week: 'Week 4',
      title: 'Pipeline Acceleration',
      tasks: [
        'Follow up on all pending applications',
        'Schedule a mock negotiation session',
        'Lock in final interview rounds',
      ],
    },
  ],
  coach_intervention: {
    urgency_statement: 'Self-guided job search duration currently averages 6–9 months in this market climate.',
    value_prop: 'Consulting with a senior talent partner eliminates ATS blind spots and matches you to unlisted direct channels.',
    cta_text: 'Book Free 1-on-1 Strategy Call',
  },
  gps_score: 78,
  career_health_score: 78,
  score_label: 'Good',
  phase: {
    id: 2,
    name: 'Screening → Technical Round',
    shortName: 'Screening Stage',
    stuckDescription: 'Getting screening calls, but struggling to convert calls into technical rounds.',
    metricGoal: 'Convert >50% of recruiter screens into hiring manager/tech rounds.',
    confidence: 'High',
  },
  primary_bottleneck: {
    title: 'Recruiter Screening Pitch & Behavioral Story Framing',
    category: 'screening_delivery',
    whyItMatters: 'Recruiter screens verify communication, technical summary clarity, and compensation alignment. Live elevator pitch needs sharper business metrics.',
    evidence: 'Candidate reports getting calls but stalling before advancing to technical panel interviews.',
  },
  secondary_problem: {
    title: 'Resume Achievement Metrics & STAR Structure Gaps',
    description: 'Achievement bullets describe routine tasks rather than quantifiable business impact and scale.',
  },
  strongest_area: 'Resume / Documents (20/25)',
  next_best_action: 'Script and rehearse a crisp 90-second "Tell me about yourself" narrative focused on technical ownership.',
  top_actions: [
    {
      title: 'Script 90-Second Recruiter Pitch',
      category: 'Screening Pitch',
      whyItMatters: 'Recruiter screens verify communication and ownership within 15 minutes.',
      whatToDo: 'Script and practice a crisp 90-second "Tell me about yourself" narrative focused on technical ownership.',
      resourceTool: 'Recruiter Scripting Framework',
      duration: '2 hours',
      successMetric: 'Scheduled recruiter calls convert at >50%',
    },
    {
      title: 'Quantify Top 5 Resume Bullets',
      category: 'Resume Optimization',
      whyItMatters: 'Recruiters screen for business ROI and verifiable scale metrics within 6 seconds.',
      whatToDo: 'Rewrite top 5 resume bullets using STAR/Google XYZ impact formula with hard numbers.',
      resourceTool: 'Crafture STAR Bullet Builder',
      duration: '3 hours',
      successMetric: '100% of top role bullets include verified metrics',
    },
    {
      title: 'Direct Hiring Manager Outreach',
      category: 'Networking & Strategy',
      whyItMatters: 'Direct messages to hiring managers achieve 4x higher response rates than Easy Apply.',
      whatToDo: 'Identify 5 verified hiring managers weekly at target firms; send personalized 50-word notes.',
      resourceTool: 'LinkedIn InMail Templates',
      duration: '45 mins / day',
      successMetric: 'At least 2 warm replies weekly',
    },
  ],
}

import ReportErrorBoundary from './ReportErrorBoundary'

export default function ReportDashboard() {
  return (
    <ReportErrorBoundary>
      <ReportDashboardContent />
    </ReportErrorBoundary>
  )
}

function ReportDashboardContent() {
  const storeReportData = useAppStore((s) => s.reportData)
  const userId = useAppStore((s) => s.userId)
  const email = useAppStore((s) => s.email)
  const formData = useAppStore((s) => s.formData)
  const setReportData = useAppStore((s) => s.setReportData)
  const reset = useAppStore((s) => s.reset)
  const setPhase = useAppStore((s) => s.setPhase)
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  const isMockPreview = typeof window !== 'undefined' && (
    window.location.search.includes('mock=true') ||
    window.location.pathname.toLowerCase() === '/report-preview'
  )

  const [isRecovering, setIsRecovering] = useState(false)
  const hasAttemptedRecovery = useRef(false)

  useEffect(() => {
    if (storeReportData || isMockPreview) return
    if (hasAttemptedRecovery.current) return
    if (!userId && !email) return

    hasAttemptedRecovery.current = true
    let isMounted = true
    setIsRecovering(true)

    api.getReport({ userId, email })
      .then((report) => {
        if (isMounted && report) {
          setReportData(report)
        }
      })
      .catch((err) => {
        console.warn('[ReportDashboard] Failed to fetch persisted report:', err)
      })
      .finally(() => {
        if (isMounted) setIsRecovering(false)
      })

    return () => { isMounted = false }
  }, [storeReportData, userId, email, isMockPreview, setReportData])

  const [activeDiagnosisTab, setActiveDiagnosisTab] = useState('resume')
  const [showReadyModal, setShowReadyModal] = useState(() => {
    if (typeof window === 'undefined') return false
    return !sessionStorage.getItem('crafture_gps_ready_dismissed')
  })

  // Case 1: Fetching persisted report from backend for verified user
  if (isRecovering) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--surface-base)] text-[var(--text-primary)]">
        <div className="relative mb-6 w-16 h-16 flex items-center justify-center">
          <SpinnerGap size={40} className="animate-spin text-[var(--primary)]" />
        </div>
        <h2 className="text-xl font-bold mb-2 font-['Poppins']">Recovering Your Career GPS Report...</h2>
        <p className="text-sm text-[var(--text-tertiary)] max-w-sm text-center">
          Retrieving your verified assessment diagnosis and customized roadmap.
        </p>
      </div>
    )
  }

  const storeResumeAnalysis = useAppStore((s) => s.resumeAnalysis)

  // Case 2: Assessment completed + verified, but report generation pending
  const hasResumeData = Boolean(storeResumeAnalysis?.data || storeResumeAnalysis?.status === 'completed')
  const hasAssessmentData = Boolean(formData && Object.keys(formData).length > 0)
  if (!storeReportData && !isMockPreview && userId && (hasAssessmentData || hasResumeData || email)) {
    return <AnalysisLoader />
  }

  // Case 3: No report, and no active user session (cold visit to /report)
  if (!storeReportData && !isMockPreview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--surface-base)] text-[var(--text-primary)]">
        <div className="max-w-md w-full p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-default)] shadow-xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[var(--primary-subtle)] text-[var(--primary)] flex items-center justify-center mx-auto border border-[var(--border-default)]">
            <Compass size={36} weight="duotone" />
          </div>
          <h2 className="text-2xl font-bold font-['Poppins'] text-[var(--text-primary)]">
            No Assessment Found
          </h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            You haven't completed a Career GPS assessment yet, or your previous session has expired. Complete our 3-minute assessment to unlock your personalized career diagnosis.
          </p>
          <button
            onClick={() => {
              reset()
              setPhase(PHASES.ASSESSMENT)
              navigateTo('/')
            }}
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Start Assessment</span>
            <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      </div>
    )
  }

  const reportData = storeReportData || (isMockPreview ? MOCK_REPORT : null)
  if (!reportData) return null

  // Gracefully merge background resume and linkedin agent analyses if not already attached on reportData
  if (!reportData.resume_agent) {
    if (reportData.resumeAgent) reportData.resume_agent = reportData.resumeAgent
    else if (storeResumeAnalysis?.data?.analysis) reportData.resume_agent = storeResumeAnalysis.data.analysis
    else if (isMockPreview) reportData.resume_agent = MOCK_REPORT.resume_agent
  }
  if (!reportData.resume_json) {
    if (reportData.resumeJson) reportData.resume_json = reportData.resumeJson
    else if (storeResumeAnalysis?.data?.canonicalResume) reportData.resume_json = storeResumeAnalysis.data.canonicalResume
    else if (isMockPreview) reportData.resume_json = MOCK_REPORT.resume_json
  }
  if (!reportData.linkedin_agent) {
    if (reportData.linkedinAgent) reportData.linkedin_agent = reportData.linkedinAgent
    else if (isMockPreview) reportData.linkedin_agent = MOCK_REPORT.linkedin_agent
  }

  // Dynamic client-side backfill if assessment metrics or bottlenecks are missing or stuck on Phase 1 fallback
  if (!reportData.primary_bottleneck || !reportData.phase?.shortName || reportData.phase?.name === 'Resume → Screening Call') {
    try {
      const liveEval = evaluateAssessmentPersona({
        answers: reportData.user_answers || formData || {},
        resumeAgent: reportData.resume_agent,
        linkedinAgent: reportData.linkedin_agent,
      })
      if (liveEval) {
        reportData.phase = liveEval.phase
        reportData.primary_bottleneck = liveEval.primary_bottleneck
        reportData.secondary_problem = liveEval.secondary_problem
        reportData.strongest_area = liveEval.strongest_area
        reportData.next_best_action = liveEval.next_best_action
        reportData.top_actions = liveEval.top_actions
        reportData.gps_scores = liveEval.scores
        reportData.external_context = liveEval.external_context
        reportData.assessment_agent = liveEval
        reportData.gps_score = liveEval.gpsScore
      }
    } catch (evalErr) {
      console.warn('[ReportDashboard] Failed to backfill live assessment persona:', evalErr)
    }
  }

  // Resolve Candidate Name dynamically from all possible resume & assessment sources
  const rawName =
    reportData.resume_agent?.candidateSnapshot?.name ||
    reportData.resume_json?.candidate?.name ||
    reportData.resume_json?.candidate_name ||
    reportData.resume_json?.name ||
    reportData.candidate_name ||
    formData?.name ||
    formData?.fullName ||
    storeResumeAnalysis?.data?.analysis?.candidateSnapshot?.name ||
    storeResumeAnalysis?.data?.canonicalResume?.candidate?.name ||
    (email ? email.split('@')[0] : '')

  const candidateName = typeof rawName === 'string' ? rawName.trim() : (rawName?.name || '')

  // Resolve Target Role dynamically from all possible resume & assessment sources
  const rawRole =
    reportData.resume_agent?.candidateSnapshot?.targetRole ||
    reportData.resume_json?.candidate?.targetRole ||
    reportData.resume_json?.target_role ||
    reportData.target_role ||
    formData?.targetRole ||
    formData?.target_role ||
    formData?.desiredRole ||
    formData?.role ||
    storeResumeAnalysis?.data?.analysis?.candidateSnapshot?.targetRole ||
    storeResumeAnalysis?.data?.canonicalResume?.candidate?.targetRole ||
    ''

  const targetRole = typeof rawRole === 'string' ? rawRole.trim() : ''


  const handleBookCall = async () => {
    if (email) {
      try {
        await api.bookCall({ email })
      } catch (err) {
        console.error('Failed to register book call lead:', err)
      }
    }
  }

  // Cross-component smooth navigation
  const handleNavigateSection = (sectionId, tabId = null) => {
    let targetId = sectionId
    if (targetId === 'opportunities' || targetId === 'priorities' || targetId === 'diagnosis' || targetId === 'strengths') {
      if (tabId === 'linkedin' || targetId === 'linkedin') targetId = 'linkedin-ai'
      else if (tabId === 'interview' || targetId === 'funnel') targetId = 'funnel-risks'
      else targetId = 'resume-ai'
    }
    const element = document.getElementById(targetId)
    if (element) {
      const navOffset = 90
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({
        top: elementPosition - navOffset,
        behavior: 'smooth',
      })
    }
  }

  return (
    <div className="bg-[var(--surface-base)] text-[var(--text-primary)] transition-colors duration-150">
      {/* ─── Screen Popup: Your Career GPS is Ready (Section 22) ─── */}
      <CareerGpsReadyModal
        isOpen={showReadyModal}
        onClose={() => {
          setShowReadyModal(false)
          try {
            sessionStorage.setItem('crafture_gps_ready_dismissed', 'true')
          } catch (_e) {}
        }}
        reportData={reportData}
      />

      {/* ─── Top Brand Header ─── */}
      <header
        role="banner"
        className="px-4 py-3.5 bg-[var(--surface-card)] border-b border-[var(--border-default)]"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={brandLogo}
              alt="Career GPS"
              className="w-8 h-8 rounded-lg shadow-xs object-cover border border-[var(--border-default)]"
            />
            <div>
              <span
                style={{ fontFamily: 'var(--font-head)', fontWeight: 800, letterSpacing: '-0.02em' }}
                className="text-base sm:text-lg text-[var(--text-primary)] block leading-tight"
              >
                CAREER <span className="text-[var(--primary)]">GPS</span>
              </span>
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-muted)] tracking-wider block">
                Executive Intelligence Report
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReadyModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary-light)] border border-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              title="Open Executive GPS Summary"
            >
              <Sparkle size={13} weight="fill" />
              <span className="hidden sm:inline">Executive Summary</span>
            </button>
            <button
              onClick={async () => {
                try {
                  const state = useAppStore.getState()
                  const email = state.userEmail || reportData?.user_answers?.email || ''
                  const userId = state.userId || ''
                  const params = new URLSearchParams()
                  if (userId) params.append('userId', userId)
                  if (email) params.append('email', email)
                  const url = `${import.meta.env.VITE_API_URL || '/api'}/assessment/report-pdf?${params.toString()}`
                  window.open(url, '_blank')
                } catch (_e) {
                  sessionStorage.setItem('craftureFullReport', JSON.stringify(reportData))
                  window.open('/full-report?print=true', '_blank')
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="Download print-perfect Career GPS Report PDF"
            >
              <DownloadSimple size={13} weight="bold" />
              <span className="hidden sm:inline">Download PDF Report</span>
            </button>

            <button
              onClick={() => {
                sessionStorage.setItem('craftureFullReport', JSON.stringify(reportData))
                window.open('/full-report', '_blank')
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Open full expanded document view for printing"
            >
              <Printer size={13} weight="bold" />
              <span className="hidden md:inline">Print / Standardized View</span>
            </button>

            <button
              onClick={() => useAppStore.getState().setPhase(PHASES.ASSESSMENT)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--surface-sunken)] border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--primary)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Return to assessment to re-test or edit inputs"
            >
              <ArrowsClockwise size={13} weight="bold" />
              <span className="hidden sm:inline">Retest</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] transition-all cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
            </button>

            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 text-[var(--emerald)]">
              <ShieldCheck size={14} weight="fill" />
              <span>Verified Report</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Sticky Story Navigation Bar ─── */}
      <StickyReportNav
        candidateName={candidateName}
        targetRole={targetRole}
        showResumeAi={Boolean(reportData.resume_agent)}
        showLinkedinAi={true}
      />

      {/* ─── Main Story-Driven Content Container (Max Width 1200px) ─── */}
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-0 space-y-10 print:px-0 print:py-0 print:pb-0 print:space-y-3">
        {/* SECTION 1: HERO & SCORECARD */}
        <ReportHero reportData={reportData} />

        <CareerHealthSnapshot
          scores={reportData.scores || reportData.score_breakdown}
          resumeAgent={reportData.resume_agent}
          resumeJson={reportData.resume_json}
          reportData={reportData}
          onNavigateSection={handleNavigateSection}
        />

        {/* SECTION 2: WHERE & WHY YOU ARE STUCK (6-PHASE ROOT CAUSE) */}
        <PrimaryBottleneck
          reportData={reportData}
          onNavigateSection={handleNavigateSection}
        />

        {/* SECTION 3: AI RESUME DEEP DIAGNOSIS & REWRITES (MUST BE VISIBLE!) */}
        {reportData.resume_agent && (
          <ResumeDeepDiagnosis resumeAgent={reportData.resume_agent} reportData={reportData} />
        )}

        {/* SECTION 4: AI LINKEDIN PROFILE DIAGNOSIS & REWRITES (MUST BE VISIBLE!) */}
        <LinkedInDeepDiagnosis
          linkedinAgent={reportData.linkedin_agent}
          reportData={reportData}
        />

        {/* SECTION 5: 90-DAY FUNNEL & CONVERSION VELOCITY */}
        <FunnelAndConversionSection
          funnelData={reportData.funnel_stages}
          rejectionData={{
            factors: reportData.rejection_factors,
            insight: reportData.rejection_insight,
          }}
          riskData={reportData.risk_heatmap}
        />

        {/* SECTION 6: 7-DAY ACTION PLAN & 30/60/90 ROADMAP */}
        <RoadmapTimeline
          roadmapData={reportData.roadmap}
          currentPhaseId={reportData.career_journey?.current_phase_id}
          reportData={reportData}
        />

        {/* SECTION 7: FINAL EXECUTION BRIDGE & CALL BOOKING */}
        <FinalNextAction
          coachData={reportData.coach_intervention}
          reportData={reportData}
          onBookCall={handleBookCall}
        />

        {/* ─── Footer (Anchored with FinalNextAction to avoid trailing blank page) ─── */}
        <footer className="border-t border-[var(--border-default)] mt-4 pt-3 pb-2 text-center text-xs text-[var(--text-muted)] space-y-1 break-inside-avoid page-break-inside-avoid print:mt-2 print:pt-2 print:pb-0">
          <p className="font-medium">
            Crafture Career GPS AI • Confidential Candidate Career Intelligence
          </p>
          <p className="text-[11px]">
            Proprietary scoring and ATS diagnostic algorithms. &copy; {new Date().getFullYear()} Crafture Inc. All rights reserved.
          </p>
        </footer>
      </main>

      {/* Floating agent chat (Atlas) */}
      <ReportChatbot />
    </div>
  )
}
