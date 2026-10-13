# Internal Job Market JD Library

## 1. Bucket Taxonomy & Identity

Market intelligence is organized into canonical **Role × Experience** buckets:
```text
<canonicalRoleKey>::<experienceBucket>
```

### 1.1 Canonical Roles
Controlled role taxonomy ensures consistent market sampling without uncontrolled bucket explosion:
- `software-engineer`: Software Engineers, Developers, Full Stack, Backend, Frontend, Systems, Mobile.
- `ai-ml-engineer`: AI Engineers, Machine Learning Engineers, MLOps, LLM/RAG Developers.
- `data-engineer`: Data Engineers, Pipeline Developers, Big Data Architects.
- `data-analyst`: Data Analysts, Business Intelligence (BI) Specialists, Analytics Engineers.
- `product-manager`: Technical Product Managers, Product Owners, Group Product Managers.
- `qa-engineer`: Quality Assurance Engineers, SDETs, Test Automation Engineers.
- `security-engineer`: Cybersecurity Engineers, DevSecOps, AppSec Engineers.
- `sales-manager`: Account Executives, Enterprise Sales Managers, Business Development.
- `clinical-nurse`: Registered Nurses, Clinical Specialists, ICU/ER Staff Nurses.
- Ambiguous/unmatched roles map safely to slugified fallback categories with `confidence < 0.70` and are flagged for review.

### 1.2 Experience Buckets
- `0-2`: Entry-level, Associate, Junior (0 to 2 years)
- `3-5`: Mid-level professional (3 to 5 years)
- `6-8`: Senior engineer / specialist (6 to 8 years)
- `8+`: Principal, Staff, Lead, Director (8+ years)

---

## 2. MongoDB Data Models

Market data is structured into two decoupled collections to prevent data duplication and enable zero-downtime atomic updates.

### 2.1 `JobMarketBucket` Collection
Maintains the operational status and active version pointer:
```javascript
{
  bucketKey: "software-engineer::6-8",
  roleKey: "software-engineer",
  roleName: "Software Engineer",
  specialization: "fullstack",
  experienceBucket: "6-8",

  activeVersion: 1,                 // Pointer to current active JobMarketVersion
  status: "healthy",                // "healthy" | "needs_refresh" | "refreshing" | "failed"
  jobCount: 5,                      // Valid active JDs (target: 5)
  lastSuccessfulRefreshAt: ISODate("..."),
  lastError: null,

  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### 2.2 `JobMarketVersion` Collection
Stores immutable snapshots of validated JDs and pre-aggregated market profiles:
```javascript
{
  bucketKey: "software-engineer::6-8",
  version: 1,

  jobs: [
    {
      sourceJobId: "apify_job_12345",
      title: "Senior Full Stack Engineer",
      company: "CloudNova Technologies",
      location: "San Jose, CA (Hybrid)",
      description: "Full job description...",
      normalizedDescription: "Cleaned description...",
      skills: ["Python", "FastAPI", "AWS", "Kafka", "PostgreSQL"],
      responsibilities: ["Design microservices", "Lead sprint reviews"],
      senioritySignals: ["System design", "Technical ownership"],
      source: "apify",
      sourceUrl: "https://linkedin.com/jobs/view/12345",
      scrapedAt: ISODate("..."),
      fingerprint: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
    // Exactly 5 validated jobs
  ],

  marketProfile: {
    bucketKey: "software-engineer::6-8",
    sampleSize: 5,
    skills: [...],
    responsibilities: [...],
    senioritySignals: [...],
    version: "market-profile-v1"
  },

  sourceMetadata: {
    actorId: "bebity/linkedin-jobs-scraper",
    candidatesFetched: 20,
    validCandidates: 18,
    duplicatesRemoved: 3
  },

  validationSummary: {
    isValid: true,
    jobCount: 5,
    errors: []
  },

  isArchived: false,
  createdAt: ISODate("...")
}
```

---

## 3. Deduplication & Top-5 Quality Selection

Before activating a version, candidate records fetched by Apify pass through an automated normalization and selection pipeline:

1. **Deterministic Fingerprinting**:
   ```text
   hash(normalizedTitle + normalizedCompany + normalizedDescription + normalizedUrl)
   ```
   Prevents duplicate listings across different job boards or scrape batches.
2. **Quality Filter (Section 30)**:
   - Job title must exist and be ≥ 3 characters.
   - Cleaned description must be ≥ 120 characters.
   - Rejects test postings, dummy listings, and spam keywords (`test job`, `placeholder`, `lorem ipsum`).
3. **Company Diversity Ranking**:
   - Limits representation to at most 2 jobs from the same employer when a diverse candidate pool is available.
   - Sorts candidates with rich skill and responsibility signals to top positions.
4. **Target Count Selection (Section 7)**:
   - Selects exactly top 5 valid jobs.
   - If fewer than 5 valid jobs survive filtering, the version is marked invalid and fails activation, preserving the previous active version intact.
