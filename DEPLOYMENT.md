# Tinder for Freelancers — Production Deployment & Live Environment Guide

> **Product**: Tinder for Freelancers  
> **Tagline**: *Swipe. Match. Get Hired.*  
> **Brand Palette**: Pink (`#EC4899`) & Warm Beige (`#FFFBEB`)  
> **Version**: 6.0.0 (Production Release)

---

## 1. Architecture Overview

**Tinder for Freelancers** is built with a decoupled modern full-stack architecture:

- **Frontend**: React 18, Vite 5, TailwindCSS, Framer Motion, Lucide Icons, PWA (Service Worker + Web App Manifest).
- **Backend**: Node.js (v18+) with Express 5, serving secure RESTful endpoints, rate limiting, and token authentication.
- **Database Engine**: Server-side JSON database (`server/database.js`) with atomic file persistence, flush queues, and backup snapshots (`server/data/backups/`).
- **External Services**: Modular adapters for Reddit API, YouTube Data API v3, X (Twitter) API v2, and AI Completion Providers (Google Gemini / OpenAI compatible).

### Deployment Topologies

```
┌────────────────────────────────────────────────────────┐
│ Option A: Unified Deployment (Single Node.js Container)│
│                                                        │
│   Client (Browser / PWA)                               │
│        │                                               │
│        ▼                                               │
│   Reverse Proxy (NGINX / Cloudflare SSL)               │
│        │                                               │
│        ▼                                               │
│   Node.js Express Server (:5000)                       │
│     ├── Static SPA Assets (/dist)                      │
│     ├── API Endpoints (/api/*)                         │
│     └── File Database Engine (/server/data/*.json)     │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Option B: Decoupled Deployment (CDN + Cloud Service)  │
│                                                        │
│   Client (Browser / PWA)                               │
│        │                                               │
│        ├─── Static Assets ──► Vercel / Netlify / S3    │
│        │                      (SPA Rewrite /* -> index)│
│        └─── API Calls ──────► Express API Server       │
│                               (Render / Railway / VPS) │
└────────────────────────────────────────────────────────┘
```

---

## 2. Environment Configuration Reference

Create a `.env` file in the project root by copying `.env.example`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Required in Prod | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | HTTP port on which the Express server listens. |
| `NODE_ENV` | **Yes** | `development` | Set to `production` to activate strict CORS, HSTS, and error masking. |
| `FRONTEND_ORIGIN` | **Yes** (if separated) | `http://localhost:3000` | Allowed client URL for CORS (e.g. `https://tinderforfreelancers.com`). |
| `APP_URL` | No | `http://localhost:3000` | Canonical production URL of the application. |
| `VITE_API_BASE_URL` | No | `/api` | Base path for frontend API calls. Use `/api` for same-domain or reverse-proxy, or `https://api.yourdomain.com/api` for separate backend. |
| `ENABLE_DEMO_OTP` | **Yes** | `true` | Set to `false` in production to disable hardcoded demo OTP (`123456`) and enforce randomized dynamic codes. |
| `DATABASE_URL` | No | `./server/data/` | Path to server data directory. |
| `REDDIT_CLIENT_ID` | Optional | - | Reddit App Client ID for live job monitoring. |
| `REDDIT_CLIENT_SECRET`| Optional | - | Reddit App Client Secret. |
| `REDDIT_USER_AGENT` | Optional | - | User-agent string conforming to Reddit API rules. |
| `YOUTUBE_API_KEY` | Optional | - | Google Cloud API key with YouTube Data API v3 enabled. |
| `X_BEARER_TOKEN` | Optional | - | Twitter Developer v2 Read-only Bearer Token. |
| `AI_API_KEY` | Optional | - | Google Gemini or OpenAI API Key for personalized cover letters & matching. |
| `AI_MODEL` | Optional | `gemini-1.5-flash` | Selected AI model for message generation. |

> **Production Security Rule**: Never commit `.env` into version control. Ensure `.gitignore` includes `.env` and `.env.local`.

---

## 3. Deployment Methods

### Method 1: Unified Node.js Server (Recommended for VPS, Railway, Render, Docker)

In this mode, the Express server serves both the compiled React frontend from `dist/` and all `/api/*` endpoints on a single port.

1. **Install production dependencies**:
   ```bash
   npm ci
   ```
2. **Compile frontend assets**:
   ```bash
   npm run build
   ```
3. **Start the production server**:
   ```bash
   NODE_ENV=production PORT=5000 node server/index.js
   ```

### Method 2: Decoupled (Vercel/Netlify Frontend + Cloud Backend)

#### A. Frontend (Static CDN)
1. Build the frontend with the backend URL injected:
   ```bash
   VITE_API_BASE_URL=https://api.yourdomain.com/api npm run build
   ```
2. Deploy the `dist/` folder to Vercel, Netlify, or Cloudflare Pages.
3. Configure the SPA fallback route (see Section 4).

#### B. Backend (API Host)
1. Deploy the Node server repository to Render, Railway, Fly.io, or AWS EC2.
2. Set environment variables:
   ```env
   NODE_ENV=production
   PORT=5000
   FRONTEND_ORIGIN=https://yourdomain.com
   ENABLE_DEMO_OTP=false
   ```
3. Start command: `node server/index.js` or `npm start`.

---

## 4. SPA Client-Side Routing Configuration

Because **Tinder for Freelancers** uses React Router v6 client-side routing (`/jobs`, `/sources`, `/applications`, `/profile`, `/autopilot`, `/settings`), web servers must return `index.html` with status HTTP 200 for deep-linked paths.

### NGINX Configuration

```nginx
server {
    listen 80;
    server_name tinderforfreelancers.com www.tinderforfreelancers.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tinderforfreelancers.com www.tinderforfreelancers.com;

    ssl_certificate /etc/letsencrypt/live/tinderforfreelancers.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tinderforfreelancers.com/privkey.pem;

    root /var/www/tinderforfreelancers/dist;
    index index.html;

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA Client-Side Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Netlify (`public/_redirects`)

Add a `_redirects` file in `public/` (or root):
```
/*    /index.html   200
```

### Vercel (`vercel.json`)

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://api.yourdomain.com/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Apache (`.htaccess`)

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 5. Process Management & Production Lifecycle

### PM2 Setup (Recommended for Linux/VPS)

Create `ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: 'tinder-for-freelancers',
      script: 'server/index.js',
      instances: 1, // Single instance preserves JSON file db locking
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        ENABLE_DEMO_OTP: 'false',
      },
    },
  ],
};
```

Start and persist with PM2:
```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

### Docker Deployment

#### `Dockerfile`
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "server/index.js"]
```

#### `docker-compose.yml`
```yaml
version: '3.8'

services:
  app:
    build: .
    restart: always
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - FRONTEND_ORIGIN=https://tinderforfreelancers.com
      - ENABLE_DEMO_OTP=false
    volumes:
      - ./server/data:/app/server/data
```

### Graceful Shutdown

The backend handles `SIGINT` and `SIGTERM` signals automatically:
1. Stops accepting new inbound HTTP requests.
2. Calls `db.flushAll()` to ensure dirty in-memory data is written to disk.
3. Closes server connections.
4. If requests do not finish within 5 seconds, it forcefully shuts down cleanly.

---

## 6. Database Storage, Backups & Disaster Recovery

### Data Directory Structure
```
server/data/
├── users.json
├── profiles.json
├── preferences.json
├── jobs.json
├── sources.json
├── applications.json
├── leads.json
├── activities.json
├── notifications.json
├── tasks.json
├── source_health.json
└── backups/
    └── tf_backup_2026-09-10T18-00-00-000Z.json
```

### Creating Backups

Programmatically via Node:
```javascript
import { db } from './server/database.js';
const backupPath = db.createBackup();
console.log('Backup saved to:', backupPath);
```

Automated Daily Cron Backup:
```bash
# Add to crontab -e
0 3 * * * node -e "import('./server/database.js').then(m => m.db.createBackup())" >> /var/log/tf_backup.log 2>&1
```

### Disaster Recovery / Restore Procedure

To restore from a backup file:
```bash
# Stop backend
pm2 stop tinder-for-freelancers

# Restore JSON collections
node -e "
const fs = require('fs');
const backup = JSON.parse(fs.readFileSync('server/data/backups/tf_backup_XXXX.json', 'utf-8'));
for (const [key, val] of Object.entries(backup)) {
  if (['timestamp', 'version'].includes(key)) continue;
  fs.writeFileSync('server/data/' + key + '.json', JSON.stringify(val, null, 2));
}
console.log('Restored successfully');
"

# Restart backend
pm2 start tinder-for-freelancers
```

---

## 7. Security Hardening Checklist

| Layer | Configuration | Status |
|---|---|---|
| **CORS** | Strict whitelist from `FRONTEND_ORIGIN` / `APP_URL`. Wildcards blocked in production. | Enabled |
| **HTTP Headers** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP, Referrer-Policy, HSTS. | Enabled |
| **Rate Limiting** | Global: 120 req/min, Auth: 10 req/min, AI endpoints: 15 req/min. | Enabled |
| **Authentication** | Bearer session tokens with IP/expiry checks; sanitized profile responses. | Enabled |
| **Demo Mode Toggle** | `ENABLE_DEMO_OTP=false` disables hardcoded test codes in production. | Configurable |
| **Error Handling** | Global Express error handler masks stack traces and internal diagnostics. | Enabled |

---

## 8. Health Verification & Smoke Testing

### Backend Health Check

```bash
curl -i https://yourdomain.com/api/health
```

Expected HTTP Response:
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "healthy",
  "app": "Tinder for Freelancers",
  "version": "6.0.0",
  "environment": "production",
  "database": {
    "status": "connected",
    "users": 1,
    "jobs": 15,
    "applications": 3
  }
}
```

---

## 9. Rollback Strategy

If a deployment produces an unexpected error:

1. **Revert Frontend**:
   - For Vercel/Netlify: Click **Promote to Production** on the previous green deployment.
   - For static NGINX: Re-point symlink `/var/www/tinderforfreelancers/dist` to previous release directory.
2. **Revert Backend**:
   - `git checkout <previous-tag>`
   - `npm ci`
   - `pm2 restart tinder-for-freelancers`
3. **Revert Database**:
   - Execute the restore script from Section 6 using the latest pre-deployment snapshot.
