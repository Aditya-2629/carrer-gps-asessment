// Curated database of U.S. Job Market Locations: Metros, States, Cities & Remote
// Designed for high-relevance career search matching

export const POPULAR_HUBS = [
  {
    id: 'remote-us',
    label: 'Remote (Anywhere in U.S.)',
    value: 'Remote',
    category: 'remote',
    categoryLabel: 'Remote',
    icon: '🌐',
    meta: 'Nationwide reach · Maximum pipeline flexibility',
    keywords: ['remote', 'work from home', 'wfh', 'telecommute', 'anywhere', 'us', 'usa', 'virtual'],
  },
  {
    id: 'metro-sf-bay',
    label: 'San Francisco Bay Area, CA',
    value: 'San Francisco Bay Area, CA',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'CA',
    stateName: 'California',
    icon: '🌉',
    meta: 'Tech & AI Epicenter · Silicon Valley, SF, San Jose',
    keywords: ['sf', 'san francisco', 'silicon valley', 'bay area', 'san jose', 'palo alto', 'oakland', 'sunnyvale', 'mountain view', 'ca', 'california'],
  },
  {
    id: 'metro-nyc',
    label: 'New York City Metro Area, NY',
    value: 'New York, NY',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'NY',
    stateName: 'New York',
    icon: '🗽',
    meta: 'Finance, Enterprise Tech, Media & Commerce',
    keywords: ['nyc', 'new york', 'manhattan', 'brooklyn', 'queens', 'jersey city', 'ny', 'nj', 'new jersey'],
  },
  {
    id: 'metro-seattle',
    label: 'Greater Seattle Area, WA',
    value: 'Seattle, WA',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'WA',
    stateName: 'Washington',
    icon: '🌲',
    meta: 'Cloud Infrastructure, AI & Big Tech Hub',
    keywords: ['seattle', 'bellevue', 'redmond', 'kirkland', 'wa', 'washington', 'puget sound'],
  },
  {
    id: 'metro-austin',
    label: 'Greater Austin Area, TX',
    value: 'Austin, TX',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'TX',
    stateName: 'Texas',
    icon: '🤠',
    meta: 'Silicon Hills · High-growth tech & startups',
    keywords: ['austin', 'round rock', 'tx', 'texas', 'silicon hills'],
  },
  {
    id: 'metro-boston',
    label: 'Greater Boston Area, MA',
    value: 'Boston, MA',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'MA',
    stateName: 'Massachusetts',
    icon: '🎓',
    meta: 'Biotech, AI Research, Robotics & Engineering',
    keywords: ['boston', 'cambridge', 'somerville', 'ma', 'massachusetts', 'new england'],
  },
  {
    id: 'metro-chicago',
    label: 'Chicago Metropolitan Area, IL',
    value: 'Chicago, IL',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'IL',
    stateName: 'Illinois',
    icon: '🏙️',
    meta: 'Fintech, Proprietary Trading, Logistics & SaaS',
    keywords: ['chicago', 'naperville', 'evanston', 'il', 'illinois', 'midwest'],
  },
  {
    id: 'metro-los-angeles',
    label: 'Greater Los Angeles Area, CA',
    value: 'Los Angeles, CA',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'CA',
    stateName: 'California',
    icon: '🌴',
    meta: 'Silicon Beach, Media Tech, Aerospace & Defense',
    keywords: ['la', 'los angeles', 'santa monica', 'culver city', 'irvine', 'orange county', 'ca'],
  },
]

export const US_METROS = [
  ...POPULAR_HUBS.filter((h) => h.category === 'metro'),
  {
    id: 'metro-dfw',
    label: 'Dallas-Fort Worth Metroplex, TX',
    value: 'Dallas-Fort Worth, TX',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'TX',
    stateName: 'Texas',
    icon: '🏢',
    meta: 'Enterprise Tech, Telecom & Corporate HQs',
    keywords: ['dfw', 'dallas', 'fort worth', 'plano', 'irving', 'frisco', 'tx', 'texas'],
  },
  {
    id: 'metro-dc',
    label: 'Washington D.C. Metro Area (DMV)',
    value: 'Washington D.C.',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'DC',
    stateName: 'District of Columbia',
    icon: '🏛️',
    meta: 'Cybersecurity, GovTech, Defense & Cloud',
    keywords: ['dc', 'washington dc', 'dmv', 'arlington', 'alexandria', 'mclean', 'bethesda', 'tysons', 'va', 'md'],
  },
  {
    id: 'metro-denver',
    label: 'Denver-Boulder Metro, CO',
    value: 'Denver, CO',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'CO',
    stateName: 'Colorado',
    icon: '🏔️',
    meta: 'Aerospace, CleanTech, SaaS & Startups',
    keywords: ['denver', 'boulder', 'colorado springs', 'co', 'colorado', 'rockies'],
  },
  {
    id: 'metro-rtp',
    label: 'Raleigh-Durham Research Triangle, NC',
    value: 'Raleigh-Durham, NC',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'NC',
    stateName: 'North Carolina',
    icon: '🔬',
    meta: 'Life Sciences, Software Hub & Enterprise Tech',
    keywords: ['rtp', 'raleigh', 'durham', 'chapel hill', 'cary', 'nc', 'north carolina', 'research triangle'],
  },
  {
    id: 'metro-atlanta',
    label: 'Atlanta Metropolitan Area, GA',
    value: 'Atlanta, GA',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'GA',
    stateName: 'Georgia',
    icon: '🍑',
    meta: 'Fintech Transaction Alley, HealthTech & Supply Chain',
    keywords: ['atlanta', 'alpharetta', 'midtown', 'buckhead', 'ga', 'georgia'],
  },
  {
    id: 'metro-miami',
    label: 'Miami-South Florida Metro, FL',
    value: 'Miami, FL',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'FL',
    stateName: 'Florida',
    icon: '☀️',
    meta: 'Fintech, Crypto, HealthTech & LatAm Tech Bridge',
    keywords: ['miami', 'fort lauderdale', 'boca raton', 'brickell', 'fl', 'florida'],
  },
  {
    id: 'metro-sandiego',
    label: 'San Diego Metro Area, CA',
    value: 'San Diego, CA',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'CA',
    stateName: 'California',
    icon: '🌊',
    meta: 'Biotech, Genomics, Wireless & Defense Technology',
    keywords: ['san diego', 'la jolla', 'sorrento valley', 'carlsbad', 'ca', 'california'],
  },
  {
    id: 'metro-phoenix',
    label: 'Phoenix-Scottsdale Metro, AZ',
    value: 'Phoenix, AZ',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'AZ',
    stateName: 'Arizona',
    icon: '🌵',
    meta: 'Semiconductors, Autonomous Mobility & Software',
    keywords: ['phoenix', 'scottsdale', 'tempe', 'chandler', 'mesa', 'az', 'arizona'],
  },
  {
    id: 'metro-philly',
    label: 'Philadelphia Metro Area, PA',
    value: 'Philadelphia, PA',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'PA',
    stateName: 'Pennsylvania',
    icon: '🔔',
    meta: 'BioTech, Pharma, FinTech & Healthcare AI',
    keywords: ['philadelphia', 'philly', 'conshohocken', 'king of prussia', 'pa', 'pennsylvania'],
  },
  {
    id: 'metro-twin-cities',
    label: 'Minneapolis-Saint Paul (Twin Cities), MN',
    value: 'Minneapolis, MN',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'MN',
    stateName: 'Minnesota',
    icon: '❄️',
    meta: 'MedTech, Fortune 500 Enterprise & Retail Tech',
    keywords: ['minneapolis', 'st paul', 'saint paul', 'twin cities', 'bloomington', 'mn', 'minnesota'],
  },
  {
    id: 'metro-slc',
    label: 'Salt Lake City-Silicon Slopes, UT',
    value: 'Salt Lake City, UT',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'UT',
    stateName: 'Utah',
    icon: '⛷️',
    meta: 'Silicon Slopes · Enterprise Cloud & SaaS Corridor',
    keywords: ['salt lake city', 'slc', 'silicon slopes', 'lehi', 'provo', 'draper', 'ut', 'utah'],
  },
  {
    id: 'metro-portland',
    label: 'Portland Metro Area (Silicon Forest), OR',
    value: 'Portland, OR',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'OR',
    stateName: 'Oregon',
    icon: '🌲',
    meta: 'Silicon Forest · Semiconductors, Hardware & Software',
    keywords: ['portland', 'hillsboro', 'beaverton', 'silicon forest', 'or', 'oregon'],
  },
  {
    id: 'metro-charlotte',
    label: 'Charlotte Metro Area, NC',
    value: 'Charlotte, NC',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'NC',
    stateName: 'North Carolina',
    icon: '💳',
    meta: 'Second Largest U.S. Banking Center & FinTech',
    keywords: ['charlotte', 'uptown', 'ballantyne', 'nc', 'north carolina'],
  },
  {
    id: 'metro-pittsburgh',
    label: 'Pittsburgh Metro Area, PA',
    value: 'Pittsburgh, PA',
    category: 'metro',
    categoryLabel: 'Metro Area',
    state: 'PA',
    stateName: 'Pennsylvania',
    icon: '🤖',
    meta: 'Robotics, Autonomous Vehicles & AI Research (CMU)',
    keywords: ['pittsburgh', 'robotics row', 'pa', 'pennsylvania'],
  },
]

export const US_STATES = [
  { code: 'AL', name: 'Alabama', icon: '📍' },
  { code: 'AK', name: 'Alaska', icon: '❄️' },
  { code: 'AZ', name: 'Arizona', icon: '🌵' },
  { code: 'AR', name: 'Arkansas', icon: '📍' },
  { code: 'CA', name: 'California', icon: '☀️' },
  { code: 'CO', name: 'Colorado', icon: '🏔️' },
  { code: 'CT', name: 'Connecticut', icon: '📍' },
  { code: 'DE', name: 'Delaware', icon: '📍' },
  { code: 'FL', name: 'Florida', icon: '🌴' },
  { code: 'GA', name: 'Georgia', icon: '🍑' },
  { code: 'HI', name: 'Hawaii', icon: '🌺' },
  { code: 'ID', name: 'Idaho', icon: '🥔' },
  { code: 'IL', name: 'Illinois', icon: '🏙️' },
  { code: 'IN', name: 'Indiana', icon: '🏎️' },
  { code: 'IA', name: 'Iowa', icon: '🌽' },
  { code: 'KS', name: 'Kansas', icon: '🌾' },
  { code: 'KY', name: 'Kentucky', icon: '🐎' },
  { code: 'LA', name: 'Louisiana', icon: '🎷' },
  { code: 'ME', name: 'Maine', icon: '🦞' },
  { code: 'MD', name: 'Maryland', icon: '🦀' },
  { code: 'MA', name: 'Massachusetts', icon: '🎓' },
  { code: 'MI', name: 'Michigan', icon: '🚗' },
  { code: 'MN', name: 'Minnesota', icon: '❄️' },
  { code: 'MS', name: 'Mississippi', icon: '📍' },
  { code: 'MO', name: 'Missouri', icon: '🏛️' },
  { code: 'MT', name: 'Montana', icon: '🏔️' },
  { code: 'NE', name: 'Nebraska', icon: '🌽' },
  { code: 'NV', name: 'Nevada', icon: '🎰' },
  { code: 'NH', name: 'New Hampshire', icon: '🍁' },
  { code: 'NJ', name: 'New Jersey', icon: '🌉' },
  { code: 'NM', name: 'New Mexico', icon: '🌶️' },
  { code: 'NY', name: 'New York', icon: '🗽' },
  { code: 'NC', name: 'North Carolina', icon: '🌲' },
  { code: 'ND', name: 'North Dakota', icon: '🌾' },
  { code: 'OH', name: 'Ohio', icon: '🌰' },
  { code: 'OK', name: 'Oklahoma', icon: '🌪️' },
  { code: 'OR', name: 'Oregon', icon: '🌲' },
  { code: 'PA', name: 'Pennsylvania', icon: '🔔' },
  { code: 'RI', name: 'Rhode Island', icon: '⚓' },
  { code: 'SC', name: 'South Carolina', icon: '🌴' },
  { code: 'SD', name: 'South Dakota', icon: '🦬' },
  { code: 'TN', name: 'Tennessee', icon: '🎸' },
  { code: 'TX', name: 'Texas', icon: '🤠' },
  { code: 'UT', name: 'Utah', icon: '⛷️' },
  { code: 'VT', name: 'Vermont', icon: '🍁' },
  { code: 'VA', name: 'Virginia', icon: '🏛️' },
  { code: 'WA', name: 'Washington', icon: '🌲' },
  { code: 'WV', name: 'West Virginia', icon: '⛰️' },
  { code: 'WI', name: 'Wisconsin', icon: '🧀' },
  { code: 'WY', name: 'Wyoming', icon: '🤠' },
  { code: 'DC', name: 'Washington D.C.', icon: '🏛️' },
].map((s) => ({
  id: `state-${s.code.toLowerCase()}`,
  label: `${s.name} (${s.code})`,
  value: `${s.name}, ${s.code}`,
  category: 'state',
  categoryLabel: 'U.S. State',
  state: s.code,
  stateName: s.name,
  icon: s.icon,
  meta: `Statewide search · All cities & regions in ${s.name}`,
  keywords: [s.name.toLowerCase(), s.code.toLowerCase(), 'state'],
}))

export const MAJOR_US_CITIES = [
  { name: 'New York', state: 'NY', icon: '🗽', meta: 'Financial Capital & Tech Hub' },
  { name: 'Los Angeles', state: 'CA', icon: '🌴', meta: 'Silicon Beach & Media Tech' },
  { name: 'San Francisco', state: 'CA', icon: '🌉', meta: 'AI & Venture Capital Epicenter' },
  { name: 'Seattle', state: 'WA', icon: '🌲', meta: 'Cloud Computing & Tech Titans' },
  { name: 'Austin', state: 'TX', icon: '🤠', meta: 'Silicon Hills High-Tech Hub' },
  { name: 'Boston', state: 'MA', icon: '🎓', meta: 'Biotech & Robotics Capital' },
  { name: 'Chicago', state: 'IL', icon: '🏙️', meta: 'Trading, Fintech & Enterprise Hub' },
  { name: 'San Jose', state: 'CA', icon: '💻', meta: 'Capital of Silicon Valley' },
  { name: 'San Diego', state: 'CA', icon: '🌊', meta: 'Biotech & Defense Tech Corridor' },
  { name: 'Dallas', state: 'TX', icon: '🏢', meta: 'Corporate Telecom & Tech Center' },
  { name: 'Houston', state: 'TX', icon: '🚀', meta: 'Space, Energy Tech & Medical Center' },
  { name: 'Washington', state: 'DC', icon: '🏛️', meta: 'National Cybersecurity & GovTech' },
  { name: 'Atlanta', state: 'GA', icon: '🍑', meta: 'Fintech & Enterprise Tech Hub' },
  { name: 'Denver', state: 'CO', icon: '🏔️', meta: 'Aerospace & SaaS Hub' },
  { name: 'Miami', state: 'FL', icon: '☀️', meta: 'Fintech & Emerging Startup Hub' },
  { name: 'Phoenix', state: 'AZ', icon: '🌵', meta: 'Semiconductor Manufacturing Hub' },
  { name: 'Philadelphia', state: 'PA', icon: '🔔', meta: 'Pharma & Biotech Center' },
  { name: 'Raleigh', state: 'NC', icon: '🔬', meta: 'Research Triangle Software Hub' },
  { name: 'Charlotte', state: 'NC', icon: '💳', meta: 'Banking & Financial Technology' },
  { name: 'Minneapolis', state: 'MN', icon: '❄️', meta: 'Medical Device & Retail Tech' },
  { name: 'Portland', state: 'OR', icon: '🌲', meta: 'Silicon Forest Tech Corridor' },
  { name: 'Salt Lake City', state: 'UT', icon: '⛷️', meta: 'Silicon Slopes SaaS Center' },
  { name: 'Pittsburgh', state: 'PA', icon: '🤖', meta: 'Robotics & Autonomous AI' },
  { name: 'Nashville', state: 'TN', icon: '🎸', meta: 'Healthcare Tech & Music Tech' },
  { name: 'Orlando', state: 'FL', icon: '🎢', meta: 'Simulation, Gaming & Defense Tech' },
  { name: 'Tampa', state: 'FL', icon: '🏖️', meta: 'Cybersecurity & Healthtech Hub' },
  { name: 'Detroit', state: 'MI', icon: '🚗', meta: 'Autonomous Mobility & Industrial Tech' },
  { name: 'Columbus', state: 'OH', icon: '🌰', meta: 'Fintech & Intel Semiconductor Corridor' },
  { name: 'Indianapolis', state: 'IN', icon: '🏎️', meta: 'HealthTech & Marketing SaaS Hub' },
  { name: 'Boulder', state: 'CO', icon: '🏔️', meta: 'Quantum Computing & Tech Startups' },
  { name: 'Palo Alto', state: 'CA', icon: '💡', meta: 'Heart of Silicon Valley & Stanford' },
  { name: 'Mountain View', state: 'CA', icon: '🔍', meta: 'Home of Google & Tech Pioneers' },
  { name: 'Sunnyvale', state: 'CA', icon: '☀️', meta: 'Silicon Valley Cloud & Hardware' },
  { name: 'Bellevue', state: 'WA', icon: '🏢', meta: 'Eastside Cloud & Enterprise Hub' },
  { name: 'Redmond', state: 'WA', icon: '💻', meta: 'Enterprise Software & Gaming (Microsoft)' },
  { name: 'Cambridge', state: 'MA', icon: '🧬', meta: 'Kendall Square · Biotech & MIT AI' },
  { name: 'Jersey City', state: 'NJ', icon: '🗽', meta: 'Wall Street West & Fintech' },
  { name: 'Arlington', state: 'VA', icon: '🏛️', meta: 'Amazon HQ2 & Defense Tech Corridor' },
  { name: 'Plano', state: 'TX', icon: '🏢', meta: 'Legacy West Corporate & Tech Hub' },
  { name: 'Irvine', state: 'CA', icon: '🌴', meta: 'Orange County Tech & Gaming Center' },
].map((c) => ({
  id: `city-${c.name.toLowerCase().replace(/\s+/g, '-')}-${c.state.toLowerCase()}`,
  label: `${c.name}, ${c.state}`,
  value: `${c.name}, ${c.state}`,
  category: 'city',
  categoryLabel: 'Major City',
  state: c.state,
  icon: c.icon,
  meta: c.meta,
  keywords: [c.name.toLowerCase(), c.state.toLowerCase(), `${c.name.toLowerCase()}, ${c.state.toLowerCase()}`, `${c.name.toLowerCase()} ${c.state.toLowerCase()}`],
}))

export const ALL_LOCATIONS = [
  POPULAR_HUBS[0], // Remote
  ...US_METROS,
  ...MAJOR_US_CITIES,
  ...US_STATES,
]

// Search algorithm with ranked results
export function searchLocations(query, limit = 10) {
  if (!query || !query.trim()) {
    return POPULAR_HUBS
  }

  const q = query.trim().toLowerCase()
  const exactMatches = []
  const startsWithMatches = []
  const containsMatches = []
  const keywordMatches = []

  const seenIds = new Set()

  for (const loc of ALL_LOCATIONS) {
    if (seenIds.has(loc.id)) continue

    const labelLower = loc.label.toLowerCase()
    const valueLower = loc.value.toLowerCase()

    // 1. Exact match
    if (labelLower === q || valueLower === q || (loc.state && loc.state.toLowerCase() === q)) {
      exactMatches.push(loc)
      seenIds.add(loc.id)
      continue
    }

    // 2. Starts with query
    if (labelLower.startsWith(q) || valueLower.startsWith(q)) {
      startsWithMatches.push(loc)
      seenIds.add(loc.id)
      continue
    }

    // 3. Contains as a word or substring in label/value
    if (labelLower.includes(q) || valueLower.includes(q)) {
      containsMatches.push(loc)
      seenIds.add(loc.id)
      continue
    }

    // 4. Keyword / Alias match (e.g. 'dmv' -> DC, 'silicon valley' -> SF Bay Area)
    if (loc.keywords && loc.keywords.some((k) => k.includes(q) || q.includes(k))) {
      keywordMatches.push(loc)
      seenIds.add(loc.id)
      continue
    }
  }

  const combined = [
    ...exactMatches,
    ...startsWithMatches,
    ...containsMatches,
    ...keywordMatches,
  ]

  return combined.slice(0, limit)
}
