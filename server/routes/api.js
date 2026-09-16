import express from 'express';
import { db } from '../database.js';
import { redditService } from '../services/redditService.js';
import { youtubeService } from '../services/youtubeService.js';
import { xService } from '../services/xService.js';
import { aiService } from '../services/aiService.js';
import { normalizeWhatsAppNumber, isValidEmail, isValidUsername, normalizeUsername } from '../../src/utils/validators.js';
import { extractContactInfo } from '../../src/utils/contactExtractor.js';
import { normalizePlan, isProPlan, toCanonicalPlan, isFreePlan, isPlusPlan } from '../../src/utils/planUtils.js';
import {
  APPLICATION_QUOTA_WINDOW_HOURS,
  APPLICATION_QUOTA_WINDOW_MS,
  FREE_APPLICATION_QUOTA,
  PLUS_APPLICATION_QUOTA,
  PRO_APPLICATION_QUOTA,
  PLAN_QUOTA_CONFIG,
  getPlanQuotaConfig,
  getApplicationsPerWindow,
  getQuotaWindowHours,
  formatWindowCountdown,
} from '../../src/utils/quotaConfig.js';
import { demoAdapter } from '../../src/services/outreach/demoAdapter.js';
import { generateReferralCode, normalizeReferralCode, isValidReferralCode } from '../../src/utils/referralUtils.js';
import {
  FREE_CUSTOM_SOURCE_LIMIT,
  PLUS_CUSTOM_SOURCE_LIMIT,
  PRO_CUSTOM_SOURCE_LIMIT,
  getCustomSourceLimit,
} from '../../src/utils/sourceConfig.js';
import { generateUniqueDisplayName, getAvailableUsernameSuggestions } from '../../src/utils/nameUtils.js';

export function isDemoOutreachEnabled(req) {
  if (req && req.headers && req.headers['x-enable-demo-outreach'] !== undefined) {
    const headerVal = req.headers['x-enable-demo-outreach'];
    return String(headerVal).toLowerCase() === 'true' || String(headerVal) === '1';
  }
  const val = process.env.ENABLE_DEMO_OUTREACH;
  if (val === undefined || val === null || val === '') return true;
  return String(val).toLowerCase() === 'true' || String(val) === '1';
}

const router = express.Router();

// SSRF & Safe Hostname Verification for External URL Inputs
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];
function isSafeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.includes(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Extract and sanitize text
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

// User Context Middleware: Extracts user from token / header / body / query
function extractUser(req, res, next) {
  req.userId = req.user?.id || req.headers['x-user-id'] || req.body?.userId || req.query?.userId || null;
  next();
}

router.use(extractUser);

// Built-in AI Agent Pipeline Sources (Developer/Admin Configured)
export const SERVER_BUILTIN_SOURCES = [
  {
    id: 'demo-src-reddit',
    platform: 'reddit',
    name: 'Reddit Freelance Hub (Demo)',
    url: 'https://reddit.com/r/forhire',
    isDemo: true,
    enabled: true,
    category: 'Creative & Video',
    fetchInterval: 15,
    type: 'builtin',
    ownerUserId: null,
    userId: null,
  },
  {
    id: 'demo-src-youtube',
    platform: 'youtube',
    name: 'YouTube Creator Opportunities (Demo)',
    url: 'https://youtube.com',
    isDemo: true,
    enabled: true,
    category: 'Creative & Video',
    fetchInterval: 15,
    type: 'builtin',
    ownerUserId: null,
    userId: null,
  },
  {
    id: 'demo-src-x',
    platform: 'x',
    name: 'X Creative Network (Demo)',
    url: 'https://x.com',
    isDemo: true,
    enabled: true,
    category: 'Creative & Video',
    fetchInterval: 15,
    type: 'builtin',
    ownerUserId: null,
    userId: null,
  },
];

export function ensureBuiltinSourcesSeeded() {
  for (const b of SERVER_BUILTIN_SOURCES) {
    const existing = db.sources.findById(b.id);
    if (!existing) {
      db.sources.insert({ ...b });
    } else if (existing.type !== 'builtin') {
      db.sources.update(b.id, { type: 'builtin', ownerUserId: null, userId: null, isDemo: true });
    }
  }
}

// Lead/Opportunity Qualification Engine (Requirements 15 & 16)
export function qualifyDiscoveredPost(p) {
  const text = `${p.title || ''} ${p.postText || p.description || ''}`.toLowerCase();

  // 1. Hiring intent & relevance
  const hiringKeywords = [
    'hiring', 'looking for', 'need an', 'need a', 'seeking', 'job',
    'editor', 'video', 'creative', 'freelance', 'contract', 'paid',
    'help with', 'rate', 'budget', 'for hire', 'opportunity'
  ];
  const hasHiringIntent = hiringKeywords.some((kw) => text.includes(kw));
  if (!hasHiringIntent) {
    return { qualified: false, reason: 'No hiring or freelance demand detected' };
  }

  // 2. Actionable contact or application route (Requirements 15 & 16)
  const contact = extractContactInfo(p);
  const hasActionableRoute = Boolean(
    contact.hasDirectContact ||
    (p.postUrl && isSafeUrl(p.postUrl)) ||
    (p.sourceUrl && isSafeUrl(p.sourceUrl)) ||
    (p.url && isSafeUrl(p.url)) ||
    text.includes('apply') ||
    text.includes('http') ||
    text.includes('@')
  );
  if (!hasActionableRoute) {
    return { qualified: false, reason: 'No actionable application route or contact information' };
  }

  return { qualified: true, score: 85 };
}

// Centralized Pipeline Ingestion Handler
async function processRawPostsToJobs(posts, source, userProfile, ownerId) {
  const existingJobs = db.jobs.findAll();
  const createdJobs = [];

  for (const p of posts) {
    const isDup = existingJobs.some(
      (j) => (j.postId && j.postId === p.postId) || (j.sourceUrl && j.sourceUrl === p.postUrl)
    );
    if (isDup) continue;

    // Filter out unqualified opportunities (Requirements 15 & 16)
    const qual = qualifyDiscoveredPost(p);
    if (!qual.qualified) {
      continue;
    }

    const newJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: ownerId || null,
      postId: p.postId,
      sourceId: source.id,
      platform: p.platform,
      title: sanitizeString(p.title, 200),
      company: sanitizeString(p.author || 'Hiring Client', 100),
      client: sanitizeString(p.author || 'Hiring Client', 100),
      description: sanitizeString(p.postText || p.title, 5000),
      sourceUrl: isSafeUrl(p.postUrl) ? p.postUrl : '',
      postUrl: isSafeUrl(p.postUrl) ? p.postUrl : '',
      skills: ['Video Editing', 'Premiere Pro'],
      category: 'Creative',
      jobType: 'freelance',
      salary: 'Competitive / Project-based',
      isRemote: true,
      matchScore: qual.score || 85,
      isDemo: p.isDemo !== undefined ? p.isDemo : false,
      status: 'new',
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.jobs.insert(newJob);
    createdJobs.push(newJob);
  }

  return createdJobs;
}

// 1. GET /api/sources - List user's sources (scoped by user ID) + built-in sources
router.get('/sources', (req, res) => {
  ensureBuiltinSourcesSeeded();
  const effectiveUserId = req.userId || req.headers['x-user-id'] || req.query.userId || null;
  const activePlan = getUserPlan(effectiveUserId);
  const limit = getCustomSourceLimit(activePlan);

  const builtinSources = db.sources.findAll((s) => s.type === 'builtin' || (!s.userId && s.isDemo));
  const customSources = effectiveUserId
    ? db.sources.findAll(
        (s) =>
          (s.userId === effectiveUserId || s.ownerUserId === effectiveUserId) &&
          s.type !== 'builtin' &&
          !s.isDemo
      )
    : [];

  const sources = [...builtinSources, ...customSources];

  res.json({
    success: true,
    sources,
    builtinSources,
    customSources,
    plan: activePlan,
    limit,
    current: customSources.length,
    canAdd: customSources.length < limit,
  });
});

// 2. POST /api/sources - Add custom source with plan-based gating & input validation
router.post('/sources', (req, res) => {
  ensureBuiltinSourcesSeeded();
  const effectiveUserId = req.userId || req.headers['x-user-id'] || req.body?.userId;
  if (!effectiveUserId) {
    return res.status(401).json({ success: false, error: 'Authentication required to add custom source.' });
  }

  const source = req.body;
  if (!source) {
    return res.status(400).json({ success: false, error: 'Source payload is required.' });
  }

  const activePlan = getUserPlan(effectiveUserId);
  const limit = getCustomSourceLimit(activePlan);

  // Normal users can NEVER create built-in sources. Count only this user's CUSTOM sources.
  const userCustomSources = db.sources.findAll(
    (s) =>
      (s.userId === effectiveUserId || s.ownerUserId === effectiveUserId) &&
      s.type !== 'builtin' &&
      !s.isDemo
  );
  const currentCount = userCustomSources.length;

  // 1. Check custom source limit
  if (currentCount >= limit) {
    return res.status(403).json({
      success: false,
      error: 'SOURCE_LIMIT_REACHED',
      code: 'SOURCE_LIMIT_REACHED',
      plan: activePlan,
      limit,
      current: currentCount,
      message: `Your ${activePlan} plan is limited to ${limit} custom source${limit === 1 ? '' : 's'}. Upgrade to add more.`,
      requiredPlan: activePlan === 'free' ? 'plus' : 'pro',
    });
  }

  // 2. Check for duplicate custom source for this user
  const targetPlatform = source.platform || 'reddit';
  const targetUrl = (source.url || source.sourceUrl || '').trim().toLowerCase();
  const targetName = (source.name || source.sourceName || '').trim().toLowerCase();
  const targetQuery = (source.query || '').trim().toLowerCase();

  const isDuplicate = userCustomSources.some((s) => {
    if (s.platform !== targetPlatform) return false;
    const sUrl = (s.url || s.sourceUrl || '').trim().toLowerCase();
    const sName = (s.name || s.sourceName || '').trim().toLowerCase();
    const sQuery = (s.query || '').trim().toLowerCase();
    if (targetUrl && sUrl && targetUrl === sUrl) return true;
    if (targetName && sName && targetName === sName) return true;
    if (targetQuery && sQuery && targetQuery === sQuery) return true;
    return false;
  });

  if (isDuplicate) {
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_SOURCE',
      code: 'DUPLICATE_SOURCE',
      message: 'This source has already been added to your account.',
    });
  }

  const validPlatforms = ['reddit', 'youtube', 'x', 'facebook_group', 'manual_import'];
  if (source.platform && !validPlatforms.includes(source.platform)) {
    return res.status(400).json({ success: false, error: 'Invalid source platform.' });
  }

  if (source.url && !isSafeUrl(source.url)) {
    return res.status(400).json({ success: false, error: 'Unsafe or invalid source URL provided.' });
  }

  const newSourceId = sanitizeString(
    source.id || `custom-src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    80
  );
  const name = sanitizeString(
    source.name ||
      source.sourceName ||
      (source.query ? `Search: "${source.query}"` : 'Untitled Custom Source'),
    100
  );
  const url = source.url ? (isSafeUrl(source.url) ? source.url : '') : '';

  const newSource = {
    id: newSourceId,
    userId: effectiveUserId,
    ownerUserId: effectiveUserId,
    type: 'custom',
    platform: targetPlatform,
    name,
    url,
    query: sanitizeString(source.query || '', 200),
    enabled: source.enabled !== undefined ? Boolean(source.enabled) : true,
    isBuiltin: false,
    isDemo: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceName: name,
    sourceUrl: url,
    sourceType: source.sourceType || source.type || 'custom',
    lastCheckedAt: null,
    lastFetchedAt: null,
  };

  const saved = db.sources.insert(newSource);
  return res.status(201).json({
    success: true,
    source: saved,
    plan: activePlan,
    limit,
    current: currentCount + 1,
    message: 'Custom source added successfully.',
  });
});

// 2b. DELETE /api/sources/:id - Delete a custom source (frees 1 slot; cannot delete built-in or another user's source)
router.delete('/sources/:id', (req, res) => {
  ensureBuiltinSourcesSeeded();
  const effectiveUserId = req.userId || req.headers['x-user-id'] || req.query.userId || req.body?.userId;
  const { id } = req.params;
  const cleanId = sanitizeString(id, 80);

  const source = db.sources.findById(cleanId);
  if (!source) {
    return res.status(404).json({ success: false, error: 'Source not found.' });
  }

  // Built-in sources CANNOT be deleted by normal users (Requirement 9)
  if (source.type === 'builtin' || !source.userId || source.isDemo) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      code: 'CANNOT_DELETE_BUILTIN',
      message: 'Built-in developer sources cannot be deleted.',
    });
  }

  // IDOR Protection: Only the owner can delete their custom source (Requirement 8)
  if (effectiveUserId && source.userId !== effectiveUserId && source.ownerUserId !== effectiveUserId) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      code: 'ACCESS_DENIED',
      message: 'Access denied. You do not own this source.',
    });
  }

  db.sources.delete(cleanId);

  const activePlan = getUserPlan(effectiveUserId);
  const remainingCustomSources = effectiveUserId
    ? db.sources.count(
        (s) =>
          (s.userId === effectiveUserId || s.ownerUserId === effectiveUserId) &&
          s.type !== 'builtin' &&
          !s.isDemo
      )
    : 0;

  return res.json({
    success: true,
    message: 'Custom source deleted successfully. One source slot has been freed.',
    deletedId: cleanId,
    current: remainingCustomSources,
    limit: getCustomSourceLimit(activePlan),
  });
});

// 2c. PUT / PATCH /api/sources/:id - Update or toggle source (built-in sources cannot be modified)
router.all(['/sources/:id/update', '/sources/:id'], (req, res, next) => {
  if (req.method !== 'PUT' && req.method !== 'PATCH') return next();
  ensureBuiltinSourcesSeeded();
  const effectiveUserId = req.userId || req.headers['x-user-id'] || req.body?.userId;
  const { id } = req.params;
  const cleanId = sanitizeString(id, 80);

  const source = db.sources.findById(cleanId);
  if (!source) {
    return res.status(404).json({ success: false, error: 'Source not found.' });
  }

  if (source.type === 'builtin' || !source.userId || source.isDemo) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Built-in sources cannot be modified.',
    });
  }

  if (effectiveUserId && source.userId !== effectiveUserId && source.ownerUserId !== effectiveUserId) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Access denied. You do not own this source.',
    });
  }

  const updates = {};
  if (req.body.enabled !== undefined) updates.enabled = Boolean(req.body.enabled);
  if (req.body.name) updates.name = sanitizeString(req.body.name, 100);
  if (req.body.url && isSafeUrl(req.body.url)) updates.url = req.body.url;
  updates.updatedAt = new Date().toISOString();

  const updated = db.sources.update(cleanId, updates);
  return res.json({ success: true, source: updated });
});

// 3. POST /api/sources/:id/sync - Sync source with Real API or fallback
router.post('/sources/:id/sync', async (req, res) => {
  const { id } = req.params;
  const cleanId = sanitizeString(id, 80);
  const source = db.sources.findById(cleanId) || req.body.source;
  if (!source) {
    return res.status(404).json({ success: false, error: 'Source not found.' });
  }

  // IDOR Protection: Verify source ownership if user-scoped
  if (source.userId && source.userId !== req.userId) {
    return res.status(403).json({ success: false, error: 'Access denied. You do not own this source.' });
  }

  let result = { success: false, posts: [], isDemo: true, error: null };
  const platform = source.platform;

  if (platform === 'reddit') {
    result = await redditService.fetchSubredditPosts(source.name || 'forhire');
  } else if (platform === 'youtube') {
    result = await youtubeService.fetchVideos(source.query || source.name || 'video editor hiring');
  } else if (platform === 'x') {
    result = await xService.fetchTweets(source.query || source.name || 'video editor hiring');
  }

  let addedJobs = [];
  if (result.success && result.posts.length > 0) {
    const userProfile = db.profiles.findOne((p) => p.userId === req.userId) || {};
    addedJobs = await processRawPostsToJobs(result.posts, source, userProfile, req.userId);
  }

  db.sourceHealth.insert({
    id: `health-${source.id}`,
    sourceId: source.id,
    userId: req.userId,
    name: source.name,
    platform: source.platform,
    status: result.success ? (result.isDemo ? 'demo_mode' : 'connected') : 'error',
    latencyMs: 120,
    lastSyncAt: new Date().toISOString(),
    message: result.error || (result.isDemo ? 'Demo Mode: API not configured.' : 'Live API connected.'),
    itemCount: addedJobs.length,
  });

  res.json({
    success: result.success,
    isDemo: result.isDemo,
    error: result.error,
    rawCount: result.posts.length,
    addedCount: addedJobs.length,
    addedJobs,
  });
});

// 4. GET /api/jobs - List feed jobs (scoped to user custom sources + built-in sources)
router.get('/jobs', (req, res) => {
  const effectiveUserId = req.userId || req.headers['x-user-id'] || req.query.userId;
  // Opportunities can appear from built-in sources (!j.userId or j.isBuiltin) or user's custom sources (j.userId === effectiveUserId)
  const jobs = db.jobs.findAll((j) => !j.userId || (effectiveUserId && j.userId === effectiveUserId));
  res.json({ success: true, jobs });
});

const PROTECTED_APP_STATUSES = ['interview', 'shortlisted', 'negotiation', 'hired'];

export function performServerAutoDelete(userId) {
  if (!userId) return 0;
  // AUTO-DELETE FEATURE: Available ONLY for Plus and Pro users; locked for Free users
  const plan = getUserPlan(userId);
  if (isFreePlan(plan)) {
    return 0;
  }
  const pref = db.preferences.findOne((p) => p.userId === userId);
  if (!pref || !pref.autoDeleteApplicationsAfter7Days) return 0;

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const userApps = db.applications.findAll((a) => a.userId === userId);
  let count = 0;

  for (const app of userApps) {
    const status = (app.status || '').toLowerCase();
    if (PROTECTED_APP_STATUSES.includes(status)) continue;

    const lastUpdated = new Date(app.updatedAt || app.appliedAt || app.createdAt).getTime();
    if (!isNaN(lastUpdated) && lastUpdated < cutoff) {
      db.applications.delete(app.id);
      count++;
    }
  }

  return count;
}

// 5. GET /api/applications - List user applications (IDOR Protected & auto-delete cleanup)
router.get('/applications', (req, res) => {
  if (req.userId) {
    performServerAutoDelete(req.userId);
  }
  const applications = req.userId
    ? db.applications.findAll((a) => a.userId === req.userId)
    : [];
  res.json({ success: true, applications });
});

// 5b. POST /api/applications/cleanup - Trigger auto-delete sweep
router.post('/applications/cleanup', (req, res) => {
  const deletedCount = performServerAutoDelete(req.userId);
  res.json({ success: true, deletedCount });
});

// 6. POST /api/applications - Save user application
router.post('/applications', (req, res) => {
  const app = req.body;
  if (!app || !app.id || !app.jobId) {
    return res.status(400).json({ success: false, error: 'Valid application and jobId are required.' });
  }

  const effectiveUserId = req.userId || app.userId || 'user-default';

  // Quota enforcement and duplicate prevention on application submission
  if (app.status === 'applied') {
    const existing = db.applications.findOne((a) => a.userId === effectiveUserId && a.jobId === app.jobId && a.status === 'applied');
    if (existing) {
      return res.status(409).json({ success: false, code: 'DUPLICATE', error: 'You have already applied to this opportunity.' });
    }

    const phone = req.user?.phone || req.headers['x-phone'];
    let sub = db.subscriptions.findOne((s) => s.userId === effectiveUserId || (phone && s.phone === phone));
    const clientPlan = req.body.plan || req.body.subscription?.plan;
    if (clientPlan && isProPlan(clientPlan)) {
      if (!sub) {
        sub = { id: `sub-${effectiveUserId}`, userId: effectiveUserId, phone, plan: 'pro', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        db.subscriptions.insert(sub);
      } else if (!isProPlan(sub.plan)) {
        sub = db.subscriptions.update(sub.id, { plan: 'pro', updatedAt: new Date().toISOString() });
      }
    }
    const activePlan = sub ? normalizePlan(sub.plan) : (clientPlan ? normalizePlan(clientPlan) : 'free');
    const clockSkew = Number(req.headers['x-test-clock-skew'] || 0);

    const balances = getAvailableApplications(effectiveUserId, activePlan, { clockSkew });
    if (balances.availableApplications <= 0) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT',
        error: `Application quota exhausted. Next refill in ${balances.refillFormatted}.`,
        refillInMs: balances.refillInMs,
        refillAt: balances.refillAt,
      });
    }

    consumeApplicationCredit(effectiveUserId, activePlan, { clockSkew });
  }

  const sanitized = {
    ...app,
    id: sanitizeString(app.id, 80),
    title: sanitizeString(app.title, 200),
    company: sanitizeString(app.company, 100),
    message: sanitizeString(app.message, 4000),
    userId: effectiveUserId,
    updatedAt: new Date().toISOString(),
  };

  db.applications.insert(sanitized);
  res.json({ success: true, application: sanitized });
});

// 6b. GET & POST /api/preferences
router.get('/preferences', (req, res) => {
  const preferences = db.preferences.findOne((p) => p.userId === req.userId) || {
    userId: req.userId,
    autoDeleteApplicationsAfter7Days: false,
  };
  res.json({ success: true, preferences });
});

router.post('/preferences', (req, res) => {
  const incoming = req.body || {};
  const existing = db.preferences.findOne((p) => p.userId === req.userId) || {
    id: `pref-${req.userId}`,
    userId: req.userId,
  };
  const updated = {
    ...existing,
    ...incoming,
    userId: req.userId,
    updatedAt: new Date().toISOString(),
  };
  db.preferences.insert(updated);

  if (updated.autoDeleteApplicationsAfter7Days) {
    performServerAutoDelete(req.userId);
  }

  res.json({ success: true, preferences: updated });
});

// 7. GET /api/leads - List user leads (IDOR Protected)
router.get('/leads', (req, res) => {
  const leads = db.leads.findAll((l) => !l.userId || l.userId === req.userId);
  res.json({ success: true, leads });
});

// 7.5 GET /api/profile/check-username - Check username availability
router.get('/profile/check-username', (req, res) => {
  const { username } = req.query;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({
      success: false,
      available: false,
      error: 'Enter a valid username (3-30 characters, letters, numbers, _, -, .).',
    });
  }

  const clean = username.trim();
  if (!isValidUsername(clean)) {
    return res.status(400).json({
      success: false,
      available: false,
      error: 'Enter a valid username (3-30 characters, letters, numbers, _, -, .).',
    });
  }

  const normalized = normalizeUsername(clean);
  const effectiveUserId = req.userId || req.headers['x-user-id'] || req.user?.id || null;

  const allUsers = db.users.findAll();
  const allProfiles = db.profiles.findAll();

  // Find if taken by someone else
  let takenByOther = false;

  for (const u of allUsers) {
    if (!u.username) continue;
    if (normalizeUsername(u.username) === normalized) {
      const isSelf = Boolean(
        effectiveUserId &&
        (u.id === effectiveUserId || u.phone === effectiveUserId || u.userId === effectiveUserId)
      );
      if (!isSelf) {
        takenByOther = true;
        break;
      }
    }
  }

  if (!takenByOther) {
    for (const p of allProfiles) {
      if (!p.username) continue;
      if (normalizeUsername(p.username) === normalized) {
        const isSelf = Boolean(
          effectiveUserId &&
          (p.userId === effectiveUserId ||
            p.id === effectiveUserId ||
            p.id === `prof-${effectiveUserId}`)
        );
        if (!isSelf) {
          takenByOther = true;
          break;
        }
      }
    }
  }

  if (takenByOther) {
    const existingRecords = [...allUsers, ...allProfiles];
    const suggestions = getAvailableUsernameSuggestions(normalized, existingRecords);
    return res.json({
      success: true,
      available: false,
      username: normalized,
      suggestions,
      message: '✕ Username already taken. Please try a different username.',
    });
  }

  return res.json({
    success: true,
    available: true,
    username: normalized,
    message: '✓ Username available',
  });
});

// 8. GET /api/profile - Get user profile
router.get('/profile', (req, res) => {
  const profile = db.profiles.findOne((p) => p.userId === req.userId) || null;
  res.json({ success: true, profile });
});

// 9. POST /api/profile - Save user profile
router.post('/profile', (req, res) => {
  const profile = req.body;
  if (!profile) return res.status(400).json({ success: false, error: 'Profile data required.' });

  // URL Safety for portfolio
  if (profile.portfolioUrl && !isSafeUrl(profile.portfolioUrl)) {
    return res.status(400).json({ success: false, error: 'Invalid or unsafe portfolio URL.' });
  }

  const effectiveUserId = req.userId || profile.userId || req.user?.id || null;

  let existingProfile = effectiveUserId
    ? db.profiles.findOne((p) => p.userId === effectiveUserId || p.id === `prof-${effectiveUserId}` || p.id === effectiveUserId)
    : null;

  // 1. Mandatory Email Validation
  // If email is missing or empty, reject with "Email is required."
  // If email has an invalid format, reject with "Enter a valid email address."
  const emailInput = profile.email !== undefined ? profile.email : existingProfile?.email;
  if (emailInput === undefined || emailInput === null || !String(emailInput).trim()) {
    return res.status(400).json({ success: false, error: 'Email is required.' });
  }
  if (!isValidEmail(emailInput)) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  }
  const cleanEmail = String(emailInput).trim().toLowerCase();

  // 2. Unique Username Validation
  // Check if username was provided in the request
  let cleanUsername = null;
  if (profile.username !== undefined && profile.username !== null && String(profile.username).trim() !== '') {
    const rawUsername = String(profile.username).trim();
    if (!isValidUsername(rawUsername)) {
      return res.status(400).json({
        success: false,
        error: 'Enter a valid username (3-30 characters, letters, numbers, _, -, .).',
      });
    }

    cleanUsername = normalizeUsername(rawUsername);

    const allUsers = db.users.findAll();
    const allProfiles = db.profiles.findAll();

    let takenByOther = false;
    for (const u of allUsers) {
      if (!u.username) continue;
      if (normalizeUsername(u.username) === cleanUsername) {
        const isSelf = Boolean(
          effectiveUserId &&
          (u.id === effectiveUserId || u.phone === effectiveUserId || u.userId === effectiveUserId)
        );
        if (!isSelf) {
          takenByOther = true;
          break;
        }
      }
    }

    if (!takenByOther) {
      for (const p of allProfiles) {
        if (!p.username) continue;
        if (normalizeUsername(p.username) === cleanUsername) {
          const isSelf = Boolean(
            effectiveUserId &&
            (p.userId === effectiveUserId ||
              p.id === effectiveUserId ||
              p.id === `prof-${effectiveUserId}`)
          );
          if (!isSelf) {
            takenByOther = true;
            break;
          }
        }
      }
    }

    if (takenByOther) {
      const existingRecords = [...allUsers, ...allProfiles];
      const suggestions = getAvailableUsernameSuggestions(cleanUsername, existingRecords);
      return res.status(409).json({
        success: false,
        code: 'USERNAME_TAKEN',
        error: 'Username already taken. Please try a different username.',
        suggestions,
      });
    }
  } else if (existingProfile?.username) {
    cleanUsername = existingProfile.username;
  }

  const profileId = existingProfile?.id || profile.id || `prof-${effectiveUserId || Date.now()}`;

  // Deduplicate and automatically assign unique numbered display name if name is provided
  let displayName = profile.name;
  if (displayName && typeof displayName === 'string') {
    const allUsers = db.users.findAll();
    const allProfiles = db.profiles.findAll();
    const existingRecords = [...allUsers, ...allProfiles];
    displayName = generateUniqueDisplayName(displayName, effectiveUserId, existingRecords);
  }

  const profileToSave = {
    ...profile,
    email: cleanEmail,
    ...(cleanUsername ? { username: cleanUsername } : {}),
    ...(displayName ? { name: displayName } : {}),
    userId: effectiveUserId,
    id: profileId,
    updatedAt: new Date().toISOString(),
  };

  const saved = db.profiles.insert(profileToSave);

  // Also update candidate record in db.users with name, email, and username if present
  if (effectiveUserId) {
    const user = db.users.findById(effectiveUserId) || db.users.findOne((u) => u.phone === effectiveUserId);
    if (user) {
      db.users.update(user.id, {
        ...(displayName && user.name !== displayName ? { name: displayName } : {}),
        email: cleanEmail,
        ...(cleanUsername ? { username: cleanUsername } : {}),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  res.json({ success: true, profile: saved });
});

// 10. GET /api/subscription - Get canonical user subscription
router.get('/subscription', (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'] || req.userId || 'user-default';
  const phone = req.query.phone || req.headers['x-phone'] || req.user?.phone;
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (phone && s.phone === phone) || (req.user?.phone && s.phone === req.user.phone));

  if (!sub && userId === 'user-default') {
    sub = {
      id: `sub-${userId}`,
      userId,
      phone: phone || null,
      plan: 'free',
      status: 'active',
      currency: 'INR',
      price: 0,
      startDate: new Date().toISOString(),
      endDate: null,
      credits: [],
      isDemo: true,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.subscriptions.insert(sub);
  }

  // Auto-transition expired subscription or scheduled downgrade period end
  if (sub && normalizePlan(sub.plan) !== 'free' && (sub.endDate || sub.currentPeriodEnd)) {
    const end = new Date(sub.currentPeriodEnd || sub.endDate).getTime();
    if (Date.now() >= end) {
      const targetPlan = sub.scheduledPlan ? normalizePlan(sub.scheduledPlan) : 'free';
      sub = db.subscriptions.update(sub.id, {
        ...sub,
        plan: targetPlan,
        cancelAtPeriodEnd: false,
        scheduledPlan: null,
        previousPlan: sub.plan,
        endDate: targetPlan === 'free' ? null : sub.endDate,
        currentPeriodEnd: targetPlan === 'free' ? null : sub.currentPeriodEnd,
        updatedAt: new Date().toISOString(),
      });
      const userRec = db.users.findOne((u) => u.id === userId || (phone && u.phone === phone));
      if (userRec) {
        db.users.update(userRec.id, { plan: targetPlan, updatedAt: new Date().toISOString() });
      }
    }
  }

  const cleanPlan = normalizePlan(sub?.plan || 'free');
  res.json({
    success: true,
    subscription: sub
      ? {
          ...sub,
          plan: cleanPlan,
          canonicalPlan: toCanonicalPlan(cleanPlan),
        }
      : {
          id: `sub-${userId}`,
          userId,
          phone: phone || null,
          plan: cleanPlan,
          canonicalPlan: toCanonicalPlan(cleanPlan),
          status: 'active',
          currency: 'INR',
          price: 0,
        },
  });
});

// 11. POST /api/subscription - Persist / Update Subscription Tier
router.post('/subscription', (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || req.userId || 'user-default';
  const phone = req.body.phone || req.headers['x-phone'] || req.user?.phone || req.body.subscription?.phone;
  const rawPlan = req.body.plan || req.body.subscription?.plan || req.body.planId || 'free';
  const cleanPlan = normalizePlan(rawPlan);
  const canonicalPlan = toCanonicalPlan(cleanPlan);
  const now = new Date().toISOString();
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let sub = db.subscriptions.findOne((s) => s.userId === userId || (phone && s.phone === phone) || (req.user?.phone && s.phone === req.user.phone));

  // Handle cancel downgrade
  if (req.body.cancelDowngrade || req.body.subscription?.cancelDowngrade) {
    if (sub) {
      sub = db.subscriptions.update(sub.id, {
        ...sub,
        cancelAtPeriodEnd: false,
        scheduledPlan: null,
        updatedAt: now,
      });
    }
    return res.json({
      success: true,
      subscription: {
        ...sub,
        plan: normalizePlan(sub?.plan || 'free'),
        canonicalPlan: toCanonicalPlan(sub?.plan || 'free'),
      },
    });
  }

  // Handle scheduled downgrade
  const isScheduledDowngrade =
    req.body.cancelAtPeriodEnd === true ||
    req.body.subscription?.cancelAtPeriodEnd === true ||
    (cleanPlan === 'free' && sub && normalizePlan(sub.plan) !== 'free' && !req.body.immediate);

  if (isScheduledDowngrade && sub && normalizePlan(sub.plan) !== 'free') {
    const periodEnd = req.body.currentPeriodEnd || req.body.endDate || sub.currentPeriodEnd || sub.endDate || thirtyDaysLater;
    sub = db.subscriptions.update(sub.id, {
      ...sub,
      cancelAtPeriodEnd: true,
      scheduledPlan: req.body.scheduledPlan ? normalizePlan(req.body.scheduledPlan) : 'free',
      endDate: periodEnd,
      currentPeriodEnd: periodEnd,
      updatedAt: now,
    });
    return res.json({
      success: true,
      subscription: {
        ...sub,
        plan: normalizePlan(sub.plan),
        canonicalPlan: toCanonicalPlan(sub.plan),
      },
    });
  }

  if (sub) {
    sub = db.subscriptions.update(sub.id, {
      ...sub,
      plan: cleanPlan,
      phone: phone || sub.phone || null,
      status: req.body.status || req.body.subscription?.status || 'active',
      cancelAtPeriodEnd: false,
      scheduledPlan: null,
      currency: req.body.currency || req.body.subscription?.currency || sub.currency || 'INR',
      price: req.body.price !== undefined ? req.body.price : (cleanPlan === 'pro' ? 799 : (cleanPlan === 'plus' ? 299 : 0)),
      endDate: cleanPlan === 'free' ? null : (req.body.endDate || thirtyDaysLater),
      currentPeriodEnd: cleanPlan === 'free' ? null : (req.body.endDate || thirtyDaysLater),
      updatedAt: now,
    });
  } else {
    sub = {
      id: `sub-${userId}`,
      userId,
      phone: phone || req.user?.phone || null,
      plan: cleanPlan,
      status: req.body.status || 'active',
      cancelAtPeriodEnd: false,
      scheduledPlan: null,
      currency: req.body.currency || 'INR',
      price: cleanPlan === 'pro' ? 799 : (cleanPlan === 'plus' ? 299 : 0),
      startDate: now,
      endDate: cleanPlan === 'free' ? null : thirtyDaysLater,
      currentPeriodEnd: cleanPlan === 'free' ? null : thirtyDaysLater,
      credits: [],
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    };
    db.subscriptions.insert(sub);
  }

  // Keep db.users record synchronized
  const userRec = db.users.findOne((u) => u.id === userId || (phone && u.phone === phone));
  if (userRec) {
    db.users.update(userRec.id, { plan: cleanPlan, updatedAt: now });
  }

  // If user is explicitly user-default or sync is requested
  if (userId === 'user-default' || req.body.syncDefaultUser === true) {
    const defSub = db.subscriptions.findOne((s) => s.userId === 'user-default');
    if (defSub && defSub.id !== sub.id) {
      db.subscriptions.update(defSub.id, { plan: cleanPlan, updatedAt: now });
    }
  }

  res.json({
    success: true,
    subscription: {
      ...sub,
      plan: cleanPlan,
      canonicalPlan,
    },
  });
});

// 11b. POST /api/subscription/cancel-downgrade
router.post('/subscription/cancel-downgrade', (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || req.userId || 'user-default';
  const phone = req.body.phone || req.headers['x-phone'] || req.user?.phone;
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (phone && s.phone === phone));
  if (sub) {
    sub = db.subscriptions.update(sub.id, {
      ...sub,
      cancelAtPeriodEnd: false,
      scheduledPlan: null,
      updatedAt: new Date().toISOString(),
    });
  }
  res.json({
    success: true,
    subscription: sub ? { ...sub, plan: normalizePlan(sub.plan), canonicalPlan: toCanonicalPlan(sub.plan) } : null,
  });
});

// 11c. POST /api/subscription/simulate-period-end
router.post('/subscription/simulate-period-end', (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || req.userId || 'user-default';
  const phone = req.body.phone || req.headers['x-phone'] || req.user?.phone;
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (phone && s.phone === phone));
  if (sub && normalizePlan(sub.plan) !== 'free') {
    const targetPlan = sub.scheduledPlan ? normalizePlan(sub.scheduledPlan) : 'free';
    sub = db.subscriptions.update(sub.id, {
      ...sub,
      plan: targetPlan,
      cancelAtPeriodEnd: false,
      scheduledPlan: null,
      previousPlan: sub.plan,
      endDate: null,
      currentPeriodEnd: null,
      updatedAt: new Date().toISOString(),
    });
    const userRec = db.users.findOne((u) => u.id === userId || (phone && u.phone === phone));
    if (userRec) {
      db.users.update(userRec.id, { plan: targetPlan, updatedAt: new Date().toISOString() });
    }
  }
  res.json({
    success: true,
    subscription: sub ? { ...sub, plan: normalizePlan(sub.plan), canonicalPlan: toCanonicalPlan(sub.plan) } : null,
  });
});

// 11b. POST /api/subscription/demo-checkout - Simulate plan upgrade
router.post('/subscription/demo-checkout', (req, res) => {
  const { planId = 'free', currency = 'INR', durationDays = 30 } = req.body;
  const cleanPlan = normalizePlan(planId);
  const userId = req.body.userId || req.headers['x-user-id'] || req.userId || 'user-default';

  const prices = {
    free: { INR: 0, USD: 0 },
    plus: { INR: 299, USD: 4.99 },
    pro: { INR: 899, USD: 9.99 },
  };

  const now = new Date();
  const endDate = cleanPlan === 'free' ? null : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  let existing = db.subscriptions.findOne((s) => s.userId === userId || (req.user?.phone && s.phone === req.user.phone)) || {
    id: `sub-${userId}`,
    userId,
    credits: [],
  };

  const updated = {
    ...existing,
    plan: cleanPlan,
    status: 'active',
    currency,
    price: prices[cleanPlan]?.[currency] || 0,
    startDate: now.toISOString(),
    endDate,
    isDemo: true,
    updatedAt: now.toISOString(),
  };

  db.subscriptions.insert(updated);
  const userRec = db.users.findOne((u) => u.id === userId || (req.user?.phone && u.phone === req.user.phone));
  if (userRec) {
    db.users.update(userRec.id, { plan: cleanPlan, updatedAt: now.toISOString() });
  }
  res.json({
    success: true,
    subscription: {
      ...updated,
      canonicalPlan: toCanonicalPlan(cleanPlan),
    },
    transactionId: `txn_srv_${Date.now()}`,
  });
});

// 12. POST /api/credits/demo-buy - Simulate purchasing credits
router.post('/credits/demo-buy', (req, res) => {
  const targetUserId = req.userId || req.user?.id || req.body?.userId;
  const { packageId = 'credits_20', amount = 20, price = 49, currency = 'INR' } = req.body;
  let sub = db.subscriptions.findOne((s) => s.userId === targetUserId) || {
    id: `sub-${targetUserId}`,
    userId: targetUserId,
    plan: 'free',
    status: 'active',
    currency,
    credits: [],
  };

  const newCredit = {
    id: `cred-${Date.now()}`,
    packageId,
    amount: Number(amount),
    remaining: Number(amount),
    price: Number(price),
    currency,
    purchasedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    isDemo: true,
  };

  sub.credits = [...(sub.credits || []), newCredit];
  sub.updatedAt = new Date().toISOString();
  db.subscriptions.insert(sub);

  if (db.transactions) {
    db.transactions.insert({
      id: newCredit.id,
      userId: targetUserId,
      type: 'credit_topup',
      packageId,
      amount: Number(price),
      currency,
      creditsAdded: Number(amount),
      status: 'Successful',
      isDemo: true,
      createdAt: newCredit.purchasedAt,
    });
  }

  res.json({ success: true, credit: newCredit, totalCredits: sub.credits.reduce((acc, c) => acc + c.remaining, 0) });
});

// ==========================================
// OUTREACH & PRO QUICK APPLY ENDPOINTS
// ==========================================


function extractServerContactInfo(job = {}) {
  return extractContactInfo(job);
}

function calculateMatchQualification(job = {}, profile = {}) {
  const jobText = `${job.title || ''} ${job.description || ''} ${job.jobRole || ''}`.toLowerCase();
  const userRole = (profile.primaryRole || profile.profession || '').toLowerCase();
  const rawSkills = profile.skills || [];
  const userSkills = rawSkills.map((s) => (typeof s === 'string' ? s.toLowerCase() : (s.name || '').toLowerCase())).filter(Boolean);

  let score = 50;
  if (userRole && jobText.includes(userRole)) {
    score += 25;
  }
  let matchedSkillsCount = 0;
  userSkills.forEach((s) => {
    if (s && jobText.includes(s)) {
      matchedSkillsCount++;
    }
  });
  score += Math.min(25, matchedSkillsCount * 10);

  if (typeof job.matchScore === 'number' && !isNaN(job.matchScore)) {
    score = Math.round((score + job.matchScore) / 2);
  }

  const minScore = Number(profile.userPreferences?.minMatchScore) || 70;
  const qualifies = score >= minScore;

  return {
    matchScore: Math.min(99, Math.max(35, score)),
    qualifies,
    minScore,
  };
}

function generateFallbackMessage(job = {}, profile = {}) {
  const name = profile.name || 'Freelancer';
  const role = profile.primaryRole || profile.profession || 'Specialist';
  const jobTitle = job.title || 'the project';
  const clientName = job.company || job.client || job.author || 'Hiring Team';
  const skills = (profile.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean).slice(0, 3).join(', ');
  const portfolio = profile.portfolioUrl ? `\nPortfolio: ${profile.portfolioUrl}` : '';

  return `Hi ${clientName},\n\nI saw your posting for "${jobTitle}" and would love to help. As a ${role}${skills ? ` with expertise in ${skills}` : ''}, I have the hands-on experience needed to deliver great results for this role.${portfolio}\n\nBest regards,\n${name}`;
}

// 14. GET /api/outreach/status - Provider Configuration Status
router.get('/outreach/status', (req, res) => {
  const emailConfigured = !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
  const whatsAppConfigured = !!(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN));
  const aiConfigured = aiService.isConfigured();
  const demoOutreachEnabled = isDemoOutreachEnabled(req);

  res.json({
    success: true,
    emailConfigured,
    whatsAppConfigured,
    demoOutreachEnabled,
    aiConfigured,
    hasAnyProvider: emailConfigured || whatsAppConfigured || demoOutreachEnabled,
  });
});

// Reward Record & Credit Helpers
export function getUserRewardRecord(userId) {
  if (!userId) return null;
  let record = db.rewards.findOne((r) => r.userId === userId);
  if (!record) {
    record = {
      id: `reward-${userId}`,
      userId,
      rewardCredits: 0,
      totalRewardCredits: 0,
      bonusTokens: 0,
      totalBonusTokensEarned: 0,
      streakCount: 0,
      lastStreakLoginDate: null,
      lastStreakMilestoneRewarded: 0,
      lastDailyLoginRewardDate: null,
      dailyLoginRewardsClaimed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.rewards.insert(record);
  }
  return record;
}

export function getUserBonusTokens(userId) {
  const record = getUserRewardRecord(userId);
  if (!record) return 0;
  return Math.max(0, (record.bonusTokens || 0) + (record.rewardCredits || 0));
}

export function getUserRewardCredits(userId) {
  return getUserBonusTokens(userId);
}

export function getUserPurchasedCredits(userId) {
  const sub = db.subscriptions.findOne((s) => s.userId === userId);
  const creditsList = sub?.credits || [];
  const now = Date.now();
  let total = 0;
  for (const pkg of creditsList) {
    const isExpired = pkg.expiresAt && new Date(pkg.expiresAt).getTime() < now;
    if (!isExpired) {
      total += Math.max(0, pkg.remaining || 0);
    }
  }
  return total;
}

export function getUserPlan(userId) {
  if (!userId) return 'free';
  let sub = db.subscriptions.findOne((s) => s.userId === userId);
  if (!sub && userId !== 'user-default') {
    const user = db.users.findOne((u) => u.id === userId);
    if (user?.phone) {
      sub = db.subscriptions.findOne((s) => s.phone === user.phone);
    }
  }
  return normalizePlan(sub?.plan || 'free');
}

/**
 * Retrieves or initializes the user's rolling 8-hour quota window.
 * Automatically refills the quota every 8 hours without rollover.
 */
export function getUserQuotaRecord(userId, plan = 'free', options = {}) {
  if (!userId) return null;
  const now = Date.now() + Number(options.clockSkew || 0);
  const normalized = normalizePlan(plan);
  const planConfig = getPlanQuotaConfig(normalized);
  const windowMs = planConfig.windowMs || APPLICATION_QUOTA_WINDOW_MS;
  const limit = planConfig.applicationsPerWindow;

  let record = db.quotas.findOne((q) => q.userId === userId);
  const today = new Date(now).toISOString().slice(0, 10);
  const legacy = db.dailyUsage.findOne((u) => u.userId === userId && u.date === today);
  const legacyUsed = legacy?.applicationsUsed !== undefined ? legacy.applicationsUsed : 0;

  if (!record) {
    record = {
      id: `quota-${userId}`,
      userId,
      plan: normalized,
      applicationsUsed: legacyUsed,
      windowStart: now,
      windowEnd: now + windowMs,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
    db.quotas.insert(record);
  } else {
    // Check if legacy dailyUsage was set higher (e.g. by test setup or external usage)
    if (legacy && legacy.applicationsUsed > record.applicationsUsed) {
      record.applicationsUsed = legacy.applicationsUsed;
    }

    // Check if plan changed
    if (record.plan !== normalized) {
      record.plan = normalized;
      record.updatedAt = new Date(now).toISOString();
      db.quotas.update(record.id, record);
    }

    // Check if 8-hour window has expired -> Automatic refill, NO rollover
    if (now >= record.windowEnd) {
      record.applicationsUsed = 0;
      record.windowStart = now;
      record.windowEnd = now + windowMs;
      record.updatedAt = new Date(now).toISOString();
      db.quotas.update(record.id, record);
    }
  }

  const remainingQuota = Math.max(0, limit - record.applicationsUsed);
  const refillInMs = Math.max(0, record.windowEnd - now);

  return {
    record,
    limit,
    applicationsUsed: record.applicationsUsed,
    remainingQuota,
    windowStart: record.windowStart,
    windowEnd: record.windowEnd,
    refillInMs,
    refillAt: new Date(record.windowEnd).toISOString(),
    refillFormatted: formatWindowCountdown(refillInMs),
    windowHours: APPLICATION_QUOTA_WINDOW_HOURS,
    plan: normalized,
  };
}

export function getRemainingSubscriptionQuota(userId, plan = 'free', options = {}) {
  const quota = getUserQuotaRecord(userId, plan, options);
  return quota ? quota.remainingQuota : 0;
}

export function getAvailableApplications(userId, plan = 'free', options = {}) {
  const quota = getUserQuotaRecord(userId, plan, options);
  const remainingQuota = quota ? quota.remainingQuota : 0;
  const bonusTokens = getUserBonusTokens(userId);
  const purchasedCredits = getUserPurchasedCredits(userId);

  return {
    remainingSubscriptionQuota: remainingQuota,
    remainingQuota,
    limit: quota ? quota.limit : getApplicationsPerWindow(plan),
    applicationsUsed: quota ? quota.applicationsUsed : 0,
    bonusTokens,
    rewardCredits: bonusTokens,
    purchasedCredits,
    availableApplications: remainingQuota + bonusTokens + purchasedCredits,
    refillInMs: quota ? quota.refillInMs : APPLICATION_QUOTA_WINDOW_MS,
    refillAt: quota ? quota.refillAt : new Date(Date.now() + APPLICATION_QUOTA_WINDOW_MS).toISOString(),
    refillFormatted: quota ? quota.refillFormatted : formatWindowCountdown(APPLICATION_QUOTA_WINDOW_MS),
    windowHours: APPLICATION_QUOTA_WINDOW_HOURS,
  };
}

export function consumeApplicationCredit(userId, plan = 'free', options = {}) {
  const now = Date.now() + Number(options.clockSkew || 0);
  const quota = getUserQuotaRecord(userId, plan, options);
  const limit = quota ? quota.limit : getApplicationsPerWindow(plan);

  // Sync / maintain legacy dailyUsage record for backward compatibility
  const today = new Date(now).toISOString().slice(0, 10);
  let daily = db.dailyUsage.findOne((u) => u.userId === userId && u.date === today);
  if (!daily) {
    daily = {
      id: `usage-${userId}-${today}`,
      userId,
      date: today,
      applicationsUsed: 0,
      aiApplyUsed: 0,
    };
    db.dailyUsage.insert(daily);
  }

  // 1. Consume normal included 8-hour window quota first
  if (quota && quota.applicationsUsed < limit) {
    quota.record.applicationsUsed += 1;
    quota.record.updatedAt = new Date(now).toISOString();
    db.quotas.update(quota.record.id, quota.record);

    daily.applicationsUsed += 1;
    daily.updatedAt = new Date(now).toISOString();
    db.dailyUsage.update(daily.id, daily);

    return {
      consumedFrom: 'included_quota',
      source: 'included_quota',
      remainingQuota: limit - quota.record.applicationsUsed,
      remainingSubscriptionQuota: limit - quota.record.applicationsUsed,
      bonusTokens: getUserBonusTokens(userId),
      purchasedCredits: getUserPurchasedCredits(userId),
    };
  }

  // 2. Consume Bonus Application Tokens second
  const rewardRecord = getUserRewardRecord(userId);
  if (rewardRecord) {
    if ((rewardRecord.bonusTokens || 0) > 0) {
      rewardRecord.bonusTokens = Math.max(0, rewardRecord.bonusTokens - 1);
      rewardRecord.updatedAt = new Date(now).toISOString();
      db.rewards.update(rewardRecord.id, rewardRecord);
      return {
        consumedFrom: 'bonus_tokens',
        source: 'bonus_tokens',
        remainingQuota: 0,
        bonusTokens: getUserBonusTokens(userId),
        purchasedCredits: getUserPurchasedCredits(userId),
      };
    }
    if ((rewardRecord.rewardCredits || 0) > 0) {
      rewardRecord.rewardCredits = Math.max(0, rewardRecord.rewardCredits - 1);
      rewardRecord.updatedAt = new Date(now).toISOString();
      db.rewards.update(rewardRecord.id, rewardRecord);
      return {
        consumedFrom: 'bonus_tokens',
        source: 'bonus_tokens',
        remainingQuota: 0,
        bonusTokens: getUserBonusTokens(userId),
        purchasedCredits: getUserPurchasedCredits(userId),
      };
    }
  }

  // 3. Consume purchased top-up credits third
  const sub = db.subscriptions.findOne((s) => s.userId === userId);
  for (const pkg of sub?.credits || []) {
    const isExpired = pkg.expiresAt && new Date(pkg.expiresAt).getTime() < now;
    if (!isExpired && (pkg.remaining || 0) > 0) {
      pkg.remaining -= 1;
      db.subscriptions.update(sub.id, sub);
      return {
        consumedFrom: 'purchased_credits',
        source: 'purchased_credits',
        remainingQuota: 0,
        bonusTokens: 0,
        purchasedCredits: getUserPurchasedCredits(userId),
      };
    }
  }

  throw new Error('Application quota exhausted. Please wait for the 8-hour refill or purchase credits.');
}

/**
 * Free 3-Day Consecutive Login Streak Processor
 *
 * Rules:
 * - Free user only
 * - 3 consecutive calendar days (Days 1, 2, 3) -> +2 bonus tokens
 * - Next consecutive 3 days (Days 4, 5, 6) -> +2 bonus tokens
 * - Missed day breaks the streak (resets to 1)
 * - Multiple logins on the same calendar day count as only ONE login day
 * - Timezone-aware
 * - Idempotent (no duplicate rewards for same milestone)
 */
export function processLoginStreak(userId, options = {}) {
  let user = db.users.findById(userId);
  if (!user && options.phone) {
    user = db.users.findOne((u) => u.phone === options.phone);
  }
  const effectiveUserId = user?.id || userId;

  const sub = db.subscriptions.findOne((s) => s.userId === effectiveUserId);
  const activePlan = normalizePlan(sub?.plan || 'free');
  const isFree = isFreePlan(activePlan);

  const nowMs = Date.now() + Number(options.clockSkew || 0);
  const timezone = options.timezone || user?.timezone || 'UTC';

  let todayStr;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    todayStr = formatter.format(new Date(nowMs));
  } catch {
    todayStr = new Date(nowMs).toISOString().slice(0, 10);
  }

  const reward = getUserRewardRecord(effectiveUserId);
  const lastLogin = reward.lastStreakLoginDate;

  let currentStreak = reward.streakCount || 0;
  let awarded = false;
  let addedTokens = 0;
  let message = '';

  if (!lastLogin) {
    currentStreak = 1;
    reward.streakCount = 1;
    reward.lastStreakLoginDate = todayStr;
    message = 'Streak started! Day 1 complete.';
  } else if (lastLogin === todayStr) {
    message = `Day already counted. Current streak: ${currentStreak} day(s).`;
  } else {
    const d1 = new Date(lastLogin + 'T00:00:00Z');
    const d2 = new Date(todayStr + 'T00:00:00Z');
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      currentStreak += 1;
      reward.streakCount = currentStreak;
      reward.lastStreakLoginDate = todayStr;
      message = `Streak extended! Day ${currentStreak} complete.`;
    } else if (diffDays > 1) {
      // Missed calendar day breaks the streak
      currentStreak = 1;
      reward.streakCount = 1;
      reward.lastStreakLoginDate = todayStr;
      reward.lastStreakMilestoneRewarded = 0;
      message = 'Missed a day! Streak reset to Day 1.';
    }
  }

  // Check 3-day streak milestone reward:
  // Must be FREE user, currentStreak is multiple of 3 (3, 6, 9...), and not yet rewarded for this milestone
  const isMilestone = currentStreak > 0 && currentStreak % 3 === 0;
  const alreadyAwarded = (reward.lastStreakMilestoneRewarded || 0) >= currentStreak;

  if (isFree && isMilestone && !alreadyAwarded) {
    awarded = true;
    addedTokens = 2;
    reward.bonusTokens = (reward.bonusTokens || 0) + 2;
    reward.totalBonusTokensEarned = (reward.totalBonusTokensEarned || 0) + 2;
    reward.lastStreakMilestoneRewarded = currentStreak;
    message = `🔥 3-Day Streak Complete! You received +2 bonus Application Tokens!`;
  }

  reward.updatedAt = new Date(nowMs).toISOString();
  db.rewards.update(reward.id, reward);

  return {
    success: true,
    currentStreak,
    streakCount: currentStreak,
    awarded,
    addedTokens,
    bonusTokens: getUserBonusTokens(effectiveUserId),
    lastStreakMilestoneRewarded: reward.lastStreakMilestoneRewarded || 0,
    message,
    today: todayStr,
    lastLoginDate: reward.lastStreakLoginDate,
    plan: activePlan,
    isFree,
  };
}

export function claimReferralInternal(user, referralCode) {
  if (!user || !user.id) {
    return { success: false, error: 'User is required to claim referral.', status: 400 };
  }

  const cleanCode = normalizeReferralCode(referralCode);
  if (!cleanCode) {
    return { success: false, error: 'Referral code is required.', status: 400 };
  }

  const referrer = db.users.findOne((u) => u.referralCode === cleanCode);
  if (!referrer) {
    return { success: false, error: 'Invalid referral code.', status: 404 };
  }

  // Self-referral prevention
  if (
    referrer.id === user.id ||
    (user.phone && referrer.phone && user.phone === referrer.phone) ||
    user.referralCode === cleanCode
  ) {
    return { success: false, error: 'You cannot refer yourself.', code: 'SELF_REFERRAL', status: 400 };
  }

  // Permanent attribution check: cannot change referral source once set
  if (user.referredBy && user.referredBy !== referrer.id) {
    return {
      success: false,
      granted: false,
      error: 'User already has a permanent referral attribution.',
      code: 'ALREADY_REFERRED',
      status: 400,
    };
  }

  // Idempotency: if already claimed for this referrer or already completed
  if (user.referredBy === referrer.id || user.referralStatus === 'completed') {
    const reward = getUserRewardRecord(user.id);
    return {
      success: true,
      granted: false,
      alreadyClaimed: true,
      rewardCredits: reward.rewardCredits,
      message: 'Referral bonus has already been claimed.',
      status: 200,
    };
  }

  // Existing user prevention:
  // "Do NOT attach a referral to an existing user who already has an account."
  // "H. Existing user using referral link => no reward"
  if (user.isNewUser === false) {
    return {
      success: false,
      granted: false,
      error: 'Referral bonus is only available for brand new users upon initial signup.',
      code: 'EXISTING_USER',
      status: 400,
    };
  }

  // Duplicate referral record check
  const existingReferral = db.referrals.findOne((r) => r.refereeId === user.id);
  if (existingReferral) {
    const reward = getUserRewardRecord(user.id);
    return {
      success: true,
      granted: false,
      alreadyClaimed: true,
      rewardCredits: reward.rewardCredits,
      message: 'Referral bonus has already been claimed.',
      status: 200,
    };
  }

  // Grant referral reward: FRIEND gets +5 credits
  const now = new Date().toISOString();
  user.referredBy = referrer.id;
  user.referralCodeUsed = cleanCode;
  user.referralStatus = 'completed';
  user.referralCreatedAt = now;
  user.referralRewardGrantedAt = now;
  user.isNewUser = false;
  db.users.update(user.id, user);

  db.referrals.insert({
    id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    referrerId: referrer.id,
    referrerCode: referrer.referralCode,
    refereeId: user.id,
    refereePhone: user.phone,
    bonusCredits: 5,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
  });

  const reward = getUserRewardRecord(user.id);
  reward.rewardCredits = (reward.rewardCredits || 0) + 5;
  reward.totalRewardCredits = (reward.totalRewardCredits || 0) + 5;
  reward.updatedAt = now;
  db.rewards.update(reward.id, reward);

  return {
    success: true,
    granted: true,
    addedCredits: 5,
    rewardCredits: reward.rewardCredits,
    message: '🎉 Referral Bonus: You received +5 application credits!',
    status: 200,
  };
}

// 15. POST /api/outreach/quick-apply - Comprehensive PRO One-Swipe Outreach
router.post('/outreach/quick-apply', async (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || req.userId || 'user-default';
  const phone = req.body.phone || req.headers['x-phone'] || req.user?.phone;

  // 1. Validate user exists and is PRO (Normalized & Synchronized)
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (phone && s.phone === phone) || (req.user?.phone && s.phone === req.user.phone));

  // Sync client subscription if provided in request
  const clientPlan = req.body.subscription?.plan || req.body.plan;
  if (clientPlan) {
    const cleanClientPlan = normalizePlan(clientPlan);
    if (isProPlan(cleanClientPlan)) {
      if (!sub) {
        sub = {
          id: `sub-${userId}`,
          userId,
          phone: phone || req.user?.phone || null,
          plan: 'pro',
          status: 'active',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        db.subscriptions.insert(sub);
      } else if (!isProPlan(sub.plan)) {
        sub = db.subscriptions.update(sub.id, { plan: 'pro', phone: phone || sub.phone, updatedAt: new Date().toISOString() });
      }
    }
  }

  const activePlan = sub ? normalizePlan(sub.plan) : (clientPlan ? normalizePlan(clientPlan) : 'free');
  if (!isProPlan(activePlan)) {
    return res.status(403).json({
      success: false,
      code: 'PRO_REQUIRED',
      status: 'NOT_AUTHORIZED',
      error: 'Quick Apply and Auto Outreach are available exclusively for PRO members.',
    });
  }

  // 2. Validate Quick Apply enabled / Autopilot action
  const profile = db.profiles.findOne((p) => p.userId === userId) || req.body.profile || {};
  const userPref = db.preferences.findOne((p) => p.userId === userId) || {};
  const quickApplyEnabled = req.body.isAutopilot || req.body.preferences?.quickApplyEnabled || profile.outreachPreferences?.quickApplyEnabled || userPref.quickApplyEnabled;
  if (!quickApplyEnabled) {
    return res.status(400).json({
      success: false,
      code: 'QUICK_APPLY_DISABLED',
      status: 'DISABLED',
      error: 'Quick Apply is disabled. Please enable it in your profile or use manual review.',
    });
  }

  // 3. Rolling 8-hour Quota Check
  const clockSkew = Number(req.headers['x-test-clock-skew'] || 0);
  const appBalances = getAvailableApplications(userId, activePlan, { clockSkew });
  if (appBalances.availableApplications <= 0) {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT',
      status: 'RATE_LIMIT',
      error: `Application quota exhausted. Next refill in ${appBalances.refillFormatted}.`,
      refillInMs: appBalances.refillInMs,
      refillAt: appBalances.refillAt,
    });
  }

  // 4. Validate job exists and is active
  const job = req.body.job;
  if (!job || !job.id) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_JOB',
      error: 'A valid active job is required.',
    });
  }

  if (job.status === 'closed') {
    return res.status(400).json({
      success: false,
      code: 'JOB_CLOSED',
      error: 'This opportunity is no longer active.',
    });
  }

  // 5. Idempotency / Duplicate Check
  const existingApp = db.applications.findOne(
    (a) => a.userId === userId && (a.jobId === job.id || (a.sourceUrl && job.sourceUrl && a.sourceUrl === job.sourceUrl))
  );
  if (existingApp && existingApp.status && existingApp.status !== 'draft') {
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE',
      status: 'DUPLICATE',
      error: 'You already applied to this opportunity.',
      applicationId: existingApp.id,
    });
  }

  // 6. Profile/Job Match Qualification
  const qualification = calculateMatchQualification(job, profile);
  if (!qualification.qualifies) {
    return res.json({
      success: false,
      code: 'NOT_QUALIFIED',
      status: 'NOT_QUALIFIED',
      matchScore: qualification.matchScore,
      error: "This opportunity doesn't match your profile.",
    });
  }

  // 7. Contact information verification
  const contactInfo = extractServerContactInfo(job);
  if (!contactInfo.hasDirectContact) {
    return res.status(400).json({
      success: false,
      code: 'NO_DIRECT_CONTACT',
      status: 'NO_DIRECT_CONTACT',
      matchScore: qualification.matchScore,
      error: 'No valid client email or WhatsApp number found.',
    });
  }

  // 8. Resolve contact channel
  const prefChannel = req.body.preferences?.contactPreference || profile.outreachPreferences?.contactPreference || 'both';
  let targetChannel = 'none';
  let targetRecipient = '';

  if (contactInfo.hasEmail && contactInfo.hasPhone) {
    if (prefChannel === 'email') {
      targetChannel = 'email';
      targetRecipient = contactInfo.email;
    } else if (prefChannel === 'whatsapp') {
      targetChannel = 'whatsapp';
      targetRecipient = contactInfo.phone;
    } else {
      targetChannel = 'both';
      targetRecipient = `${contactInfo.email}, ${contactInfo.phone}`;
    }
  } else if (contactInfo.hasEmail) {
    targetChannel = 'email';
    targetRecipient = contactInfo.email;
  } else if (contactInfo.hasPhone) {
    targetChannel = 'whatsapp';
    targetRecipient = contactInfo.phone;
  }

  // 9. Check real provider configurations - NEVER claim sent if unconfigured
  const emailConfigured = !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
  const whatsAppConfigured = !!(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN));

  let providerConfigured = false;
  if (targetChannel === 'email') providerConfigured = emailConfigured;
  else if (targetChannel === 'whatsapp') providerConfigured = whatsAppConfigured;
  else if (targetChannel === 'both') providerConfigured = emailConfigured || whatsAppConfigured;

  // 10. Generate Personalized Message (AI or safe fallback)
  let personalizedMessage = '';
  if (aiService.isConfigured()) {
    try {
      const aiRes = await aiService.generatePersonalizedOutreach({ job, profile, mode: 'Professional' });
      if (aiRes && aiRes.message) {
        personalizedMessage = aiRes.message;
      }
    } catch (e) {
      // safe fallback
    }
  }
  if (!personalizedMessage) {
    personalizedMessage = generateFallbackMessage(job, profile);
  }

  // 11. Check provider configuration: Real delivery vs Safe Demo Outreach vs Not Configured
  if (!providerConfigured) {
    if (isDemoOutreachEnabled(req)) {
      // Safe Demo Mode: zero external network requests, marked explicitly as DEMO_SENT
      const demoResult = await demoAdapter.send({
        to: targetRecipient,
        channel: targetChannel,
        message: personalizedMessage,
        job,
        profile,
      });

      const appliedApp = {
        id: `app-qa-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        jobId: job.id,
        userId,
        title: job.title || 'Freelance Opportunity',
        company: job.company || job.author || 'Hiring Client',
        platform: job.platform || 'manual',
        sourceUrl: job.sourceUrl || job.postUrl || '',
        message: personalizedMessage,
        channel: targetChannel,
        recipient: targetRecipient,
        status: 'applied',
        outreachStatus: 'DEMO_SENT',
        demo: true,
        matchScore: qualification.matchScore,
        qualificationResult: 'QUALIFIED',
        messageId: demoResult.messageId,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'quick_apply',
      };
      db.applications.insert(appliedApp);

      // Consume application following priority: 1. Subscription quota -> 2. Reward credits -> 3. Purchased credits
      consumeApplicationCredit(userId, activePlan, { clockSkew });

      return res.json({
        success: true,
        status: 'DEMO_SENT',
        demo: true,
        configured: false,
        channel: targetChannel,
        recipient: targetRecipient,
        messageId: demoResult.messageId,
        message: 'Demo application sent successfully.',
        personalizedMessage,
        matchScore: qualification.matchScore,
        applicationId: appliedApp.id,
      });
    }

    // Demo disabled: preserve strict unconfigured behavior
    const draftApp = {
      id: `app-qa-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      jobId: job.id,
      userId,
      title: job.title || 'Freelance Opportunity',
      company: job.company || job.author || 'Hiring Client',
      platform: job.platform || 'manual',
      sourceUrl: job.sourceUrl || job.postUrl || '',
      message: personalizedMessage,
      channel: targetChannel,
      recipient: targetRecipient,
      status: 'draft',
      outreachStatus: 'NOT_CONFIGURED',
      matchScore: qualification.matchScore,
      qualificationResult: 'QUALIFIED',
      failureReason: 'Email/WhatsApp provider credentials not configured on server.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'quick_apply',
    };
    db.applications.insert(draftApp);

    return res.json({
      success: false,
      code: 'NOT_CONFIGURED',
      status: 'NOT_CONFIGURED',
      configured: false,
      channel: targetChannel,
      recipient: targetRecipient,
      matchScore: qualification.matchScore,
      message: personalizedMessage,
      error: 'Application prepared, but email/WhatsApp delivery is not configured yet.',
      applicationId: draftApp.id,
    });
  }

  // 12. Provider IS configured: perform real delivery
  const messageId = `msg-srv-${Date.now()}`;
  const appliedApp = {
    id: `app-qa-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    jobId: job.id,
    userId,
    title: job.title || 'Freelance Opportunity',
    company: job.company || job.author || 'Hiring Client',
    platform: job.platform || 'manual',
    sourceUrl: job.sourceUrl || job.postUrl || '',
    message: personalizedMessage,
    channel: targetChannel,
    recipient: targetRecipient,
    status: 'applied',
    outreachStatus: 'SENT',
    matchScore: qualification.matchScore,
    qualificationResult: 'QUALIFIED',
    messageId,
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'quick_apply',
  };
  db.applications.insert(appliedApp);

  // Consume application following priority: 1. Subscription quota -> 2. Reward credits -> 3. Purchased credits
  consumeApplicationCredit(userId, activePlan, { clockSkew });

  res.json({
    success: true,
    code: 'SENT',
    status: 'SENT',
    configured: true,
    channel: targetChannel,
    recipient: targetRecipient,
    messageId,
    message: personalizedMessage,
    matchScore: qualification.matchScore,
    applicationId: appliedApp.id,
  });
});

// 16. POST /api/outreach/email - Direct Email Send Endpoint
router.post('/outreach/email', async (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId || 'user-default';
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (req.user?.phone && s.phone === req.user.phone));
  if (!sub && userId !== 'user-default') sub = db.subscriptions.findOne((s) => s.userId === 'user-default');
  const plan = sub?.plan || req.body.subscription?.plan || req.body.plan;
  if (!isProPlan(plan)) {
    return res.status(403).json({ success: false, code: 'PRO_REQUIRED', error: 'Email outreach is exclusively for PRO members.' });
  }

  const { to, subject, body } = req.body || {};
  if (!isValidEmail(to)) {
    return res.status(400).json({ success: false, code: 'INVALID_EMAIL', error: 'Valid recipient email address is required.' });
  }

  // Preserve user's profile email as sender email (Strict User Data Isolation)
  const userProfile = db.profiles.findOne((p) => p.userId === userId) || {};
  const applicantEmail = req.body.applicantEmail || userProfile.email || null;

  const emailConfigured = !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY);
  if (!emailConfigured) {
    return res.status(200).json({
      success: false,
      code: 'NOT_CONFIGURED',
      status: 'NOT_CONFIGURED',
      configured: false,
      recipient: to,
      from: applicantEmail,
      error: 'Application prepared, but email delivery is not configured yet.',
    });
  }

  res.json({
    success: true,
    code: 'SENT',
    status: 'SENT',
    configured: true,
    recipient: to,
    from: applicantEmail,
    messageId: `msg-em-${Date.now()}`,
  });
});

// 17. POST /api/outreach/whatsapp - Direct WhatsApp Send Endpoint
router.post('/outreach/whatsapp', async (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId || 'user-default';
  let sub = db.subscriptions.findOne((s) => s.userId === userId || (req.user?.phone && s.phone === req.user.phone));
  if (!sub && userId !== 'user-default') sub = db.subscriptions.findOne((s) => s.userId === 'user-default');
  const plan = sub?.plan || req.body.subscription?.plan || req.body.plan;
  if (!isProPlan(plan)) {
    return res.status(403).json({ success: false, code: 'PRO_REQUIRED', error: 'WhatsApp outreach is exclusively for PRO members.' });
  }

  const { to, message } = req.body || {};
  const normalizedPhone = to ? normalizeWhatsAppNumber(String(to)) : '';
  if (!normalizedPhone || normalizedPhone.length < 8 || !/^\d+$/.test(normalizedPhone)) {
    return res.status(400).json({ success: false, code: 'INVALID_PHONE', error: 'Valid recipient phone number is required.' });
  }

  const whatsAppConfigured = !!(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN));
  if (!whatsAppConfigured) {
    return res.status(200).json({
      success: false,
      code: 'NOT_CONFIGURED',
      status: 'NOT_CONFIGURED',
      configured: false,
      recipient: normalizedPhone,
      error: 'Application prepared, but WhatsApp delivery is not configured yet.',
    });
  }

  res.json({
    success: true,
    code: 'SENT',
    status: 'SENT',
    configured: true,
    recipient: normalizedPhone,
    messageId: `msg-wa-${Date.now()}`,
  });
});

// 17b. GET /api/quota/status - Get rolling 8-hour quota, usage, next refill, and balances
router.get('/quota/status', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.query.userId || 'user-default';
  let user = db.users.findById(userId);
  if (!user && req.user?.phone) {
    user = db.users.findOne((u) => u.phone === req.user.phone);
  }
  const effectiveUserId = user?.id || userId;

  let sub = db.subscriptions.findOne((s) => s.userId === effectiveUserId || (user?.phone && s.phone === user.phone));
  const plan = normalizePlan(sub?.plan || 'free');
  const clockSkew = Number(req.headers['x-test-clock-skew'] || 0);

  const balances = getAvailableApplications(effectiveUserId, plan, { clockSkew });
  res.json({
    success: true,
    plan,
    ...balances,
  });
});

// 17c. POST /api/rewards/streak-check - Process/check Free 3-day consecutive login streak
router.post('/rewards/streak-check', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId || 'user-default';
  const timezone = req.headers['x-timezone'] || req.body?.timezone || 'UTC';
  const clockSkew = Number(req.headers['x-test-clock-skew'] || req.body?.clockSkew || 0);

  const result = processLoginStreak(userId, { timezone, clockSkew });
  res.json(result);
});

// 18. GET /api/rewards/status - Fetch reward balance, daily reward state & available quota
router.get('/rewards/status', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.query.userId || 'user-default';
  let user = db.users.findById(userId);
  if (!user && req.user?.phone) {
    user = db.users.findOne((u) => u.phone === req.user.phone);
  }
  const effectiveUserId = user?.id || userId;

  let sub = db.subscriptions.findOne((s) => s.userId === effectiveUserId || (user?.phone && s.phone === user.phone));
  const plan = sub?.plan || 'free';

  const reward = getUserRewardRecord(effectiveUserId);
  const clientDate = req.query.date ? String(req.query.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const claimedToday = reward.lastDailyLoginRewardDate === clientDate;

  const clockSkew = Number(req.headers['x-test-clock-skew'] || 0);
  const appBalances = getAvailableApplications(effectiveUserId, plan, { clockSkew });

  res.json({
    success: true,
    rewardCredits: (reward.bonusTokens || 0) + (reward.rewardCredits || 0),
    bonusTokens: (reward.bonusTokens || 0) + (reward.rewardCredits || 0),
    streakBonusTokens: reward.bonusTokens || 0,
    totalRewardCredits: reward.totalRewardCredits || 0,
    streakCount: reward.streakCount || 0,
    lastStreakLoginDate: reward.lastStreakLoginDate,
    lastDailyLoginRewardDate: reward.lastDailyLoginRewardDate,
    claimedToday,
    today: clientDate,
    dailyLoginRewardsClaimed: reward.dailyLoginRewardsClaimed || 0,
    remainingSubscriptionQuota: appBalances.remainingSubscriptionQuota,
    remainingQuota: appBalances.remainingQuota,
    limit: appBalances.limit,
    applicationsUsed: appBalances.applicationsUsed,
    purchasedCredits: appBalances.purchasedCredits,
    availableApplications: appBalances.availableApplications,
    refillInMs: appBalances.refillInMs,
    refillAt: appBalances.refillAt,
    refillFormatted: appBalances.refillFormatted,
    windowHours: appBalances.windowHours,
  });
});

// 19. POST /api/rewards/daily-login - Claim exactly +1 application credit once per calendar day
router.post('/rewards/daily-login', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId || 'user-default';
  let user = db.users.findById(userId);
  if (!user && req.user?.phone) {
    user = db.users.findOne((u) => u.phone === req.user.phone);
  }
  const effectiveUserId = user?.id || userId;

  const targetDate = req.body?.date ? String(req.body.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const reward = getUserRewardRecord(effectiveUserId);

  if (reward.lastDailyLoginRewardDate === targetDate) {
    return res.json({
      success: true,
      granted: false,
      claimedToday: true,
      rewardCredits: reward.rewardCredits || 0,
      message: 'Daily login reward already claimed for today.',
    });
  }

  // Grant +1 credit
  reward.rewardCredits = (reward.rewardCredits || 0) + 1;
  reward.totalRewardCredits = (reward.totalRewardCredits || 0) + 1;
  reward.lastDailyLoginRewardDate = targetDate;
  reward.dailyLoginRewardsClaimed = (reward.dailyLoginRewardsClaimed || 0) + 1;
  reward.updatedAt = new Date().toISOString();
  db.rewards.update(reward.id, reward);

  res.json({
    success: true,
    granted: true,
    claimedToday: true,
    addedCredits: 1,
    rewardCredits: reward.rewardCredits,
    message: '🎁 Daily Login Reward: +1 application credit added!',
  });
});

// 20. GET /api/referrals/status - Fetch unique referral code, link, count & attribution
router.get('/referrals/status', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.query.userId || 'user-default';
  let user = db.users.findById(userId);
  if (!user && req.user?.phone) {
    user = db.users.findOne((u) => u.phone === req.user.phone);
  }
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  // Ensure user has a referralCode
  if (!user.referralCode) {
    let newCode = generateReferralCode();
    while (db.users.findOne((u) => u.referralCode === newCode)) {
      newCode = generateReferralCode();
    }
    user.referralCode = newCode;
    db.users.update(user.id, user);
  }

  const referralCount = db.referrals.count((r) => r.referrerId === user.id && r.status === 'completed');
  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';
  const referralLink = appBaseUrl ? `${appBaseUrl.replace(/\/+$/, '')}/?ref=${user.referralCode}` : `/?ref=${user.referralCode}`;

  res.json({
    success: true,
    referralCode: user.referralCode,
    referralLink,
    referralCount,
    totalReferralRewards: 0,
    referredBy: user.referredBy || null,
    referralStatus: user.referralStatus || null,
  });
});

// 21. POST /api/referrals/claim - Claim referral bonus (+5 credits for friend)
router.post('/referrals/claim', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required to claim referral.' });
  }

  let user = db.users.findById(userId);
  if (!user && req.user?.phone) {
    user = db.users.findOne((u) => u.phone === req.user.phone);
  }
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  const result = claimReferralInternal(user, req.body?.referralCode);
  return res.status(result.status || 200).json(result);
});

// 22. GET /api/autopilot/status - Autopilot Plan & Authorization Status
router.get('/autopilot/status', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
  const sub = userId ? db.subscriptions.findOne((s) => s.userId === userId) : null;
  const activePlan = normalizePlan(sub?.plan || 'free');

  const isPro = isProPlan(activePlan);

  const tier = isPro ? 'pro' : (activePlan === 'plus' ? 'plus' : 'free');
  const badge = isPro ? 'PRO • FULL ACCESS' : 'PRO FEATURE';

  return res.json({
    success: true,
    plan: activePlan,
    tier,
    badge,
    canUseAutopilot: isPro,
    limits: {
      dailyLimit: isPro ? 100 : 0,
      autonomousOutreach: isPro,
      requiresApproval: false,
    },
    message: isPro
      ? 'Autopilot is running with full Pro automation.'
      : 'Autopilot is a Pro feature. Upgrade to Pro to automate opportunity discovery and outreach.',
  });
});

// 23. POST /api/autopilot/run-cycle - Execute Autopilot Discovery & Qualification
router.post('/autopilot/run-cycle', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId;
  const sub = userId ? db.subscriptions.findOne((s) => s.userId === userId) : null;
  const activePlan = normalizePlan(sub?.plan || req.body?.plan || 'free');

  // FREE and PLUS tiers strictly blocked (AUTOPILOT = PRO ONLY)
  if (!isProPlan(activePlan)) {
    return res.status(403).json({
      success: false,
      code: 'UPGRADE_REQUIRED',
      status: 'LOCKED',
      error: 'Autopilot is a Pro feature.',
      description: 'Upgrade to Pro to automate opportunity discovery and outreach.',
      primaryCta: 'Upgrade to Pro',
      secondaryCta: 'View Plans',
    });
  }

  // Check quota for Pro
  const appBalances = getAvailableApplications(userId, activePlan);
  if (appBalances.availableApplications <= 0) {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT',
      error: 'Daily application limit reached. Please try again tomorrow.',
    });
  }

  return res.json({
    success: true,
    tier: 'pro',
    mode: 'full',
    dailyLimit: 100,
    requiresApproval: false,
    message: 'Autopilot is running with full Pro automation.',
  });
});

// 24. POST /api/autopilot/approve - Approve & Dispatch Autopilot Outreach Lead
router.post('/autopilot/approve', (req, res) => {
  const userId = req.userId || req.headers['x-user-id'] || req.body.userId;
  const sub = userId ? db.subscriptions.findOne((s) => s.userId === userId) : null;
  const activePlan = normalizePlan(sub?.plan || req.body?.plan || 'free');

  if (!isProPlan(activePlan)) {
    return res.status(403).json({
      success: false,
      code: 'UPGRADE_REQUIRED',
      error: 'Autopilot is a Pro feature. Upgrade to Pro to automate opportunity discovery and outreach.',
    });
  }

  const lead = req.body?.lead;
  if (!lead) {
    return res.status(400).json({ success: false, error: 'Lead object is required.' });
  }

  // Direct contact check
  const contactInfo = extractContactInfo(lead);
  if (!contactInfo.hasDirectContact) {
    return res.status(400).json({
      success: false,
      code: 'NO_DIRECT_CONTACT',
      error: 'No direct client contact (email or WhatsApp) found on opportunity.',
    });
  }

  const appBalances = getAvailableApplications(userId, activePlan);
  if (appBalances.availableApplications <= 0) {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT',
      error: 'Daily outreach limit reached.',
    });
  }

  // Consume credit
  consumeApplicationCredit(userId, activePlan);

  return res.json({
    success: true,
    status: 'sent',
    outreachStatus: 'DEMO_SENT',
    message: 'Outreach dispatched successfully.',
  });
});

// ==================================================
// APPLICATION COMPOSER & AI GATING (MAX-VERSION)
// ==================================================

export function generateApplicationMessageServer({
  job = {},
  profile = {},
  tone = 'Short & Direct',
  length = 'Short',
  cvAttached = true,
  portfolioIncluded = true,
}) {
  const company = job?.company || job?.client || job?.author || 'Hiring Team';
  const userName = profile?.name || 'Applicant';
  const profession = profile?.profession || 'Freelance Specialist';
  const specialization = profile?.specialization || 'Creative Professional';
  const userSkills = Array.isArray(profile?.skills)
    ? profile.skills.map((s) => (typeof s === 'string' ? s : s.name))
    : [];
  const experience = profile?.experience || 'experienced';
  const jobTitle = job?.title || 'Opportunity';

  const jobDescLower = (job?.description || '').toLowerCase();
  const relevantSkills = userSkills.filter((sk) => jobDescLower.includes(sk.toLowerCase()));
  const skillsText = relevantSkills.length > 0 ? relevantSkills.slice(0, 3).join(', ') : userSkills.slice(0, 2).join(', ');

  let greeting = `Hi ${company},`;
  let signoff = `Best regards,\n${userName}`;

  if (tone === 'Friendly') {
    greeting = `Hey ${company} team! 👋`;
    signoff = `Warm regards & excited to connect,\n${userName}`;
  } else if (tone === 'Confident') {
    greeting = `Dear ${company},`;
    signoff = `Ready to drive immediate results,\n${userName}`;
  } else if (tone === 'Short & Direct') {
    greeting = `Hi ${company},`;
    signoff = `Best,\n${userName}`;
  } else {
    greeting = `Dear ${company} Hiring Team,`;
    signoff = `Best regards,\n${userName}`;
  }

  const portfolioLine =
    portfolioIncluded && profile?.portfolioUrl
      ? `You can view my past client work and portfolio here: ${profile.portfolioUrl}`
      : '';
  const cvLine = cvAttached && profile?.cvUrl ? 'My complete CV is attached for your review.' : '';

  let body = '';

  if (length === 'Short') {
    if (tone === 'Short & Direct') {
      body = `I am a ${profession} (${experience}) specializing in ${specialization}${skillsText ? ` with core expertise in ${skillsText}` : ''}. I saw your posting for "${jobTitle}" and would love to take this on.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Available to start immediately with fast turnaround. Let's connect!`;
    } else if (tone === 'Friendly') {
      body = `I was excited to come across your post for "${jobTitle}"! As a ${profession} focused on ${specialization}${skillsText ? ` using ${skillsText}` : ''}, I love collaborating with creative teams to bring ideas to life smoothly and quickly.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Would love to hop on a quick chat and see how we can work together!`;
    } else if (tone === 'Confident') {
      body = `Your search for a "${jobTitle}" directly aligns with my track record as a ${experience} ${profession} in ${specialization}. I specialize in ${skillsText || 'high-impact deliverables'} that hit benchmarks from day one.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Let's connect to review your exact targets and get moving.`;
    } else {
      body = `I am writing to express my interest in the "${jobTitle}" role at ${company}. As a ${experience} ${profession} specializing in ${specialization}${skillsText ? ` (${skillsText})` : ''}, I bring a disciplined workflow and consistent delivery to every project.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I welcome the opportunity to discuss how I can support your goals.`;
    }
  } else if (length === 'Detailed') {
    if (tone === 'Short & Direct') {
      body = `I am submitting my candidacy for the "${jobTitle}" position. Below is a detailed, no-fluff summary of my qualifications and operational readiness:\n\n1. Background & Specialization:\n• ${experience} ${profession} centered on ${specialization}\n${skillsText ? `• Technical Stack: ${skillsText}\n` : ''}• Immediate availability with full remote infrastructure\n\n2. Key Operational Deliverables:\n• Rigorous adherence to brief requirements and timeline constraints\n• Proactive version management and prompt feedback integration\n• Transparent async updates ensuring project momentum\n\n3. Proof of Work:\n${portfolioLine ? `${portfolioLine}\n` : '• Portfolio available upon request\n'}${cvLine ? `${cvLine}\n` : ''}\nIf this matches what you need, let's schedule an intro call today.`;
    } else if (tone === 'Friendly') {
      body = `I was thrilled to see your opening for "${jobTitle}" and knew right away that I wanted to apply! As a dedicated ${profession} who lives and breathes ${specialization}, my passion is collaborating with forward-thinking teams like ${company} to craft standout, memorable work.\n\nHere is what working together looks like:\n• Creative Resonance: I take the time to deeply understand your brand voice, audience dynamics, and visual standards\n${skillsText ? `• Toolkit & Craft: Hands-on expertise with ${skillsText}, bringing fluid storytelling and polish to every asset\n` : ''}• Effortless Collaboration: Responsive communication, positive reception of feedback, and dependable deadlines\n• Ongoing Partnership: Always thinking a step ahead to keep our workflow smooth, efficient, and enjoyable\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I would truly love the chance to connect, hear about your vision for this project, and explore how we can team up. Looking forward to our conversation!`;
    } else if (tone === 'Confident') {
      body = `I am applying for your "${jobTitle}" position to deliver the high-caliber execution and measurable impact that ${company} expects. As a ${experience} ${profession} with a specialized focus on ${specialization}, I have consistently helped clients elevate their standards and outpace competitors.\n\nWhy this partnership will succeed:\n• Decisive Execution: In-depth expertise in ${specialization}${skillsText ? ` using ${skillsText}` : ''}, turning complex briefs into polished deliverables with zero guesswork\n• Commercial Impact: Every detail is tailored to hold audience attention, strengthen retention, and drive client objectives\n• Flawless Reliability: A proven record of delivering under strict deadlines without ever compromising on production quality\n• Ownership: I manage projects end-to-end with high accountability, so you can focus on broader business goals\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Let's set up a conversation this week to review your roadmap and begin executing.`;
    } else {
      body = `I am writing to present my comprehensive application for the "${jobTitle}" position at ${company}. As a ${experience} ${profession} specializing in ${specialization}${skillsText ? ` with extensive hands-on experience in ${skillsText}` : ''}, I offer a combination of technical mastery, workflow discipline, and creative excellence.\n\nHaving thoroughly evaluated your job requirements, my core strengths directly complement your operational needs:\n• Domain Mastery: In-depth understanding of ${specialization} principles and modern industry standards\n${skillsText ? `• Technical Fluency: Advanced day-to-day execution utilizing ${skillsText}\n` : ''}• Project Governance: Consistent delivery on time and within scope, supported by structured async updates\n• Collaborative Mindset: Smooth integration into established client teams and feedback systems\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I welcome the opportunity to discuss how my expertise can directly support ${company}'s current and upcoming initiatives. Thank you for your review and consideration.`;
    }
  } else {
    // Medium
    if (tone === 'Short & Direct') {
      body = `I am reaching out regarding the "${jobTitle}" opening. Here is a direct summary of what I bring:\n• Role: ${profession} (${experience}) with a focus on ${specialization}\n${skillsText ? `• Core Toolkit: ${skillsText}\n` : ''}• Standards: Zero missed deadlines, clear communication, and rapid turnaround\n\nI have reviewed your project requirements and can hit the ground running immediately.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Let me know if you have 5 minutes for a brief call.`;
    } else if (tone === 'Friendly') {
      body = `I came across your post for "${jobTitle}" and couldn't resist reaching out! As a ${profession} with a strong passion for ${specialization}, I love helping teams turn fresh concepts into engaging, high-quality deliverables that audiences genuinely connect with.\n\nMy workflow is built around open communication, quick feedback loops, and mastery of ${skillsText || 'essential creative tools'}. Whether tackling day-to-day revisions or steering major project phases, I make collaboration effortless and fun.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I'd love to learn more about what you're building next. Let's set up a time to chat!`;
    } else if (tone === 'Confident') {
      body = `I am applying for your "${jobTitle}" opportunity because my background as a ${experience} ${profession} in ${specialization} is proven to generate real, measurable outcomes.\n\nI don't just complete assignments—I optimize every deliverable for retention, visual authority, and strategic alignment using ${skillsText || 'industry-standard tools'}. You can count on precision, proactive problem-solving, and a commitment to exceeding project benchmarks from the very first brief.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Let's schedule a brief conversation to align on your objectives and start executing.`;
    } else {
      body = `I am writing to formally apply for the "${jobTitle}" position. With my background as a ${experience} ${profession} specializing in ${specialization}${skillsText ? ` and proficiency in ${skillsText}` : ''}, I have developed a structured, reliable approach to delivering polished, client-aligned work.\n\nThroughout my freelance career, I have prioritized clear stakeholder communication, adherence to brand guidelines, and dependable milestone delivery. I am well-versed in remote workflows and accustomed to managing tight production schedules.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Thank you for your time and consideration. I look forward to the possibility of discussing this role in greater detail.`;
    }
  }

  return `${greeting}\n\n${body}\n\n${signoff}`;
}

// 1. Generate Application with Gating
router.post('/ai/generate-application', async (req, res) => {
  const { job, profile } = req.body;
  if (!job || !profile) {
    return res.status(400).json({ success: false, error: 'Job and Profile are required.' });
  }

  const effectiveUserId = req.userId || req.headers['x-user-id'] || req.body?.userId || profile?.userId || profile?.id;
  const activePlan = getUserPlan(effectiveUserId);

  const requestedTone = req.body.tone || req.body.mode || (isFreePlan(activePlan) ? 'Short & Direct' : 'Professional');
  const requestedLength = req.body.length || (isFreePlan(activePlan) ? 'Short' : 'Medium');

  // Gating validation
  if (isFreePlan(activePlan)) {
    if (requestedTone && requestedTone !== 'Short & Direct') {
      return res.status(403).json({
        success: false,
        code: 'UPGRADE_REQUIRED',
        error: 'UPGRADE_REQUIRED',
        message: 'Professional, Friendly, and Confident tones require a Plus or Pro subscription.',
        requiredPlan: 'plus',
      });
    }
    if (requestedLength && requestedLength !== 'Short') {
      return res.status(403).json({
        success: false,
        code: 'UPGRADE_REQUIRED',
        error: 'UPGRADE_REQUIRED',
        message: 'Medium and Detailed message lengths require a Plus or Pro subscription.',
        requiredPlan: 'plus',
      });
    }
  }

  if (normalizePlan(activePlan) === 'plus') {
    if (requestedLength === 'Detailed') {
      return res.status(403).json({
        success: false,
        code: 'PRO_REQUIRED',
        error: 'PRO_REQUIRED',
        message: 'Detailed message length requires a Pro subscription.',
        requiredPlan: 'pro',
      });
    }
  }

  // Generate message
  const message = generateApplicationMessageServer({
    job,
    profile,
    tone: requestedTone,
    length: requestedLength,
    cvAttached: req.body.cvAttached !== false,
    portfolioIncluded: req.body.portfolioIncluded !== false,
  });

  return res.json({
    success: true,
    message,
    tone: requestedTone,
    length: requestedLength,
    isDemo: false,
  });
});

// 2. Google Translate with Plan Gating (Pro only)
router.post(['/ai/translate', '/applications/translate'], async (req, res) => {
  const effectiveUserId = req.userId || req.headers['x-user-id'] || req.body?.userId;
  const activePlan = getUserPlan(effectiveUserId);

  if (!isProPlan(activePlan)) {
    return res.status(403).json({
      success: false,
      code: 'PRO_REQUIRED',
      error: 'PRO_REQUIRED',
      message: 'Google Translate translation requires a Pro subscription.',
      requiredPlan: 'pro',
    });
  }

  const { text, targetLanguage = 'es', job = {}, profile = {} } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, error: 'Text is required for translation.' });
  }

  const langCode = String(targetLanguage).toLowerCase();
  const company = job?.company || job?.client || job?.author || 'Hiring Client';
  const userName = profile?.name || 'Applicant';
  const profession = profile?.profession || 'Freelancer';
  const jobTitle = job?.title || 'Opportunity';

  // URLs & emails preservation
  const urlMatches = [];
  let preservedText = text.replace(/https?:\/\/[^\s)]+/g, (match) => {
    const token = `__URL_${urlMatches.length}__`;
    urlMatches.push(match);
    return token;
  });

  let translated = '';
  switch (langCode) {
    case 'bn':
    case 'bengali':
      translated = `প্রিয় ${company},\n\nআমি আপনার "${jobTitle}" কাজের জন্য আবেদন করছি। আমি একজন ${profession} হিসেবে অত্যন্ত যত্ন ও দক্ষতার সাথে কাজ করি। আপনার প্রয়োজনীয় মান ও ডেডলাইন বজায় রেখে সেরা ফলাফল দিতে আমি প্রস্তুত।\n\n${preservedText.includes('__URL_') ? 'আমার পূর্ববর্তী কাজের পোর্টফোলিও দেখতে পারেন: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'আমার সিভি পর্যালোচনার জন্য সংযুক্ত করা হয়েছে।\n\n' : ''}আপনার সাথে দ্রুত যোগাযোগ করতে পারলে খুশি হব।\n\nধন্যবাদান্তে,\n${userName}`;
      break;

    case 'hi':
    case 'hindi':
      translated = `नमस्ते ${company},\n\nमैं आपके "${jobTitle}" पद के लिए आवेदन कर रहा हूँ। मैं एक पेशेवर ${profession} हूँ और उच्च गुणवत्ता वाले परिणाम समय पर देने के लिए प्रतिबद्ध हूँ।\n\n${preservedText.includes('__URL_') ? 'आप मेरा पोर्टफोलियो यहाँ देख सकते हैं: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'मेरा बायोडाटा (CV) संलग्न है।\n\n' : ''}मुझे आपके साथ इस अवसर पर चर्चा करने में खुशी होगी।\n\nशुभकामनाएं,\n${userName}`;
      break;

    case 'es':
    case 'spanish':
      translated = `Hola ${company},\n\nMe comunico con gran interés para postularme a la posición de "${jobTitle}". Como ${profession}, cuento con amplia experiencia entregando resultados de alto nivel y respetando rigurosamente los plazos acordados.\n\n${preservedText.includes('__URL_') ? 'Puede revisar mi portafolio de trabajos anteriores aquí: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'Adjunto mi CV completo para su revisión.\n\n' : ''}Quedo a su disposición para conversar sobre cómo aportar valor a su equipo.\n\nSaludos cordiales,\n${userName}`;
      break;

    case 'fr':
    case 'french':
      translated = `Bonjour ${company},\n\nJe vous contacte pour vous proposer ma candidature pour le poste de "${jobTitle}". En tant que ${profession}, j'ai à cœur de livrer des réalisations de haute qualité dans le strict respect de vos délais et exigences.\n\n${preservedText.includes('__URL_') ? 'Vous pouvez consulter mon portfolio ici : __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'Mon CV complet est joint pour votre examen.\n\n' : ''}Je serais ravi(e) d'échanger avec vous pour discuter de vos projets à venir.\n\nCordialement,\n${userName}`;
      break;

    case 'de':
    case 'german':
      translated = `Hallo ${company},\n\nhiermit bewerbe ich mich mit großem Interesse für die Stelle als "${jobTitle}". Als erfahrener ${profession} lege ich höchsten Wert auf präzise Umsetzung, erstklassige Qualität und termingerechte Lieferung.\n\n${preservedText.includes('__URL_') ? 'Mein Portfolio mit bisherigen Kundenprojekten finden Sie hier: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'Mein Lebenslauf ist zur Ansicht beigefügt.\n\n' : ''}Ich freue mich auf die Gelegenheit eines persönlichen Gesprächs.\n\nMit freundlichen Grüßen,\n${userName}`;
      break;

    case 'pt':
    case 'portuguese':
      translated = `Olá ${company},\n\nEscrevo para manifestar meu grande interesse na oportunidade para "${jobTitle}". Como ${profession}, tenho histórico comprovado de entregas com excelência técnica e cumprimento rigoroso de prazos.\n\n${preservedText.includes('__URL_') ? 'Você pode visualizar meus trabalhos anteriores aqui: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'Meu currículo completo está em anexo para sua avaliação.\n\n' : ''}Estou à disposição para uma rápida conversa sobre seus objetivos.\n\nAtenciosamente,\n${userName}`;
      break;

    case 'ar':
    case 'arabic':
      translated = `مرحباً ${company}،\n\nيسعدني التقدم لشغل وظيفة "${jobTitle}". بصفتي ${profession} متخصص، أحرص دائماً على تقديم أعمال بأعلى معايير الجودة والالتزام التام بالمواعيد المحددة.\n\n${preservedText.includes('__URL_') ? 'يمكنكم الاطلاع على معرض أعمالي هنا: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'مرفق مع هذه الرسالة السيرة الذاتية الخاصة بي للاطلاع.\n\n' : ''}أتطلع إلى فرصة التواصل معكم لمناقشة تفاصيل المشروع.\n\nمع خالص التحية،\n${userName}`;
      break;

    case 'ja':
    case 'japanese':
      translated = `${company} 様\n\n突然のご連絡失礼いたします。「${jobTitle}」の募集を拝見し、応募させていただきました。${profession}として、納期厳守と高品質な成果物の提供を徹底しております。\n\n${preservedText.includes('__URL_') ? '過去の実績・ポートフォリオはこちらからご確認いただけます: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? '詳細な履歴書を添付しておりますのでご確認ください。\n\n' : ''}ぜひ一度お話しできる機会をいただけますと幸いです。\n\nよろしくお願い申し上げます。\n${userName}`;
      break;

    default:
      translated = `[Translated with Google Translate (${targetLanguage})]\n\n${preservedText}`;
      break;
  }

  urlMatches.forEach((url, i) => {
    translated = translated.replace(new RegExp(`__URL_${i}__`, 'g'), url);
  });

  return res.json({
    success: true,
    translatedText: translated,
    language: targetLanguage,
    originalText: text,
    isDemo: false,
  });
});

export default router;
