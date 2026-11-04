/**
 * AI Resume Parser Agent — Career GPS
 * Uses fast LLM structured extraction (Gemini Flash / Groq) to parse raw resume text
 * into 100% accurate canonical JSON. Zero regex guessing.
 */

import { llmGateway } from '../../../ai/gateway/llmGateway.js'
import { jsonrepair } from 'jsonrepair'

export const RESUME_PARSER_SYSTEM_PROMPT = `You are a World-Class ATS Resume Parser. Your sole mission is to extract structured JSON from raw resume text with 100% accuracy and fidelity.

CRITICAL EXTRACTION RULES:
1. COMPANY NAMES: Extract ONLY the legal company, employer, or client name (e.g., "PwC USA", "Shure Incorporated USA", "Recibo Technologies", "Collabera / Bank of America"). 
   - NEVER put job titles, dates, or locations into the company field.
   - If a bullet mentions working at a client (e.g., "delivered pipelines at Shure Incorporated USA"), recognize "Shure Incorporated USA" as the company for that role.
2. JOB ROLES: Extract standard professional job titles (e.g., "Data Analyst", "Senior Full Stack Software Developer"). Do not append dates or company names to the role.
3. DATES: Extract start and end dates cleanly (e.g., startDate: "July 2024", endDate: "May 2025" or "Present"). If current job, set isCurrent: true.
4. EDUCATION: Strictly separate into 4 distinct fields:
   - school: University or College name ONLY (e.g., "University of Illinois Chicago (UIC)", "Stevens Institute of Technology")
   - degree: Degree and Major (e.g., "M.S., Business Analytics", "B.Tech, Computer Science and Engineering")
   - location: City, State/Country (e.g., "Chicago, IL", "Hoboken, NJ", "Kolhapur, India")
   - dates: "August 2023 – May 2025"
5. PROJECTS: Extract project title, tech stack (comma-separated), and bullet points.
6. TECHNICAL SKILLS: Extract categorized skills (e.g., "Programming Languages", "Cloud & DevOps", "Databases & Messaging"). Do not split parentheses or slashes across items.
7. CERTIFICATIONS: Extract certifications as a clean array of strings (e.g., ["Google Data Analytics", "Bloomberg Market Concepts"]).
8. CONTACT: Extract candidate's name, email, phone, location, LinkedIn URL, and GitHub URL.
9. ZERO FABRICATION: Extract strictly what is present in the text. Never invent dates, companies, or metrics.

OUTPUT FORMAT (JSON ONLY):
{
  "candidate": {
    "name": "Candidate Full Name",
    "targetRole": "Primary Target Title from resume",
    "contact": {
      "location": "City, State",
      "phone": "Phone number",
      "email": "Email address",
      "linkedin": "LinkedIn profile link or username",
      "github": "GitHub profile link or username"
    }
  },
  "summary": "Full professional summary text if present",
  "experiences": [
    {
      "company": "Clean Legal Company Name",
      "role": "Clean Job Title",
      "location": "City, State/Country (e.g. Chicago, IL)",
      "startDate": "Start Month Year",
      "endDate": "End Month Year or Present",
      "isCurrent": false,
      "bullets": ["Bullet 1", "Bullet 2"]
    }
  ],
  "projects": [
    {
      "title": "Project Title",
      "techStack": "Tools & frameworks used",
      "bullets": ["Bullet 1"]
    }
  ],
  "skills": [
    { "category": "Programming Languages", "skills": ["Python", "SQL"] }
  ],
  "education": [
    {
      "school": "University Name",
      "degree": "Degree and Major",
      "location": "City, State/Country",
      "dates": "Start Month Year – End Month Year"
    }
  ],
  "certifications": ["Cert 1", "Cert 2"]
}
`

export async function parseResumeWithAI(rawText = '', targetRoleContext = '') {
  if (!rawText || rawText.trim().length < 40) {
    throw new Error('Raw resume text is too short or empty to parse.')
  }

  const userPrompt = `
TARGET ROLE CONTEXT: ${targetRoleContext || 'Not Specified'}

RESUME RAW TEXT TO PARSE:
${rawText}
`

  try {
    let rawResponse
    try {
      rawResponse = await llmGateway.generate({
        purpose: 'resume-parsing',
        preferredProvider: 'openrouter',
        model: 'google/gemini-3.5-flash-lite',
        messages: [
          { role: 'system', content: RESUME_PARSER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        responseFormat: 'json_object',
        temperature: 0.0,
        timeoutMs: 30000,
      })
    } catch (openRouterErr) {
      console.warn('[aiResumeParserAgent] OpenRouter primary parse failed, trying gemini fallback:', openRouterErr.message)
      rawResponse = await llmGateway.generate({
        purpose: 'resume-parsing',
        preferredProvider: 'gemini',
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: RESUME_PARSER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        responseFormat: 'json_object',
        temperature: 0.0,
        timeoutMs: 30000,
      })
    }

    const textToParse = typeof rawResponse === 'string' ? rawResponse : rawResponse?.text || JSON.stringify(rawResponse)
    let parsed
    try {
      parsed = JSON.parse(textToParse)
    } catch {
      parsed = JSON.parse(jsonrepair(textToParse))
    }

    if (parsed && typeof parsed === 'object') {
      // Backward compatibility aliases for candidate
      if (parsed.candidate) {
        if (!parsed.candidate_name) parsed.candidate_name = parsed.candidate.name || ''
        if (!parsed.target_role) parsed.target_role = parsed.candidate.targetRole || ''
        if (!parsed.contact && parsed.candidate.contact) {
          parsed.contact = { ...parsed.candidate.contact }
        }
      } else if (parsed.candidate_name) {
        parsed.candidate = {
          name: parsed.candidate_name,
          targetRole: parsed.target_role || '',
          contact: parsed.contact || {},
        }
      }

      // Ensure education entries have both school/institution and dates/year aliases
      if (Array.isArray(parsed.education)) {
        parsed.education = parsed.education.map((edu) => {
          if (typeof edu === 'string') return edu
          const school = (edu.school || edu.institution || edu.university || '').trim()
          const dates = (edu.dates || edu.year || '').trim()
          return {
            ...edu,
            school,
            institution: school,
            dates,
            year: dates,
          }
        })
      }

      // Ensure flat array of skills and top_skills are easily accessible
      const flatSkills = []
      if (Array.isArray(parsed.skills)) {
        for (const item of parsed.skills) {
          if (typeof item === 'string') {
            flatSkills.push(item.trim())
          } else if (item && Array.isArray(item.skills)) {
            for (const sk of item.skills) {
              if (typeof sk === 'string' && sk.trim()) flatSkills.push(sk.trim())
            }
          } else if (item && (item.name || item.skill)) {
            flatSkills.push((item.name || item.skill || '').trim())
          }
        }
      }
      parsed.flatSkills = flatSkills.filter(Boolean)
      if (!parsed.top_skills || !Array.isArray(parsed.top_skills)) {
        parsed.top_skills = parsed.flatSkills.slice(0, 8)
      }
    }

    return parsed
  } catch (err) {
    console.error('[AIResumeParser] Failed to parse resume with LLM:', err.message)
    throw err
  }
}

export default {
  RESUME_PARSER_SYSTEM_PROMPT,
  parseResumeWithAI,
}

