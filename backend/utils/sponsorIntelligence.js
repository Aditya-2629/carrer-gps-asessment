// Top verified USCIS enterprise tech sponsors & consulting firms
export const VERIFIED_SPONSOR_REGISTRY = new Map([
  ['pwc', { name: 'PricewaterhouseCoopers (PwC)', tier: 'Tier-1 Sponsor', approvals: '1,200+' }],
  ['deloitte', { name: 'Deloitte', tier: 'Tier-1 Sponsor', approvals: '2,500+' }],
  ['ey', { name: 'Ernst & Young (EY)', tier: 'Tier-1 Sponsor', approvals: '1,800+' }],
  ['kpmg', { name: 'KPMG', tier: 'Tier-1 Sponsor', approvals: '950+' }],
  ['amazon', { name: 'Amazon / AWS', tier: 'Tier-1 Sponsor', approvals: '8,000+' }],
  ['google', { name: 'Google / Alphabet', tier: 'Tier-1 Sponsor', approvals: '4,500+' }],
  ['microsoft', { name: 'Microsoft', tier: 'Tier-1 Sponsor', approvals: '3,800+' }],
  ['meta', { name: 'Meta', tier: 'Tier-1 Sponsor', approvals: '1,500+' }],
  ['apple', { name: 'Apple', tier: 'Tier-1 Sponsor', approvals: '2,100+' }],
  ['capital one', { name: 'Capital One', tier: 'Tier-1 Sponsor', approvals: '1,100+' }],
  ['jpmorgan', { name: 'JPMorgan Chase', tier: 'Tier-1 Sponsor', approvals: '1,400+' }],
  ['goldman sachs', { name: 'Goldman Sachs', tier: 'Tier-1 Sponsor', approvals: '850+' }],
  ['shure', { name: 'Shure Incorporated', tier: 'Verified Corporate Sponsor', approvals: '50+' }],
  ['kpit', { name: 'KPIT Technologies', tier: 'Verified Corporate Sponsor', approvals: '450+' }],
  ['walmart', { name: 'Walmart Global Tech', tier: 'Tier-1 Sponsor', approvals: '900+' }],
  ['salesforce', { name: 'Salesforce', tier: 'Tier-1 Sponsor', approvals: '750+' }],
  ['oracle', { name: 'Oracle', tier: 'Tier-1 Sponsor', approvals: '1,100+' }],
  ['cisco', { name: 'Cisco Systems', tier: 'Tier-1 Sponsor', approvals: '900+' }],
  ['intel', { name: 'Intel Corporation', tier: 'Tier-1 Sponsor', approvals: '1,300+' }],
  ['qualcomm', { name: 'Qualcomm', tier: 'Tier-1 Sponsor', approvals: '1,200+' }],
  ['uber', { name: 'Uber Technologies', tier: 'Tier-1 Sponsor', approvals: '600+' }],
])

export function getCompanySponsorStatus(companyName = '') {
  if (!companyName) return { isVerified: false, tier: 'Unverified / Direct Inquiry Needed', approvals: '0' }
  const clean = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const [key, data] of VERIFIED_SPONSOR_REGISTRY.entries()) {
    const cleanKey = key.replace(/[^a-z0-9]/g, '')
    const rawName = data.name ? data.name.replace(/\(.*?\)/g, '') : ''
    const cleanName = rawName.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (
      (cleanKey && (clean.includes(cleanKey) || cleanKey.includes(clean))) ||
      (cleanName && (clean.includes(cleanName) || cleanName.includes(clean)))
    ) {
      return { isVerified: true, ...data }
    }
  }
  return { isVerified: false, tier: 'Unverified / Direct Inquiry Needed', approvals: '0' }
}
