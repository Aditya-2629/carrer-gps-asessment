# Assessment Schema & AI Semantic Registry

The Crafture Career GPS assessment systematically evaluates job seekers across **31 standardized dimensions** organized into **5 thematic Chapters**.

---

## The 5 Assessment Chapters

```text
Chapter 01: Set Your Coordinates      (Steps 1  – 5)   • Location, Eligibility, & Resume Upload
Chapter 02: Inspect Your Career Gear   (Steps 6  – 10)  • ATS Readability, Versions, & Impact
Chapter 03: Become Visible             (Steps 11 – 17)  • LinkedIn, Velocity, & Direct Outreach
Chapter 04: Enter the Hiring Arena     (Steps 18 – 25)  • Recruiter Screens, Assessments, & Mocks
Chapter 05: Build Your Route           (Steps 26 – 31)  • Time Investment, AI Tools, & Guidance
```

---

## Complete 31-Question Schema Catalog

| Step | Canonical Field | Layer 1 UX Title | Answer Type | Unit / Cadence | Normalized |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **01** | `phone` | Where should we send your Career GPS report? | `contact` | Phone String | No |
| **02** | `visa` | What kind of work authorization are you traveling with? | `category` | Enum (CPT, STEM OPT, H1, GC, USC...) | No |
| **03** | `relocate` | How wide should we draw your job-search map? | `boolean` | Yes / No | No |
| **04** | `location` | Where should your Career GPS search first? | `location_list` | Text / City Array | No |
| **05** | `resume` | Show us the resume you are taking into the market. | `document_file`| PDF / DOCX Binary File | No |
| **06** | `resumeVersions` | How many versions are in your resume toolkit? | `count` | Versions | No |
| **07** | `atsScore` | Has your resume ever been through an ATS check? | `percentage` | Percentage / Unknown | No |
| **08** | `customizeResume` | When the job changes, does your resume change with it? | `boolean` | Yes / No | No |
| **09** | `employmentGap` | Does your career timeline have a chapter we should explain? | `boolean` | Yes / No | No |
| **10** | `metrics` | Does your resume show what changed because of your work? | `boolean` | Yes / No | No |
| **11** | `linkedin` | Where can recruiters find the professional version of you? | `url` | LinkedIn Profile URL | No |
| **12** | `linkedinOpt` | If a recruiter found you tonight, would your profile tell the story? | `category` | Yes / No / Not Sure | No |
| **13** | `linkedinCon` | How fast is your professional network growing? | `frequency` | Connection Requests | **Yes (Week / Month)** |
| **14** | `coldEmails` | How often are you knocking on doors instead of waiting for them to open? | `frequency` | Direct Messages | **Yes (Week / Month)** |
| **15** | `consultancy` | Who's currently in your corner? | `category` | Agency / C2C / W2 / Solo | No |
| **16** | `appsWeek` | How many job applications are you submitting? | `frequency` | Applications | **Yes (Week / Month)** |
| **17** | `easyApply` | How much of your search is one-click applying? | `frequency` | Applications | **Yes (Week / Month)** |
| **18** | `aiScreen` | How often does an AI recruiter invite you in? | `frequency` | Automated Screens | **Yes (Week / Month)** |
| **19** | `humanScreen` | How often does a real recruiter enter the conversation? | `frequency` | Recruiter Calls | **Yes (Week / Month)** |
| **20** | `assessments` | How often are employers testing you before the interview? | `frequency` | Coding / Skill Tests | **Yes (Week / Month)** |
| **21** | `assessScore` | When you get tested, how are you scoring? | `percentage` | Percentage / Unknown | No |
| **22** | `assessType` | Which hiring challenges have you already faced? | `multi_select` | Multiple Select Options | No |
| **23** | `mockInterviews` | Before the real interview, do you practice against a fake one? | `boolean` | Yes / No | No |
| **24** | `codeInterviews` | When a live coding interview begins, how does it feel? | `category` | High Anxiety / Comfortable / N/A | No |
| **25** | `feedback` | Where do companies usually go quiet? | `multi_select` | Multiple Drop-off Stages | No |
| **26** | `hoursWeek` | How much time can you put into your search each week? | `frequency` | Hours | **Yes (Week / Month)** |
| **27** | `biggestChallenge` | What has been your single biggest roadblock? | `free_text` | Candidate Narrative | No |
| **28** | `triedImprove` | What moves have you already made to fix it? | `free_text` | Candidate Remediation Log | No |
| **29** | `aiTools` | Which AI gear is currently in your toolkit? | `multi_select` | Multiple Tool Selections | No |
| **30** | `strategies` | Which routes are currently on your radar? | `multi_select` | Multiple Strategy Selections | No |
| **31** | `investGuidance` | If a proven route opened today, are you ready to invest? | `boolean` | Yes / No (Final Submit Step) | No |

---

## Quantitative Normalization Architecture

Several questions measure search velocity. Rather than forcing candidates to perform mental math for a rigid "per week" format, candidates choose between:
- `📅 Per Week`
- `🗓️ Per Month`

### Normalization Logic
When a candidate selects a timeframe and inputs a numerical value:
1. **Raw Entry**: Preserves the original candidate input string (e.g. `"25"`).
2. **Chosen Period**: Records `'week'` or `'month'`.
3. **Normalized Per Week**:
   $$\text{normalizedPerWeek} = \begin{cases} \text{raw}, & \text{if period} = \text{'week'} \\ \text{round}\left(\frac{\text{raw}}{4.33}\right), & \text{if period} = \text{'month'} \end{cases}$$
4. **Normalized Per Month**:
   $$\text{normalizedPerMonth} = \begin{cases} \text{round}(\text{raw} \times 4.33), & \text{if period} = \text{'week'} \\ \text{raw}, & \text{if period} = \text{'month'} \end{cases}$$
5. **Formatted String**: Human-readable label (e.g. `"25 per week"`, `"100 per month"`).
6. **Not Applicable (`is_na`)**: Boolean flag set when candidate clicks "None / Not doing this".

---

## Layer-2 Semantic Object Example

When the candidate completes Step 14:

```json
{
  "coldEmails": {
    "field": "coldEmails",
    "semanticKey": "direct_outreach_frequency",
    "questionIntent": "Measure the number of proactive recruiter, hiring manager, or professional outreach messages the candidate sends during a selected period.",
    "answerType": "frequency",
    "unit": "messages",
    "timeframe": "weekly_or_monthly",
    "interpretationRules": "Sending <5 messages per week is passive. 15-25+ messages/week indicates proactive search and higher probability of bypassing ATS filters.",
    "possibleValues": null,
    "rawAnswer": "25",
    "selectedPeriod": "week",
    "normalizedPerWeek": 25,
    "normalizedPerMonth": 108,
    "formattedAnswer": "25 per week",
    "isNA": false
  }
}
```

This guarantees that downstream AI agents never have to guess or interpret colloquial phrasing.
