import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRouter, { performServerAutoDelete } from './routes/api.js';
import adminRouter from './routes/admin.js';
import { activeSessions } from './sessions.js';
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

// Security Check: Fail safely in production if ADMIN_SECRET_KEY is missing or using known default development value
if (IS_PROD) {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret || typeof secret !== 'string' || secret.trim() === '' || secret.trim() === 'tf-admin-secret-2026') {
    console.error('[FATAL SECURITY ERROR] In production (NODE_ENV=production), ADMIN_SECRET_KEY must be configured with a secure non-default secret. Server startup aborted.');
    process.exit(1);
  }
}

// 1. Strict CORS Configuration supporting Subdomain Topology
const railwayOrigin = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null;

function parseOrigins(val) {
  if (!val) return [];
  return String(val)
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const KNOWN_DEPLOYMENT_ORIGINS = [
  'https://tinder-for-freelancers.vercel.app',
  'https://tinder-for-freelancers.onrender.com',
];

const configuredOrigins = [
  ...KNOWN_DEPLOYMENT_ORIGINS,
  ...parseOrigins(process.env.ALLOWED_ORIGINS),
  ...parseOrigins(process.env.FRONTEND_ORIGIN),
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.APP_URL),
  ...parseOrigins(process.env.ADMIN_URL),
  ...parseOrigins(process.env.API_URL),
  railwayOrigin,
].filter(Boolean);

// Extract base hostnames from configured production origins to support subdomains
// e.g., if https://yourdomain.com is configured, allow *.yourdomain.com
const allowedBaseDomains = configuredOrigins
  .map((originStr) => {
    try {
      const parsed = new URL(originStr);
      const hostParts = parsed.hostname.split('.');
      if (hostParts.length >= 2) {
        return hostParts.slice(-2).join('.');
      }
      return parsed.hostname;
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Mobile apps, curl, server-to-server

  // Development & local environments
  if (
    origin === 'http://localhost:3000' ||
    origin === 'http://127.0.0.1:3000' ||
    origin === 'http://localhost:5000' ||
    origin === 'http://127.0.0.1:5000' ||
    origin === 'http://localhost:5173' ||
    origin === 'http://127.0.0.1:5173' ||
    /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
  ) {
    return true;
  }

  // Exact match against any configured or known origin
  if (configuredOrigins.includes(origin)) {
    return true;
  }

  // Cloud platform deployment origins (Vercel, Render, Railway)
  try {
    const originHost = new URL(origin).hostname.toLowerCase();
    if (
      originHost === 'vercel.app' ||
      originHost.endsWith('.vercel.app') ||
      originHost === 'onrender.com' ||
      originHost.endsWith('.onrender.com') ||
      originHost === 'railway.app' ||
      originHost.endsWith('.railway.app') ||
      originHost.endsWith('.up.railway.app')
    ) {
      return true;
    }
  } catch {
    // Malformed origin
    return false;
  }

  // Subdomain matching against configured production base domains (e.g. app.yourdomain.com, admin.yourdomain.com)
  try {
    const originHost = new URL(origin).hostname.toLowerCase();
    for (const baseDomain of allowedBaseDomains) {
      if (baseDomain && (originHost === baseDomain || originHost.endsWith(`.${baseDomain}`))) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        // Safe rejection without passing an Error to next(), preventing 500 internal server error
        callback(null, false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'x-user-id',
      'x-admin-key',
      'x-phone',
      'x-enable-demo-outreach',
      'x-test-clock-skew',
    ],
    credentials: true,
    optionsSuccessStatus: 204,
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
// activeSessions is imported from ./sessions.js

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

  const user = db.users.findOne((u) => u.id === session.userId);
  if (user && user.status === 'banned') {
    if (user.banType === 'temporary' && user.banUntil && Date.now() >= new Date(user.banUntil).getTime()) {
      user.status = 'active';
      user.banType = null;
      user.banUntil = null;
      db.users.update(user.id, user);
    } else {
      return res.status(403).json({ success: false, error: 'USER_BANNED' });
    }
  }

  req.user = { id: session.userId, phone: session.phone };
  next();
}

// Session resolver middleware to populate req.userId and req.user when token is present
app.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token);
    if (Date.now() <= session.expiresAt) {
      const user = db.users.findOne((u) => u.id === session.userId);
      let isBanned = false;
      if (user && user.status === 'banned') {
        if (user.banType === 'temporary' && user.banUntil && Date.now() >= new Date(user.banUntil).getTime()) {
          user.status = 'active';
          user.banType = null;
          user.banUntil = null;
          db.users.update(user.id, user);
        } else {
          isBanned = true;
        }
      }
      if (!isBanned) {
        req.user = { id: session.userId, phone: session.phone };
        req.userId = session.userId;
      }
    }
  }
  next();
});

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

// 6. Hardened Phone OTP Authentication with Persistence (Survives Restarts)
class PersistentOtpStore {
  constructor() {
    this.memoryCache = new Map();
  }

  get(phone) {
    if (!phone) return undefined;
    let rec = this.memoryCache.get(phone);
    if (!rec && db.otpVerifications) {
      const persisted = db.otpVerifications.findById(phone) || db.otpVerifications.findOne((o) => o.phone === phone);
      if (persisted) {
        rec = {
          code: String(persisted.code),
          countryCode: persisted.countryCode || persisted.country_code || '+91',
          localNumber: persisted.localNumber || persisted.local_number || '',
          createdAt: persisted.createdAt ? new Date(persisted.createdAt).getTime() : Date.now(),
          expiresAt: persisted.expiresAt ? new Date(persisted.expiresAt).getTime() : Date.now() + 10 * 60 * 1000,
          attempts: persisted.attempts || 0,
          isDemo: Boolean(persisted.isDemo || persisted.is_demo),
        };
        this.memoryCache.set(phone, rec);
      }
    }
    return rec;
  }

  set(phone, record) {
    if (!phone) return this;
    this.memoryCache.set(phone, record);
    if (db.otpVerifications) {
      try {
        db.otpVerifications.insert({
          id: phone,
          phone,
          code: String(record.code),
          countryCode: record.countryCode || '+91',
          country_code: record.countryCode || '+91',
          localNumber: record.localNumber || '',
          local_number: record.localNumber || '',
          attempts: record.attempts || 0,
          isDemo: Boolean(record.isDemo),
          is_demo: Boolean(record.isDemo),
          expiresAt: new Date(record.expiresAt || Date.now() + 10 * 60 * 1000).toISOString(),
          expires_at: new Date(record.expiresAt || Date.now() + 10 * 60 * 1000).toISOString(),
          createdAt: new Date(record.createdAt || Date.now()).toISOString(),
          created_at: new Date(record.createdAt || Date.now()).toISOString(),
        });
      } catch (err) {
        // Non-blocking in-memory fallback
      }
    }
    return this;
  }

  delete(phone) {
    if (!phone) return false;
    this.memoryCache.delete(phone);
    if (db.otpVerifications) {
      try {
        db.otpVerifications.delete(phone);
      } catch {}
    }
    return true;
  }
}

const otpStore = new PersistentOtpStore();

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
    const localStr = String(localNumber);
    // Strictly reject if contains spaces, hyphens, non-digits, or not exactly 10 digits
    if (/\s/.test(localStr)) {
      return {
        isValid: false,
        error: 'Phone number must not contain spaces.',
      };
    }
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
    let raw = String(phone).trim();
    if (/^91[6-9][0-9]{9}$/.test(raw)) {
      raw = '+' + raw;
    }

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
        // Strictly check matchedLocal: must be exactly 10 digits, NO slicing, NO truncation, no spaces/special chars
        if (/\s/.test(matchedLocal)) {
          return {
            isValid: false,
            error: 'Phone number must not contain spaces.',
          };
        }
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
      if (/\s/.test(raw)) {
        return {
          isValid: false,
          error: 'Phone number must not contain spaces.',
        };
      }
      if (!/^[0-9]{10}$/.test(raw)) {
        return {
          isValid: false,
          error: 'Phone number must be exactly 10 digits.',
        };
      }
      return validatePhoneNumber(countryCode || '+91', raw);
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

/**
 * Normalizes phone and finds existing user by exact phone or local number + countryCode
 */
export function findUserByPhone(phone) {
  if (!phone) return null;
  const validation = parseAndValidatePhoneRequest({ phone });
  const targetPhone = validation.isValid ? validation.normalizedNumber : String(phone).trim();
  const targetLocal = validation.isValid ? validation.localNumber : targetPhone.replace(/\D/g, '').slice(-10);
  const targetCc = validation.isValid ? validation.countryCode : '+91';

  return db.users.findOne((u) => {
    if (u.phone === targetPhone || u.phone === phone) return true;
    if (targetLocal && u.localNumber === targetLocal && (u.countryCode || '+91') === targetCc) return true;
    if (targetLocal && String(u.phone).endsWith(targetLocal) && targetLocal.length === 10) return true;
    return false;
  });
}

/**
 * Server-side CAPTCHA verification (Cloudflare Turnstile or dev mode)
 */
async function verifyCaptchaToken(token, req) {
  // Test suite / automated test bypass if specifically running automated tests without captcha
  const isTest = process.env.NODE_ENV === 'test' || req.headers['x-test-suite'] || req.headers['x-test-clock-skew'];

  if (token === 'force_fail_captcha' || token === 'invalid') {
    return {
      success: false,
      code: 'CAPTCHA_FAILED',
      error: 'CAPTCHA verification failed. Please try again.',
    };
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret && IS_PROD) {
    if (!token) {
      return {
        success: false,
        code: 'CAPTCHA_REQUIRED',
        error: 'Please complete the CAPTCHA.',
      };
    }
    try {
      const formData = new URLSearchParams();
      formData.append('secret', turnstileSecret);
      formData.append('response', token);
      if (req.ip) formData.append('remoteip', req.ip);

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });
      const outcome = await response.json();
      if (!outcome.success) {
        return {
          success: false,
          code: 'CAPTCHA_FAILED',
          error: 'CAPTCHA verification failed. Please try again.',
        };
      }
      return { success: true };
    } catch (e) {
      console.error('[CAPTCHA VERIFY ERROR]:', e);
      return {
        success: false,
        code: 'CAPTCHA_FAILED',
        error: 'CAPTCHA verification failed. Please try again.',
      };
    }
  }

  // In non-production or when no Turnstile secret is configured:
  // CAPTCHA is required if in production, or if mode is specified (new auth flow), or if explicitly tested
  const requiresCaptcha = Boolean(IS_PROD || req.body?.mode);
  if (!token && requiresCaptcha) {
    return {
      success: false,
      code: 'CAPTCHA_REQUIRED',
      error: 'Please complete the CAPTCHA.',
    };
  }

  return { success: true };
}

// 7. Check Phone Account Existence
app.post('/api/auth/check-phone', authLimiter, (req, res) => {
  try {
    const validation = parseAndValidatePhoneRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error });
    }
    const sanitizedPhone = validation.normalizedNumber;
    const existingUser = findUserByPhone(sanitizedPhone);
    return res.json({
      success: true,
      exists: Boolean(existingUser),
      phone: sanitizedPhone,
      countryCode: validation.countryCode,
      localNumber: validation.localNumber,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to check phone number.' });
  }
});

// 8. Request OTP with CAPTCHA and Account Existence Validation
app.post('/api/auth/send-otp', authLimiter, async (req, res) => {
  try {
    const { mode, captchaToken } = req.body;
    const validation = parseAndValidatePhoneRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const sanitizedPhone = validation.normalizedNumber;
    const now = Date.now() + (IS_PROD ? 0 : Number(req.headers['x-test-clock-skew'] || 0));

    // 1. CAPTCHA Verification (MUST happen before OTP generation, sending, and rate-limiting)
    const captchaResult = await verifyCaptchaToken(captchaToken, req);
    if (!captchaResult.success) {
      return res.status(400).json({
        success: false,
        code: captchaResult.code || 'CAPTCHA_FAILED',
        error: captchaResult.error || 'Please complete the CAPTCHA.',
      });
    }

    // 2. Account Existence Check (Mode-specific)
    const existingUser = findUserByPhone(sanitizedPhone);

    if (mode === 'login' && !existingUser) {
      // Login mode: account does not exist -> DO NOT SEND OTP
      return res.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        error: 'No account found with this number.',
        phone: sanitizedPhone,
        countryCode: validation.countryCode,
        localNumber: validation.localNumber,
      });
    }

    if (mode === 'signup' && existingUser) {
      // Sign Up mode: account already exists -> DO NOT SEND OTP
      return res.status(409).json({
        success: false,
        code: 'ACCOUNT_ALREADY_EXISTS',
        error: 'An account already exists with this number.',
        phone: sanitizedPhone,
        countryCode: validation.countryCode,
        localNumber: validation.localNumber,
      });
    }

    // 3. Phone-level Rate Limiting
    let rateLimit = otpRequestRateLimits.get(sanitizedPhone);
    if (!rateLimit) {
      rateLimit = { history: [], cooldownUntil: 0 };
      otpRequestRateLimits.set(sanitizedPhone, rateLimit);
    }

    // Clean history older than rolling 1-hour window (60 * 60 * 1000 ms)
    rateLimit.history = rateLimit.history.filter((ts) => now - ts < 60 * 60 * 1000);

    // 60-second cooldown between requests for the same phone number
    if (now < rateLimit.cooldownUntil) {
      const waitSec = Math.ceil((rateLimit.cooldownUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSec} seconds before requesting another OTP.`,
        remainingSeconds: waitSec,
        cooldownActive: true,
      });
    }

    // Max 5 OTP requests per phone number per rolling 1-hour window
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
    const code = allowDemoOtp ? '1234' : Math.floor(1000 + Math.random() * 9000).toString();

    // Store OTP record
    otpStore.set(sanitizedPhone, {
      code,
      countryCode: validation.countryCode,
      localNumber: validation.localNumber,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,      // 10-minute expiration
      attempts: 0,                          // max 5 failed attempts
      isDemo: allowDemoOtp,
    });

    return res.json({
      success: true,
      message: allowDemoOtp ? 'OTP sent successfully (Demo code: 1234).' : 'Verification code sent to your phone.',
      phone: sanitizedPhone,
      countryCode: validation.countryCode,
      localNumber: validation.localNumber,
      isDemo: allowDemoOtp,
      demoCode: allowDemoOtp ? '1234' : null,
      cooldownSeconds: 60,
    });
  } catch (err) {
    console.error('[OTP SEND ERROR]:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to send OTP. Please try again.',
    });
  }
});

// 9. Verify OTP with Device Binding & Single-Identity Account Resolution
app.post('/api/auth/verify-otp', authLimiter, (req, res) => {
  try {
    const { code, otp } = req.body;
    const inputCode = code !== undefined && code !== null ? code : otp;
    const validation = parseAndValidatePhoneRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    if (inputCode === undefined || inputCode === null || (typeof inputCode !== 'string' && typeof inputCode !== 'number')) {
      return res.status(400).json({ success: false, error: 'Phone and OTP code are required.' });
    }

    const sanitizedPhone = validation.normalizedNumber;
    const cleanCode = String(inputCode).trim();
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

    let user = findUserByPhone(sanitizedPhone);
    const isBrandNewUser = !user;
    if (!user) {
      user = {
        id: `user-${Date.now()}`,
        phone: sanitizedPhone,
        countryCode: validation.countryCode,
        localNumber: validation.localNumber,
        name: '',
        createdAt: new Date(now).toISOString(),
      };
      db.users.insert(user);

      // Initialize clean FREE subscription in database for new user
      const existingSub = db.subscriptions.findOne((s) => s.userId === user.id || s.phone === sanitizedPhone);
      if (!existingSub) {
        db.subscriptions.insert({
          id: `sub-${user.id}`,
          userId: user.id,
          phone: sanitizedPhone,
          plan: 'free',
          status: 'active',
          currency: 'INR',
          price: 0,
          startDate: new Date(now).toISOString(),
          endDate: null,
          credits: [],
          isDemo: true,
          updatedAt: new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
        });
      }
    } else if (!user.countryCode || !user.localNumber) {
      user.countryCode = validation.countryCode;
      user.localNumber = validation.localNumber;
      db.users.update(user.id, user);
    }

    // Device Binding Security (One account per active device, 72-hour cooldown for switching accounts)
    const rawDeviceId = req.body.deviceId || req.headers['x-device-id'];
    if (rawDeviceId) {
      const deviceId = String(rawDeviceId).trim();
      const binding = db.deviceBindings ? (db.deviceBindings.findById(deviceId) || db.deviceBindings.findOne((b) => b.deviceId === deviceId || b.id === deviceId)) : null;
      const COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72 hours

      if (binding) {
        const boundAccountId = binding.boundUserId || binding.boundAccountId;
        const boundPhone = binding.boundPhone;
        const isSameAccount = boundAccountId === user.id || boundPhone === sanitizedPhone;

        if (isSameAccount) {
          // SAME ACCOUNT ON SAME DEVICE: Always allow! Regardless of 72h cooldown
          binding.lastActiveAt = new Date(now).toISOString();
          if (db.deviceBindings) db.deviceBindings.update(binding.id, binding);
        } else {
          // DIFFERENT ACCOUNT ON SAME DEVICE!
          const boundTime = new Date(binding.boundAt || binding.createdAt || 0).getTime();
          const elapsed = now - boundTime;

          if (elapsed < COOLDOWN_MS) {
            const remainingHours = Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / (60 * 60 * 1000)));
            return res.status(403).json({
              success: false,
              code: 'DEVICE_COOLDOWN_ACTIVE',
              error: `This device is bound to another account. You can switch accounts in ${remainingHours} hours.`,
              remainingCooldownHours: remainingHours,
            });
          } else {
            // Elapsed >= 72 hours: ALLOW new account binding
            binding.boundUserId = user.id;
            binding.boundAccountId = user.id;
            binding.boundPhone = sanitizedPhone;
            binding.boundAt = new Date(now).toISOString();
            binding.lastActiveAt = new Date(now).toISOString();
            if (db.deviceBindings) db.deviceBindings.update(binding.id, binding);
          }
        }
      } else if (db.deviceBindings) {
        // First-time device binding
        db.deviceBindings.insert({
          id: deviceId,
          deviceId: deviceId,
          boundUserId: user.id,
          boundAccountId: user.id,
          boundPhone: sanitizedPhone,
          boundAt: new Date(now).toISOString(),
          lastActiveAt: new Date(now).toISOString(),
        });
      }
    }

    // Ban Check
    if (user && user.status === 'banned') {
      if (user.banType === 'temporary' && user.banUntil && Date.now() >= new Date(user.banUntil).getTime()) {
        user.status = 'active';
        user.banType = null;
        user.banUntil = null;
        db.users.update(user.id, user);
      } else {
        return res.status(403).json({ success: false, error: 'USER_BANNED' });
      }
    }

    // Create session with 7-day expiration
    const token = `tf-sess-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    activeSessions.set(token, {
      userId: user.id,
      phone: sanitizedPhone,
      countryCode: validation.countryCode,
      localNumber: validation.localNumber,
      role: user.role || 'user',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        phone: sanitizedPhone,
        countryCode: validation.countryCode,
        localNumber: validation.localNumber,
        name: user.name,
        role: user.role || 'user',
        isNewUser: isBrandNewUser,
      },
      isNewUser: isBrandNewUser,
      token,
    });
  } catch (err) {
    console.error('[OTP VERIFY ERROR]:', err);
    return res.status(500).json({
      success: false,
      error: 'Unable to verify OTP. Please try again.',
    });
  }
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

// Helper: Allow admin routes to clear in-memory OTP stores without circular dependency
app.set('clearOtpState', (phones = []) => {
  if (!phones || phones.length === 0) {
    otpStore.clear();
    otpRequestRateLimits.clear();
    return;
  }
  for (const p of phones) {
    otpStore.delete(p);
    otpRequestRateLimits.delete(p);
  }
});

// 6.5 Mount Private Admin API router
app.use('/api/admin', adminRouter);

// 7. Mount API router
app.use('/api', apiRouter);



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

// Dedicated APK Download Endpoint with proper Android MIME type
app.get(['/app-release.apk', '/api/download/apk'], (req, res) => {
  const publicApk = path.join(__dirname, '../public/app-release.apk');
  const distApk = path.join(__dirname, '../dist/app-release.apk');
  const apkPath = fs.existsSync(publicApk) ? publicApk : (fs.existsSync(distApk) ? distApk : null);

  if (!apkPath) {
    return res.status(404).json({
      success: false,
      error: 'APK release package is currently unavailable.',
    });
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="app-release.apk"');
  res.download(apkPath, 'app-release.apk');
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

let server = null;

export async function startServer() {
  const engine = (process.env.DATABASE_ENGINE || '').toLowerCase();
  if (engine === 'supabase' || db.isPostgres) {
    console.log('[Database Engine] Initializing Supabase PostgreSQL connection & hydration...');
    try {
      const pool = db.getPool();
      if (!pool) {
        throw new Error('PostgreSQL connection pool could not be initialized. Check DATABASE_URL.');
      }
      const result = await db.syncAll();
      console.log(`[Database Engine] ✓ Successfully hydrated ${result.count} collections from Supabase PostgreSQL.`);
      if (typeof activeSessions.hydrate === 'function') {
        activeSessions.hydrate(true);
      }
    } catch (err) {
      console.warn('[Database Engine] Could not hydrate from Supabase PostgreSQL:', err.message);
      if (IS_PROD) {
        console.error('[FATAL DATABASE ERROR] In production with DATABASE_ENGINE=supabase, server startup cannot proceed in an empty fallback state. Aborting.');
        process.exit(1);
      } else {
        console.log('[Database Engine] Continuing in development with local storage fallback.');
      }
    }
  }

  server = app.listen(PORT, HOST, () => {
    console.log(`[TF Backend Server] running securely on http://${HOST}:${PORT}`);

    // Safe server-side application auto-delete sweep for users with setting enabled
    try {
      const activePrefs = db.preferences.findAll((p) => p.autoDeleteApplicationsAfter7Days);
      activePrefs.forEach((p) => performServerAutoDelete(p.userId));
    } catch (e) {
      // Ignore initial empty db sweep
    }
  });

  return server;
}

startServer();

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
  
  if (server) {
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
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
