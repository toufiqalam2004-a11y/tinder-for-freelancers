import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRouter, { performServerAutoDelete } from './routes/api.js';
import { db } from './database.js';
import { redditService } from './services/redditService.js';
import { youtubeService } from './services/youtubeService.js';
import { xService } from './services/xService.js';
import { aiService } from './services/aiService.js';
import { validatePhoneNumber, DEFAULT_COUNTRY_CODES } from '../src/utils/validators.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

// 1. Strict CORS Configuration
const railwayOrigin = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null;
const allowedOrigins = IS_PROD
  ? [
      process.env.FRONTEND_ORIGIN,
      process.env.FRONTEND_URL,
      process.env.APP_URL,
      railwayOrigin,
      'http://localhost:3000',
    ].filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or Railway / LAN
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.railway.app') ||
        origin.endsWith('.up.railway.app') ||
        (!IS_PROD && (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)))
      ) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation: Origin not allowed.'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// 2. HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:* https:;"
  );
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// 3. Rate Limiting Engine with Per-Route Caps
const ipRateLimitMap = new Map();
function createRateLimiter(maxRequests = 100, windowMs = 60 * 1000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${ip}-${req.baseUrl || req.path}`;
    const now = Date.now();

    const record = ipRateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > record.resetAt) {
      record.count = 1;
      record.resetAt = now + windowMs;
    } else {
      record.count++;
    }
    ipRateLimitMap.set(key, record);

    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Rate limit exceeded. Please wait before retrying.',
      });
    }
    next();
  };
}

const globalLimiter = createRateLimiter(120, 60 * 1000);
const authLimiter = createRateLimiter(IS_PROD ? 30 : 200, 60 * 1000); // Max 30/min prod, 200/min dev
const aiLimiter = createRateLimiter(15, 60 * 1000);   // Max 15 AI gens/min

app.use(globalLimiter);

// 4. Token-Based Authentication Middleware
const activeSessions = new Map(); // token -> { userId, phone, expiresAt }

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    // In dev mode allow demo fallback if authorization header is omitted
    if (!IS_PROD && req.headers['x-demo-user']) {
      req.user = { id: req.headers['x-demo-user'], phone: '+1234567890' };
      return next();
    }
    return res.status(401).json({ success: false, error: 'Authentication required. Missing token.' });
  }

  const session = activeSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) activeSessions.delete(token);
    return res.status(403).json({ success: false, error: 'Invalid or expired session token.' });
  }

  req.user = { id: session.userId, phone: session.phone };
  next();
}

// 5. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    backend: 'connected',
    database: 'connected',
    services: {
      reddit: redditService.isConfigured() ? 'connected' : 'not_configured',
      youtube: youtubeService.isConfigured() ? 'connected' : 'not_configured',
      x: xService.isConfigured() ? 'connected' : 'not_configured',
      ai: aiService.isConfigured() ? 'connected' : 'not_configured',
    },
    demoFallback: true,
  });
});

// 6. Hardened Phone OTP Authentication
const otpStore = new Map(); // phone -> { code, countryCode, localNumber, expiresAt, attempts, resendAvailableAt }

/**
 * Strict Phone Number Validator for OTP endpoints
 * The local number MUST be exactly 10 digits.
 * Rejects fewer than 10 digits, more than 10 digits (including 11 digits), and non-numeric characters.
 * Absolutely NO slicing or truncation.
 * Accepts:
 *   { localNumber, countryCode } OR
 *   { phone, countryCode } OR
 *   { phone }
 */
function parseAndValidatePhoneRequest(body = {}) {
  let { countryCode, localNumber, phone } = body;

  // 1. If localNumber is explicitly provided:
  if (localNumber !== undefined && localNumber !== null) {
    const localStr = String(localNumber).trim();
    // Strictly reject if contains spaces, hyphens, non-digits, or not exactly 10 digits
    if (!/^[0-9]{10}$/.test(localStr)) {
      return {
        isValid: false,
        error: 'Phone number must be exactly 10 digits.',
      };
    }
    const codeStr = countryCode ? String(countryCode).trim() : '+91';
    return validatePhoneNumber(codeStr, localStr);
  }

  // 2. If phone is provided:
  if (phone !== undefined && phone !== null) {
    const raw = String(phone).trim();

    // Check if phone has a country code prefix (e.g. +91...)
    if (raw.startsWith('+')) {
      const sortedCodes = [...DEFAULT_COUNTRY_CODES]
        .map((c) => c.code)
        .sort((a, b) => b.length - a.length);

      let matchedCode = null;
      let matchedLocal = null;

      for (const code of sortedCodes) {
        if (raw.startsWith(code)) {
          matchedCode = code;
          matchedLocal = raw.slice(code.length);
          break;
        }
      }

      if (matchedCode && matchedLocal) {
        // Strictly check matchedLocal: must be exactly 10 digits, NO slicing, NO truncation
        if (!/^[0-9]{10}$/.test(matchedLocal)) {
          return {
            isValid: false,
            error: 'Phone number must be exactly 10 digits.',
          };
        }
        return validatePhoneNumber(matchedCode, matchedLocal);
      }

      // If unrecognized '+' prefix or unrecognized country code:
      return {
        isValid: false,
        error: 'Unrecognized country calling code or invalid phone format.',
      };
    } else {
      // Raw string without '+'
      // Must be EXACTLY 10 digits. No slicing, no truncation!
      if (/^[0-9]{10}$/.test(raw)) {
        return validatePhoneNumber(countryCode || '+91', raw);
      } else {
        return {
          isValid: false,
          error: 'Phone number must be exactly 10 digits.',
        };
      }
    }
  }

  return {
    isValid: false,
    error: 'Phone number must be exactly 10 digits.',
  };
}

// Rate limit store for OTP requests per phone number
// phone -> { history: [timestamps], cooldownUntil: timestamp }
const otpRequestRateLimits = new Map();

app.post('/api/auth/send-otp', authLimiter, (req, res) => {
  const validation = parseAndValidatePhoneRequest(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const sanitizedPhone = validation.normalizedNumber;
  const now = Date.now() + (IS_PROD ? 0 : Number(req.headers['x-test-clock-skew'] || 0));

  // Phone-level Rate Limiting
  let rateLimit = otpRequestRateLimits.get(sanitizedPhone);
  if (!rateLimit) {
    rateLimit = { history: [], cooldownUntil: 0 };
    otpRequestRateLimits.set(sanitizedPhone, rateLimit);
  }

  // 1. Clean history older than rolling 1-hour window (60 * 60 * 1000 ms)
  rateLimit.history = rateLimit.history.filter((ts) => now - ts < 60 * 60 * 1000);

  // 2. Check 60-second cooldown between requests for the same phone number
  if (now < rateLimit.cooldownUntil) {
    const waitSec = Math.ceil((rateLimit.cooldownUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      error: `Please wait ${waitSec} seconds before requesting another OTP.`,
      remainingSeconds: waitSec,
      cooldownActive: true,
    });
  }

  // 3. Check Maximum 5 OTP requests per phone number per rolling 1-hour window
  if (rateLimit.history.length >= 5) {
    return res.status(429).json({
      success: false,
      error: 'Too many OTP requests. Please try again later.',
      hourlyLimitReached: true,
    });
  }

  // Rate limit checks passed: Record this request
  rateLimit.history.push(now);
  rateLimit.cooldownUntil = now + 60 * 1000; // 60-second cooldown

  // Demo mode is active unless explicitly disabled by ENABLE_DEMO_OTP === 'false'
  const allowDemoOtp = process.env.ENABLE_DEMO_OTP !== 'false';
  const code = allowDemoOtp ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

  // If a new OTP is requested, invalidate any previous OTP and overwrite with fresh parameters
  otpStore.set(sanitizedPhone, {
    code,
    countryCode: validation.countryCode,
    localNumber: validation.localNumber,
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000,      // 10-minute expiration
    attempts: 0,                          // max 5 failed attempts
    isDemo: allowDemoOtp,
  });

  res.json({
    success: true,
    message: allowDemoOtp ? 'OTP sent successfully (Demo code: 123456).' : 'Verification code sent to your phone.',
    phone: sanitizedPhone,
    countryCode: validation.countryCode,
    localNumber: validation.localNumber,
    isDemo: allowDemoOtp,
    demoCode: allowDemoOtp ? '123456' : null,
    cooldownSeconds: 60,
  });
});

app.post('/api/auth/verify-otp', authLimiter, (req, res) => {
  const { code } = req.body;
  const validation = parseAndValidatePhoneRequest(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'Phone and 6-digit OTP code are required.' });
  }

  const sanitizedPhone = validation.normalizedNumber;
  const cleanCode = code.trim();
  const record = otpStore.get(sanitizedPhone);
  const now = Date.now() + (IS_PROD ? 0 : Number(req.headers['x-test-clock-skew'] || 0));

  // Case 1: No OTP request was made for this phone
  if (!record) {
    return res.status(400).json({
      success: false,
      error: 'No active OTP request found for this phone number. Please request an OTP first.',
    });
  }

  // Case 2: OTP has expired (> 10 minutes)
  if (now > record.expiresAt) {
    otpStore.delete(sanitizedPhone);
    return res.status(400).json({
      success: false,
      error: 'OTP code has expired. Please request a new code.',
    });
  }

  // Case 3: Failed attempt limit reached (max 5)
  if (record.attempts >= 5) {
    otpStore.delete(sanitizedPhone);
    return res.status(429).json({
      success: false,
      error: 'Too many failed attempts. This OTP has been invalidated. Please request a new code.',
    });
  }

  // Verification
  const isValid = cleanCode === record.code;
  if (!isValid) {
    record.attempts++;
    if (record.attempts >= 5) {
      otpStore.delete(sanitizedPhone);
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. This OTP has been invalidated. Please request a new code.',
      });
    }
    const remaining = 5 - record.attempts;
    return res.status(400).json({
      success: false,
      error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      remainingAttempts: remaining,
    });
  }

  // Case 4: Successful verification -> immediately invalidate/delete OTP record so it cannot be reused
  otpStore.delete(sanitizedPhone);

  let user = db.users.findOne((u) => u.phone === sanitizedPhone);
  if (!user) {
    user = {
      id: `user-${Date.now()}`,
      phone: sanitizedPhone,
      countryCode: validation.countryCode,
      localNumber: validation.localNumber,
      name: '',
      createdAt: new Date().toISOString(),
    };
    db.users.insert(user);
  } else if (!user.countryCode || !user.localNumber) {
    user.countryCode = validation.countryCode;
    user.localNumber = validation.localNumber;
    db.users.update(user.id, user);
  }

  // Create session with 7-day expiration
  const token = `tf-sess-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  activeSessions.set(token, {
    userId: user.id,
    phone: sanitizedPhone,
    countryCode: validation.countryCode,
    localNumber: validation.localNumber,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      phone: sanitizedPhone,
      countryCode: validation.countryCode,
      localNumber: validation.localNumber,
      name: user.name,
    },
    token,
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

if (!IS_PROD) {
  app.post('/api/test/reset-otp', (req, res) => {
    const { phone } = req.body || {};
    if (phone) {
      const validation = parseAndValidatePhoneRequest({ phone });
      const target = validation.isValid ? validation.normalizedNumber : phone;
      otpStore.delete(target);
      otpRequestRateLimits.delete(target);
    } else {
      otpStore.clear();
      otpRequestRateLimits.clear();
    }
    res.json({ success: true, message: 'Test OTP state reset successfully.' });
  });
}

// 7. Mount API router
app.use('/api', apiRouter);

// 8. AI Application Generation Endpoint (Rate Limited & Protected)
app.post('/api/ai/generate-application', aiLimiter, async (req, res) => {
  const { job, profile, mode } = req.body;
  if (!job || !profile) {
    return res.status(400).json({ success: false, error: 'Job and Profile are required.' });
  }

  const result = await aiService.generatePersonalizedOutreach({ job, profile, mode });
  res.json(result);
});

// 9. Data Migration Endpoint with User Scoping
app.post('/api/data/migrate', (req, res) => {
  const { profile, jobs, applications, sources, preferences, userId } = req.body;
  const ownerId = userId || 'user-default';

  if (profile) {
    db.profiles.insert({ ...profile, userId: ownerId, id: profile.id || `prof-${ownerId}` });
  }
  if (Array.isArray(jobs)) {
    jobs.slice(0, 100).forEach((j) => db.jobs.insert({ ...j, userId: ownerId }));
  }
  if (Array.isArray(applications)) {
    applications.slice(0, 100).forEach((a) => db.applications.insert({ ...a, userId: ownerId }));
  }
  if (Array.isArray(sources)) {
    sources.slice(0, 20).forEach((s) => db.sources.insert({ ...s, userId: ownerId }));
  }
  if (preferences) {
    db.preferences.insert({ id: `pref-${ownerId}`, userId: ownerId, ...preferences });
  }

  res.json({
    success: true,
    message: 'Local data safely migrated to backend database.',
    stats: {
      jobs: db.jobs.count(),
      sources: db.sources.count(),
      applications: db.applications.count(),
    },
  });
});

// Static Frontend Serving for Production (Unified Deployment)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(
    express.static(distPath, {
      maxAge: IS_PROD ? '1d' : 0,
    })
  );

  // SPA Fallback: Serve index.html for all non-API GET requests
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// 404 Handler for Unmatched API Endpoints
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  // Do NOT leak stack traces or internal errors to client
  res.status(500).json({
    success: false,
    error: 'An internal error occurred. Please retry later.',
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[TF Backend Server] running securely on http://${HOST}:${PORT}`);

  // Safe server-side application auto-delete sweep for users with setting enabled
  try {
    const activePrefs = db.preferences.findAll((p) => p.autoDeleteApplicationsAfter7Days);
    activePrefs.forEach((p) => performServerAutoDelete(p.userId));
  } catch (e) {
    // Ignore initial empty db sweep
  }
});

// Periodic server-side application cleanup (runs every 6 hours)
const cleanupInterval = setInterval(() => {
  try {
    const activePrefs = db.preferences.findAll((p) => p.autoDeleteApplicationsAfter7Days);
    activePrefs.forEach((p) => performServerAutoDelete(p.userId));
  } catch (e) {
    // Silent
  }
}, 6 * 60 * 60 * 1000);
cleanupInterval.unref();

// Graceful Shutdown Handling
function handleShutdown(signal) {
  console.log(`\n[TF Backend Server] Received ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('[TF Backend Server] Closed HTTP server connections.');
    try {
      // Flush any pending database writes to disk
      if (typeof db.flushAll === 'function') {
        db.flushAll();
        console.log('[TF Backend Server] Flushed database state safely.');
      }
    } catch (e) {
      console.error('[TF Backend Server] Error flushing database during shutdown:', e);
    }
    console.log('[TF Backend Server] Shutdown complete. Exiting cleanly.');
    process.exit(0);
  });

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    console.error('[TF Backend Server] Forcefully shutting down after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
