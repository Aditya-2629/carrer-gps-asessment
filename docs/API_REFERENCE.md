# API Reference — Crafture Career GPS™

The Crafture Career GPS backend exposes a RESTful API over HTTP with JSON payloads and `multipart/form-data` support for file uploads.

**Base URL**: `http://localhost:5000/api` (Local) / `https://<service-name>.onrender.com/api` (Production)

---

## 1. Authentication & OTP Routes (`/api/otp`)

### `POST /api/otp/send-otp`
Generates a cryptographically secure 6-digit one-time code and emails it to the candidate via Resend or Nodemailer.

- **Request Body**:
  ```json
  {
    "email": "candidate@example.com"
  }
  ```
- **Responses**:
  - `200 OK`:
    ```json
    {
      "message": "Verification code dispatched successfully."
    }
    ```
  - `400 Bad Request`: Email format invalid or missing.

---

### `POST /api/otp/verify-otp`
Validates the 6-digit OTP against the user record. If valid, marks `isVerified = true` in MongoDB and returns the `userId`.

- **Request Body**:
  ```json
  {
    "email": "candidate@example.com",
    "otp": "123456"
  }
  ```
- **Responses**:
  - `200 OK`:
    ```json
    {
      "message": "OTP verified successfully.",
      "userId": "65f2a1b9e4b0a1a2b3c4d5e6",
      "email": "candidate@example.com"
    }
    ```
  - `400 Bad Request`: Invalid OTP or expired code.

---

## 2. Assessment Routes (`/api/assessment`)

### `POST /api/assessment/save-answers`
Saves candidate answers, stores the Layer-2 AI Semantic Profile, and parses the uploaded resume. Accepts `multipart/form-data`.

- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `userId` (string, required): MongoDB ObjectId of the verified candidate.
  - `answers` (JSON string, required): Raw dictionary of answers for all 31 questions.
  - `semanticProfile` (JSON string, optional): Layer-2 machine-readable semantic registry object.
  - `resume` (Binary File, optional): PDF or DOCX file (up to 10MB) parsed via Multer.
- **Workflow**:
  1. Validates that `userId` exists and `isVerified === true`.
  2. Saves `answers` and `semanticProfile` to the User document.
  3. Scrapes candidate LinkedIn profile via Apify if a valid URL is present.
  4. Parses the resume into structured JSON via `gemini-3.6-flash`.
- **Responses**:
  - `200 OK`:
    ```json
    {
      "message": "Answers, resume, and LinkedIn data processed successfully.",
      "resumeJson": { ... },
      "linkedinData": { ... }
    }
    ```

---

### `POST /api/assessment/generate-report`
Triggers full AI executive analysis under the "Atlas" persona using `gemini-3.6-flash`. Injects ground-truth context from the RAG engine.

- **Request Body**:
  ```json
  {
    "userId": "65f2a1b9e4b0a1a2b3c4d5e6",
    "semanticProfile": { ... }
  }
  ```
- **Responses**:
  - `200 OK`: Returns the comprehensive JSON report object conforming to the UI contract:
    ```json
    {
      "career_health_score": 45,
      "score_label": "Survival Mode",
      "score_breakdown": {
        "resume": { "score": 35, "diagnosis": "..." },
        "linkedin": { "score": 50, "diagnosis": "..." },
        "outreach": { "score": 20, "diagnosis": "..." },
        "interviews": { "score": 60, "diagnosis": "..." }
      },
      "market_reality_check": { ... },
      "career_journey": { ... },
      "funnel_stages": { ... },
      "rejection_factors": [ ... ],
      "risk_heatmap": { ... },
      "mission_board": { ... },
      "critical_issues": [ ... ],
      "roadmap": [ ... ],
      "recommended_tools": [ ... ],
      "coach_intervention": { ... }
    }
    ```

---

### `GET /api/assessment/report/:userId`
Fetches a previously generated report from MongoDB.

- **URL Parameter**: `userId` (MongoDB ObjectId)
- **Responses**:
  - `200 OK`: Complete report JSON.
  - `404 Not Found`: Report not found for user.

---

### `POST /api/assessment/book-call`
Triggers an immediate high-priority alert email to the executive coaching admin team when a candidate requests a consultation.

- **Request Body**:
  ```json
  {
    "userId": "65f2a1b9e4b0a1a2b3c4d5e6",
    "name": "Alex Candidate",
    "email": "alex@example.com",
    "phone": "+1 (555) 123-4567",
    "preferredTime": "Tomorrow morning",
    "notes": "Need H-1B sponsorship advice"
  }
  ```
- **Responses**:
  - `200 OK`: Notification dispatched.

---

## 3. Knowledge Base Routes (`/api/knowledge-base`)

Endpoints supporting administrative document management for the dynamic RAG engine.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/knowledge-base/documents` | List all active RAG knowledge base documents. |
| `POST` | `/api/knowledge-base/upload` | Upload new PDF/TXT/MD file into the knowledge base. |
| `DELETE`| `/api/knowledge-base/document/:id` | Remove a document from the active RAG index. |
| `GET` | `/api/knowledge-base/search?q=query`| Test semantic retrieval across indexed documents. |

---

## 4. System Health Check

### `GET /health`
Liveness probe used by Render and load balancers to confirm backend health.

- **Response**:
  ```json
  {
    "status": "UP",
    "message": "Career GPS API is running smoothly."
  }
  ```
