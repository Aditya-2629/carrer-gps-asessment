# Deployment & Environment Configuration

This guide details environment variables, database configuration, and deployment topology on **Render**.

---

## 1. Environment Variables Specification

### Frontend Configuration (`.env`)

Create a `.env` file in the root directory for local development:

```env
# URL pointing to the running backend Express API
# Local fallback: http://localhost:5000/api
# Production: https://<your-render-backend-service>.onrender.com/api
VITE_API_URL=http://localhost:5000/api
```

---

### Backend Configuration (`backend/.env`)

Create a `backend/.env` file with the following keys:

```env
# Server Port
PORT=5000

# Client Application URL (used for CORS whitelist)
FRONTEND_URL=http://localhost:5173

# MongoDB Connection String
# Local: mongodb://localhost:27017/career-gps
# Atlas: mongodb+srv://<user>:<password>@cluster0.mongodb.net/career-gps?retryWrites=true&w=majority
MONGO_URI=mongodb://localhost:27017/career-gps

# Google Gemini API Key (Required for AI report generation, chat, and resume parsing)
GEMINI_API_KEY=AIzaSy...
# Additional fallback keys (auto-rotated on 429 quota or 503 limit)
GEMINI_API_KEY_FALLBACK_1=AIzaSy...
GEMINI_API_KEY_FALLBACK_2=AIzaSy...
# Or provide comma-separated keys:
# GEMINI_API_KEYS=key1,key2,key3
GEMINI_MODEL=gemini-3.8-flash

# Apify API Token (Required for LinkedIn scraper actor)
APIFY_TOKEN=apify_api_...

# Email Service Provider Configuration (Choose Resend or Nodemailer)
# 1. Resend (Recommended)
RESEND_API_KEY=re_...
EMAIL_FROM=onboarding@resend.dev

# 2. Nodemailer SMTP (Alternative fallback)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=admin@crafture.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@crafture.com
```

---

## 2. Render Deployment Blueprint (`render.yaml`)

The repository contains a multi-service blueprint in [`render.yaml`](../render.yaml):

```yaml
services:
  # 1. Backend Web Service
  - type: web
    name: career-gps-backend
    runtime: node
    plan: free
    region: oregon
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm start
    envVars:
      - key: MONGO_URI
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: APIFY_TOKEN
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: FRONTEND_URL
        fromService:
          type: web
          name: career-gps-frontend
          property: host

  # 2. Frontend Static Site
  - type: web
    name: career-gps-frontend
    runtime: static
    plan: free
    region: oregon
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        fromService:
          type: web
          name: career-gps-backend
          property: host
```

---

## 3. Production Deployment Checklist

1. **MongoDB Atlas Whitelist**: Ensure network access allows incoming connections from all IPs (`0.0.0.0/0`) or Render egress IP ranges.
2. **Gemini API Quotas**: Ensure the Gemini API key has quota enabled for `gemini-3.6-flash`.
3. **CORS Validation**:
   - `backend/server.js` automatically allows subdomains on `*.onrender.com` containing `carrer-gps` as a resilient fallback.
4. **Client Routing**: The `public/_redirects` file contains `/* /index.html 200` to support client-side routing on static hosting providers (Netlify, Render, Cloudflare Pages).
