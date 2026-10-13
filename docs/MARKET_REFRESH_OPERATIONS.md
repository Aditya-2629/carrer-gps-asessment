# Market Refresh Operations & Admin Workflow

## 1. Refresh Architecture & Atomic Version Swaps

Market JD refreshes follow a strict zero-downtime atomic swap lifecycle:

```text
Current Active Version: v1 (5 Valid JDs)
                 │
   Admin Clicks "Update JD Library"
   (or Background Missing-Bucket Trigger)
                 │
                 ▼
  Enqueue Job with Bounded Concurrency (3)
                 │
                 ▼
  Apify Actor Fetches 15-25 Candidate JDs
                 │
                 ▼
  Normalization, Deduplication, & Quality Filter
                 │
                 ▼
  Select Top 5 JDs & Build Deterministic Profile
                 │
                 ▼
  Create Immutable JobMarketVersion (v2)
                 │
        ┌────────┴────────┐
   Validation Passes?   Validation Fails?
        │                       │
       YES                      NO
        │                       │
  Atomically update             │
  JobMarketBucket:              │
  activeVersion = 2             │
        │                       │
  Mark v1 as archived           │
        │                       ▼
        │               Retain activeVersion = 1
        │               Record lastError on bucket
        ▼                       ▼
  Zero Downtime           Zero Downtime
```

**Key Safety Invariant (Section 13):**
Never delete old JDs prior to fetching new ones. If scraping fails, network times out, or fewer than 5 valid JDs are returned, the existing version remains active without disruption.

---

## 2. Apify Integration & Scraper Configuration

The scraper uses the official `apify-client` package (version 2.24.0) with server-side token isolation:

### Environment Variables
```env
# Required for Apify execution
APIFY_API_TOKEN=apify_api_...

# Configurable Actor ID (defaults to LinkedIn Jobs Scraper)
APIFY_JOB_ACTOR_ID=bebity/linkedin-jobs-scraper

# Bounded worker concurrency & timeouts
MARKET_JD_REFRESH_CONCURRENCY=3
MARKET_JD_RESULTS_TARGET=5
MARKET_JD_MAX_CANDIDATES=20
MARKET_JD_REFRESH_TIMEOUT_MS=120000
```

### Search Specification
The scraper generates targeted role and keyword queries:
```json
{
  "title": "Senior AI & Full Stack Engineer",
  "keywords": ["Python", "FastAPI", "React", "AWS", "Kafka"],
  "location": "United States",
  "maxItems": 20,
  "experienceLevel": "mid_senior"
}
```

---

## 3. Worker Concurrency & Queue Engine

To prevent exceeding Apify rate limits or exhausting server memory, refreshes are orchestrated through a unified queue with bounded concurrency:
- **Default Concurrency**: 3 simultaneous bucket refreshes.
- **Queue Engine**: Compatible with in-memory task runner and BullMQ Redis clusters.
- **Backoff & Retries**: Exponential backoff with up to 3 retries for transient HTTP errors.

---

## 4. Admin API Endpoints

All admin endpoints require an active `admin` JWT session (`verifyToken` + `adminOnly` guards):

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/market-library` | Returns stats summary, health status, and all configured buckets. |
| `GET` | `/api/admin/market-library/:bucketKey` | Returns details and version history for a specific bucket. |
| `POST` | `/api/admin/market-library/refresh` | **Update JD Library**: Enqueues global background refresh for all buckets. |
| `POST` | `/api/admin/market-library/refresh/:bucketKey` | Enqueues refresh for an individual bucket. |
| `GET` | `/api/admin/market-library/refresh/:jobId` | Polls progress and status of an ongoing refresh task. |

---

## 5. Admin UI: Job Market Library

The Admin Panel includes a dedicated **Job Market Library** section featuring:
- **Metrics Bar**: Total Buckets, Healthy Buckets, Needs Refresh, and Last Refresh Timestamp.
- **Global Action**: `[ Update JD Library ]` button with progress bar and completion notification.
- **Bucket Table**:
  - Role Name & Specialization
  - Experience Bucket (`0-2`, `3-5`, `6-8`, `8+`)
  - Active JDs (Target: 5)
  - Active Version (`v1`, `v2`, etc.)
  - Health Badge (`Healthy`, `Needs Refresh`, `Refreshing`, `Failed`)
  - Per-bucket `[ Refresh ]` trigger.
