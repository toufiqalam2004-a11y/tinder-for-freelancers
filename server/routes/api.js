import express from 'express';
import { db } from '../database.js';
import { redditService } from '../services/redditService.js';
import { youtubeService } from '../services/youtubeService.js';
import { xService } from '../services/xService.js';
import { aiService } from '../services/aiService.js';

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

// User Context Middleware: Extracts user from header in dev / token
function extractUser(req, res, next) {
  req.userId = req.headers['x-user-id'] || 'user-default';
  next();
}

router.use(extractUser);

// Centralized Pipeline Ingestion Handler
async function processRawPostsToJobs(posts, source, userProfile, ownerId) {
  const existingJobs = db.jobs.findAll();
  const createdJobs = [];

  for (const p of posts) {
    const isDup = existingJobs.some(
      (j) => (j.postId && j.postId === p.postId) || (j.sourceUrl && j.sourceUrl === p.postUrl)
    );
    if (isDup) continue;

    const newJob = {
      id: job--,
      userId: ownerId,
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
      matchScore: 85,
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

// 1. GET /api/sources - List user's sources (scoped by user ID)
router.get('/sources', (req, res) => {
  const sources = db.sources.findAll((s) => !s.userId || s.userId === req.userId);
  res.json({ success: true, sources });
});

// 2. POST /api/sources - Add or update source with input validation
router.post('/sources', (req, res) => {
  const source = req.body;
  if (!source || !source.id || typeof source.id !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid source ID is required.' });
  }

  const validPlatforms = ['reddit', 'youtube', 'x', 'facebook_group', 'manual_import'];
  if (source.platform && !validPlatforms.includes(source.platform)) {
    return res.status(400).json({ success: false, error: 'Invalid source platform.' });
  }

  if (source.url && !isSafeUrl(source.url)) {
    return res.status(400).json({ success: false, error: 'Unsafe or invalid source URL provided.' });
  }

  const sanitized = {
    ...source,
    id: sanitizeString(source.id, 80),
    name: sanitizeString(source.name, 100),
    userId: req.userId,
    updatedAt: new Date().toISOString(),
  };

  const saved = db.sources.insert(sanitized);
  res.json({ success: true, source: saved });
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

// 4. GET /api/jobs - List feed jobs (scoped to user/public)
router.get('/jobs', (req, res) => {
  const jobs = db.jobs.findAll((j) => !j.userId || j.userId === req.userId);
  res.json({ success: true, jobs });
});

const PROTECTED_APP_STATUSES = ['interview', 'shortlisted', 'negotiation', 'hired'];

export function performServerAutoDelete(userId) {
  if (!userId) return 0;
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
  const applications = db.applications.findAll((a) => !a.userId || a.userId === req.userId);
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

  const sanitized = {
    ...app,
    id: sanitizeString(app.id, 80),
    title: sanitizeString(app.title, 200),
    company: sanitizeString(app.company, 100),
    message: sanitizeString(app.message, 4000),
    userId: req.userId,
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

  const saved = db.profiles.insert({
    ...profile,
    userId: req.userId,
    id: profile.id || `prof-${req.userId}`,
    updatedAt: new Date().toISOString(),
  });

  res.json({ success: true, profile: saved });
});

// 10. GET /api/subscription - Get user subscription
router.get('/subscription', (req, res) => {
  let sub = db.subscriptions.findOne((s) => s.userId === req.userId);
  if (!sub) {
    sub = {
      id: `sub-${req.userId}`,
      userId: req.userId,
      plan: 'free',
      status: 'active',
      currency: 'INR',
      price: 0,
      startDate: new Date().toISOString(),
      endDate: null,
      credits: [],
      isDemo: true,
      updatedAt: new Date().toISOString(),
    };
    db.subscriptions.insert(sub);
  }
  res.json({ success: true, subscription: sub });
});

// 11. POST /api/subscription/demo-checkout - Simulate plan upgrade
router.post('/subscription/demo-checkout', (req, res) => {
  const { planId = 'free', currency = 'INR', durationDays = 30 } = req.body;
  const validPlans = ['free', 'plus', 'pro'];
  if (!validPlans.includes(planId)) {
    return res.status(400).json({ success: false, error: 'Invalid plan ID.' });
  }

  const prices = {
    free: { INR: 0, USD: 0 },
    plus: { INR: 299, USD: 4.99 },
    pro: { INR: 899, USD: 9.99 },
  };

  const now = new Date();
  const endDate = planId === 'free' ? null : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  let existing = db.subscriptions.findOne((s) => s.userId === req.userId) || {
    id: `sub-${req.userId}`,
    userId: req.userId,
    credits: [],
  };

  const updated = {
    ...existing,
    plan: planId,
    status: 'active',
    currency,
    price: prices[planId]?.[currency] || 0,
    startDate: now.toISOString(),
    endDate,
    isDemo: true,
    updatedAt: now.toISOString(),
  };

  db.subscriptions.insert(updated);
  res.json({ success: true, subscription: updated, transactionId: `txn_srv_${Date.now()}` });
});

// 12. POST /api/credits/demo-buy - Simulate purchasing credits
router.post('/credits/demo-buy', (req, res) => {
  const { packageId = 'credits_20', amount = 20, price = 49, currency = 'INR' } = req.body;
  let sub = db.subscriptions.findOne((s) => s.userId === req.userId) || {
    id: `sub-${req.userId}`,
    userId: req.userId,
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

  res.json({ success: true, credit: newCredit, totalCredits: sub.credits.reduce((acc, c) => acc + c.remaining, 0) });
});

// 13. GET /api/usage/today - Get user daily usage
router.get('/usage/today', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  let usage = db.dailyUsage.findOne((u) => u.userId === req.userId && u.date === today);
  if (!usage) {
    usage = {
      id: `usage-${req.userId}-${today}`,
      userId: req.userId,
      date: today,
      applicationsUsed: 0,
      aiApplyUsed: 0,
    };
  }
  res.json({ success: true, usage });
});

export default router;
