# 🛠️ Tinder for Freelancers — API & Backend Setup Guide

This guide explains how to configure real external APIs for Reddit, YouTube, X (Twitter), Google Gemini AI, and run the secure backend API server.

---

## 🚀 Quick Start (Development)

1. **Install Dependencies**:
   `ash
   npm install
   `

2. **Run Backend API Server**:
   `ash
   npm run server
   `
   The backend runs on http://localhost:5000 with built-in rate limiting, JSON database persistence, and proxying through Vite.

3. **Run Frontend Web App**:
   `ash
   npm run dev
   `
   The client runs on http://localhost:3000 and automatically proxies /api calls to the backend server.

---

## 🔑 Environment Variables Configuration

Copy .env.example to .env:
`ash
cp .env.example .env
`

| Variable | Description | Where to Obtain |
| :--- | :--- | :--- |
| PORT | Backend server port (Default: 5000) | Internal configuration |
| REDDIT_CLIENT_ID | Reddit App Script ID | [Reddit Apps](https://www.reddit.com/prefs/apps) |
| REDDIT_CLIENT_SECRET| Reddit App Secret | [Reddit Apps](https://www.reddit.com/prefs/apps) |
| REDDIT_USER_AGENT | Custom Reddit User Agent string | Format: web:TinderForFreelancers:v6.0.0 (by /u/username) |
| YOUTUBE_API_KEY | YouTube Data API v3 Key | [Google Cloud Console](https://console.cloud.google.com/) |
| X_BEARER_TOKEN | Twitter / X API v2 Bearer Token | [Twitter Developer Portal](https://developer.twitter.com/) |
| AI_API_KEY | Google Gemini API Key | [Google AI Studio](https://aistudio.google.com/) |
| DATABASE_URL | Local database storage path | Default: ./server/data/tinder_for_freelancers.db |

---

## 📡 API Integrations & Fallbacks

### 1. Reddit Integration
- **Mechanism**: Official Reddit JSON API endpoint (https://www.reddit.com/r/{subreddit}/new.json) with custom User-Agent.
- **Quota & Rate Limits**: Reddit allows 60 requests/minute for standard clients.
- **Fallback**: If credentials are not present in .env, the system automatically serves curated, high-quality freelance opportunities in **Demo Mode**.

### 2. YouTube Integration
- **Mechanism**: Official Google YouTube Data API v3 (https://www.googleapis.com/youtube/v3/search).
- **Queries**: Targeted search terms like "video editor hiring", "remote video editor", etc.
- **Quota Limits**: 10,000 units/day free tier.
- **Fallback**: Returns realistic channel opportunities with verified contact methods in **Demo Mode**.

### 3. X (Twitter) API v2
- **Mechanism**: Recent Tweets Search (/2/tweets/search/recent) with standard query filtering.
- **Rate Limits**: 450 requests per 15-minute window for Bearer token.
- **Fallback**: If X_BEARER_TOKEN is unset or quota is exhausted (HTTP 429), the app gracefully switches to labeled **Demo Mode**.

### 4. AI Provider (Google Gemini)
- **Model**: gemini-1.5-flash for fast, cost-effective generation.
- **Tasks**: Application tailoring, translation from Bangla to Professional English, qualification scoring, and tone customization.
- **Security**: The API key is stored strictly on the server; the browser never sees the raw key.
- **Fallback**: Zero-hallucination deterministic template engine matching candidate's profile skills.

---

## 🔒 Security Architecture
- **No Client Secrets**: Client bundles never include private credentials. All requests flow through Frontend -> /api -> Backend Express Server -> External API.
- **In-Memory Rate Limiting**: Max 120 requests/minute per client IP on the API server.
- **Database Safety**: Client localStorage data can be migrated safely to backend database via POST /api/data/migrate.
