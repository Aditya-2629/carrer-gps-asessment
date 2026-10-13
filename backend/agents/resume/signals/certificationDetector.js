/**
 * Certification Detector
 * Deterministically detects industry-standard technical certifications across
 * resume skills, professional summary, experience bullets, and projects.
 *
 * Ensures certifications mentioned anywhere in the document are recognized
 * in the canonical facts and deterministic dossier without relying on an LLM.
 */

export const KNOWN_CERTIFICATIONS = [
  // AWS Certifications
  {
    name: 'AWS Certified Solutions Architect - Associate',
    issuer: 'Amazon Web Services',
    category: 'Cloud',
    pattern: /\baws\s+certified\s+solutions\s+architect\s*(?:[-–]\s*)?(?:associate)?\b|\baws\s+solutions\s+architect\s+associate\b/i,
  },
  {
    name: 'AWS Certified Solutions Architect - Professional',
    issuer: 'Amazon Web Services',
    category: 'Cloud',
    pattern: /\baws\s+certified\s+solutions\s+architect\s*(?:[-–]\s*)?professional\b|\baws\s+solutions\s+architect\s+professional\b/i,
  },
  {
    name: 'AWS Certified Developer - Associate',
    issuer: 'Amazon Web Services',
    category: 'Cloud',
    pattern: /\baws\s+certified\s+developer\b|\baws\s+developer\s+associate\b/i,
  },
  {
    name: 'AWS Certified DevOps Engineer - Professional',
    issuer: 'Amazon Web Services',
    category: 'Cloud',
    pattern: /\baws\s+certified\s+devops\s+engineer\b|\baws\s+devops\s+engineer\s+professional\b/i,
  },
  {
    name: 'AWS Certified Cloud Practitioner',
    issuer: 'Amazon Web Services',
    category: 'Cloud',
    pattern: /\baws\s+certified\s+cloud\s+practitioner\b|\baws\s+cloud\s+practitioner\b/i,
  },
  {
    name: 'AWS Certified SysOps Administrator',
    issuer: 'Amazon Web Services',
    category: 'Cloud',
    pattern: /\baws\s+certified\s+sysops\b/i,
  },
  {
    name: 'AWS Certified Security - Specialty',
    issuer: 'Amazon Web Services',
    category: 'Security',
    pattern: /\baws\s+certified\s+security\b/i,
  },

  // Microsoft Azure Certifications
  {
    name: 'Microsoft Certified: Azure Fundamentals (AZ-900)',
    issuer: 'Microsoft',
    category: 'Cloud',
    pattern: /\b(?:az-?900|azure\s+fundamentals)\b/i,
  },
  {
    name: 'Microsoft Certified: Azure Administrator Associate (AZ-104)',
    issuer: 'Microsoft',
    category: 'Cloud',
    pattern: /\b(?:az-?104|azure\s+administrator\s+associate)\b/i,
  },
  {
    name: 'Microsoft Certified: Azure Developer Associate (AZ-204)',
    issuer: 'Microsoft',
    category: 'Cloud',
    pattern: /\b(?:az-?204|azure\s+developer\s+associate)\b/i,
  },
  {
    name: 'Microsoft Certified: Azure Solutions Architect Expert (AZ-305)',
    issuer: 'Microsoft',
    category: 'Cloud',
    pattern: /\b(?:az-?305|azure\s+solutions\s+architect\s+expert)\b/i,
  },
  {
    name: 'Microsoft Certified: Azure DevOps Engineer Expert (AZ-400)',
    issuer: 'Microsoft',
    category: 'Cloud',
    pattern: /\b(?:az-?400|azure\s+devops\s+engineer\s+expert)\b/i,
  },

  // Google Cloud Certifications
  {
    name: 'Google Cloud Certified Professional Cloud Architect',
    issuer: 'Google Cloud',
    category: 'Cloud',
    pattern: /\b(?:google\s+cloud|gcp)\s+certified\s+professional\s+cloud\s+architect\b|\bgcp\s+cloud\s+architect\b/i,
  },
  {
    name: 'Google Cloud Certified Associate Cloud Engineer',
    issuer: 'Google Cloud',
    category: 'Cloud',
    pattern: /\b(?:google\s+cloud|gcp)\s+certified\s+associate\s+cloud\s+engineer\b|\bgcp\s+associate\s+cloud\s+engineer\b/i,
  },
  {
    name: 'Google Cloud Certified Professional Data Engineer',
    issuer: 'Google Cloud',
    category: 'Data',
    pattern: /\b(?:google\s+cloud|gcp)\s+certified\s+professional\s+data\s+engineer\b|\bgcp\s+data\s+engineer\b/i,
  },

  // Kubernetes & Cloud Native
  {
    name: 'Certified Kubernetes Administrator (CKA)',
    issuer: 'CNCF / Linux Foundation',
    category: 'DevOps',
    pattern: /\b(?:cka|certified\s+kubernetes\s+administrator)\b/i,
  },
  {
    name: 'Certified Kubernetes Application Developer (CKAD)',
    issuer: 'CNCF / Linux Foundation',
    category: 'DevOps',
    pattern: /\b(?:ckad|certified\s+kubernetes\s+application\s+developer)\b/i,
  },
  {
    name: 'Certified Kubernetes Security Specialist (CKS)',
    issuer: 'CNCF / Linux Foundation',
    category: 'Security',
    pattern: /\b(?:cks|certified\s+kubernetes\s+security\s+specialist)\b/i,
  },
  {
    name: 'HashiCorp Certified: Terraform Associate',
    issuer: 'HashiCorp',
    category: 'DevOps',
    pattern: /\b(?:terraform\s+associate|hashicorp\s+certified\s+terraform)\b/i,
  },
  {
    name: 'Docker Certified Associate (DCA)',
    issuer: 'Docker / Mirantis',
    category: 'DevOps',
    pattern: /\b(?:docker\s+certified\s+associate|dca\s+certified)\b/i,
  },

  // Project Management & Agile
  {
    name: 'Project Management Professional (PMP)',
    issuer: 'Project Management Institute (PMI)',
    category: 'Management',
    pattern: /\b(?:pmp|project\s+management\s+professional)\b/i,
  },
  {
    name: 'Certified ScrumMaster (CSM)',
    issuer: 'Scrum Alliance',
    category: 'Agile',
    pattern: /\b(?:csm|certified\s+scrum\s*master)\b/i,
  },
  {
    name: 'Professional Scrum Master (PSM)',
    issuer: 'Scrum.org',
    category: 'Agile',
    pattern: /\b(?:psm\s*(?:i|ii|iii)?|professional\s+scrum\s*master)\b/i,
  },
  {
    name: 'Certified Scrum Product Owner (CSPO)',
    issuer: 'Scrum Alliance',
    category: 'Agile',
    pattern: /\b(?:cspo|certified\s+scrum\s*product\s*owner)\b/i,
  },
  {
    name: 'PMI Agile Certified Practitioner (PMI-ACP)',
    issuer: 'Project Management Institute (PMI)',
    category: 'Agile',
    pattern: /\bpmi-acp\b/i,
  },

  // Cybersecurity
  {
    name: 'Certified Information Systems Security Professional (CISSP)',
    issuer: '(ISC)²',
    category: 'Security',
    pattern: /\bcissp\b|\bcertified\s+information\s+systems\s+security\s+professional\b/i,
  },
  {
    name: 'CompTIA Security+',
    issuer: 'CompTIA',
    category: 'Security',
    pattern: /\bcomptia\s+security\+?\b|\bsec\+\b/i,
  },
  {
    name: 'Certified Ethical Hacker (CEH)',
    issuer: 'EC-Council',
    category: 'Security',
    pattern: /\bceh\b|\bcertified\s+ethical\s+hacker\b/i,
  },
  {
    name: 'Certified Information Security Manager (CISM)',
    issuer: 'ISACA',
    category: 'Security',
    pattern: /\bcism\b/i,
  },
  {
    name: 'Offensive Security Certified Professional (OSCP)',
    issuer: 'OffSec',
    category: 'Security',
    pattern: /\boscp\b/i,
  },

  // Networking & Systems
  {
    name: 'Cisco Certified Network Associate (CCNA)',
    issuer: 'Cisco',
    category: 'Networking',
    pattern: /\bccna\b|\bcisco\s+certified\s+network\s+associate\b/i,
  },
  {
    name: 'Cisco Certified Network Professional (CCNP)',
    issuer: 'Cisco',
    category: 'Networking',
    pattern: /\bccnp\b|\bcisco\s+certified\s+network\s+professional\b/i,
  },
  {
    name: 'CompTIA Network+',
    issuer: 'CompTIA',
    category: 'Networking',
    pattern: /\bcomptia\s+network\+?\b|\bnet\+\b/i,
  },
  {
    name: 'CompTIA A+',
    issuer: 'CompTIA',
    category: 'IT',
    pattern: /\bcomptia\s+a\+\b/i,
  },
]

/**
 * Deterministically scans a canonical resume representation for certifications
 * across existing certifications, skills, summary, and experience/project bullets.
 *
 * @param {Object} canonicalResume
 * @returns {Array<Object>} Deduplicated certifications
 */
export function detectCertifications(canonicalResume) {
  if (!canonicalResume || typeof canonicalResume !== 'object') {
    return []
  }

  const detected = []
  const seenNames = new Set()

  // 1. Existing parsed certifications from dedicated section
  if (Array.isArray(canonicalResume.certifications)) {
    for (const cert of canonicalResume.certifications) {
      if (!cert || !cert.name) continue
      const cleanName = cert.name.trim()
      const normKey = cleanName.toLowerCase()
      if (!seenNames.has(normKey)) {
        seenNames.add(normKey)
        detected.push({
          id: cert.id || `cert_${String(detected.length + 1).padStart(3, '0')}`,
          name: cleanName,
          issuer: cert.issuer || '',
          year: cert.year || '',
          category: cert.category || 'General',
          source: 'section',
        })
      }
    }
  }

  // 2. Scan skill names
  const skillNames = (canonicalResume.skills || []).map((s) => s.name || s).filter(Boolean)
  for (const skill of skillNames) {
    for (const certDef of KNOWN_CERTIFICATIONS) {
      if (certDef.pattern.test(skill)) {
        const normKey = certDef.name.toLowerCase()
        if (!seenNames.has(normKey)) {
          seenNames.add(normKey)
          detected.push({
            id: `cert_${String(detected.length + 1).padStart(3, '0')}`,
            name: certDef.name,
            issuer: certDef.issuer,
            year: '',
            category: certDef.category,
            source: 'skills',
          })
        }
      }
    }
  }

  // 3. Scan summary text
  const summaryText = canonicalResume.summary?.text || ''
  if (summaryText) {
    for (const certDef of KNOWN_CERTIFICATIONS) {
      if (certDef.pattern.test(summaryText)) {
        const normKey = certDef.name.toLowerCase()
        if (!seenNames.has(normKey)) {
          seenNames.add(normKey)
          detected.push({
            id: `cert_${String(detected.length + 1).padStart(3, '0')}`,
            name: certDef.name,
            issuer: certDef.issuer,
            year: '',
            category: certDef.category,
            source: 'summary',
          })
        }
      }
    }
  }

  // 4. Scan experience and project bullets
  const allBullets = [
    ...(canonicalResume.experience || []).flatMap((e) => e.bullets || []),
    ...(canonicalResume.projects || []).flatMap((p) => p.bullets || []),
  ].map((b) => b.text || '').filter(Boolean)

  for (const bulletText of allBullets) {
    for (const certDef of KNOWN_CERTIFICATIONS) {
      if (certDef.pattern.test(bulletText)) {
        const normKey = certDef.name.toLowerCase()
        if (!seenNames.has(normKey)) {
          seenNames.add(normKey)
          detected.push({
            id: `cert_${String(detected.length + 1).padStart(3, '0')}`,
            name: certDef.name,
            issuer: certDef.issuer,
            year: '',
            category: certDef.category,
            source: 'bullets',
          })
        }
      }
    }
  }

  return detected
}

export default {
  KNOWN_CERTIFICATIONS,
  detectCertifications,
}
