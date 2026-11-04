import React from 'react'
import InterviewDefenseInteractive from './InterviewDefenseInteractive.jsx'

/**
 * InterviewDefenseSheet
 *
 * Technical Talking Points & Interview Defense Guide
 * Equips candidates with concrete, humanized talking points to confidently explain
 * every target skill added or enhanced on their resume during live recruiter and technical rounds.
 */
export default function InterviewDefenseSheet({
  interviewLedger = [],
  variant = 'light',
  initialSkillsOnly = [],
  targetRole = 'Data Analyst',
  company = 'PwC USA',
  onToast = (msg) => console.log(msg),
}) {
  const skills = Array.isArray(initialSkillsOnly) && initialSkillsOnly.length > 0
    ? initialSkillsOnly
    : (Array.isArray(interviewLedger) && interviewLedger.length > 0
        ? interviewLedger.map((i) => i.keyword || i.name || i).filter(Boolean)
        : [])

  return (
    <InterviewDefenseInteractive
      initialSkillsOnly={skills}
      targetRole={targetRole}
      company={company}
      onToast={onToast}
    />
  )
}
